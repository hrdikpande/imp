// Centralized Error Handling System
import { logger } from './logger';
import { ERROR_CODES } from '../config/constants';
import toast from 'react-hot-toast';

export interface AppError extends Error {
  code: string;
  statusCode?: number;
  context?: Record<string, any>;
  isOperational?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  createError(
    message: string,
    code: string,
    statusCode?: number,
    context?: Record<string, any>
  ): AppError {
    const error = new Error(message) as AppError;
    error.code = code;
    error.statusCode = statusCode;
    error.context = context;
    error.isOperational = true;
    return error;
  }

  handleError(error: Error | AppError, showToast = true): void {
    const appError = error as AppError;
    
    // Log the error
    logger.error(error.message, error, {
      code: appError.code,
      statusCode: appError.statusCode,
      context: appError.context,
      stack: error.stack,
    });

    // Show user-friendly message
    if (showToast) {
      const userMessage = this.getUserFriendlyMessage(appError);
      toast.error(userMessage);
    }

    // Report to monitoring service in production
    if (import.meta.env.PROD) {
      this.reportToMonitoring(appError);
    }
  }

  private getUserFriendlyMessage(error: AppError): string {
    const errorMessages: Record<string, string> = {
      [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
      [ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
      [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action.',
      
      [ERROR_CODES.DB_CONNECTION_FAILED]: 'Unable to connect to the database. Please try again later.',
      [ERROR_CODES.DB_QUERY_FAILED]: 'A database error occurred. Please try again.',
      [ERROR_CODES.DB_CONSTRAINT_VIOLATION]: 'This operation violates data constraints.',
      
      [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Please fill in all required fields.',
      [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Please check the format of your input.',
      [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: 'The value is outside the allowed range.',
      
      [ERROR_CODES.BUSINESS_DUPLICATE_ENTRY]: 'This entry already exists.',
      [ERROR_CODES.BUSINESS_INSUFFICIENT_STOCK]: 'Insufficient stock available.',
      [ERROR_CODES.BUSINESS_INVALID_OPERATION]: 'This operation is not allowed.',
    };

    return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
  }

  private reportToMonitoring(error: AppError): void {
    // In a real application, this would send to a monitoring service
    // like Sentry, LogRocket, or custom analytics
    console.warn('Error reported to monitoring:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
      timestamp: new Date().toISOString(),
    });
  }

  // Async error boundary
  async handleAsyncError<T>(
    operation: () => Promise<T>,
    fallback?: T,
    showToast = true
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error as Error, showToast);
      return fallback;
    }
  }

  // Validation error helper
  createValidationError(field: string, message: string): AppError {
    return this.createError(
      `Validation failed for ${field}: ${message}`,
      ERROR_CODES.VALIDATION_INVALID_FORMAT,
      400,
      { field, validationMessage: message }
    );
  }

  // Database error helper
  createDatabaseError(operation: string, originalError: Error): AppError {
    return this.createError(
      `Database operation failed: ${operation}`,
      ERROR_CODES.DB_QUERY_FAILED,
      500,
      { operation, originalError: originalError.message }
    );
  }

  // Business logic error helper
  createBusinessError(operation: string, reason: string): AppError {
    return this.createError(
      `Business rule violation: ${reason}`,
      ERROR_CODES.BUSINESS_INVALID_OPERATION,
      400,
      { operation, reason }
    );
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Global error handler for unhandled promises
window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(new Error(event.reason), false);
  event.preventDefault();
});

// Global error handler for uncaught exceptions
window.addEventListener('error', (event) => {
  errorHandler.handleError(event.error, false);
});

export default errorHandler;