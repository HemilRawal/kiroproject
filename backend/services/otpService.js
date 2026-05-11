// services/otpService.js
// ─────────────────────────────────────────────────────────────
// OTP generation, storage, and verification.
// OTPs are hashed before storage and expire after 10 minutes.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../config/db');

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a random 6-digit numeric OTP.
 * @returns {string} 6-digit OTP code
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Store a hashed OTP in the verification_otps table.
 * Invalidates any previous unused OTPs for the same identifier+type+role.
 *
 * @param {string} identifier - Email or phone number
 * @param {string} otpCode    - Plain-text 6-digit OTP
 * @param {string} type       - 'email' or 'phone'
 * @param {string} role       - 'buyer' or 'manufacturer'
 */
const storeOTP = async (identifier, otpCode, type, role) => {
  // Mark all previous OTPs for this identifier as used (invalidate)
  await supabase
    .from('verification_otps')
    .update({ used: true })
    .eq('identifier', identifier.toLowerCase())
    .eq('otp_type', type)
    .eq('user_role', role)
    .eq('used', false);

  // Hash the OTP before storing
  const hashedOTP = await bcrypt.hash(otpCode, 8);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('verification_otps')
    .insert({
      identifier: identifier.toLowerCase(),
      otp_code: hashedOTP,
      otp_type: type,
      user_role: role,
      expires_at: expiresAt,
    });

  if (error) {
    console.error('[OTP] Failed to store OTP:', error.message);
    throw new Error('Failed to store verification code.');
  }
};

/**
 * Verify an OTP code against the stored hash.
 *
 * @param {string} identifier - Email or phone number
 * @param {string} otpCode    - Plain-text OTP entered by user
 * @param {string} type       - 'email' or 'phone'
 * @param {string} role       - 'buyer' or 'manufacturer'
 * @returns {Promise<{valid: boolean, message: string}>}
 */
const verifyOTP = async (identifier, otpCode, type, role) => {
  // Get the latest unused OTP for this identifier
  const { data: records, error } = await supabase
    .from('verification_otps')
    .select('*')
    .eq('identifier', identifier.toLowerCase())
    .eq('otp_type', type)
    .eq('user_role', role)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !records || records.length === 0) {
    return { valid: false, message: 'No verification code found. Please request a new one.' };
  }

  const record = records[0];

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    // Mark as used since it's expired
    await supabase
      .from('verification_otps')
      .update({ used: true })
      .eq('id', record.id);

    return { valid: false, message: 'Verification code has expired. Please request a new one.' };
  }

  // Compare OTP
  const isMatch = await bcrypt.compare(otpCode, record.otp_code);

  if (!isMatch) {
    return { valid: false, message: 'Invalid verification code. Please try again.' };
  }

  // Mark as used
  await supabase
    .from('verification_otps')
    .update({ used: true })
    .eq('id', record.id);

  return { valid: true, message: 'Verification successful.' };
};

module.exports = { generateOTP, storeOTP, verifyOTP };
