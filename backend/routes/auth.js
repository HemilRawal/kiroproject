const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, resendOTP, getMe, sendPhoneOTP, verifyPhoneOTP, resendPhoneOTP } = require('../controllers/authController');
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

// Phone Verification (MSG91)
router.post('/send-phone-otp', sendPhoneOTP);
router.post('/verify-phone-otp', verifyPhoneOTP);
router.post('/resend-phone-otp', resendPhoneOTP);

// GET /api/auth/me  (requires token)
router.get('/me', protect, getMe);

module.exports = router;
