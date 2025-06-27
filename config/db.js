// Code connects to PostgreSQL (Supabase)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Important for Supabase connections on Render
  }
});

const connectDb = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL Connected...');
    client.release();
  } catch (err) {
    console.error('PostgreSQL Connection Error:', err);
    process.exit(1);
  }
};

module.exports = { pool, connectDb };