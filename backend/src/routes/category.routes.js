const express = require('express');
const {
  getAllCategories,
  getFeaturedCategories,
  getCategoryById,
  getCategoryWithProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree
} = require('../controllers/category.controller');
const { protect, admin, validateObjectId } = require('../middleware/auth.middleware');
const { validate } = require('../validators');
const schemas = require('../validators/schemas');

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/featured', getFeaturedCategories);
router.get('/tree', getCategoryTree);
router.get('/:id', validateObjectId('id'), getCategoryById);
router.get('/:id/products', validateObjectId('id'), getCategoryWithProducts);

// Admin routes
router.post('/', protect, admin, validate(schemas.category.createCategory), createCategory);
router.put('/:id', protect, admin, validateObjectId('id'), validate(schemas.category.updateCategory), updateCategory);
router.delete('/:id', protect, admin, validateObjectId('id'), deleteCategory);

module.exports = router; 