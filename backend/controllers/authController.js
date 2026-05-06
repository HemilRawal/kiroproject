// controllers/authController.js
// ─────────────────────────────────────────────────────────────
// Handles: register, login, verifyEmail, resendOTP, getMe
//
// Architecture:
//   - Buyers  → user_buyers table
//   - Manufacturers → user_manufacturers table
//   - Same email CANNOT exist in both tables
//   - Email must be verified before login is allowed
//   - Passwords hashed with bcrypt (cost factor 12)
//   - JWT signed with role, expires in 7 days
// ─────────────────────────────────────────────────────────────

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/db');
const { generateOTP, storeOTP, verifyOTP } = require('../services/otpService');
const { sendEmailOTP } = require('../services/emailService');

// ── Helpers ──────────────────────────────────────────────────

const getTable = (role) => {
  if (role === 'manufacturer') return 'user_manufacturers';
  return 'user_buyers';
};

const getOtherTable = (role) => {
  if (role === 'manufacturer') return 'user_buyers';
  return 'user_manufacturers';
};

const signToken = (user, role) => {
  return jwt.sign(
    { id: user.id, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const sanitizeUser = (user, role) => {
  const { password_hash, ...safe } = user;
  return { ...safe, role };
};

// ── POST /api/auth/register ──────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, role = 'buyer', company_name } = req.body;
    const table = getTable(role);
    const otherTable = getOtherTable(role);

    // 1. Check if email exists in the SAME role table
    const { data: existingSame } = await supabase
      .from(table)
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingSame) {
      return res.status(409).json({
        success: false,
        message: `An account with this email already exists as a ${role}.`,
      });
    }

    // 2. Check if email exists in the OTHER role table
    const { data: existingOther } = await supabase
      .from(otherTable)
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingOther) {
      const otherRole = role === 'buyer' ? 'manufacturer' : 'buyer';
      return res.status(409).json({
        success: false,
        message: `This email is already registered as a ${otherRole}. The same email cannot be used for both roles.`,
      });
    }

    // 3. Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // 4. Insert user into the correct table
    const { data: user, error } = await supabase
      .from(table)
      .insert({
        email: email.toLowerCase(),
        password_hash,
        full_name,
        phone: phone || null,
        company_name: company_name || null,
        email_verified: false,
        phone_verified: false,
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Generate and send email OTP
    const otpCode = generateOTP();
    await storeOTP(email, otpCode, 'email', role);

    const emailResult = await sendEmailOTP(email, otpCode, full_name);
    if (!emailResult.success) {
      console.error('[REGISTER] Email OTP send failed:', emailResult.error);
      // Don't block registration — user can resend OTP
    }

    // 6. Return success WITHOUT token — must verify email first
    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for the verification code.',
      requiresVerification: true,
      email: user.email,
      role,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-email ──────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp, role = 'buyer' } = req.body;
    const table = getTable(role);

    // 1. Verify the OTP
    const result = await verifyOTP(email, otp, 'email', role);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    // 2. Mark email as verified in the correct table
    const { data: user, error } = await supabase
      .from(table)
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .select()
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // 3. Issue JWT token now that email is verified
    const token = signToken(user, role);

    res.json({
      success: true,
      message: 'Email verified successfully.',
      token,
      user: sanitizeUser(user, role),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/resend-otp ────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email, role = 'buyer' } = req.body;
    const table = getTable(role);

    // Check user exists
    const { data: user } = await supabase
      .from(table)
      .select('id, full_name, email_verified')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified.',
      });
    }

    // Generate and send new OTP
    const otpCode = generateOTP();
    await storeOTP(email, otpCode, 'email', role);

    const emailResult = await sendEmailOTP(email, otpCode, user.full_name);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }

    res.json({
      success: true,
      message: 'A new verification code has been sent to your email.',
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password, role = 'buyer' } = req.body;
    const table = getTable(role);
    const invalidMsg = 'Invalid email or password.';

    // 1. Fetch user from the role-specific table
    const { data: user, error } = await supabase
      .from(table)
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user) {
      // Check if user exists in the other table to give a helpful message
      const otherTable = getOtherTable(role);
      const { data: otherUser } = await supabase
        .from(otherTable)
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (otherUser) {
        const otherRole = role === 'buyer' ? 'manufacturer' : 'buyer';
        return res.status(401).json({
          success: false,
          message: `This email is registered as a ${otherRole}, not as a ${role}. Please switch to ${otherRole} login.`,
          suggestedRole: otherRole,
        });
      }

      return res.status(401).json({ success: false, message: invalidMsg });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    // 3. Check email verification
    if (!user.email_verified) {
      // Send a new OTP automatically
      const otpCode = generateOTP();
      await storeOTP(email, otpCode, 'email', role);
      await sendEmailOTP(email, otpCode, user.full_name);

      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. A new verification code has been sent.',
        requiresVerification: true,
        email: user.email,
        role,
      });
    }

    // 4. Issue JWT
    const token = signToken(user, role);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: sanitizeUser(user, role),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const table = getTable(req.user.role);

    const { data: user, error } = await supabase
      .from(table)
      .select('id, email, full_name, phone, company_name, email_verified, phone_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user: { ...user, role: req.user.role } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, verifyEmail, resendOTP, getMe };
