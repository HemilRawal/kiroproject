// controllers/authController.js
// ─────────────────────────────────────────────────────────────
// Handles: register, login, getMe
//
// Security practices used here:
//   - Passwords hashed with bcrypt (cost factor 12)
//   - JWT signed with secret, expires in 7 days
//   - We never return password_hash in responses
//   - Timing-safe comparison via bcrypt.compare
// ─────────────────────────────────────────────────────────────

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/db');

// Helper: sign a JWT token for a user
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper: return user data without sensitive fields
const sanitizeUser = (user) => {
  const { password_hash, ...safe } = user;
  return safe;
};

// ── POST /api/auth/register ──────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, role = 'buyer' } = req.body;

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Hash password — cost factor 12 is a good balance of security vs speed
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, password_hash, full_name, phone, role })
      .select()
      .single();

    if (error) throw error;

    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user including password_hash (we select it explicitly)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    // Use the same error message whether email or password is wrong
    // This prevents "user enumeration" attacks
    const invalidMsg = 'Invalid email or password.';

    if (error || !user) {
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please log in with Google.',
      });
    }

    // bcrypt.compare is timing-safe
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    const token = signToken(user);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────
// Returns the currently logged-in user's profile
const getMe = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, is_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
