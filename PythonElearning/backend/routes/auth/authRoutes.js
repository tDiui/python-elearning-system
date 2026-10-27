const express = require('express');
const router = express.Router();
const { register, login, getAccountProfile, updateAccountProfile, forgotPassword, resetPassword } = require('../../controllers/auth/authController');
const { verifyToken } = require('../../middlewares/authMiddleware');


router.post('/register', register);
router.post('/login', login);
router.get('/profile', verifyToken, getAccountProfile);
router.put('/profile', verifyToken, updateAccountProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
module.exports = router;