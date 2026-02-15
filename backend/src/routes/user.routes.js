const express = require('express');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  deleteUserAccount
} = require('../controllers/user.controller');
const { protect, admin, validateObjectId } = require('../middleware/auth.middleware');
const { validate } = require('../validators');
const schemas = require('../validators/schemas');

const router = express.Router();

// Protected user routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/profile', protect, deleteUserAccount);
router.put('/password', protect, changePassword);
router.get('/addresses', protect, getUserAddresses);
router.post('/addresses', protect, addUserAddress);
router.put('/addresses/:addressId', protect, validateObjectId('addressId'), updateUserAddress);
router.delete('/addresses/:addressId', protect, validateObjectId('addressId'), deleteUserAddress);

// Admin routes
router.get('/', protect, admin, getAllUsers);
router.get('/:id', protect, admin, validateObjectId('id'), getUserById);
router.put('/:id', protect, admin, validateObjectId('id'), validate(schemas.user.updateUser), updateUser);
router.delete('/:id', protect, admin, validateObjectId('id'), deleteUser);

module.exports = router; 