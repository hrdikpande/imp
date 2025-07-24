import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { enhancedAuthService } from '../services/enhancedAuthService';
import { userDataService } from '../services/userDataService';
import { initDatabase } from '../database/sqlite';
import toast from 'react-hot-toast';

interface EnhancedAuthContextType extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (userData: any) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
  getActiveSessionsCount: () => Promise<number>;
  revokeAllSessions: () => Promise<void>;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export const EnhancedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      enhancedAuthService.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // Every hour

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Initialize main database
      await initDatabase();
      
      // Check for existing session
      const user = await enhancedAuthService.getCurrentUser();
      if (user) {
        setAuthState({
          isAuthenticated: true,
          user,
          token: getStoredToken()
        });
        
        // Set user context for data service
        userDataService.setCurrentUser(user.id);
        
        console.log(`Restored session for user: ${user.businessName}`);
      } else {
        // Clear any invalid session data
        localStorage.removeItem('auth_data');
        localStorage.removeItem('user_data');
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      toast.error('Failed to initialize authentication');
      
      // Clear potentially corrupted data
      localStorage.removeItem('auth_data');
      localStorage.removeItem('user_data');
    } finally {
      setIsLoading(false);
    }
  };

  const getStoredToken = (): string | null => {
    try {
      const authData = localStorage.getItem('auth_data');
      if (authData) {
        const decrypted = atob(authData); // Simple decoding
        const parsed = JSON.parse(decrypted);
        return parsed.token;
      }
    } catch (error) {
      console.error('Error getting stored token:', error);
    }
    return null;
  };

  const login = async (email: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await enhancedAuthService.login(email, password, rememberMe);
      
      if (result.success && result.user && result.token) {
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          token: result.token
        });
        
        // Set user context for data service
        userDataService.setCurrentUser(result.user.id);
        
        toast.success(`Welcome back, ${result.user.businessName}!`);
        return true;
      } else {
        toast.error(result.message);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await enhancedAuthService.register(userData);
      
      if (result.success && result.user) {
        // Auto-login after registration
        const loginResult = await enhancedAuthService.login(userData.email, userData.password, false);
        if (loginResult.success && loginResult.user && loginResult.token) {
          setAuthState({
            isAuthenticated: true,
            user: loginResult.user,
            token: loginResult.token
          });
          
          // Set user context for data service
          userDataService.setCurrentUser(loginResult.user.id);
        }
        
        toast.success(`Welcome to your billing system, ${result.user.businessName}!`);
        return true;
      } else {
        toast.error(result.message);
        return false;
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await enhancedAuthService.logout();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null
      });
      
      // Clear user context
      userDataService.clearCurrentUser();
      
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (!authState.user) return false;
      
      const result = await enhancedAuthService.updateProfile(authState.user.id, updates);
      
      if (result.success && result.user) {
        setAuthState(prev => ({
          ...prev,
          user: result.user!
        }));
        toast.success('Profile updated successfully');
        return true;
      } else {
        toast.error(result.message);
        return false;
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      if (!authState.user) return;
      
      const user = await enhancedAuthService.getCurrentUser();
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user
        }));
      }
    } catch (error) {
      console.error('Refresh user data error:', error);
    }
  };

  const getActiveSessionsCount = async (): Promise<number> => {
    try {
      if (!authState.user) return 0;
      return await enhancedAuthService.getActiveSessionsCount(authState.user.id);
    } catch (error) {
      console.error('Get active sessions count error:', error);
      return 0;
    }
  };

  const revokeAllSessions = async (): Promise<void> => {
    try {
      if (!authState.user) return;
      
      await enhancedAuthService.revokeAllSessions(authState.user.id);
      toast.success('All sessions revoked successfully');
      
      // Force logout current session
      await logout();
    } catch (error) {
      console.error('Revoke all sessions error:', error);
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
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};