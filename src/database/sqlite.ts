import initSqlJs from 'sql.js';

let SQL: any = null;
let db: any = null;

export const initDatabase = async () => {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  if (!db) {
    // Try to load existing database from localStorage
    const savedDb = localStorage.getItem('billing_system_main_db');
    if (savedDb) {
      const uint8Array = new Uint8Array(JSON.parse(savedDb));
      db = new SQL.Database(uint8Array);
    } else {
      db = new SQL.Database();
      await createTables();
    }
  }

  return db;
};

const createTables = async () => {
  const queries = [
    // Users table - main authentication table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      business_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      secondary_phone TEXT,
      website TEXT,
      business_reg_number TEXT,
      tax_id TEXT,
      business_type TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      country TEXT NOT NULL,
      billing_address TEXT,
      bank_name TEXT,
      bank_branch TEXT,
      account_number TEXT,
      swift_code TEXT,
      payment_terms TEXT,
      accepted_payment_methods TEXT,
      logo_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Sessions table - for authentication management
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,

    // Audit log table - for security tracking
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
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

  saveDatabase();
};

export const saveDatabase = () => {
  if (db) {
    const data = db.export();
    localStorage.setItem('billing_system_main_db', JSON.stringify(Array.from(data)));
  }
};

export const getDatabase = () => db;

export const executeQuery = (query: string, params: any[] = []) => {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(query);
    const result = stmt.getAsObject(params);
    stmt.free();
    saveDatabase();
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const executeQueryAll = (query: string, params: any[] = []) => {
  if (!db) throw new Error('Database not initialized');
  
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
  }
};

export const executeUpdate = (query: string, params: any[] = []) => {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(query);
    stmt.run(params);
    stmt.free();
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Database update error:', error);
    throw error;
  }
};