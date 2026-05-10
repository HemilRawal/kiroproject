// services/emailService.js
// ─────────────────────────────────────────────────────────────
// Email service using Resend.com
// Sends branded OTP verification emails.
// ─────────────────────────────────────────────────────────────

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email verification OTP to the user.
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} userName - User's full name for personalization
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendEmailOTP = async (toEmail, otpCode, userName = 'User') => {
  try {
    const { data, error } = await resend.emails.send({
      from: `Bharat Modules <${process.env.FROM_EMAIL || 'noreply@bharatmodules.com'}>`,
      to: [toEmail],
      subject: `${otpCode} is your Bharat Modules verification code`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden; border: 1px solid #222;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #e85d04, #f48c06); padding: 32px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
              Bharat Modules
            </h1>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">
              B2B Solar & Energy Platform
            </p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <p style="color: #e0e0e0; font-size: 15px; margin: 0 0 8px;">
              Hi <strong style="color: #fff;">${userName}</strong>,
            </p>
            <p style="color: #aaa; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">
              Use the code below to verify your email address. This code expires in <strong style="color: #f48c06;">10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background: #161616; border: 1px solid #333; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <div style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #f48c06; font-family: 'Courier New', monospace;">
                ${otpCode}
              </div>
            </div>

            <p style="color: #888; font-size: 12px; margin: 0; line-height: 1.5;">
              If you didn't request this code, you can safely ignore this email.
              Someone might have entered your email address by mistake.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #0d0d0d; padding: 16px 24px; border-top: 1px solid #1a1a1a; text-align: center;">
            <p style="color: #555; font-size: 11px; margin: 0;">
              &copy; ${new Date().getFullYear()} Bharat Modules. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[EMAIL] OTP sent to ${toEmail} (ID: ${data?.id})`);
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] Failed to send OTP:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmailOTP };
