const express = require('express');
const router = express.Router();
const {
  getProducts, getProductById, getCategories, createProduct,
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

// PUBLIC
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// PROTECTED — manufacturer only
router.post('/', protect, requireRole('manufacturer'), createProduct);

module.exports = router;
