const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const { register, login, getAccountProfile, updateAccountProfile, changePassword, forgotPassword, resetPassword } = require('../../controllers/auth/authController');
const { verifyToken } = require('../../middlewares/authMiddleware');

const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.'
  }
});

router.post('/register', register);
router.post('/login', login);
router.get('/profile', verifyToken, getAccountProfile);
router.put('/profile', verifyToken, updateAccountProfile);
router.put('/password', verifyToken, changePassword);
router.post('/forgot-password', forgotPasswordRateLimit, forgotPassword);
router.post('/reset-password', resetPassword);
module.exports = router;