// Enhanced Authentication Service with Security Features
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../types';
import { executeQuery, executeQueryAll, executeUpdate } from '../database/sqlite';
import { secureUserDataService } from './secureUserDataService';
import { enhancedDb } from '../lib/database';
import { security } from '../lib/security';
import { validator } from '../lib/validation';
import { errorHandler } from '../lib/errorHandler';
import { logger } from '../lib/logger';
import { SECURITY_CONFIG, ERROR_CODES } from '../config/constants';

interface AuthResult {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

class SecureAuthService {
  private currentUser: User | null = null;
  private token: string | null = null;
  private refreshTokenInterval: NodeJS.Timeout | null = null;

  async register(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<AuthResult> {
    try {
      // Validate user data
      const validation = validator.validateUser(userData);
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const sanitizedData = validation.sanitizedValue;

      // Check if user already exists
      const existingUser = await this.getUserByEmail(sanitizedData.email);
      if (existingUser) {
        security.logSecurityEvent('REGISTRATION_ATTEMPT_DUPLICATE_EMAIL', { email: sanitizedData.email });
        return { 
          success: false, 
          message: 'User already exists with this email' 
        };
      }

      // Validate password strength
      if (!this.validatePasswordStrength(userData.password)) {
        return { 
          success: false, 
          message: `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long and contain uppercase, lowercase, number, and special character` 
        };
      }

      // Hash password with high cost factor
      const hashedPassword = await bcrypt.hash(userData.password, 14);
      
      const userId = uuidv4();
      const now = Date.now();

      const query = `
        INSERT INTO users (
          id, email, password, business_name, contact_person, phone, secondary_phone,
          website, business_reg_number, tax_id, business_type, address, city, state,
          zip_code, country, billing_address, bank_name, bank_branch, account_number,
          swift_code, payment_terms, accepted_payment_methods, logo_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await executeUpdate(query, [
        userId,
        sanitizedData.email,
        hashedPassword,
        sanitizedData.businessName,
        sanitizedData.contactPerson,
        sanitizedData.phone,
        sanitizedData.secondaryPhone || null,
        sanitizedData.website || null,
        sanitizedData.businessRegNumber || null,
        sanitizedData.taxId || null,
        sanitizedData.businessType || null,
        sanitizedData.address,
        sanitizedData.city,
        sanitizedData.state,
        sanitizedData.zipCode,
        sanitizedData.country,
        sanitizedData.billingAddress || null,
        sanitizedData.bankName || null,
        sanitizedData.bankBranch || null,
        sanitizedData.accountNumber || null,
        sanitizedData.swiftCode || null,
        sanitizedData.paymentTerms || null,
        JSON.stringify(sanitizedData.acceptedPaymentMethods || []),
        sanitizedData.logoUrl || null,
        now,
        now
      ]);

      // Initialize user's database
      await this.initializeUserDatabase(userId);

      const user = await this.getUserById(userId);
      
      // Log registration
      await this.logAuditEvent(userId, 'USER_REGISTERED', 'users', userId, null, { email: sanitizedData.email });
      
      logger.info('User registered successfully', { userId, email: sanitizedData.email });
      
      return { 
        success: true, 
        message: 'Registration successful', 
        user 
      };
    } catch (error) {
      logger.error('Registration error', error);
      return { 
        success: false, 
        message: 'Registration failed' 
      };
    }
  }

  async login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResult> {
    try {
      const sanitizedEmail = security.sanitizeInput(email.toLowerCase());
      
      // Check rate limiting
      if (!security.checkLoginAttempts(sanitizedEmail)) {
        security.logSecurityEvent('LOGIN_RATE_LIMITED', { email: sanitizedEmail });
        return { 
          success: false, 
          message: 'Too many login attempts. Please try again later.' 
        };
      }

      const user = await this.getUserByEmail(sanitizedEmail);
      if (!user) {
        await this.logFailedLogin(sanitizedEmail, 'User not found');
        return { 
          success: false, 
          message: 'Invalid email or password' 
        };
      }

      const userData = await this.getUserWithPassword(sanitizedEmail);
      if (!userData || !await bcrypt.compare(password, userData.password)) {
        await this.logFailedLogin(sanitizedEmail, 'Invalid password');
        return { 
          success: false, 
          message: 'Invalid email or password' 
        };
      }

      // Reset login attempts on successful login
      security.resetLoginAttempts(sanitizedEmail);

      // Create session token
      const token = await this.createAuthToken(user.id, rememberMe);
      
      // Set current user context
      this.currentUser = user;
      this.token = token;
      secureUserDataService.setCurrentUser(user.id);

      // Store in localStorage with encryption
      const authData = {
        token,
        userId: user.id,
        rememberMe,
        loginTime: Date.now()
      };
      
      const encryptedAuthData = await security.encryptData(JSON.stringify(authData));
      const encryptedUserData = await security.encryptData(JSON.stringify(user));
      
      localStorage.setItem('auth_data', encryptedAuthData);
      localStorage.setItem('user_data', encryptedUserData);

      // Set up token refresh for long-lived tokens
      if (rememberMe) {
        this.setupTokenRefresh(token);
      }

      // Log successful login
      await this.logAuditEvent(user.id, 'USER_LOGIN', 'users', user.id, null, { loginTime: Date.now() });

      logger.info('User logged in successfully', { userId: user.id, email: sanitizedEmail });

      return { 
        success: true, 
        message: 'Login successful', 
        user, 
        token 
      };
    } catch (error) {
      logger.error('Login error', error);
      return { 
        success: false, 
        message: 'Login failed' 
      };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.currentUser && this.token) {
        // Invalidate token
        await this.invalidateToken(this.token);
        
        // Log logout
        await this.logAuditEvent(this.currentUser.id, 'USER_LOGOUT', 'users', this.currentUser.id, null, { logoutTime: Date.now() });
        
        logger.info('User logged out successfully', { userId: this.currentUser.id });
      }
      
      // Clear refresh interval
      if (this.refreshTokenInterval) {
        clearInterval(this.refreshTokenInterval);
        this.refreshTokenInterval = null;
      }
      
      // Clear context
      this.currentUser = null;
      this.token = null;
      secureUserDataService.clearCurrentUser();
      
      // Clear storage
      localStorage.removeItem('auth_data');
      localStorage.removeItem('user_data');
      
    } catch (error) {
      logger.error('Logout error', error);
    }
  }

  async validateSession(token?: string): Promise<User | null> {
    try {
      const authToken = token || await this.getStoredToken();
      if (!authToken) return null;

      const session = await executeQuery(
        'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
        [authToken, Date.now()]
      );

      if (!session || !session.user_id) {
        await this.clearInvalidSession();
        return null;
      }

      const user = await this.getUserById(session.user_id as string);
      if (user) {
        this.currentUser = user;
        this.token = authToken;
        secureUserDataService.setCurrentUser(user.id);
        
        // Refresh token if it's close to expiry
        await this.refreshTokenIfNeeded(authToken);
      }

      return user;
    } catch (error) {
      logger.error('Session validation error', error);
      await this.clearInvalidSession();
      return null;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    const authToken = await this.getStoredToken();
    if (authToken) {
      return await this.validateSession(authToken);
    }

    return null;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<AuthResult> {
    try {
      const sanitizedUserId = security.sanitizeInput(userId);
      
      // Validate updates
      const validation = validator.validateUser({ ...updates, id: userId });
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          const sanitizedValue = typeof value === 'string' ? security.sanitizeInput(value) : value;
          values.push(typeof sanitizedValue === 'object' ? JSON.stringify(sanitizedValue) : sanitizedValue);
        }
      });

      if (setClause.length === 0) {
        return { 
          success: false, 
          message: 'No valid updates provided' 
        };
      }

      values.push(Date.now()); // updated_at
      values.push(sanitizedUserId);

      const query = `UPDATE users SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await executeUpdate(query, values);

      const user = await this.getUserById(sanitizedUserId);
      if (user) {
        this.currentUser = user;
        const encryptedUserData = await security.encryptData(JSON.stringify(user));
        localStorage.setItem('user_data', encryptedUserData);
        
        // Log profile update
        await this.logAuditEvent(sanitizedUserId, 'PROFILE_UPDATED', 'users', sanitizedUserId, null, updates);
        
        logger.info('Profile updated successfully', { userId: sanitizedUserId });
      }

      return { 
        success: true, 
        message: 'Profile updated successfully', 
        user 
      };
    } catch (error) {
      logger.error('Update profile error', error);
      return { 
        success: false, 
        message: 'Failed to update profile' 
      };
    }
  }

  private validatePasswordStrength(password: string): boolean {
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) return false;
    
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
  }

