const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  createPaymentIntent,
  confirmPayment,
  createPayPalOrder,
  capturePayPalPayment,
  processApplePay,
  handleWebhook
} = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 payment attempts per 15 minutes
  message: { message: 'Too many payment attempts, please try again later' }
});

// Webhook route - MUST come before express.json() body parsing for raw body
// Note: Stripe needs raw body for signature verification - handled at server level
router.post('/webhook', handleWebhook);

// Protected routes with rate limiting
router.post('/stripe/create-payment-intent', protect, paymentLimiter, createPaymentIntent);
router.post('/stripe/confirm-payment', protect, paymentLimiter, confirmPayment);
router.post('/paypal/create-order', protect, paymentLimiter, createPayPalOrder);
router.post('/paypal/capture-payment', protect, paymentLimiter, capturePayPalPayment);
router.post('/apple-pay/process', protect, processApplePay);

module.exports = router; 