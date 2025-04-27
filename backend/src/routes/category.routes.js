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
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/featured', getFeaturedCategories);
router.get('/tree', getCategoryTree);
router.get('/:id', getCategoryById);
router.get('/:id/products', getCategoryWithProducts);

// Admin routes
router.post('/', protect, admin, createCategory);
router.put('/:id', protect, admin, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);

module.exports = router; 