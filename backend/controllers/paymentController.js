// controllers/paymentController.js
// ─────────────────────────────────────────────────────────────
// Manages admin-assigned pending payment amounts for manufacturers.
//
// Admin endpoints:
//   POST   /api/payments/admin/pending          — add a pending amount
//   GET    /api/payments/admin/pending          — list all pending amounts
//   DELETE /api/payments/admin/pending/:id      — remove a pending amount
//
// Manufacturer endpoint:
//   GET    /api/payments/my-pending             — get own pending amounts
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');

// ── POST /api/payments/admin/pending ─────────────────────────
// Admin adds a pending amount for a manufacturer
const addPendingPayment = async (req, res, next) => {
  try {
    const { manufacturer_email, manufacturer_name, amount, description } = req.body;

    if (!manufacturer_email || !manufacturer_name || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'manufacturer_email, manufacturer_name, amount, and description are all required.',
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a positive number.',
      });
    }

    const { data, error } = await supabase
      .from('manufacturer_pending_payments')
      .insert({
        manufacturer_email: manufacturer_email.trim().toLowerCase(),
        manufacturer_name:  manufacturer_name.trim(),
        amount:             parsedAmount,
        description:        description.trim(),
        added_by:           req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Pending payment added successfully.',
      payment: data,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/payments/admin/pending ──────────────────────────
// Admin lists all pending payment entries
const listAllPendingPayments = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('manufacturer_pending_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, payments: data });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/payments/admin/pending/:id ────────────────────
// Admin removes a pending payment entry
const deletePendingPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabase
      .from('manufacturer_pending_payments')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, message: 'Payment entry not found.' });
    }

    const { error } = await supabase
      .from('manufacturer_pending_payments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Pending payment removed.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/payments/my-pending ─────────────────────────────
// Manufacturer fetches their own pending amounts (matched by email)
const getMyPendingPayments = async (req, res, next) => {
  try {
    // Resolve the manufacturer's email from the users table
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.id)
      .single();

    // Also check user_manufacturers table (separate auth table)
    let email = user?.email;
    if (!email) {
      const { data: mfrUser } = await supabase
        .from('user_manufacturers')
        .select('email')
        .eq('id', req.user.id)
        .single();
      email = mfrUser?.email;
    }

    if (userErr || !email) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { data, error } = await supabase
      .from('manufacturer_pending_payments')
      .select('id, amount, description, manufacturer_name, created_at')
      .eq('manufacturer_email', email.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, payments: data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addPendingPayment,
  listAllPendingPayments,
  deletePendingPayment,
  getMyPendingPayments,
};
