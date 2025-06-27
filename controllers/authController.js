const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

exports.register = async (req, res) => {
  const { owner, username, password } = req.body;
  if (!owner || !username || !password) return res.status(400).json({ message: 'All fields are required' });

  // ADDED: Use a connection for transaction
  const connection = await pool.getConnection();

  try {
    // MODIFIED: Start transaction
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT username FROM accounts WHERE username = ?', [username]);
    if (existing.length > 0) {
      await connection.rollback(); // Rollback on validation failure
      return res.status(409).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query('INSERT INTO accounts (owner, username, password) VALUES (?, ?, ?)', [owner, username, hashedPassword]);
    
    const newUserId = result.insertId;
    // ADDED: Initial deposit as part of the transaction
    await connection.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [newUserId, 1000, 'Initial Deposit']);
    
    // MODIFIED: Commit transaction
    await connection.commit();
    
    res.status(201).json({ message: 'User registered successfully with an initial balance of 1000€' });
  } catch (err) {
    // MODIFIED: Rollback on error and log it
    await connection.rollback();
    console.error('REGISTRATION ERROR:', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  } finally {
    // ADDED: Always release connection
    if (connection) connection.release();
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
  try {
    const [results] = await pool.query('SELECT * FROM accounts WHERE username = ?', [username]);
    if (results.length === 0) return res.status(401).json({ message: 'Login Failed' });
    
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Login Failed' });
    
    // MODIFIED: Use !! to ensure a boolean value
    const payload = { id: user.id, username: user.username, is_admin: !!user.is_admin };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const userResponse = { id: user.id, owner: user.owner, username: user.username, is_admin: !!user.is_admin };
    res.json({ message: 'Login successful', token, user: userResponse });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};