const express = require('express');
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

// Protected routes
router.post('/stripe/create-payment-intent', protect, createPaymentIntent);
router.post('/stripe/confirm-payment', protect, confirmPayment);
router.post('/paypal/create-order', protect, createPayPalOrder);
router.post('/paypal/capture-payment', protect, capturePayPalPayment);
router.post('/apple-pay/process', protect, processApplePay);

// Webhook routes (unprotected, called by payment providers)
router.post('/webhook', handleWebhook);

module.exports = router; 