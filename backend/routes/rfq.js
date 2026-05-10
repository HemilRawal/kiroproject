const express = require('express');
const router = express.Router();
const {
  createRFQ, getMyRFQs, trackRFQ, getRFQById, updateRFQStatus,
} = require('../controllers/rfqController');
const { protect, requireRole } = require('../middleware/auth');

// PUBLIC — no login needed
// GET /api/rfq/track/:rfqNumber
router.get('/track/:rfqNumber', trackRFQ);

// PROTECTED — buyer must be logged in
// POST /api/rfq
router.post('/', protect, requireRole('buyer'), createRFQ);

// GET /api/rfq/my
router.get('/my', protect, requireRole('buyer'), getMyRFQs);

// GET /api/rfq/:id
router.get('/:id', protect, getRFQById);

// PATCH /api/rfq/:id/status  (manufacturer or admin)
router.patch('/:id/status', protect, requireRole('manufacturer', 'admin'), updateRFQStatus);

module.exports = router;
