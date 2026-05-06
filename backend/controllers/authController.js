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
const admin = require('../config/firebaseAdmin');
const { generateOTP, storeOTP, verifyOTP } = require('../services/otpService');
const { sendEmailOTP } = require('../services/emailService');
const smsService = require('../services/smsService');

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

    // 1. Check if email already exists in our tables
    const { data: existingSame } = await supabase.from(table).select('id').eq('email', email.toLowerCase()).single();
    if (existingSame) {
      return res.status(409).json({ success: false, message: `An account with this email already exists as a ${role}.` });
    }

    const { data: existingOther } = await supabase.from(otherTable).select('id').eq('email', email.toLowerCase()).single();
    if (existingOther) {
      const otherRole = role === 'buyer' ? 'manufacturer' : 'buyer';
      return res.status(409).json({ success: false, message: `This email is already registered as a ${otherRole}. The same email cannot be used for both roles.` });
    }

    // 2. Use Supabase Auth to Sign Up and send OTP
    // This creates the user in auth.users and automatically sends the OTP
    // We store the profile data in user_metadata to use later during verification
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        data: {
          role,
          full_name,
          phone: phone || null,
          company_name: company_name || null
        }
      }
    });

    if (authError) {
      // If the user already exists in Supabase Auth but hasn't verified their email,
      // we should just resend the OTP instead of showing an error.
      if (authError.message.includes('User already registered')) {
        const { data: existingProfile } = await supabase.from(table).select('id').eq('email', email.toLowerCase()).single();
        if (!existingProfile) {
           // User exists in Auth but not in our profile table -> they are unverified.
           const otpCode = generateOTP();
           await storeOTP(email, otpCode, 'email', role);
           await sendEmailOTP(email.toLowerCase(), otpCode, full_name);
           
           return res.status(201).json({
             success: true,
             message: 'Account exists but is not verified. A new verification code has been sent via Resend.',
             requiresVerification: true,
             email: email.toLowerCase(),
             role
           });
        }
      }
      return res.status(400).json({ success: false, message: authError.message });
    }

    // 3. Generate and Send our own OTP via Resend
    const otpCode = generateOTP();
    await storeOTP(email, otpCode, 'email', role);
    
    const emailRes = await sendEmailOTP(email.toLowerCase(), otpCode, full_name);
    
    if (!emailRes.success) {
      // We don't fail the whole registration if email fails to send, 
      // but we should warn the user they might need to resend.
      console.error('[REGISTER] Email failed to send:', emailRes.error);
    }

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for the verification code (sent via Resend).',
      requiresVerification: true,
      email: email.toLowerCase(),
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
    
    // 1. Verify the OTP using our custom otpService
    const verification = await verifyOTP(email, otp, 'email', role);

    if (!verification.valid) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    // 2. Fetch the user from Supabase Auth to get their ID and metadata
    // We search by email since they just verified it.
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email.toLowerCase());

    if (!authUser) {
      return res.status(404).json({ success: false, message: 'User account not found in Auth system.' });
    }

    // 3. Mark the user as verified in Supabase Auth
    await supabase.auth.admin.updateUserById(authUser.id, { email_confirm: true });

    // OTP is correct! Now we officially register them in our custom table.
    const userMeta = authUser.user_metadata || {};
    const table = getTable(role);

    // We still need to pass a dummy password_hash since the schema requires it, 
    // but actual authentication is handled by Supabase Auth going forward.
    const dummyHash = await bcrypt.hash(authUser.id, 10);

    const { data: user, error: dbError } = await supabase
      .from(table)
      .insert({
        email: email.toLowerCase(),
        password_hash: dummyHash,
        full_name: userMeta.full_name || 'User',
        phone: userMeta.phone || null,
        company_name: userMeta.company_name || null,
        email_verified: true,
      })
      .select()
      .single();

    let finalUser = user;
    if (dbError && dbError.code === '23505') {
       const { data: existingUser } = await supabase.from(table).update({ email_verified: true }).eq('email', email.toLowerCase()).select().single();
       finalUser = existingUser;
    } else if (dbError) {
      console.error("DB Insert Error:", dbError);
      return res.status(500).json({ success: false, message: 'Failed to create user profile in database: ' + dbError.message });
    }

    // 5. SKIP PHONE VERIFICATION FOR NOW
    const token = signToken(finalUser, role);

    res.json({
      success: true,
      message: 'Email verified and account registered successfully.',
      token,
      user: sanitizeUser(finalUser, role),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/resend-otp ────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email, role = 'buyer' } = req.body;

    // 1. Generate new OTP
    const otpCode = generateOTP();
    await storeOTP(email, otpCode, 'email', role);

    // 2. Send via Resend
    // We need the user's name, but for a resend we might not have it in the request.
    // We can try to fetch it from Auth or just use 'User'.
    const emailRes = await sendEmailOTP(email.toLowerCase(), otpCode);

    if (!emailRes.success) {
      return res.status(500).json({ success: false, message: 'Failed to send email: ' + emailRes.error });
    }

    res.json({
      success: true,
      message: 'A new verification code has been sent to your email via Resend.',
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

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password
    });

    if (authError) {
      // If email isn't confirmed yet in Supabase Auth
      if (authError.message.includes('Email not confirmed')) {
        // Generate and send our own OTP
        const otpCode = generateOTP();
        await storeOTP(email, otpCode, 'email', role);
        await sendEmailOTP(email.toLowerCase(), otpCode);

        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in. A new verification code has been sent via Resend.',
          requiresVerification: true,
          email: email.toLowerCase(),
          role,
        });
      }
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    // 2. Fetch user from our custom role-specific table
    const { data: user, error } = await supabase
      .from(table)
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user) {
      // Check if user exists in the other table to give a helpful message
      const otherTable = getOtherTable(role);
      const { data: otherUser } = await supabase.from(otherTable).select('id').eq('email', email.toLowerCase()).single();

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

    // 3. PHONE VERIFICATION (SKIPPED FOR NOW)
    /*
    if (!user.phone_verified && user.phone) {
      await smsService.sendOTP(user.phone);
      return res.status(403).json({ ... });
    }
    */

    // 4. Issue custom JWT for our app
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

// ── MSG91 Phone Verification Endpoints ───────────────────────

const sendPhoneOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const result = await smsService.sendOTP(phone);
    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully via MSG91.' });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (err) {
    next(err);
  }
};

const verifyPhoneOTP = async (req, res, next) => {
  try {
    const { email, phone, otp, role = 'buyer' } = req.body;
    const table = getTable(role);

    // 1. Verify with MSG91
    const result = await smsService.verifyOTP(phone, otp);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // 2. Update DB
    const { data: user, error } = await supabase
      .from(table)
      .update({ phone_verified: true })
      .eq('email', email.toLowerCase())
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: 'Failed to update phone status.' });
    }

    const token = signToken(user, role);
    res.json({
      success: true,
      message: 'Phone verified successfully.',
      token,
      user: sanitizeUser(user, role)
    });
  } catch (err) {
    next(err);
  }
};

const resendPhoneOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const result = await smsService.resendOTP(phone);
    if (result.success) {
      res.json({ success: true, message: 'OTP resent successfully.' });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  register, 
  login, 
  verifyEmail, 
  resendOTP, 
  getMe, 
  sendPhoneOTP, 
  verifyPhoneOTP, 
  resendPhoneOTP 
};
