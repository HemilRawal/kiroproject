// middleware/validate.js
// ─────────────────────────────────────────────────────────────
// Input validation helpers.
// We sanitize and validate before touching the database.
// ─────────────────────────────────────────────────────────────

const validator = require('validator');

// Sanitize a string — trim whitespace, remove HTML tags
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(validator.trim(str));
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

  if (role && !['buyer', 'manufacturer'].includes(role)) {
    errors.push('Role must be buyer or manufacturer.');
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
  const { email, password } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password) {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.email = validator.normalizeEmail(email);
  next();
};

module.exports = { validateRegister, validateLogin, sanitize };
