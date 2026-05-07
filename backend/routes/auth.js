const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, resendOTP, getMe } = require('../controllers/authController');
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


module.exports = router;
