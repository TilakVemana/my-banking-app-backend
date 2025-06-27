const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}).promise();

const connectDb = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected...');
    connection.release();
  } catch (err) {
    console.error('MySQL Connection Error:', err);
    process.exit(1);
  }
};

module.exports = { pool, connectDb };