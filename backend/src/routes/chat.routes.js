const express = require('express');
const { processMessage } = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Process chat messages - protected by authentication
router.post('/message', protect, processMessage);

module.exports = router; 