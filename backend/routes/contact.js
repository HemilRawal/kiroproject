const express = require('express');
const router = express.Router();
const { submitEnquiry } = require('../controllers/contactController');

// POST /api/contact
router.post('/', submitEnquiry);

module.exports = router;
