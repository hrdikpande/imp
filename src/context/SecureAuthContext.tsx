// Secure Authentication Context with Enhanced Error Handling
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { secureAuthService } from '../services/secureAuthService';
import { secureUserDataService } from '../services/secureUserDataService';
import { initDatabase } from '../database/sqlite';
import { logger } from '../lib/logger';
import { errorHandler } from '../lib/errorHandler';
import { security } from '../lib/security';
import toast from 'react-hot-toast';

interface SecureAuthContextType extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (userData: any) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
  getActiveSessionsCount: () => Promise<number>;
  revokeAllSessions: () => Promise<void>;
}

const SecureAuthContext = createContext<SecureAuthContextType | undefined>(undefined);

export const SecureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
    
    // Cleanup expired sessions periodically
    const cleanupInterval = setInterval(() => {
      secureAuthService.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // Every hour

    // Security monitoring
    const securityInterval = setInterval(() => {
      performSecurityChecks();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(securityInterval);
    };
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      logger.info('Initializing authentication system');
      
      // Initialize main database
      await initDatabase();
      
      // Check for existing session
      const user = await secureAuthService.getCurrentUser();
      if (user) {
        setAuthState({
          isAuthenticated: true,
          user,
          token: await getStoredToken()
        });
        
        // Set user context for data service
        secureUserDataService.setCurrentUser(user.id);
        
        logger.info('Session restored successfully', { userId: user.id });
      } else {
        // Clear any invalid session data
        await clearSessionData();
      }
    } catch (error) {
      logger.error('Auth initialization error', error);
      toast.error('Failed to initialize authentication');
      
      // Clear potentially corrupted data
      await clearSessionData();
    } finally {
      setIsLoading(false);
    }
  };

  const performSecurityChecks = async () => {
    try {
      // Check if current session is still valid
      if (authState.isAuthenticated && authState.user) {
        const currentUser = await secureAuthService.getCurrentUser();
        if (!currentUser) {
          logger.warn('Session validation failed during security check');
          await handleSessionExpired();
        }
      }

      // Log security metrics
      const stats = {
        isAuthenticated: authState.isAuthenticated,
        userId: authState.user?.id,
        timestamp: Date.now(),
      };
      
      logger.debug('Security check completed', stats);
    } catch (error) {
      logger.error('Security check failed', error);
    }
  };

  const handleSessionExpired = async () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null
    });
    
    secureUserDataService.clearCurrentUser();
    await clearSessionData();
    
    toast.error('Your session has expired. Please log in again.');
  };

  const clearSessionData = async () => {
    localStorage.removeItem('auth_data');
    localStorage.removeItem('user_data');
  };

  const getStoredToken = async (): Promise<string | null> => {
    try {
      const authData = localStorage.getItem('auth_data');
      if (authData) {
        try {
          const decrypted = await security.decryptData(authData);
          const parsed = JSON.parse(decrypted);
          return parsed.token;
        } catch (decryptionError) {
          logger.warn('Failed to decrypt stored auth data, clearing session', decryptionError);
          await clearSessionData();
          return null;
        }
      logger.error('Error getting stored token', error);
    }
    return null;
  };

  const login = async (email: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      logger.info('Login attempt', { email: security.sanitizeInput(email) });
      
      const result = await secureAuthService.login(email, password, rememberMe);
      
      if (result.success && result.user && result.token) {
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          token: result.token
        });
        
        // Set user context for data service
        secureUserDataService.setCurrentUser(result.user.id);
        
        toast.success(`Welcome back, ${result.user.businessName}!`);
        
        logger.info('Login successful', { userId: result.user.id });
        return true;
      } else {
        toast.error(result.message);
        logger.warn('Login failed', { email: security.sanitizeInput(email), reason: result.message });
        return false;
      }
    } catch (error) {
      logger.error('Login error', error);
      toast.error('Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      logger.info('Registration attempt', { email: security.sanitizeInput(userData.email) });
      
      const result = await secureAuthService.register(userData);
      
      if (result.success && result.user) {
        // Auto-login after registration
        const loginResult = await secureAuthService.login(userData.email, userData.password, false);
        if (loginResult.success && loginResult.user && loginResult.token) {
          setAuthState({
            isAuthenticated: true,
            user: loginResult.user,
            token: loginResult.token
          });
          
          // Set user context for data service
          secureUserDataService.setCurrentUser(loginResult.user.id);
        }
        
        toast.success(`Welcome to your billing system, ${result.user.businessName}!`);
        
        logger.info('Registration successful', { userId: result.user.id });
        return true;
      } else {
        toast.error(result.message);
        logger.warn('Registration failed', { email: security.sanitizeInput(userData.email), reason: result.message });
        return false;
      }
    } catch (error) {
      logger.error('Registration error', error);
      toast.error('Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      logger.info('Logout initiated', { userId: authState.user?.id });
      
      await secureAuthService.logout();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null
      });
      
      // Clear user context
      secureUserDataService.clearCurrentUser();
      
      toast.success('Logged out successfully');
      
      logger.info('Logout completed');
    } catch (error) {
      logger.error('Logout error', error);
      toast.error('Logout failed');
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (!authState.user) return false;
      
      logger.info('Profile update initiated', { userId: authState.user.id });
      
      const result = await secureAuthService.updateProfile(authState.user.id, updates);
      
      if (result.success && result.user) {
        setAuthState(prev => ({
          ...prev,
          user: result.user!
        }));
        toast.success('Profile updated successfully');
        
        logger.info('Profile updated successfully', { userId: authState.user.id });
        return true;
      } else {
        toast.error(result.message);
        logger.warn('Profile update failed', { userId: authState.user.id, reason: result.message });
        return false;
      }
    } catch (error) {
      logger.error('Update profile error', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      if (!authState.user) return;
      
      const user = await secureAuthService.getCurrentUser();
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user
        }));
        
        logger.info('User data refreshed', { userId: user.id });
      }
    } catch (error) {
      logger.error('Refresh user data error', error);
    }
  };

  const getActiveSessionsCount = async (): Promise<number> => {
    try {
      if (!authState.user) return 0;
      return await secureAuthService.getActiveSessionsCount(authState.user.id);
    } catch (error) {
      logger.error('Get active sessions count error', error);
      return 0;
    }
  };

  const revokeAllSessions = async (): Promise<void> => {
    try {
      if (!authState.user) return;
      
      await secureAuthService.revokeAllSessions(authState.user.id);
      toast.success('All sessions revoked successfully');
      
      // Force logout current session
      await logout();
      
      logger.info('All sessions revoked', { userId: authState.user.id });
    } catch (error) {
      logger.error('Revoke all sessions error', error);
      toast.error('Failed to revoke sessions');
    }
  };

  const value = {
    ...authState,
    login,
    register,
    logout,
    updateProfile,
    refreshUserData,
    getActiveSessionsCount,
    revokeAllSessions,
    isLoading
  };

  return (
    <SecureAuthContext.Provider value={value}>
      {children}
    </SecureAuthContext.Provider>
  );
};

export const useSecureAuth = () => {
  const context = useContext(SecureAuthContext);
  if (context === undefined) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
};