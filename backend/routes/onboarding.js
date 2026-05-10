const express = require('express');
const router = express.Router();
const {
  submitApplication, getMyStatus,
  listApplications, getApplication, reviewApplication,
} = require('../controllers/onboardingController');
const { protect, requireRole } = require('../middleware/auth');

// Manufacturer routes — any logged-in user can submit/check status
// (role becomes 'manufacturer' only after admin approval)
router.post('/submit',  protect, submitApplication);
router.get('/status',   protect, getMyStatus);

// Admin routes
router.get('/admin/applications',              protect, requireRole('admin'), listApplications);
router.get('/admin/applications/:id',          protect, requireRole('admin'), getApplication);
router.patch('/admin/applications/:id/review', protect, requireRole('admin'), reviewApplication);

module.exports = router;
