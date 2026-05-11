const axios = require('axios');

/**
 * Service to handle SMS OTPs via MSG91
 */
const smsService = {
  /**
   * Send OTP to a mobile number
   * @param {string} mobile - Mobile number with country code (e.g. 919876543210)
   */
  sendOTP: async (mobile) => {
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      const templateId = process.env.MSG91_TEMPLATE_ID;

      if (!authKey) {
        console.error('[SMS] MSG91_AUTH_KEY is missing in .env');
        return { success: false, message: 'SMS service configuration missing.' };
      }

      // MSG91 OTP API v5
      const response = await axios.get('https://api.msg91.com/api/v5/otp', {
        params: {
          authkey: authKey,
          mobile: mobile,
          template_id: templateId,
          // If no template is provided, MSG91 might use a default one for test accounts, 
          // but usually it's required for India.
        }
      });

      if (response.data.type === 'success') {
        console.log(`[SMS] OTP sent successfully to ${mobile}`);
        return { success: true };
      } else {
        console.error('[SMS] MSG91 Error:', response.data);
        return { success: false, message: response.data.message || 'Failed to send SMS.' };
      }
    } catch (error) {
      console.error('[SMS] Connection Error:', error.message);
      return { success: false, message: 'Could not connect to SMS service.' };
    }
  },

  /**
   * Verify an OTP sent to a mobile number
   * @param {string} mobile - Mobile number with country code
   * @param {string} otp - The 4-6 digit OTP to verify
   */
  verifyOTP: async (mobile, otp) => {
    try {
      const authKey = process.env.MSG91_AUTH_KEY;

      const response = await axios.get('https://api.msg91.com/api/v5/otp/verify', {
        params: {
          authkey: authKey,
          mobile: mobile,
          otp: otp
        }
      });

      if (response.data.type === 'success') {
        console.log(`[SMS] OTP verified successfully for ${mobile}`);
        return { success: true };
      } else {
        console.error('[SMS] MSG91 Verify Error:', response.data);
        return { success: false, message: response.data.message || 'Invalid OTP.' };
      }
    } catch (error) {
      console.error('[SMS] Verify Connection Error:', error.message);
      return { success: false, message: 'Verification service error.' };
    }
  },

  /**
   * Resend an OTP
   * @param {string} mobile - Mobile number with country code
   */
  resendOTP: async (mobile) => {
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      const response = await axios.get('https://api.msg91.com/api/v5/otp/retry', {
        params: {
          authkey: authKey,
          mobile: mobile,
          retrytype: 'text' // can be 'text' or 'voice'
        }
      });

      if (response.data.type === 'success') {
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return { success: false, message: 'Resend service error.' };
    }
  }
};

module.exports = smsService;
