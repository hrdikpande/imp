// Enhanced Security Utilities
import { SECURITY_CONFIG } from '../config/constants';
import { logger } from './logger';

export class SecurityManager {
  private static instance: SecurityManager;
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Input Sanitization
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  // SQL Injection Prevention
  sanitizeForDatabase(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comments start
      .replace(/\*\//g, ''); // Remove block comments end
  }

  // Rate Limiting for Login Attempts
  checkLoginAttempts(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier);
    const now = Date.now();

    if (!attempts) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset if lockout period has passed
    if (now - attempts.lastAttempt > SECURITY_CONFIG.LOCKOUT_DURATION) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if max attempts exceeded
    if (attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      logger.warn('Login attempt blocked due to rate limiting', { identifier });
      return false;
    }

    // Increment attempt count
    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  resetLoginAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier);
  }

  // Session Security
  generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Data Encryption (Browser-compatible)
  async encryptData(data: string, key?: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Use consistent key from config if not provided
      const keyToUse = key || SECURITY_CONFIG.ENCRYPTION_KEY;
      const cryptoKey = keyToUse
        ? await crypto.subtle.importKey(
            'raw',
            encoder.encode(keyToUse.padEnd(32, '0').substring(0, 32)),
            { name: 'AES-GCM' },
            false,
            ['encrypt']
          )
        : await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logger.error('Encryption failed', error);
      // Fallback to base64 encoding
      return btoa(data);
    }
  }

  async decryptData(encryptedData: string, key?: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const encoder = new TextEncoder();
      const keyToUse = key || SECURITY_CONFIG.ENCRYPTION_KEY;
      const cryptoKey = keyToUse
        ? await crypto.subtle.importKey(
            'raw',
            encoder.encode(keyToUse.padEnd(32, '0').substring(0, 32)),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
          )
        : await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      logger.error('Decryption failed', error);
      // Re-throw the error to let the caller handle it
      throw error;
    }
  }

  // Content Security Policy Validation
  validateCSP(): boolean {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return !!meta;
  }

  // Secure Headers Check
  checkSecurityHeaders(): Record<string, boolean> {
    const headers = {
      'X-Content-Type-Options': false,
      'X-Frame-Options': false,
      'X-XSS-Protection': false,
      'Strict-Transport-Security': false,
    };

    // These would typically be checked on the server side
    // For client-side, we can only check what's available
    return headers;
  }

  // Input Validation
  validateInput(input: string, type: 'email' | 'phone' | 'gstin' | 'text'): boolean {
    const sanitized = this.sanitizeInput(input);
    
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized);
      case 'phone':
        return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(sanitized.replace(/[\s()-]/g, ''));
      case 'gstin':
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(sanitized);
      case 'text':
        return sanitized.length > 0 && sanitized.length <= 1000;
      default:
        return false;
    }
  }

  // Audit Trail
  logSecurityEvent(event: string, details: Record<string, any>): void {
    logger.warn(`Security Event: ${event}`, {
      ...details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  }
}

export const security = SecurityManager.getInstance();
export default security;