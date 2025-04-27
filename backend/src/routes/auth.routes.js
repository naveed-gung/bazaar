const express = require('express');
const {
  register,
  login,
  firebaseAuth,
  getCurrentUser,
  logout,
  updateProfile,
  addAddress
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/firebase', firebaseAuth);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/update-profile', protect, updateProfile);
router.post('/address', protect, addAddress);

module.exports = router; 