// Enhanced Database Layer with Connection Pooling and Security
import initSqlJs from 'sql.js';
import { logger } from './logger';
import { security } from './security';
import { errorHandler } from './errorHandler';
import { DATABASE_CONFIG, ERROR_CODES } from '../config/constants';

interface DatabaseConnection {
  db: any;
  userId: string;
  lastAccessed: number;
  connectionCount: number;
  isHealthy: boolean;
}

interface QueryOptions {
  timeout?: number;
  retries?: number;
  sanitize?: boolean;
}

export class EnhancedDatabaseManager {
  private static instance: EnhancedDatabaseManager;
  private SQL: any = null;
  private connections: Map<string, DatabaseConnection> = new Map();
  private connectionPool: Map<string, any[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): EnhancedDatabaseManager {
    if (!EnhancedDatabaseManager.instance) {
      EnhancedDatabaseManager.instance = new EnhancedDatabaseManager();
    }
    return EnhancedDatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.SQL) {
        this.SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });
        logger.info('Database engine initialized successfully');
      }

      this.startHealthChecks();
      this.startCleanupProcess();
    } catch (error) {
      logger.error('Failed to initialize database engine', error);
      throw errorHandler.createDatabaseError('initialization', error as Error);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 60000); // Every minute
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, DATABASE_CONFIG.CLEANUP_INTERVAL);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [userId, connection] of this.connections.entries()) {
      try {
        // Simple health check query
        const result = await this.executeQuery(userId, 'SELECT 1 as health_check', [], { timeout: 5000 });
        connection.isHealthy = !!result;
      } catch (error) {
        connection.isHealthy = false;
        logger.warn(`Health check failed for user ${userId}`, { error });
      }
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [userId, connection] of this.connections.entries()) {
      const isIdle = now - connection.lastAccessed > DATABASE_CONFIG.IDLE_TIMEOUT;
      const isUnused = connection.connectionCount === 0;
      
      if (isIdle && isUnused) {
        connectionsToRemove.push(userId);
      }
    }

    connectionsToRemove.forEach(userId => {
      this.closeConnection(userId);
    });

    if (connectionsToRemove.length > 0) {
      logger.info(`Cleaned up ${connectionsToRemove.length} idle database connections`);
    }
  }

  async getUserDatabase(userId: string): Promise<any> {
    if (!userId) {
      throw errorHandler.createValidationError('userId', 'User ID is required');
    }

    await this.initialize();

    let connection = this.connections.get(userId);
    
    if (!connection || !connection.isHealthy) {
      const db = await this.createOrLoadUserDatabase(userId);
      connection = {
        db,
        userId,
        lastAccessed: Date.now(),
        connectionCount: 0,
        isHealthy: true,
      };
      this.connections.set(userId, connection);
      logger.info(`Created new database connection for user: ${userId}`);
    }

    connection.lastAccessed = Date.now();
    connection.connectionCount++;

    return connection.db;
  }

  private async createOrLoadUserDatabase(userId: string): Promise<any> {
    const storageKey = `user_db_${userId}`;
    
    try {
      const savedDb = localStorage.getItem(storageKey);
      let db: any;
      
      if (savedDb) {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new this.SQL.Database(uint8Array);
        logger.debug(`Loaded existing database for user: ${userId}`);
      } else {
        db = new this.SQL.Database();
        await this.createUserTables(db);
        logger.info(`Created new database for user: ${userId}`);
      }

      return db;
    } catch (error) {
      logger.error(`Error creating/loading database for user ${userId}`, error);
      throw errorHandler.createDatabaseError('database_creation', error as Error);
    }
  }

  private async createUserTables(db: any): Promise<void> {
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON;');

    const tables = [
      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT,
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
        unit_of_measurement TEXT NOT NULL DEFAULT 'pcs',
        tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 100),
        image_url TEXT,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Customers table
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        gstin TEXT,
        discount_percentage REAL DEFAULT 0 CHECK(discount_percentage >= 0 AND discount_percentage <= 100),
        credit_limit REAL DEFAULT 0 CHECK(credit_limit >= 0),
        payment_terms TEXT,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Bills table
      `CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        bill_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        subtotal REAL NOT NULL CHECK(subtotal >= 0),
        total_discount REAL NOT NULL DEFAULT 0 CHECK(total_discount >= 0),
        bill_discount_type TEXT DEFAULT 'fixed' CHECK(bill_discount_type IN ('fixed', 'percentage')),
        bill_discount_value REAL DEFAULT 0 CHECK(bill_discount_value >= 0),
        bill_discount_amount REAL DEFAULT 0 CHECK(bill_discount_amount >= 0),
        total_tax REAL NOT NULL DEFAULT 0 CHECK(total_tax >= 0),
        total REAL NOT NULL CHECK(total >= 0),
        payment_mode TEXT CHECK(payment_mode IN ('cash', 'card', 'upi', 'bank_transfer', 'credit')),
        payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'partial', 'overdue')),
        due_date INTEGER,
        notes TEXT,
        promo_code TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )`,

      // Bill Items table
      `CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        discount_type TEXT DEFAULT 'fixed' CHECK(discount_type IN ('fixed', 'percentage')),
        discount_value REAL DEFAULT 0 CHECK(discount_value >= 0),
        discount_percentage REAL DEFAULT 0 CHECK(discount_percentage >= 0 AND discount_percentage <= 100),
        discount_amount REAL DEFAULT 0 CHECK(discount_amount >= 0),
        tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 100),
        tax_amount REAL DEFAULT 0 CHECK(tax_amount >= 0),
        subtotal REAL NOT NULL CHECK(subtotal >= 0),
        total REAL NOT NULL CHECK(total >= 0),
        FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`,

      // Audit log table
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT,
        old_values TEXT,
        new_values TEXT,
        created_at INTEGER NOT NULL
      )`,

      // User settings table
      `CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ];

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)',
      'CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)',
      'CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_product ON bill_items(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(created_at)',
    ];

    try {
      // Create tables
      for (const query of tables) {
        db.run(query);
      }

      // Create indexes
      for (const query of indexes) {
        db.run(query);
      }

      logger.debug('Database tables and indexes created successfully');
    } catch (error) {
      logger.error('Error creating database tables', error);
      throw errorHandler.createDatabaseError('table_creation', error as Error);
    }
  }

  async executeQuery(
    userId: string, 
    query: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<any> {
    const { timeout = 30000, retries = 3, sanitize = true } = options;
    
    let attempt = 0;
    while (attempt < retries) {
      try {
        const db = await this.getUserDatabase(userId);
        
        // Sanitize query if requested
        const sanitizedQuery = sanitize ? security.sanitizeForDatabase(query) : query;
        const sanitizedParams = sanitize ? params.map(p => 
          typeof p === 'string' ? security.sanitizeForDatabase(p) : p
        ) : params;

        // Execute with timeout
        const result = await Promise.race([
          this.executeQueryInternal(db, sanitizedQuery, sanitizedParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);

        // Auto-save after write operations
        if (this.isWriteOperation(sanitizedQuery)) {
          await this.saveUserDatabase(userId);
          this.logAuditEvent(userId, sanitizedQuery, sanitizedParams);
        }

        return result;
      } catch (error) {
        attempt++;
        logger.warn(`Query attempt ${attempt} failed for user ${userId}`, { error, query });
        
        if (attempt >= retries) {
          throw errorHandler.createDatabaseError('query_execution', error as Error);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        this.releaseConnection(userId);
      }
    }
  }

  private async executeQueryInternal(db: any, query: string, params: any[]): Promise<any> {
    const stmt = db.prepare(query);
    try {
      stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  async executeQueryAll(
    userId: string, 
    query: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<any[]> {
    const { timeout = 30000, retries = 3, sanitize = true } = options;
    
    let attempt = 0;
    while (attempt < retries) {
      try {
        const db = await this.getUserDatabase(userId);
        
        const sanitizedQuery = sanitize ? security.sanitizeForDatabase(query) : query;
        const sanitizedParams = sanitize ? params.map(p => 
          typeof p === 'string' ? security.sanitizeForDatabase(p) : p
        ) : params;

        const result = await Promise.race([
          this.executeQueryAllInternal(db, sanitizedQuery, sanitizedParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);

        return result as any[];
      } catch (error) {
        attempt++;
        logger.warn(`Query all attempt ${attempt} failed for user ${userId}`, { error, query });
        
        if (attempt >= retries) {
          throw errorHandler.createDatabaseError('query_execution', error as Error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        this.releaseConnection(userId);
      }
    }

    return [];
  }

  private async executeQueryAllInternal(db: any, query: string, params: any[]): Promise<any[]> {
    const stmt = db.prepare(query);
    try {
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  async executeUpdate(
    userId: string, 
    query: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<boolean> {
    const { timeout = 30000, retries = 3, sanitize = true } = options;
    
    let attempt = 0;
    while (attempt < retries) {
      try {
        const db = await this.getUserDatabase(userId);
        
        const sanitizedQuery = sanitize ? security.sanitizeForDatabase(query) : query;
        const sanitizedParams = sanitize ? params.map(p => 
          typeof p === 'string' ? security.sanitizeForDatabase(p) : p
        ) : params;

        await Promise.race([
          this.executeUpdateInternal(db, sanitizedQuery, sanitizedParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Update timeout')), timeout)
          )
        ]);

        await this.saveUserDatabase(userId);
        this.logAuditEvent(userId, sanitizedQuery, sanitizedParams);
        
        return true;
      } catch (error) {
        attempt++;
        logger.warn(`Update attempt ${attempt} failed for user ${userId}`, { error, query });
        
        if (attempt >= retries) {
          throw errorHandler.createDatabaseError('update_execution', error as Error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        this.releaseConnection(userId);
      }
    }

    return false;
  }

  private async executeUpdateInternal(db: any, query: string, params: any[]): Promise<void> {
    const stmt = db.prepare(query);
    try {
      stmt.run(params);
    } finally {
      stmt.free();
    }
  }

  private isWriteOperation(query: string): boolean {
    const writeOperations = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
    const upperQuery = query.trim().toUpperCase();
    return writeOperations.some(op => upperQuery.startsWith(op));
  }

  private async saveUserDatabase(userId: string): Promise<void> {
    try {
      const connection = this.connections.get(userId);
      if (connection) {
        const data = connection.db.export();
        const storageKey = `user_db_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(data)));
      }
    } catch (error) {
      logger.error(`Error saving database for user ${userId}`, error);
    }
  }

  private logAuditEvent(userId: string, query: string, params: any[]): void {
    try {
      const auditEntry = {
        userId,
        query: query.substring(0, 200), // Truncate long queries
        params: JSON.stringify(params),
        timestamp: new Date().toISOString(),
      };
      
      logger.debug('Database operation logged', auditEntry);
    } catch (error) {
      logger.warn('Failed to log audit event', { error });
    }
  }

  private releaseConnection(userId: string): void {
    const connection = this.connections.get(userId);
    if (connection && connection.connectionCount > 0) {
      connection.connectionCount--;
    }
  }

  private closeConnection(userId: string): void {
    try {
      const connection = this.connections.get(userId);
      if (connection) {
        this.saveUserDatabase(userId);
        this.connections.delete(userId);
        this.connectionPool.delete(userId);
        logger.debug(`Closed database connection for user: ${userId}`);
      }
    } catch (error) {
      logger.error(`Error closing connection for user ${userId}`, error);
    }
  }

  async backupUserDatabase(userId: string): Promise<string> {
    try {
      const connection = this.connections.get(userId);
      if (!connection) {
        throw new Error('Database connection not found');
      }

      const data = connection.db.export();
      const backup = JSON.stringify(Array.from(data));
      const timestamp = new Date().toISOString();
      const backupKey = `backup_${userId}_${timestamp}`;
      
      localStorage.setItem(backupKey, backup);
      logger.info(`Database backup created for user ${userId}`, { backupKey });
      
      return backupKey;
    } catch (error) {
      logger.error(`Error creating backup for user ${userId}`, error);
      throw errorHandler.createDatabaseError('backup_creation', error as Error);
    }
  }

  async restoreUserDatabase(userId: string, backupKey: string): Promise<boolean> {
    try {
      const backup = localStorage.getItem(backupKey);
      if (!backup) {
        throw new Error('Backup not found');
      }

      await this.initialize();
      const uint8Array = new Uint8Array(JSON.parse(backup));
      const db = new this.SQL.Database(uint8Array);

      const connection = {
        db,
        userId,
        lastAccessed: Date.now(),
        connectionCount: 0,
        isHealthy: true,
      };

      this.connections.set(userId, connection);
      await this.saveUserDatabase(userId);
      
      logger.info(`Database restored for user ${userId}`, { backupKey });
      return true;
    } catch (error) {
      logger.error(`Error restoring database for user ${userId}`, error);
      throw errorHandler.createDatabaseError('restore_operation', error as Error);
    }
  }

  getConnectionStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [userId, connection] of this.connections.entries()) {
      stats[userId] = {
        connections: connection.connectionCount,
        lastAccessed: connection.lastAccessed,
        isHealthy: connection.isHealthy,
      };
    }
    
    return {
      totalConnections: this.connections.size,
      connections: stats,
      poolSize: this.connectionPool.size,
    };
  }

  async destroy(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Save all databases before destroying
      for (const [userId] of this.connections.entries()) {
        await this.saveUserDatabase(userId);
      }
      
      this.connections.clear();
      this.connectionPool.clear();
      
      logger.info('Database manager destroyed successfully');
    } catch (error) {
      logger.error('Error during database manager destruction', error);
    }
  }
}

export const enhancedDb = EnhancedDatabaseManager.getInstance();
export default enhancedDb;