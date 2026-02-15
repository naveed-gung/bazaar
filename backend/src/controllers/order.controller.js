const Order = require('../models/order.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const VALID_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const VALID_PAYMENT_METHODS = ['credit-card', 'PayPal', 'apple-pay', 'stripe'];
const MAX_PAGE_LIMIT = 100;

// Create a new order
exports.createOrder = async (req, res, next) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod
    } = req.body;
    
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }
    
    // Validate shipping address
    if (!shippingAddress || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
      return res.status(400).json({ message: 'Complete shipping address is required (address, city, state, postalCode)' });
    }
    
    // Validate payment method
    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(', ')}` });
    }
    
    // Validate each order item
    for (const item of orderItems) {
      if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
        return res.status(400).json({ message: 'Each order item must have a valid product ID' });
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ message: 'Each order item must have a quantity of at least 1' });
      }
    }
    
    // Verify product availability and get updated prices from the DB (never trust client prices)
    const itemsWithDetails = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.product}` });
      }

      if (!product.isActive) {
        return res.status(400).json({ message: `Product is no longer available: ${product.name}` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }
      
      itemsWithDetails.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.discountPercentage > 0 
          ? product.discountedPrice 
          : product.price,
        image: product.images[0]
      });
    }
    
    // Atomically deduct stock using findOneAndUpdate to prevent race conditions
    for (const item of itemsWithDetails) {
      const result = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!result) {
        // Rollback previously deducted stock
        for (const prev of itemsWithDetails) {
          if (prev.product.equals(item.product)) break;
          await Product.findByIdAndUpdate(prev.product, { $inc: { stock: prev.quantity } });
        }
        return res.status(409).json({ message: `Stock no longer available for ${item.name}. Please try again.` });
      }
    }

    // Create the order
    const order = new Order({
      user: req.user.id,
      email: req.user.email,
      orderItems: itemsWithDetails,
      shippingAddress,
      paymentMethod
    });
    
    // Calculate order totals
    order.calculateTotals();
    
    // Save the order
    const createdOrder = await order.save();
    
    res.status(201).json({
      success: true,
      order: createdOrder
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders for current user (with pagination)
exports.getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const sanitizedLimit = Math.min(Math.max(1, Number(limit) || 10), MAX_PAGE_LIMIT);
    const sanitizedPage = Math.max(1, Number(page) || 1);
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    const filter = { user: req.user.id };
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(sanitizedLimit)
      .lean();
    
    const totalOrders = await Order.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: orders.length,
      totalPages: Math.ceil(totalOrders / sanitizedLimit),
      currentPage: sanitizedPage,
      totalOrders,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// Get single order by ID
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if the order belongs to the current user or if the user is an admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    // Validate status against enum
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${VALID_ORDER_STATUSES.join(', ')}` });
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    order.status = status;
    
    // If status is 'delivered', update delivery info
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }
    
    const updatedOrder = await order.save();
    
    res.status(200).json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// Update order to paid (requires valid payment proof)
exports.updateOrderToPaid = async (req, res, next) => {
  try {
    const { paymentResult } = req.body;
    
    if (!paymentResult || !paymentResult.id || !paymentResult.status) {
      return res.status(400).json({ message: 'Payment result with id and status is required' });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Ownership check: only the order owner or admin can mark as paid
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }
    
    if (order.isPaid) {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    // Only allow whitelisted payment result fields
    const sanitizedPaymentResult = {
      id: String(paymentResult.id).slice(0, 200),
      status: String(paymentResult.status).slice(0, 50),
      updateTime: paymentResult.updateTime ? String(paymentResult.updateTime).slice(0, 50) : new Date().toISOString(),
      email: paymentResult.email ? String(paymentResult.email).slice(0, 200) : undefined,
    };
    
    order.isPaid = true;
    order.paidAt = Date.now();
    order.status = 'processing';
    order.paymentResult = sanitizedPaymentResult;
    
    const updatedOrder = await order.save();
    
    logger.info(`Order ${order._id} marked as paid`, { paymentId: sanitizedPaymentResult.id, userId: req.user.id });
    
    res.status(200).json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (status && VALID_ORDER_STATUSES.includes(status)) {
      filter.status = status;
    }
    
    // Set up pagination with caps
    const sanitizedLimit = Math.min(Math.max(1, Number(limit) || 10), MAX_PAGE_LIMIT);
    const sanitizedPage = Math.max(1, Number(page) || 1);
    const skip = (sanitizedPage - 1) * sanitizedLimit;
    
    const orders = await Order.find(filter)
      .populate('user', 'id name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(sanitizedLimit)
      .lean();
    
    const totalOrders = await Order.countDocuments(filter);
    
    // Calculate revenue
    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    
    res.status(200).json({
      success: true,
      count: orders.length,
      totalPages: Math.ceil(totalOrders / sanitizedLimit),
      currentPage: sanitizedPage,
      totalOrders,
      revenue,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// Cancel an order
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if the order belongs to the current user or if the user is an admin
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }
    
    // Check if order can be canceled (not delivered or shipped)
    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ message: 'Cannot cancel an order that has been shipped or delivered' });
    }
    
    // Update order status
    order.status = 'cancelled';
    
    // Restore product stock
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
    
    const updatedOrder = await order.save();
    
    res.status(200).json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    next(error);
  }
}; 