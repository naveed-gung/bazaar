const config = require('../config');
const logger = require('../utils/logger');

// ─── SIMULATION MODE ─────────────────────────────────────────────────────────
// All payment processing is simulated. No real charges are ever made.
// Stripe / PayPal SDKs are NOT loaded.
logger.info('Payment controller running in SIMULATION mode — no real charges will be made');

const ALLOWED_CURRENCIES = ['usd', 'eur', 'gbp', 'cad', 'aud'];

// Simulated Stripe payment intent
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 999999) {
      return res.status(400).json({ message: 'Amount must be a positive number (max 999999)' });
    }

    if (!ALLOWED_CURRENCIES.includes(currency.toLowerCase())) {
      return res.status(400).json({ message: `Invalid currency. Allowed: ${ALLOWED_CURRENCIES.join(', ')}` });
    }

    const mockId = `pi_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    res.status(200).json({
      success: true,
      clientSecret: `${mockId}_secret`,
      paymentIntentId: mockId,
      simulation: true,
    });
  } catch (error) {
    logger.error('Simulated createPaymentIntent error', { error: error.message });
    next(error);
  }
};

// Simulated Stripe payment confirmation — always succeeds
exports.confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ message: 'Payment intent ID is required' });
    }

    res.status(200).json({
      success: true,
      simulation: true,
      paymentIntent: {
        id: paymentIntentId,
        status: 'succeeded',
      },
    });
  } catch (error) {
    logger.error('Simulated confirmPayment error', { error: error.message });
    next(error);
  }
};

const Order = require('../models/order.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');

// Simulated PayPal order creation
exports.createPayPalOrder = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must include at least one item' });
    }

    const mockOrderId = `PAYPAL_SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    res.status(200).json({
      success: true,
      simulation: true,
      order: {
        id: mockOrderId,
        status: 'APPROVED',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Simulated PayPal payment capture — always succeeds
exports.capturePayPalPayment = async (req, res, next) => {
  try {
    const { orderId, items } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'PayPal order ID is required' });
    }

    // Create an order record in our database with verified prices
    if (items && Array.isArray(items) && items.length > 0) {
      const verifiedItems = [];
      for (const item of items) {
        if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
          return res.status(400).json({ success: false, message: `Invalid product ID: ${item.product}` });
        }
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({ success: false, message: `Product not found: ${item.product}` });
        }
        const qty = Number(item.quantity) || 1;
        verifiedItems.push({
          product: product._id,
          name: product.name,
          quantity: qty,
          price: product.discountPercentage > 0 ? product.discountedPrice : product.price,
          image: product.images[0] || '',
        });
      }

      const order = new Order({
        user: req.user ? req.user._id : null,
        email: req.user?.email || 'simulation@bazaar.dev',
        orderItems: verifiedItems,
        paymentMethod: 'PayPal (Simulated)',
        paymentId: orderId,
        isPaid: true,
        paidAt: new Date(),
        status: 'processing',
      });
      order.calculateTotals();
      await order.save();

      return res.status(200).json({
        success: true,
        simulation: true,
        order,
      });
    }

    res.status(200).json({
      success: true,
      simulation: true,
      capture: { id: orderId, status: 'COMPLETED' },
    });
  } catch (error) {
    next(error);
  }
};


// Apple Pay — not available (simulation only)
exports.processApplePay = async (req, res, _next) => {
  return res.status(501).json({
    success: false,
    message: 'Apple Pay is not available. Payments are simulation-only.',
  });
};

// Webhook handler — simulation mode, just acknowledge
exports.handleWebhook = async (req, res, _next) => {
  logger.info('Webhook received in simulation mode — no real processing');
  res.status(200).json({ received: true, simulation: true });
}; 