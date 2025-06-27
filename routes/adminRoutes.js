const express = require('express');
const { 
  getAllUsers, 
  deleteUserByAdmin, 
  getAllLoanRequests, 
  updateLoanStatus 
} = require('../controllers/adminController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authenticateToken, isAdmin);

router.get('/users', getAllUsers);
router.delete('/delete-user/:id', deleteUserByAdmin);
router.get('/loans', getAllLoanRequests);
router.patch('/loan/:id', updateLoanStatus);

module.exports = router;