
const stripe = {
  paymentIntents: {
    create: async (options) => {
      const { amount, currency, payment_method_types } = options;
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      

      return {
        id: `pi_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        payment_method_types,
        client_secret: `sk_test_${Math.random().toString(36).substr(2, 24)}`,
        status: 'requires_payment_method'
      };
    },
    confirm: async (paymentIntentId) => {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate a successful payment or failed payment
      const success = Math.random() > 0.1; // 90% success rate
      
      if (!success) {
        throw new Error('Payment failed');
      }
      
      return {
        id: paymentIntentId,
        status: 'succeeded',
        next_action: null
      };
    }
  }
};

// Create Stripe payment intent
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }
    
    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      payment_method_types: ['card']
    });
    
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    next(error);
  }
};

// Confirm Stripe payment
exports.confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ message: 'Payment intent ID is required' });
    }
    
    // Confirm payment with Stripe
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    
    res.status(200).json({
      success: true,
      paymentIntent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const paypalService = require('../services/paypal.service');
const Order = require('../models/order.model');

// Create a PayPal order
exports.createPayPalOrder = async (req, res, next) => {
  try {
    const { items, shipping, tax, returnUrl, cancelUrl } = req.body;
    
    // Validate the request data
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Order must include at least one item' 
      });
    }
    
    if (!returnUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        message: 'Return URL and cancel URL are required'
      });
    }
    
    // Create order in PayPal
    const paypalOrder = await paypalService.createOrder({
      items,
      shipping: shipping || 0,
      tax: tax || 0,
      customer: req.user,
      returnUrl,
      cancelUrl
    });
    
    // Return the PayPal order details
    res.status(200).json({
      success: true,
      order: paypalOrder
    });
  } catch (error) {
    next(error);
  }
};

// Capture payment for an approved PayPal order
exports.capturePayPalPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'PayPal order ID is required'
      });
    }
    
    // Capture the payment
    const captureData = await paypalService.capturePayment(orderId);
    
    // Create or update our internal order
    const paypalOrderId = captureData.id;
    const paypalStatus = captureData.status;
    
    // Check if this is a completed payment
    if (paypalStatus === 'COMPLETED') {
      // Get payment details
      const payer = captureData.payer;
      const purchaseUnit = captureData.purchase_units[0];
      const paymentCapture = purchaseUnit.payments.captures[0];
      
      // Create or update the order in our database
      let order = await Order.findOne({ paymentId: paypalOrderId });
      
      if (!order) {
        // Create a new order
        order = new Order({
          user: req.user ? req.user._id : null,
          email: payer.email_address,
          orderItems: req.body.items, // We need the original items from the create order request
          shippingAddress: {
            name: purchaseUnit.shipping?.name?.full_name,
            address: purchaseUnit.shipping?.address?.address_line_1,
            city: purchaseUnit.shipping?.address?.admin_area_2,
            state: purchaseUnit.shipping?.address?.admin_area_1,
            postalCode: purchaseUnit.shipping?.address?.postal_code,
            country: purchaseUnit.shipping?.address?.country_code
          },
          paymentMethod: 'PayPal',
          paymentId: paypalOrderId,
          itemsPrice: Number(purchaseUnit.amount.breakdown.item_total.value),
          taxPrice: Number(purchaseUnit.amount.breakdown.tax_total?.value || 0),
          shippingPrice: Number(purchaseUnit.amount.breakdown.shipping.value),
          totalPrice: Number(purchaseUnit.amount.value),
          isPaid: true,
          paidAt: new Date(),
          status: 'processing'
        });
        
        await order.save();
      } else {
        // Update existing order
        order.isPaid = true;
        order.paidAt = new Date();
        order.status = 'processing';
        await order.save();
      }
      
      // Return the capture data and our order
      res.status(200).json({
        success: true,
        capture: captureData,
        order
      });
    } else {
      // Payment was not completed
      res.status(400).json({
        success: false,
        message: `Payment not completed: ${paypalStatus}`
      });
    }
  } catch (error) {
    next(error);
  }
};


exports.processApplePay = async (req, res, next) => {
  try {
    const { amount, token } = req.body;
    
    if (!amount || !token) {
      return res.status(400).json({ message: 'Amount and token are required' });
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate payment result
    const success = Math.random() > 0.1; // 90% success rate
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Payment processing failed'
      });
    }
    
    res.status(200).json({
      success: true,
      transactionId: `apay_${Math.random().toString(36).substr(2, 9)}`,
      status: 'COMPLETED'
    });
  } catch (error) {
    next(error);
  }
};

// Payment webhook handler (for Stripe, PayPal, etc.)
exports.handleWebhook = async (req, res, next) => {
  try {
    const { type, data } = req.body;
    
    // Log the webhook event
    console.log(`Received webhook: ${type}`);
    
    // Process different webhook events
    switch (type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        console.log(`Payment succeeded: ${data.id}`);
        break;
        
      case 'payment_intent.payment_failed':
        // Handle failed payment
        console.log(`Payment failed: ${data.id}`);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
}; 