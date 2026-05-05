// controllers/manufacturerController.js
// ─────────────────────────────────────────────────────────────
// Manufacturer onboarding, profile, and portal operations
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');

// ── POST /api/manufacturers/onboard ─────────────────────────
// Step 1 of onboarding: submit company details
const onboard = async (req, res, next) => {
  try {
    const {
      company_name, gstin, msme_number, pan_number,
      company_address, city, state, pincode, website, description,
    } = req.body;

    if (!company_name || !gstin) {
      return res.status(400).json({
        success: false,
        message: 'Company name and GSTIN are required.',
      });
    }

    // Check if this user already has a manufacturer profile
    const { data: existing } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A manufacturer profile already exists for this account.',
      });
    }

    const { data: manufacturer, error } = await supabase
      .from('manufacturers')
      .insert({
        user_id: req.user.id,
        company_name, gstin, msme_number, pan_number,
        company_address, city, state, pincode, website, description,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Also update the user's role to manufacturer
    await supabase
      .from('users')
      .update({ role: 'manufacturer' })
      .eq('id', req.user.id);

    res.status(201).json({
      success: true,
      message: 'Manufacturer profile created. Pending verification.',
      manufacturer,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/manufacturers/me ────────────────────────────────
// Get the logged-in manufacturer's own profile
const getMyProfile = async (req, res, next) => {
  try {
    const { data: manufacturer, error } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error || !manufacturer) {
      return res.status(404).json({
        success: false,
        message: 'Manufacturer profile not found.',
      });
    }

    res.json({ success: true, manufacturer });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/manufacturers/rfqs ──────────────────────────────
// Manufacturer sees all RFQs they can respond to (status: submitted or under_review)
const getIncomingRFQs = async (req, res, next) => {
  try {
    // Get manufacturer id first
    const { data: manufacturer } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!manufacturer) {
      return res.status(403).json({ success: false, message: 'Manufacturer profile not found.' });
    }

    const { data: rfqs, error } = await supabase
      .from('rfqs')
      .select(`
        id, rfq_number, status, notes, delivery_state,
        required_by, submitted_at,
        rfq_items (product_name, quantity, unit)
      `)
      .in('status', ['submitted', 'under_review'])
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, rfqs });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/manufacturers/rfqs/:rfqId/quote ────────────────
// Manufacturer submits a quote for an RFQ
const submitQuote = async (req, res, next) => {
  try {
    const { rfq_item_id, unit_price, total_price, lead_time_days, validity_days, notes } = req.body;

    const { data: manufacturer } = await supabase
      .from('manufacturers')
      .select('id, verification_status')
      .eq('user_id', req.user.id)
      .single();

    if (!manufacturer || manufacturer.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved manufacturers can submit quotes.',
      });
    }

    const { data: quote, error } = await supabase
      .from('rfq_quotes')
      .insert({
        rfq_id: req.params.rfqId,
        manufacturer_id: manufacturer.id,
        rfq_item_id,
        unit_price,
        total_price,
        lead_time_days,
        validity_days: validity_days || 30,
        notes,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update RFQ status to 'quoted'
    await supabase
      .from('rfqs')
      .update({ status: 'quoted', updated_at: new Date().toISOString() })
      .eq('id', req.params.rfqId);

    res.status(201).json({ success: true, message: 'Quote submitted.', quote });
  } catch (err) {
    next(err);
  }
};

module.exports = { onboard, getMyProfile, getIncomingRFQs, submitQuote };
