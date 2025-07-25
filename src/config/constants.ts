// Application Constants
export const APP_CONFIG = {
  NAME: 'SecureBill Pro',
  VERSION: '1.0.0',
  ENVIRONMENT: import.meta.env.MODE || 'development',
  API_TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FILE_TYPES: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const;

export const DATABASE_CONFIG = {
  MAX_CONNECTIONS_PER_USER: 5,
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BACKUP_RETENTION_DAYS: 30,
} as const;

export const SECURITY_CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  LONG_SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 days
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  ENCRYPTION_KEY: 'SecureBillPro2024!@#$%^&*()_+{}', // 32 character key for consistent encryption
} as const;

export const VALIDATION_RULES = {
  PRODUCT_NAME_MIN_LENGTH: 2,
  PRODUCT_NAME_MAX_LENGTH: 100,
  PRODUCT_CODE_MIN_LENGTH: 2,
  PRODUCT_CODE_MAX_LENGTH: 50,
  CUSTOMER_NAME_MIN_LENGTH: 2,
  CUSTOMER_NAME_MAX_LENGTH: 100,
  PHONE_REGEX: /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  GSTIN_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
} as const;

export const UI_CONFIG = {
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 300,
  PAGINATION_SIZE: 20,
  TABLE_PAGE_SIZE: 50,
} as const;

export const ERROR_CODES = {
  // Authentication Errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_SESSION_EXPIRED: 'AUTH_002',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  
  // Database Errors
  DB_CONNECTION_FAILED: 'DB_001',
  DB_QUERY_FAILED: 'DB_002',
  DB_CONSTRAINT_VIOLATION: 'DB_003',
  
  // Validation Errors
  VALIDATION_REQUIRED_FIELD: 'VAL_001',
  VALIDATION_INVALID_FORMAT: 'VAL_002',
  VALIDATION_OUT_OF_RANGE: 'VAL_003',
  
  // Business Logic Errors
  BUSINESS_DUPLICATE_ENTRY: 'BIZ_001',
  BUSINESS_INSUFFICIENT_STOCK: 'BIZ_002',
  BUSINESS_INVALID_OPERATION: 'BIZ_003',
} as const;