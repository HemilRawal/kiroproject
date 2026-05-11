const express = require('express');
const router = express.Router();
const { getMyOrders, getOrderById, updateOrderStatus } = require('../controllers/orderController');
const { protect, requireRole } = require('../middleware/auth');

// GET /api/orders/my
router.get('/my', protect, requireRole('buyer'), getMyOrders);

// GET /api/orders/:id
router.get('/:id', protect, getOrderById);

// PATCH /api/orders/:id/status
router.patch('/:id/status', protect, requireRole('manufacturer', 'admin'), updateOrderStatus);

module.exports = router;
