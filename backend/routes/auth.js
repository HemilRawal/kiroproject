const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, resendOTP, getMe, forgotPassword, resetPassword, verifyResetOTP } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin, validateVerifyOTP, validateResendOTP } = require('../middleware/validate');

// POST /api/auth/register
router.post('/register', validateRegister, register);

// POST /api/auth/login
router.post('/login', validateLogin, login);

// POST /api/auth/verify-email
router.post('/verify-email', validateVerifyOTP, verifyEmail);

// POST /api/auth/resend-otp
router.post('/resend-otp', validateResendOTP, resendOTP);

// GET /api/auth/me  (requires token)
router.get('/me', protect, getMe);

// POST /api/auth/forgot-password
router.post('/forgot-password', validateResendOTP, forgotPassword);

// POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', verifyResetOTP);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// POST /api/auth/google
router.post('/google', require('../controllers/authController').googleAuth);

module.exports = router;
