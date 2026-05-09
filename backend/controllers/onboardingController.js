// controllers/onboardingController.js
// ─────────────────────────────────────────────────────────────
// Handles manufacturer onboarding application submission
// and admin review (approve / reject)
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ── POST /api/onboarding/submit ───────────────────────────────
// Manufacturer submits their full onboarding application
const submitApplication = async (req, res, next) => {
  try {
    const {
      company_name, full_name, phone, gstin, msme_number, pan_number,
      company_address, city, state, pincode, website, description,
      component_categories, nda_signed, signer_name, signer_role,
      gst_doc_url, msme_doc_url, pan_doc_url, coi_doc_url, factory_doc_url
    } = req.body;

    if (!company_name || !gstin) {
      return res.status(400).json({
        success: false,
        message: 'Company name and GSTIN are required.',
      });
    }

    // Check if application already exists for this user
    const { data: existing } = await supabase
      .from('onboarding_applications')
      .select('id, status')
      .eq('user_id', req.user.id)
      .single();

    if (existing) {
      if (existing.status === 'approved') {
        return res.status(409).json({
          success: false,
          message: 'Your application has already been approved.',
        });
      }
      if (existing.status === 'pending' || existing.status === 'under_review') {
        return res.status(409).json({
          success: false,
          message: 'Your application is already under review.',
          application_id: existing.id,
        });
      }
      // If rejected, allow resubmission — update existing record
      const { data: updated, error } = await supabase
        .from('onboarding_applications')
        .update({
          company_name, full_name, phone, gstin, msme_number, pan_number,
          company_address, city, state, pincode, website, description,
          component_categories, nda_signed, signer_name, signer_role,
          gst_doc_url, msme_doc_url, pan_doc_url, coi_doc_url, factory_doc_url,
          status: 'pending',
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase Update Error:', error);
        throw error;
      }
      return res.json({
        success: true,
        message: 'Application resubmitted for review.',
        application_id: updated.id,
      });
    }

    // Get user email
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.id)
      .single();

    const { data: application, error } = await supabase
      .from('onboarding_applications')
      .insert({
        user_id: req.user.id,
        email: user?.email || req.user.email,
        company_name, full_name, phone, gstin, msme_number, pan_number,
        company_address, city, state, pincode, website, description,
        component_categories, nda_signed, signer_name, signer_role,
        gst_doc_url, msme_doc_url, pan_doc_url, coi_doc_url, factory_doc_url,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase Insert Error:', error);
      throw error;
    }

    // Notify admin
    try {
      console.log('Sending admin notification via Resend...');
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'no-reply@bharatmodules.com',
        to: process.env.TEAM_EMAIL || 'admin@bharatmodules.com',
        subject: `New Manufacturer Application: ${company_name}`,
        html: `
          <h2>New Onboarding Application</h2>
          <p><strong>Company:</strong> ${company_name}</p>
          <p><strong>GSTIN:</strong> ${gstin}</p>
          <p><strong>Contact:</strong> ${full_name} — ${phone}</p>
          <p><strong>Email:</strong> ${user?.email}</p>
          <p>Review at: <a href="${process.env.FRONTEND_URL}/admin_portal.html">Admin Portal</a></p>
        `,
      });
      console.log('Admin notification sent.');
    } catch (emailErr) {
      console.error('Admin notification email failed:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. You will be notified once reviewed.',
      application_id: application.id,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/onboarding/status ────────────────────────────────
// Manufacturer checks their own application status
const getMyStatus = async (req, res, next) => {
  try {
    const { data: application, error } = await supabase
      .from('onboarding_applications')
      .select('id, status, admin_notes, submitted_at, reviewed_at, company_name')
      .eq('user_id', req.user.id)
      .single();

    if (error || !application) {
      return res.json({
        success: true,
        status: 'not_submitted',
        message: 'No application found.',
      });
    }

    res.json({ success: true, application });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/applications ───────────────────────────────
// Admin: list all applications
const listApplications = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('onboarding_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: applications, error } = await query;
    if (error) throw error;

    res.json({ success: true, applications });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/applications/:id ──────────────────────────
// Admin: get single application detail
const getApplication = async (req, res, next) => {
  try {
    const { data: application, error } = await supabase
      .from('onboarding_applications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    res.json({ success: true, application });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/applications/:id/review ─────────────────
// Admin: approve or reject an application
// NOTE: No email is sent. Manufacturer sees status via dashboard polling.
const reviewApplication = async (req, res, next) => {
  try {
    const { decision, admin_notes } = req.body; // decision: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approved or rejected.' });
    }

    const { data: application, error: fetchErr } = await supabase
      .from('onboarding_applications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Update application status
    const { error: updateErr } = await supabase
      .from('onboarding_applications')
      .update({
        status: decision,
        admin_notes: admin_notes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;

    if (decision === 'approved') {
      // Create/update manufacturer profile in manufacturers table
      const { data: existingMfr } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('user_id', application.user_id)
        .single();

      if (existingMfr) {
        await supabase
          .from('manufacturers')
          .update({
            company_name: application.company_name,
            gstin: application.gstin,
            msme_number: application.msme_number,
            pan_number: application.pan_number,
            company_address: application.company_address,
            city: application.city,
            state: application.state,
            pincode: application.pincode,
            website: application.website,
            description: application.description,
            verification_status: 'approved',
            nda_signed: application.nda_signed,
            nda_signed_at: application.nda_signed ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMfr.id);
      } else {
        await supabase.from('manufacturers').insert({
          user_id: application.user_id,
          company_name: application.company_name,
          gstin: application.gstin,
          msme_number: application.msme_number,
          pan_number: application.pan_number,
          company_address: application.company_address,
          city: application.city,
          state: application.state,
          pincode: application.pincode,
          website: application.website,
          description: application.description,
          verification_status: 'approved',
          nda_signed: application.nda_signed,
          nda_signed_at: application.nda_signed ? new Date().toISOString() : null,
        });
      }

      // Update user role to manufacturer in main users table
      await supabase
        .from('users')
        .update({ role: 'manufacturer', is_verified: true })
        .eq('id', application.user_id);
    }

    // Send email to applicant
    try {
      const subject = decision === 'approved'
        ? 'Your Bharat Modules application has been approved!'
        : 'Update on your Bharat Modules application';

      const html = decision === 'approved'
        ? `
          <h2>Congratulations! Your application is approved.</h2>
          <p>Your manufacturer account on Bharat Modules has been verified. You can now log in and access your dashboard.</p>
          <p><a href="${process.env.FRONTEND_URL}/login-page.html">Log in to your dashboard →</a></p>
        `
        : `
          <h2>Application Update</h2>
          <p>We regret to inform you that your application has not been approved at this time.</p>
          ${admin_notes ? `<p><strong>Reason:</strong> ${admin_notes}</p>` : ''}
          <p>You may resubmit your application after addressing the above concerns.</p>
          <p>For queries, contact us at ${process.env.TEAM_EMAIL}.</p>
        `;

      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'no-reply@bharatmodules.com',
        to: application.email,
        subject,
        html,
      });
    } catch (emailErr) {
      console.error('Applicant notification email failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: `Application ${decision} successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/manufacturers/compliance-docs ─────────────────
// Manufacturer updates their compliance document URLs
const updateComplianceDocs = async (req, res, next) => {
  try {
    const { gst_doc_url, msme_doc_url, pan_doc_url, coi_doc_url, factory_doc_url } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('onboarding_applications')
      .select('id, status')
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, message: 'No application found.' });
    }

    const updates = {};
    if (gst_doc_url     !== undefined) updates.gst_doc_url     = gst_doc_url;
    if (msme_doc_url    !== undefined) updates.msme_doc_url    = msme_doc_url;
    if (pan_doc_url     !== undefined) updates.pan_doc_url     = pan_doc_url;
    if (coi_doc_url     !== undefined) updates.coi_doc_url     = coi_doc_url;
    if (factory_doc_url !== undefined) updates.factory_doc_url = factory_doc_url;
    updates.updated_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('onboarding_applications')
      .update(updates)
      .eq('id', existing.id);

    if (updateErr) throw updateErr;

    res.json({ success: true, message: 'Compliance documents updated successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitApplication,
  getMyStatus,
  listApplications,
  getApplication,
  reviewApplication,
  updateComplianceDocs,
};
