// routes/payments.js
const express = require('express');
const router = express.Router();
const {
  addPendingPayment,
  listAllPendingPayments,
  deletePendingPayment,
  getMyPendingPayments,
} = require('../controllers/paymentController');
const { protect, requireRole } = require('../middleware/auth');

// Manufacturer — get own pending amounts
router.get('/my-pending', protect, requireRole('manufacturer'), getMyPendingPayments);

// Admin — manage pending amounts
router.post('/admin/pending',        protect, requireRole('admin'), addPendingPayment);
router.get('/admin/pending',         protect, requireRole('admin'), listAllPendingPayments);
router.delete('/admin/pending/:id',  protect, requireRole('admin'), deletePendingPayment);

module.exports = router;
