const express = require('express');
const router  = express.Router();
const { submitEarlyAccess } = require('../controllers/earlyAccessController');

// POST /api/early-access
router.post('/', submitEarlyAccess);

module.exports = router;
