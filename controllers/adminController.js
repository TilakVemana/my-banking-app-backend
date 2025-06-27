const { pool } = require('../config/db');

exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, owner, username, is_admin FROM accounts');
    // MODIFIED: Ensure is_admin is boolean for consistency
    const formattedUsers = users.map(u => ({...u, is_admin: !!u.is_admin}));
    res.json(formattedUsers);
  } catch (err) {
    console.error('GET ALL USERS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteUserByAdmin = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection(); // ADDED
    try {
        await connection.beginTransaction(); // ADDED

        const [user] = await connection.query('SELECT is_admin FROM accounts WHERE id = ?', [id]);
        if (user.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }
        if (user[0].is_admin) {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot delete an admin account' });
        }
        
        // ADDED: Cascade delete related data for the user
        await connection.query('DELETE FROM transactions WHERE user_id = ?', [id]);
        await connection.query('DELETE FROM loan_requests WHERE user_id = ?', [id]);
        await connection.query('DELETE FROM accounts WHERE id = ?', [id]);

        await connection.commit(); // ADDED
        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (err) {
        await connection.rollback(); // ADDED
        console.error('ADMIN DELETE USER ERROR:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        if (connection) connection.release(); // ADDED
    }
};


exports.getAllLoanRequests = async (req, res) => {
  try {
    const [loans] = await pool.query('SELECT l.*, a.owner as owner_name FROM loan_requests l JOIN accounts a ON l.user_id = a.id ORDER BY date_requested DESC');
    res.json(loans);
  } catch (err) {
    console.error('GET ALL LOANS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateLoanStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
  
  const connection = await pool.getConnection(); // ADDED

  try {
    await connection.beginTransaction(); // ADDED

    const [loanResult] = await connection.query('SELECT * FROM loan_requests WHERE id = ? AND status = "Pending"', [id]);
    if (loanResult.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Pending loan not found or already processed.' });
    }
    const loan = loanResult[0];

    await connection.query('UPDATE loan_requests SET status = ? WHERE id = ?', [status, id]);
    
    if (status === 'Approved') {
      await connection.query('INSERT INTO transactions (user_id, amount, date, description) VALUES (?, ?, NOW(), ?)', [loan.user_id, loan.amount, `Loan #${id} approved`]);
    }

    await connection.commit(); // ADDED
    res.json({ message: `Loan request #${id} has been ${status.toLowerCase()}.` });
  } catch (err) {
    await connection.rollback(); // ADDED
    console.error('UPDATE LOAN STATUS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    if (connection) connection.release(); // ADDED
  }
};