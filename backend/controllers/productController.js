// controllers/productController.js
// ─────────────────────────────────────────────────────────────
// Public catalogue endpoints + manufacturer product management
// ─────────────────────────────────────────────────────────────

const supabase = require('../config/db');

// ── GET /api/products ────────────────────────────────────────
// Public: list all active, verified products with optional filters
const getProducts = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select(`
        id, name, sku, description, images, specifications,
        categories (id, name, slug),
        manufacturers (id, company_name)
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_verified', true)
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('categories.slug', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      products,
      pagination: { page: Number(page), limit: Number(limit), total: count },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/products/:id ────────────────────────────────────
// Public: single product detail
const getProductById = async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (id, name, slug),
        manufacturers (id, company_name, city, state, verification_status)
      `)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/categories ──────────────────────────────────────
// Public: all product categories
const getCategories = async (req, res, next) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/products ───────────────────────────────────────
// Manufacturer: add a new product (requires approved manufacturer status)
const createProduct = async (req, res, next) => {
  try {
    // Get manufacturer profile for this user
    const { data: manufacturer, error: mErr } = await supabase
      .from('manufacturers')
      .select('id, verification_status')
      .eq('user_id', req.user.id)
      .single();

    if (mErr || !manufacturer) {
      return res.status(403).json({
        success: false,
        message: 'Manufacturer profile not found.',
      });
    }

    if (manufacturer.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your manufacturer account must be approved before listing products.',
      });
    }

    const { name, sku, description, category_id, specifications } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        manufacturer_id: manufacturer.id,
        category_id,
        name,
        sku,
        description,
        specifications,
        is_active: true, // true means pending, false means rejected (if is_verified is false)
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Product created.', product });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/products/admin/all ──────────────────────────────
// Admin: list ALL products (including unverified) with manufacturer info
const adminListProducts = async (req, res, next) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, description, specifications, images,
        is_active, is_verified, created_at,
        manufacturers (id, company_name, city, state, verification_status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, products: products || [] });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/products/admin/:id/verify ─────────────────────
// Admin: verify or reject a product
const adminVerifyProduct = async (req, res, next) => {
  try {
    const { decision } = req.body; // 'verified' or 'rejected'

    if (!['verified', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be "verified" or "rejected".',
      });
    }

    const isVerified = decision === 'verified';

    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('id, name, manufacturer_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({
        is_verified: isVerified,
        is_active: isVerified, // auto-activate on verify, deactivate on reject
      })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;

    console.log(`Product ${req.params.id} (${product.name}) ${decision} by admin ${req.user.id}`);

    res.json({
      success: true,
      message: `Product ${decision} successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts, getProductById, getCategories, createProduct,
  adminListProducts, adminVerifyProduct,
};
