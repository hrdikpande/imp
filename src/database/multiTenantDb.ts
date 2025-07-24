import initSqlJs from 'sql.js';

interface DatabaseInstance {
  db: any;
  userId: string;
  lastAccessed: number;
  connectionCount: number;
}

class MultiTenantDatabaseManager {
  private static instance: MultiTenantDatabaseManager;
  private SQL: any = null;
  private databases: Map<string, DatabaseInstance> = new Map();
  private connectionPool: Map<string, any[]> = new Map();
  private readonly MAX_CONNECTIONS_PER_USER = 5;
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupProcess();
  }

  public static getInstance(): MultiTenantDatabaseManager {
    if (!MultiTenantDatabaseManager.instance) {
      MultiTenantDatabaseManager.instance = new MultiTenantDatabaseManager();
    }
    return MultiTenantDatabaseManager.instance;
  }

  private async initializeSQL() {
    if (!this.SQL) {
      this.SQL = await initSqlJs({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });
    }
    return this.SQL;
  }

  private startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleDatabases();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private cleanupIdleDatabases() {
    const now = Date.now();
    for (const [userId, dbInstance] of this.databases.entries()) {
      if (now - dbInstance.lastAccessed > this.IDLE_TIMEOUT && dbInstance.connectionCount === 0) {
        this.saveDatabaseToStorage(userId, dbInstance.db);
        this.databases.delete(userId);
        this.connectionPool.delete(userId);
        console.log(`Cleaned up idle database for user: ${userId}`);
      }
    }
  }

  public async getUserDatabase(userId: string): Promise<any> {
    await this.initializeSQL();

    let dbInstance = this.databases.get(userId);
    
    if (!dbInstance) {
      // Create or load user-specific database
      const db = await this.createOrLoadUserDatabase(userId);
      dbInstance = {
        db,
        userId,
        lastAccessed: Date.now(),
        connectionCount: 0
      };
      this.databases.set(userId, dbInstance);
    }

    dbInstance.lastAccessed = Date.now();
    dbInstance.connectionCount++;

    return dbInstance.db;
  }

  public releaseConnection(userId: string) {
    const dbInstance = this.databases.get(userId);
    if (dbInstance && dbInstance.connectionCount > 0) {
      dbInstance.connectionCount--;
    }
  }

  private async createOrLoadUserDatabase(userId: string): Promise<any> {
    const storageKey = `user_db_${userId}`;
    const savedDb = localStorage.getItem(storageKey);
    
    let db: any;
    
    if (savedDb) {
      // Load existing database
      try {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new this.SQL.Database(uint8Array);
        console.log(`Loaded existing database for user: ${userId}`);
      } catch (error) {
        console.error(`Error loading database for user ${userId}:`, error);
        db = new this.SQL.Database();
        await this.createUserTables(db);
      }
    } else {
      // Create new database
      db = new this.SQL.Database();
      await this.createUserTables(db);
      console.log(`Created new database for user: ${userId}`);
    }

    return db;
  }

  private async createUserTables(db: any) {
    const queries = [
      // Products table with user isolation
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT,
        unit_price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        unit_of_measurement TEXT NOT NULL DEFAULT 'pcs',
        tax_rate REAL DEFAULT 0,
        image_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Customers table with user isolation
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
        discount_percentage REAL DEFAULT 0,
        credit_limit REAL DEFAULT 0,
        payment_terms TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Bills table with user isolation
      `CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        bill_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        subtotal REAL NOT NULL,
        total_discount REAL NOT NULL DEFAULT 0,
        bill_discount_type TEXT DEFAULT 'fixed',
        bill_discount_value REAL DEFAULT 0,
        bill_discount_amount REAL DEFAULT 0,
        total_tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        payment_mode TEXT,
        payment_status TEXT DEFAULT 'pending',
        due_date INTEGER,
        notes TEXT,
        promo_code TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )`,

      // Bill Items table with user isolation
      `CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        discount_type TEXT DEFAULT 'fixed',
        discount_value REAL DEFAULT 0,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`,

      // User settings table
      `CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Audit log table for security
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT,
        old_values TEXT,
        new_values TEXT,
        created_at INTEGER NOT NULL
      )`
    ];

    for (const query of queries) {
      db.run(query);
    }

    this.saveDatabaseToStorage('temp', db);
  }

  private saveDatabaseToStorage(userId: string, db: any) {
    try {
      const data = db.export();
      const storageKey = `user_db_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(Array.from(data)));
    } catch (error) {
      console.error(`Error saving database for user ${userId}:`, error);
    }
  }

  public async saveUserDatabase(userId: string) {
    const dbInstance = this.databases.get(userId);
    if (dbInstance) {
      this.saveDatabaseToStorage(userId, dbInstance.db);
    }
  }

  public async executeQuery(userId: string, query: string, params: any[] = []): Promise<any> {
    const db = await this.getUserDatabase(userId);
    
    try {
      const stmt = db.prepare(query);
      const result = stmt.getAsObject(params);
      stmt.free();
      
      // Auto-save after write operations
      if (query.trim().toUpperCase().startsWith('INSERT') || 
          query.trim().toUpperCase().startsWith('UPDATE') || 
          query.trim().toUpperCase().startsWith('DELETE')) {
        this.saveDatabaseToStorage(userId, db);
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      this.releaseConnection(userId);
    }
  }

  public async executeQueryAll(userId: string, query: string, params: any[] = []): Promise<any[]> {
    const db = await this.getUserDatabase(userId);
    
    try {
      const stmt = db.prepare(query);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      this.releaseConnection(userId);
    }
  }

  public async executeUpdate(userId: string, query: string, params: any[] = []): Promise<boolean> {
    const db = await this.getUserDatabase(userId);
    
    try {
      const stmt = db.prepare(query);
      stmt.run(params);
      stmt.free();
      
      // Auto-save after updates
      this.saveDatabaseToStorage(userId, db);
      return true;
    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    } finally {
      this.releaseConnection(userId);
    }
  }

  public async backupUserDatabase(userId: string): Promise<string> {
    const dbInstance = this.databases.get(userId);
    if (!dbInstance) {
      throw new Error('Database not found for user');
    }

    const data = dbInstance.db.export();
    const backup = JSON.stringify(Array.from(data));
    const timestamp = new Date().toISOString();
    const backupKey = `backup_${userId}_${timestamp}`;
    
    localStorage.setItem(backupKey, backup);
    return backupKey;
  }

  public async restoreUserDatabase(userId: string, backupKey: string): Promise<boolean> {
    try {
      const backup = localStorage.getItem(backupKey);
      if (!backup) {
        throw new Error('Backup not found');
      }

      await this.initializeSQL();
      const uint8Array = new Uint8Array(JSON.parse(backup));
      const db = new this.SQL.Database(uint8Array);

      const dbInstance = {
        db,
        userId,
        lastAccessed: Date.now(),
        connectionCount: 0
      };

      this.databases.set(userId, dbInstance);
      this.saveDatabaseToStorage(userId, db);
      
      return true;
    } catch (error) {
      console.error('Database restore error:', error);
      return false;
    }
  }

  public async deleteUserDatabase(userId: string): Promise<boolean> {
    try {
      // Remove from memory
      this.databases.delete(userId);
      this.connectionPool.delete(userId);
      
      // Remove from storage
      const storageKey = `user_db_${userId}`;
      localStorage.removeItem(storageKey);
      
      // Remove backups
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`backup_${userId}_`)) {
          localStorage.removeItem(key);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting user database:', error);
      return false;
    }
  }

  public getConnectionStats(): { [userId: string]: { connections: number; lastAccessed: number } } {
    const stats: { [userId: string]: { connections: number; lastAccessed: number } } = {};
    
    for (const [userId, dbInstance] of this.databases.entries()) {
      stats[userId] = {
        connections: dbInstance.connectionCount,
        lastAccessed: dbInstance.lastAccessed
      };
    }
    
    return stats;
  }

  public destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Save all databases before destroying
    for (const [userId, dbInstance] of this.databases.entries()) {
      this.saveDatabaseToStorage(userId, dbInstance.db);
    }
    
    this.databases.clear();
    this.connectionPool.clear();
  }
}

export const multiTenantDb = MultiTenantDatabaseManager.getInstance();
export default multiTenantDb;