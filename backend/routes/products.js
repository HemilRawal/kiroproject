const express = require('express');
const router = express.Router();
const {
  getProducts, getProductById, getCategories, createProduct,
  adminListProducts, adminVerifyProduct,
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

// PUBLIC
router.get('/', getProducts);
router.get('/categories', getCategories);

// ADMIN — product verification (must be before /:id to avoid conflict)
router.get('/admin/all', protect, requireRole('admin'), adminListProducts);
router.patch('/admin/:id/verify', protect, requireRole('admin'), adminVerifyProduct);

// PUBLIC — single product
router.get('/:id', getProductById);

// PROTECTED — manufacturer only
router.post('/', protect, requireRole('manufacturer'), createProduct);

module.exports = router;
