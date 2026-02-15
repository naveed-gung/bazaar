const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderToPaid,
  getAllOrders,
  cancelOrder
} = require('../controllers/order.controller');
const { protect, admin, validateObjectId } = require('../middleware/auth.middleware');
const { validate } = require('../validators');
const schemas = require('../validators/schemas');

const router = express.Router();

// Admin routes (must come before /:id to avoid route conflicts)
router.get('/all', protect, admin, getAllOrders);
router.put('/:id/status', protect, admin, validateObjectId('id'), validate(schemas.order.updateOrderStatus), updateOrderStatus);

// Protected routes
router.post('/', protect, validate(schemas.order.createOrder), createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, validateObjectId('id'), getOrderById);
router.put('/:id/cancel', protect, validateObjectId('id'), cancelOrder);
router.put('/:id/pay', protect, validateObjectId('id'), updateOrderToPaid);

module.exports = router; 