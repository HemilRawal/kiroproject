// controllers/contactController.js
// ─────────────────────────────────────────────────────────────
// Handles contact form submissions and sends email via Resend
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── POST /api/contact ────────────────────────────────────────
const submitEnquiry = async (req, res, next) => {
  try {
    const { name, email, phone, company, subject, message, enquiry_type } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.',
      });
    }

    // Save to database
    const { data: enquiry, error } = await supabase
      .from('contact_enquiries')
      .insert({ name, email, phone, company, subject, message, enquiry_type })
      .select()
      .single();

    if (error) throw error;

    // Send notification email to the team
    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: process.env.TEAM_EMAIL,
        subject: `New Enquiry: ${subject || enquiry_type || 'General'} from ${name}`,
        html: `
          <h2>New Contact Enquiry</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Type:</strong> ${enquiry_type || 'General'}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `,
      });
    } catch (emailErr) {
      // Don't fail the request if email fails — just log it
      console.error('Email send failed:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Your enquiry has been received. We will respond within 24 hours.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { submitEnquiry };
