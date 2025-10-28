/**
 * Database Service - Neon PostgreSQL
 * 
 * Professional database connection with connection pooling,
 * error handling, and query optimization
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configure Neon for optimal performance
neonConfig.fetchConnectionCache = true;

// Neon serverless SQL for queries
let sql;

// Traditional Pool for connection pooling (optional, for complex queries)
let pool;

/**
 * Initialize database connection
 */
export function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  console.log(connectionString);

  if (!connectionString) {
    console.warn('⚠️  DATABASE_URL not configured. Using in-memory store.');
    return false;
  }

  try {
    // Neon serverless driver (recommended for serverless environments)
    sql = neon(connectionString);

    // Traditional pool (for connection pooling)
    pool = new Pool({
      connectionString,
      max: 10, // Maximum number of clients
    });

    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Execute a query using Neon serverless
 */
export async function query(text, params = []) {
  if (!sql) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a query using connection pool
 */
export async function poolQuery(text, params = []) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database pool query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transaction helper
 */
export async function transaction(callback) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize database schema
 */
export async function initializeSchema() {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await poolQuery(schema);
    console.log('✅ Database schema initialized');
    return true;
  } catch (error) {
    console.error('❌ Schema initialization failed:', error.message);
    return false;
  }
}

/**
 * Check database connection
 */
export async function checkConnection() {
  try {
    const result = await query('SELECT NOW()');
    return { connected: true, timestamp: result[0].now };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Close database connections
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connections closed');
  }
}

export default {
  initializeDatabase,
  query,
  poolQuery,
  transaction,
  initializeSchema,
  checkConnection,
  closeDatabase
};

