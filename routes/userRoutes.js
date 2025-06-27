const express = require('express');
const { 
  getDashboardData, 
  deposit, 
  withdraw, 
  transferMoney, 
  requestLoan, 
  repayLoan, 
  closeAccount,
  getPassbookData  
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authenticateToken);

router.get('/dashboard-data', getDashboardData);
router.post('/deposit', deposit);
router.post('/withdraw', withdraw);
router.post('/transfer', transferMoney);
router.post('/loan/request', requestLoan);
router.post('/loan/repay/:id', repayLoan);
router.post('/close', closeAccount);
router.post('/passbook', getPassbookData);

module.exports = router;