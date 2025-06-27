const { pool } = require('../config/db');

exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await pool.query('SELECT id, owner, username, is_admin FROM accounts WHERE id = ?', [userId]);
    const [transactions] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId]);
    const [loanRequests] = await pool.query('SELECT * FROM loan_requests WHERE user_id = ? ORDER BY date_requested DESC', [userId]);
    if (user.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ user: user[0], transactions, loanRequests });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deposit = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ message: 'Invalid deposit amount.' });
  try {
    await pool.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [userId, parsedAmount, 'User Deposit']);
    res.status(200).json({ message: `Successfully deposited ${parsedAmount.toFixed(2)}€.` });
  } catch (err) {
    console.error("DEPOSIT FAILED - DATABASE ERROR:", err);
    res.status(500).json({ message: 'Server error during deposit.' });
  }
};

exports.withdraw = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ message: 'Invalid withdrawal amount.' });
  try {
    const [balanceResult] = await pool.query('SELECT SUM(amount) as balance FROM transactions WHERE user_id = ?', [userId]);
    const currentBalance = parseFloat(balanceResult[0]?.balance) || 0;
    if (currentBalance < parsedAmount) return res.status(400).json({ message: 'Insufficient funds.' });
    await pool.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [userId, -parsedAmount, 'User Withdrawal']);
    res.status(200).json({ message: `Successfully withdrew ${parsedAmount.toFixed(2)}€.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error during withdrawal.' });
  }
};

// --- THIS IS THE NEW FUNCTION FOR THE PASSBOOK ---
exports.getPassbookData = async (req, res) => {
  const { days } = req.body;
  const userId = req.user.id;

  const parsedDays = parseInt(days, 10);
  if (!parsedDays || parsedDays <= 0) {
    return res.status(400).json({ message: 'Please provide a valid number of days.' });
  }

  try {
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY date DESC',
      [userId, parsedDays]
    );
    res.json(transactions);
  } catch (err) {
    console.error('PASSBOOK FETCH ERROR:', err);
    res.status(500).json({ message: 'Server error while fetching passbook data.', error: err.message });
  }
};

exports.repayLoan = async (req, res) => {
  const { id: loanId } = req.params;
  const userId = req.user.id;
  try {
    const [loanResult] = await pool.query('SELECT * FROM loan_requests WHERE id = ? AND user_id = ? AND status = "Approved" AND repaid = 0', [loanId, userId]);
    if (loanResult.length === 0) return res.status(404).json({ message: 'Outstanding approved loan not found.' });
    const loanToRepay = loanResult[0];
    const loanAmount = parseFloat(loanToRepay.amount);
    const [balanceResult] = await pool.query('SELECT SUM(amount) as balance FROM transactions WHERE user_id = ?', [userId]);
    const currentBalance = parseFloat(balanceResult[0]?.balance) || 0;
    if (currentBalance < loanAmount) return res.status(400).json({ message: 'Insufficient funds to repay loan.' });
    await pool.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [userId, -loanAmount, `Repayment for Loan #${loanId}`]);
    await pool.query('UPDATE loan_requests SET repaid = 1 WHERE id = ?', [loanId]);
    res.status(200).json({ message: `Successfully repaid loan of ${loanAmount.toFixed(2)}€.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error during loan repayment.' });
  }
};

exports.requestLoan = async (req, res) => {
  const { amount, reason } = req.body;
  const userId = req.user.id;
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ message: 'Invalid loan amount.' });
  try {
    await pool.query('INSERT INTO loan_requests (user_id, amount, reason, status) VALUES (?, ?, ?, ?)', [userId, parsedAmount, reason, 'Pending']);
    res.status(201).json({ message: 'Loan request submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.transferMoney = async (req, res) => {
  const { toUsername, amount } = req.body;
  const fromUserId = req.user.id;
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ message: 'Invalid transfer amount.' });
  if (!toUsername) return res.status(400).json({ message: 'Recipient username is required.' });
  try {
    const [recipient] = await pool.query('SELECT id FROM accounts WHERE username = ?', [toUsername]);
    if (recipient.length === 0) return res.status(404).json({ message: 'Recipient not found' });
    const toUserId = recipient[0].id;
    if (fromUserId === toUserId) return res.status(400).json({ message: 'Cannot transfer to yourself' });
    const [balanceResult] = await pool.query('SELECT SUM(amount) as balance FROM transactions WHERE user_id = ?', [fromUserId]);
    const currentBalance = parseFloat(balanceResult[0]?.balance) || 0;
    if (currentBalance < parsedAmount) return res.status(400).json({ message: 'Insufficient funds.' });
    await pool.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [fromUserId, -parsedAmount, `Transfer to ${toUsername}`]);
    await pool.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [toUserId, parsedAmount, `Transfer from ${req.user.username}`]);
    res.json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.closeAccount = async (req, res) => {
  const userId = req.user.id;
  try {
    await pool.query('DELETE FROM accounts WHERE id = ?', [userId]);
    res.json({ message: 'Account closed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};