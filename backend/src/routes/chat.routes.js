const express = require('express');
const rateLimit = require('express-rate-limit');
const { processMessage } = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Rate limiting for chat messages
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { message: 'Too many messages, please slow down' }
});

// Process chat messages - protected by authentication
router.post('/message', protect, chatLimiter, processMessage);

module.exports = router; 