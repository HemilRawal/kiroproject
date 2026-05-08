const express = require('express');
const router = express.Router();
const {
  onboard, getMyProfile, getIncomingRFQs, submitQuote, getMyProducts,
} = require('../controllers/manufacturerController');
const { protect, requireRole } = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');

// POST /api/manufacturers/onboard
router.post('/onboard', protect, onboard);

// GET /api/manufacturers/me
router.get('/me', protect, requireRole('manufacturer'), getMyProfile);

// GET /api/manufacturers/rfqs
router.get('/rfqs', protect, requireRole('manufacturer'), getIncomingRFQs);

// POST /api/manufacturers/rfqs/:rfqId/quote
router.post('/rfqs/:rfqId/quote', protect, requireRole('manufacturer'), submitQuote);

// GET /api/manufacturers/products  — manufacturer's own inventory
router.get('/products', protect, requireRole('manufacturer'), getMyProducts);

// PATCH /api/onboarding/documents  — update compliance documents
router.patch('/compliance-docs', protect, requireRole('manufacturer'), onboardingController.updateComplianceDocs);

module.exports = router;
