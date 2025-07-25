// Production Logger with Multiple Levels and Structured Logging
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  stack?: string;
}

class Logger {
  private isDevelopment = import.meta.env.MODE === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      stack: error?.stack,
    };
  }

  private getCurrentUserId(): string | undefined {
    try {
      const authData = localStorage.getItem('auth_data');
      if (authData) {
        const parsed = JSON.parse(atob(authData));
        return parsed.userId;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('session_id') || undefined;
    } catch {
      return undefined;
    }
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Store critical logs in localStorage for debugging
    if (entry.level === 'error') {
      try {
        const errorLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
        errorLogs.push(entry);
        if (errorLogs.length > 50) errorLogs.shift();
        localStorage.setItem('error_logs', JSON.stringify(errorLogs));
      } catch {
        // Ignore storage errors
      }
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', message, context);
    this.addLog(entry);
    
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('info', message, context);
    this.addLog(entry);
    
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context);
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', message, context);
    this.addLog(entry);
    
    console.warn(`[WARN] ${message}`, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const entry = this.createLogEntry('error', message, context, error);
    this.addLog(entry);
    
    console.error(`[ERROR] ${message}`, error, context);
  }

  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('error_logs');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();
export default logger;