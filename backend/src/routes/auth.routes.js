const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  firebaseAuth,
  getCurrentUser,
  logout,
  updateProfile,
  addAddress,
  refreshToken
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../validators');
const schemas = require('../validators/schemas');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { message: 'Too many attempts, please try again after 15 minutes' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  message: { message: 'Too many accounts created, please try again after an hour' }
});

// Public routes
router.post('/register', registerLimiter, validate(schemas.auth.register), register);
router.post('/login', authLimiter, validate(schemas.auth.login), login);
router.post('/firebase', authLimiter, validate(schemas.auth.firebaseAuth), firebaseAuth);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', protect, logout);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/update-profile', protect, validate(schemas.auth.updateProfile), updateProfile);
router.post('/address', protect, validate(schemas.auth.addAddress), addAddress);

module.exports = router; 