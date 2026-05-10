// controllers/authController.js
// ─────────────────────────────────────────────────────────────
// Handles: register, login, verify-email, resend-otp, getMe
//
// Security:
//   - Passwords hashed with bcrypt (cost 12)
//   - JWT signed with JWT_SECRET
//   - Role separation: buyers and manufacturers are SEPARATE tables
//   - Login enforces role — a manufacturer cannot log in as a buyer
//   - OTP is 6-digit, expires in 10 minutes, single-use
// ─────────────────────────────────────────────────────────────

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const resend = require('../config/resend');
const supabase = require('../config/db');

// ── Helpers ──────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// Returns the correct table name based on role
const tableFor = (role) =>
  role === 'manufacturer' ? 'user_manufacturers' : 'user_buyers';

// Generate a 6-digit numeric OTP
const generateOTP = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// Send OTP email via Resend
const sendOTPEmail = async (email, otp, role) => {
  const roleLabel = role === 'manufacturer' ? 'Manufacturer' : 'Buyer';
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'no-reply@bharatmodules.com',
      to: email,
      subject: `Your Bharat Modules verification code: ${otp}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#0a0a0a;margin-bottom:8px;">Verify your ${roleLabel} account</h2>
          <p style="color:#555;margin-bottom:24px;">Use the code below to complete your registration. It expires in 10 minutes.</p>
          <div style="background:#f5f5f3;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#e85c0d;">${otp}</span>
          </div>
          <p style="color:#999;font-size:13px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    // Log but don't crash — OTP is still saved in DB
    console.error('Resend email failed:', err.message);
  }
};

// ── POST /api/auth/register ───────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, role = 'buyer', company_name } = req.body;
    const table = tableFor(role);

    // Check if email already exists in this role's table
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Also check the OTHER role's table — same email can't be in both
    const otherTable = tableFor(role === 'buyer' ? 'manufacturer' : 'buyer');
    const { data: otherExists } = await supabase
      .from(otherTable)
      .select('id')
      .eq('email', email)
      .single();

    if (otherExists) {
      const otherRole = role === 'buyer' ? 'manufacturer' : 'buyer';
      return res.status(409).json({
        success: false,
        message: `This email is already registered as a ${otherRole}. Please use a different email or log in as a ${otherRole}.`,
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Insert into role-specific table
    const insertData = {
      email,
      password_hash,
      full_name,
      phone,
      email_verified: false,
    };
    if (company_name) insertData.company_name = company_name;

    const { data: user, error } = await supabase
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Generate and store OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    await supabase.from('verification_otps').insert({
      identifier: email,
      otp_code:   otp,
      otp_type:   'email',
      user_role:  role,
      expires_at: expiresAt,
    });

    // Send OTP email
    await sendOTPEmail(email, otp, role);

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for the verification code.',
      email: user.email,
      role,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-email ───────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp, role } = req.body;

    if (!email || !otp || !role) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and role are required.' });
    }

    // Find a valid, unused OTP
    const { data: record, error } = await supabase
      .from('verification_otps')
      .select('*')
      .eq('identifier', email)
      .eq('otp_type', 'email')
      .eq('user_role', role)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.',
      });
    }

    if (record.otp_code !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect verification code.',
      });
    }

    // Mark OTP as used
    await supabase
      .from('verification_otps')
      .update({ used: true })
      .eq('id', record.id);

    // Mark user as verified in their role table
    const table = tableFor(role);
    const { data: user, error: updateErr } = await supabase
      .from(table)
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('email', email)
      .select()
      .single();

    if (updateErr || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Also sync to the main users table (for RFQ/order foreign keys)
    const { data: mainUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let finalUserId = mainUser?.id;

    if (!mainUser) {
      // Create entry in main users table
      const { data: newMainUser } = await supabase
        .from('users')
        .insert({
          email: user.email,
          password_hash: user.password_hash,
          full_name: user.full_name,
          phone: user.phone,
          role,
          is_verified: true,
        })
        .select()
        .single();
      finalUserId = newMainUser?.id;
    } else {
      await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', mainUser.id);
    }

    const tokenUser = { id: finalUserId || user.id, email: user.email, role };
    const token = signToken(tokenUser);

    res.json({
      success: true,
      message: 'Email verified successfully.',
      token,
      user: {
        id: finalUserId || user.id,
        email: user.email,
        full_name: user.full_name,
        role,
        is_verified: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/resend-otp ─────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const table = tableFor(role);

    const { data: user } = await supabase
      .from(table)
      .select('id, email_verified')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified.' });
    }

    // Invalidate old OTPs
    await supabase
      .from('verification_otps')
      .update({ used: true })
      .eq('identifier', email)
      .eq('otp_type', 'email')
      .eq('user_role', role)
      .eq('used', false);

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from('verification_otps').insert({
      identifier: email,
      otp_code:   otp,
      otp_type:   'email',
      user_role:  role,
      expires_at: expiresAt,
    });

    await sendOTPEmail(email, otp, role);

    res.json({ success: true, message: 'Verification code resent.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password, role: requestedRole = 'buyer' } = req.body;
    const invalidMsg = 'Invalid email or password.';

    // ── Admin login — check main users table ──
    if (requestedRole === 'admin') {
      const { data: adminUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('role', 'admin')
        .eq('is_active', true)
        .single();

      if (error || !adminUser) {
        return res.status(401).json({ success: false, message: invalidMsg });
      }

      const isMatch = await bcrypt.compare(password, adminUser.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: invalidMsg });
      }

      const token = signToken({ id: adminUser.id, email: adminUser.email, role: 'admin' });
      return res.json({
        success: true,
        message: 'Logged in successfully.',
        token,
        user: { id: adminUser.id, email: adminUser.email, full_name: adminUser.full_name, role: 'admin', is_verified: true },
      });
    }

    // ── Buyer / Manufacturer login — check role-specific tables ──
    const table = tableFor(requestedRole);

    const { data: user, error } = await supabase
      .from(table)
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      // Check other role table in parallel — give a helpful message
      const otherRole = requestedRole === 'buyer' ? 'manufacturer' : 'buyer';
      const { data: otherUser } = await supabase
        .from(tableFor(otherRole))
        .select('id')
        .eq('email', email)
        .single();

      if (otherUser) {
        return res.status(401).json({
          success: false,
          message: `This account is registered as a ${otherRole}. Please log in from the ${otherRole} login page.`,
          suggestedRole: otherRole,
        });
      }
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please log in with Google.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: invalidMsg });
    }

    // Block login if email not verified
    if (!user.email_verified) {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      // Fire OTP insert and email in parallel
      await Promise.all([
        supabase.from('verification_otps').insert({
          identifier: email,
          otp_code:   otp,
          otp_type:   'email',
          user_role:  requestedRole,
          expires_at: expiresAt,
        }),
        sendOTPEmail(email, otp, requestedRole),
      ]);
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        role: requestedRole,
        message: 'Please verify your email. A new code has been sent.',
      });
    }

    // Run main users lookup + application status fetch in parallel
    const [mainUserResult, appResult] = await Promise.all([
      supabase.from('users').select('id').eq('email', email).single(),
      requestedRole === 'manufacturer'
        ? supabase
            .from('onboarding_applications')
            .select('status')
            .eq('email', email)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    let mainUser = mainUserResult.data;

    if (!mainUser) {
      // Sync to main users table — needed for onboarding/RFQ foreign keys
      const { data: newMainUser } = await supabase
        .from('users')
        .insert({
          email: user.email,
          password_hash: user.password_hash,
          full_name: user.full_name,
          phone: user.phone,
          role: requestedRole,
          is_verified: true,
        })
        .select('id')
        .single();
      mainUser = newMainUser;
    }

    const tokenUser = {
      id: mainUser?.id || user.id,
      email: user.email,
      role: requestedRole,
    };
    const token = signToken(tokenUser);

    const applicationStatus = appResult.data?.status || null;

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: tokenUser.id,
        email: user.email,
        full_name: user.full_name,
        role: requestedRole,
        is_verified: true,
        application_status: applicationStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────
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

// ── POST /api/auth/forgot-password ────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email, role = 'buyer' } = req.body;
    const table = tableFor(role);

    const { data: user } = await supabase
      .from(table)
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from('verification_otps').insert({
      identifier: 'reset:' + email,
      otp_code:   otp,
      otp_type:   'email',
      user_role:  role,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('OTP Insert Error:', insertError);
      return res.status(500).json({ success: false, message: 'Database error generating OTP.' });
    }

    const roleLabel = role === 'manufacturer' ? 'Manufacturer' : 'Buyer';
    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'no-reply@bharatmodules.com',
        to: email,
        subject: `Password Reset Code: ${otp}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#0a0a0a;margin-bottom:8px;">Reset your ${roleLabel} password</h2>
            <p style="color:#555;margin-bottom:24px;">Use the code below to reset your password. It expires in 10 minutes.</p>
            <div style="background:#f5f5f3;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#e85c0d;">${otp}</span>
            </div>
            <p style="color:#999;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Resend email failed:', err.message);
    }

    res.json({ success: true, message: 'A password reset code has been sent to your email.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password ─────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password, role = 'buyer' } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const { data: record, error } = await supabase
      .from('verification_otps')
      .select('*')
      .eq('identifier', 'reset:' + email)
      .eq('otp_type', 'email')
      .eq('user_role', role)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !record || String(record.otp_code).trim() !== String(otp).trim()) {
      console.log('Reset Password failed. Error:', error, 'Record:', record, 'Provided OTP:', otp);
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    await supabase
      .from('verification_otps')
      .update({ used: true })
      .eq('id', record.id);

    const password_hash = await bcrypt.hash(new_password, 12);
    const table = tableFor(role);

    // Update role specific table
    await supabase
      .from(table)
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('email', email);

    // Update main users table if exists
    await supabase
      .from('users')
      .update({ password_hash })
      .eq('email', email);

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-reset-otp ───────────────────────────
const verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp, role = 'buyer' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const { data: record, error } = await supabase
      .from('verification_otps')
      .select('*')
      .eq('identifier', 'reset:' + email)
      .eq('otp_type', 'email')
      .eq('user_role', role)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !record || String(record.otp_code).trim() !== String(otp).trim()) {
      console.log('Verify Reset OTP failed. Error:', error, 'Record:', record, 'Provided OTP:', otp);
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    // Do NOT mark used yet, wait for actual reset
    res.json({ success: true, message: 'Code verified successfully.' });
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
  forgotPassword,
  verifyResetOTP,
  resetPassword
};

