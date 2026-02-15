const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getTopProducts,
  getFeaturedProducts,
  getRelatedProducts,
  updateStock,
  searchProducts
} = require('../controllers/product.controller');
const { protect, admin, validateObjectId } = require('../middleware/auth.middleware');
const { validate } = require('../validators');
const schemas = require('../validators/schemas');

const router = express.Router();

// Public routes
router.get('/search', searchProducts);
router.get('/', getAllProducts);
router.get('/top', getTopProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id', validateObjectId('id'), getProductById);
router.get('/:id/related', validateObjectId('id'), getRelatedProducts);

// Protected routes
router.post('/:id/reviews', protect, validateObjectId('id'), validate(schemas.product.addReview), createProductReview);

// Admin only routes
router.post('/', protect, admin, validate(schemas.product.createProduct), createProduct);
router.put('/:id', protect, admin, validateObjectId('id'), validate(schemas.product.updateProduct), updateProduct);
router.delete('/:id', protect, admin, validateObjectId('id'), deleteProduct);
router.put('/:id/stock', protect, admin, validateObjectId('id'), updateStock);

module.exports = router;