  private async createAuthToken(userId: string, isLongLived: boolean): Promise<string> {
    const token = security.generateSecureToken();
    const expiresAt = isLongLived 
      ? Date.now() + SECURITY_CONFIG.LONG_SESSION_TIMEOUT
      : Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT;

    await executeUpdate(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), userId, token, expiresAt, Date.now()]
    );

    return token;
  }

  private async invalidateToken(token: string): Promise<void> {
    await executeUpdate('DELETE FROM sessions WHERE token = ?', [token]);
  }

  private async refreshTokenIfNeeded(token: string): Promise<void> {
    const session = await executeQuery(
      'SELECT * FROM sessions WHERE token = ?',
      [token]
    );

    if (session) {
      const timeUntilExpiry = session.expires_at - Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;

      // Refresh if less than 1 day remaining
      if (timeUntilExpiry < oneDayInMs) {
        const newExpiresAt = Date.now() + SECURITY_CONFIG.LONG_SESSION_TIMEOUT;
        await executeUpdate(
          'UPDATE sessions SET expires_at = ? WHERE token = ?',
          [newExpiresAt, token]
        );
      }
    }
  }

  private setupTokenRefresh(token: string): void {
    // Check token every hour
    this.refreshTokenInterval = setInterval(async () => {
      await this.refreshTokenIfNeeded(token);
    }, 60 * 60 * 1000);
  }

  private async getStoredToken(): Promise<string | null> {
    try {
      const authData = localStorage.getItem('auth_data');
      if (authData) {
        const decrypted = await security.decryptData(authData);
        const parsed = JSON.parse(decrypted);
        return parsed.token;
      }
    } catch (error) {
      logger.error('Error getting stored token', error);
    }
    return null;
  }

  private async clearInvalidSession(): Promise<void> {
    localStorage.removeItem('auth_data');
    localStorage.removeItem('user_data');
    this.currentUser = null;
    this.token = null;
    secureUserDataService.clearCurrentUser();
  }

  private async initializeUserDatabase(userId: string): Promise<void> {
    try {
      // This will create the user's database if it doesn't exist
      await enhancedDb.getUserDatabase(userId);
      logger.info('User database initialized', { userId });
    } catch (error) {
      logger.error('Error initializing user database', error, { userId });
    }
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await executeQuery(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (!result || !result.id) return null;
      return this.mapUserFromDb(result);
    } catch (error) {
      logger.error('Get user by email error', error);
      return null;
    }
  }

  private async getUserWithPassword(email: string): Promise<any> {
    try {
      return await executeQuery(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
    } catch (error) {
      logger.error('Get user with password error', error);
      return null;
    }
  }

  private async getUserById(id: string): Promise<User | null> {
    try {
      const result = await executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );

      if (!result || !result.id) return null;
      return this.mapUserFromDb(result);
    } catch (error) {
      logger.error('Get user by ID error', error);
      return null;
    }
  }

  private mapUserFromDb(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      businessName: dbUser.business_name,
      contactPerson: dbUser.contact_person,
      phone: dbUser.phone,
      secondaryPhone: dbUser.secondary_phone,
      website: dbUser.website,
      businessRegNumber: dbUser.business_reg_number,
      taxId: dbUser.tax_id,
      businessType: dbUser.business_type,
      address: dbUser.address || '',
      city: dbUser.city || '',
      state: dbUser.state || '',
      zipCode: dbUser.zip_code || '',
      country: dbUser.country || '',
      billingAddress: dbUser.billing_address,
      bankName: dbUser.bank_name,
      bankBranch: dbUser.bank_branch,
      accountNumber: dbUser.account_number,
      swiftCode: dbUser.swift_code,
      paymentTerms: dbUser.payment_terms,
      acceptedPaymentMethods: dbUser.accepted_payment_methods ? JSON.parse(dbUser.accepted_payment_methods) : [],
      logoUrl: dbUser.logo_url,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  private async logAuditEvent(userId: string, action: string, tableName: string, recordId: string, oldValues: any, newValues: any): Promise<void> {
    try {
      await executeUpdate(
        'INSERT INTO audit_log (id, user_id, action, table_name, record_id, old_values, new_values, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          uuidv4(),
          userId,
          action,
          tableName,
          recordId,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          Date.now()
        ]
      );
    } catch (error) {
      logger.error('Error logging audit event', error);
    }
  }

  private async logFailedLogin(email: string, reason: string): Promise<void> {
    try {
      await executeUpdate(
        'INSERT INTO audit_log (id, action, table_name, record_id, old_values, new_values, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          uuidv4(),
          'LOGIN_FAILED',
          'users',
          email,
          null,
          JSON.stringify({ reason, timestamp: Date.now() }),
          Date.now()
        ]
      );
    } catch (error) {
      logger.error('Error logging failed login', error);
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await executeUpdate('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    } catch (error) {
      logger.error('Cleanup sessions error', error);
    }
  }

  async getActiveSessionsCount(userId: string): Promise<number> {
    try {
      const result = await executeQuery(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND expires_at > ?',
        [userId, Date.now()]
      );
      return result?.count || 0;
    } catch (error) {
      logger.error('Error getting active sessions count', error);
      return 0;
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await executeUpdate('DELETE FROM sessions WHERE user_id = ?', [userId]);
      logger.info('All sessions revoked', { userId });
    } catch (error) {
      logger.error('Error revoking all sessions', error);
    }
  }
}

export const secureAuthService = new SecureAuthService();
export default secureAuthService;