// controllers/rfqController.js
// ─────────────────────────────────────────────────────────────
// Handles all RFQ operations:
//   - createRFQ       → buyer submits a new RFQ
//   - getMyRFQs       → buyer sees their own RFQs
//   - trackRFQ        → public tracking by RFQ number
//   - getRFQById      → full detail (buyer or manufacturer)
//   - updateRFQStatus → manufacturer/admin updates status
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');

// Helper: generate a human-readable RFQ number like RFQ-2024-00042
const generateRFQNumber = async () => {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('rfqs')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(5, '0');
  return `RFQ-${year}-${seq}`;
};

// ── POST /api/rfq ────────────────────────────────────────────
// Buyer creates a new RFQ with one or more items
const createRFQ = async (req, res, next) => {
  try {
    const { items, notes, delivery_state, delivery_pincode, required_by } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required.',
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_name || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each item needs a product_name and quantity > 0.',
        });
      }
    }

    const rfq_number = await generateRFQNumber();

    // Insert RFQ header
    const { data: rfq, error: rfqError } = await supabase
      .from('rfqs')
      .insert({
        rfq_number,
        buyer_id: req.user.id,
        notes,
        delivery_state,
        delivery_pincode,
        required_by,
        status: 'submitted',
      })
      .select()
      .single();

    if (rfqError) throw rfqError;

    // Insert all line items
    const itemsToInsert = items.map((item) => ({
      rfq_id: rfq.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      sku: item.sku || null,
      quantity: item.quantity,
      unit: item.unit || 'units',
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from('rfq_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    res.status(201).json({
      success: true,
      message: 'RFQ submitted successfully.',
      rfq_number: rfq.rfq_number,
      rfq_id: rfq.id,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/rfq/my ──────────────────────────────────────────
// Buyer sees all their own RFQs
const getMyRFQs = async (req, res, next) => {
  try {
    const { data: rfqs, error } = await supabase
      .from('rfqs')
      .select(`
        id, rfq_number, status, notes, delivery_state,
        required_by, submitted_at, updated_at,
        rfq_items (id, product_name, quantity, unit)
      `)
      .eq('buyer_id', req.user.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, rfqs });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/rfq/track/:rfqNumber ────────────────────────────
// Public endpoint — anyone with the RFQ number can check status
// We intentionally return limited info (no buyer PII)
const trackRFQ = async (req, res, next) => {
  try {
    const { rfqNumber } = req.params;

    const { data: rfq, error } = await supabase
      .from('rfqs')
      .select(`
        rfq_number, status, submitted_at, updated_at,
        rfq_items (product_name, quantity, unit)
      `)
      .eq('rfq_number', rfqNumber.toUpperCase())
      .single();

    if (error || !rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found. Please check the RFQ number.',
      });
    }

    // Map status to a user-friendly label and description
    const statusInfo = {
      submitted:     { label: 'Submitted',     description: 'Your RFQ has been received and is in our queue.' },
      under_review:  { label: 'Under Review',  description: 'Our team is reviewing your requirements.' },
      quoted:        { label: 'Quoted',         description: 'Manufacturers have submitted quotes. Check your dashboard.' },
      accepted:      { label: 'Accepted',       description: 'You have accepted a quote. An order has been created.' },
      rejected:      { label: 'Rejected',       description: 'This RFQ could not be fulfilled. Contact support.' },
      expired:       { label: 'Expired',        description: 'This RFQ has expired. Please submit a new one.' },
    };

    res.json({
      success: true,
      rfq: {
        rfq_number: rfq.rfq_number,
        status: rfq.status,
        status_label: statusInfo[rfq.status]?.label || rfq.status,
        status_description: statusInfo[rfq.status]?.description || '',
        submitted_at: rfq.submitted_at,
        last_updated: rfq.updated_at,
        items: rfq.rfq_items,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/rfq/:id ─────────────────────────────────────────
// Full RFQ detail — only the buyer who created it or a manufacturer/admin
const getRFQById = async (req, res, next) => {
  try {
    const { data: rfq, error } = await supabase
      .from('rfqs')
      .select(`
        *, 
        rfq_items (*),
        rfq_quotes (*, manufacturers (company_name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }

    // Buyers can only see their own RFQs
    if (req.user.role === 'buyer' && rfq.buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, rfq });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/rfq/:id/status ────────────────────────────────
// Admin or manufacturer updates RFQ status
const updateRFQStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['submitted', 'under_review', 'quoted', 'accepted', 'rejected', 'expired'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const { data, error } = await supabase
      .from('rfqs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'RFQ status updated.', rfq: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRFQ, getMyRFQs, trackRFQ, getRFQById, updateRFQStatus };
