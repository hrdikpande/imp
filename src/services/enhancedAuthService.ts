import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, AuthState } from '../types';
import { executeQuery, executeQueryAll, executeUpdate } from '../database/sqlite';
import { userDataService } from './userDataService';
import { multiTenantDb } from '../database/multiTenantDb';

interface AuthToken {
  token: string;
  userId: string;
  expiresAt: number;
  isLongLived: boolean;
}

class EnhancedAuthService {
  private currentUser: User | null = null;
  private token: string | null = null;
  private refreshTokenInterval: NodeJS.Timeout | null = null;

  async register(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        return { success: false, message: 'User already exists with this email' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
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
        userId, userData.email, hashedPassword, userData.businessName, userData.contactPerson,
        userData.phone, userData.secondaryPhone || null, userData.website || null,
        userData.businessRegNumber || null, userData.taxId || null, userData.businessType || null,
        userData.address, userData.city, userData.state, userData.zipCode, userData.country,
        userData.billingAddress || null, userData.bankName || null, userData.bankBranch || null,
        userData.accountNumber || null, userData.swiftCode || null, userData.paymentTerms || null,
        JSON.stringify(userData.acceptedPaymentMethods || []), userData.logoUrl || null, now, now
      ]);

      // Initialize user's database
      await this.initializeUserDatabase(userId);

      const user = await this.getUserById(userId);
      
      // Log registration
      await this.logAuditEvent(userId, 'USER_REGISTERED', 'users', userId, null, user);
      
      return { success: true, message: 'Registration successful', user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  }

  async login(email: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        await this.logFailedLogin(email, 'User not found');
        return { success: false, message: 'Invalid email or password' };
      }

      const userData = await this.getUserWithPassword(email);
      if (!userData || !await bcrypt.compare(password, userData.password)) {
        await this.logFailedLogin(email, 'Invalid password');
        return { success: false, message: 'Invalid email or password' };
      }

      // Create session token
      const token = await this.createAuthToken(user.id, rememberMe);
      
      // Set current user context
      this.currentUser = user;
      this.token = token;
      userDataService.setCurrentUser(user.id);

      // Store in localStorage with encryption
      const authData = {
        token,
        userId: user.id,
        rememberMe,
        loginTime: Date.now()
      };
      
      localStorage.setItem('auth_data', this.encryptData(JSON.stringify(authData)));
      localStorage.setItem('user_data', this.encryptData(JSON.stringify(user)));

      // Set up token refresh for long-lived tokens
      if (rememberMe) {
        this.setupTokenRefresh(token);
      }

      // Log successful login
      await this.logAuditEvent(user.id, 'USER_LOGIN', 'users', user.id, null, { loginTime: Date.now() });

      return { success: true, message: 'Login successful', user, token };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.currentUser && this.token) {
        // Invalidate token
        await this.invalidateToken(this.token);
        
        // Log logout
        await this.logAuditEvent(this.currentUser.id, 'USER_LOGOUT', 'users', this.currentUser.id, null, { logoutTime: Date.now() });
      }
      
      // Clear refresh interval
      if (this.refreshTokenInterval) {
        clearInterval(this.refreshTokenInterval);
        this.refreshTokenInterval = null;
      }
      
      // Clear context
      this.currentUser = null;
      this.token = null;
      userDataService.clearCurrentUser();
      
      // Clear storage
      localStorage.removeItem('auth_data');
      localStorage.removeItem('user_data');
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async validateSession(token?: string): Promise<User | null> {
    try {
      const authToken = token || this.getStoredToken();
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
        userDataService.setCurrentUser(user.id);
        
        // Refresh token if it's close to expiry
        await this.refreshTokenIfNeeded(authToken);
      }

      return user;
    } catch (error) {
      console.error('Session validation error:', error);
      await this.clearInvalidSession();
      return null;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    const authToken = this.getStoredToken();
    if (authToken) {
      return await this.validateSession(authToken);
    }

    return null;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });

      if (setClause.length === 0) {
        return { success: false, message: 'No valid updates provided' };
      }

      values.push(Date.now()); // updated_at
      values.push(userId);

      const query = `UPDATE users SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await executeUpdate(query, values);

      const user = await this.getUserById(userId);
      if (user) {
        this.currentUser = user;
        localStorage.setItem('user_data', this.encryptData(JSON.stringify(user)));
        
        // Log profile update
        await this.logAuditEvent(userId, 'PROFILE_UPDATED', 'users', userId, null, updates);
      }

      return { success: true, message: 'Profile updated successfully', user };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, message: 'Failed to update profile' };
    }
  }

  private async createAuthToken(userId: string, isLongLived: boolean): Promise<string> {
    const token = uuidv4() + '-' + Date.now();
    const expiresAt = isLongLived 
      ? Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      : Date.now() + (24 * 60 * 60 * 1000); // 1 day

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
        const newExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // Extend by 30 days
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

  private getStoredToken(): string | null {
    try {
      const authData = localStorage.getItem('auth_data');
      if (authData) {
        const decrypted = this.decryptData(authData);
        const parsed = JSON.parse(decrypted);
        return parsed.token;
      }
    } catch (error) {
      console.error('Error getting stored token:', error);
    }
    return null;
  }

  private async clearInvalidSession(): Promise<void> {
    localStorage.removeItem('auth_data');
    localStorage.removeItem('user_data');
    this.currentUser = null;
    this.token = null;
    userDataService.clearCurrentUser();
  }

  private async initializeUserDatabase(userId: string): Promise<void> {
    try {
      // This will create the user's database if it doesn't exist
      await multiTenantDb.getUserDatabase(userId);
      console.log(`Initialized database for user: ${userId}`);
    } catch (error) {
      console.error('Error initializing user database:', error);
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
      console.error('Get user by email error:', error);
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
      console.error('Get user with password error:', error);
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
      console.error('Get user by ID error:', error);
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
      console.error('Error logging audit event:', error);
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
      console.error('Error logging failed login:', error);
    }
  }

  private encryptData(data: string): string {
    // Simple base64 encoding for demo - in production use proper encryption
    return btoa(data);
  }

  private decryptData(encryptedData: string): string {
    // Simple base64 decoding for demo - in production use proper decryption
    return atob(encryptedData);
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await executeUpdate('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    } catch (error) {
      console.error('Cleanup sessions error:', error);
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
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await executeUpdate('DELETE FROM sessions WHERE user_id = ?', [userId]);
    } catch (error) {
      console.error('Error revoking all sessions:', error);
    }
  }
}

export const enhancedAuthService = new EnhancedAuthService();
export default enhancedAuthService;