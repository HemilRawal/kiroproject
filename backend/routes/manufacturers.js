const express = require('express');
const router = express.Router();
const {
  onboard, getMyProfile, getIncomingRFQs, submitQuote,
} = require('../controllers/manufacturerController');
const { protect, requireRole } = require('../middleware/auth');

// POST /api/manufacturers/onboard
router.post('/onboard', protect, onboard);

// GET /api/manufacturers/me
router.get('/me', protect, requireRole('manufacturer'), getMyProfile);

// GET /api/manufacturers/rfqs
router.get('/rfqs', protect, requireRole('manufacturer'), getIncomingRFQs);

// POST /api/manufacturers/rfqs/:rfqId/quote
router.post('/rfqs/:rfqId/quote', protect, requireRole('manufacturer'), submitQuote);

module.exports = router;
