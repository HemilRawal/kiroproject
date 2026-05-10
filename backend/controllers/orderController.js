// controllers/orderController.js
// ─────────────────────────────────────────────────────────────
// Buyer order tracking + manufacturer order management
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');

// Helper: generate order number
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(5, '0');
  return `ORD-${year}-${seq}`;
};

// ── GET /api/orders/my ───────────────────────────────────────
// Buyer: see all their orders
const getMyOrders = async (req, res, next) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_amount, currency,
        confirmed_at, dispatched_at, delivered_at, updated_at,
        tracking_number, courier_name,
        manufacturers (company_name),
        rfqs (rfq_number, rfq_items (product_name, quantity))
      `)
      .eq('buyer_id', req.user.id)
      .order('confirmed_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/orders/:id ──────────────────────────────────────
// Full order detail with compliance documents
const getOrderById = async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        manufacturers (company_name, city, state),
        rfqs (rfq_number, rfq_items (*)),
        order_documents (*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Only the buyer or the manufacturer involved can view
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/orders/:id/status ─────────────────────────────
// Manufacturer updates order status (e.g., dispatched)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, tracking_number, courier_name } = req.body;
    const validStatuses = ['confirmed', 'manufacturing', 'dispatched', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'dispatched') {
      updates.dispatched_at = new Date().toISOString();
      if (tracking_number) updates.tracking_number = tracking_number;
      if (courier_name) updates.courier_name = courier_name;
    }

    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Order status updated.', order: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyOrders, getOrderById, updateOrderStatus };
