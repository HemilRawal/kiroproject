// middleware/validate.js
// ─────────────────────────────────────────────────────────────
// Input validation helpers.
// We sanitize and validate before touching the database.
// ─────────────────────────────────────────────────────────────

const validator = require('validator');
const https     = require('https');

// Sanitize a string — trim whitespace, remove HTML tags
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(validator.trim(str));
};

// Verify reCAPTCHA token with Google
const verifyRecaptcha = (token) => {
  return new Promise((resolve) => {
    if (!token) return resolve(false);
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return resolve(true); // skip if not configured (local dev)
    const postData = `secret=${secret}&response=${token}`;
    const req = https.request({
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.success === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
};

// reCAPTCHA middleware
const validateRecaptcha = async (req, res, next) => {
  const token = req.body.recaptchaToken;
  const valid = await verifyRecaptcha(token);
  if (!valid) {
    return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed. Please try again.' });
  }
  next();
};

// Validate registration input
const validateRegister = (req, res, next) => {
  const { email, password, full_name, role } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }

  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }

  // Password strength: at least one letter and one number
  if (password && !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one letter and one number.');
  }

  if (!role || !['buyer', 'manufacturer'].includes(role)) {
    errors.push('Role is required and must be buyer or manufacturer.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Sanitize
  req.body.email = validator.normalizeEmail(email);
  req.body.full_name = sanitize(full_name);

  next();
};

// Validate login input
const validateLogin = (req, res, next) => {
  const { email, password, role } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password) {
    errors.push('Password is required.');
  }

  if (!role || !['buyer', 'manufacturer', 'admin'].includes(role)) {
    errors.push('Role is required. Please select Buyer or Manufacturer.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.email = validator.normalizeEmail(email);
  next();
};

// Validate OTP verification input
const validateVerifyOTP = (req, res, next) => {
  const { email, otp, role } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!otp || !/^\d{6}$/.test(otp)) {
    errors.push('A valid 6-digit verification code is required.');
  }

  if (!role || !['buyer', 'manufacturer'].includes(role)) {
    errors.push('Role is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.email = validator.normalizeEmail(email);
  next();
};

// Validate resend OTP input
const validateResendOTP = (req, res, next) => {
  const { email, role } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!role || !['buyer', 'manufacturer'].includes(role)) {
    errors.push('Role is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.email = validator.normalizeEmail(email);
  next();
};

module.exports = { validateRegister, validateLogin, validateVerifyOTP, validateResendOTP, validateRecaptcha, sanitize };
