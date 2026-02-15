const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { admin: firebaseAdmin, firebaseInitialized } = require('../config/firebase.config');
const config = require('../config');
const logger = require('../utils/logger');

// Middleware to authenticate user with JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    try {
      // Verify token using centralized config
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Get user from database (use .lean() for read-only)
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      logger.warn('JWT verification failed', { error: error.message, ip: req.ip });
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to validate Firebase ID token
exports.validateFirebaseToken = async (req, res, next) => {
  if (!firebaseInitialized) {
    return res.status(503).json({ message: 'Firebase authentication is not configured on this server' });
  }

  try {
    let idToken;
    
    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Firebase')) {
      idToken = req.headers.authorization.split(' ')[1];
    }
    
    if (!idToken) {
      return res.status(401).json({ message: 'Not authorized, no Firebase token' });
    }
    
    try {
      // Verify Firebase token
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
      
      // Find user by Firebase UID
      const user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      logger.warn('Firebase token verification failed', { error: error.message, ip: req.ip });
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Middleware to check if authenticated user is the owner of a resource
exports.isOwner = (paramName = 'id') => {
  return (req, res, next) => {
    const resourceId = req.params[paramName];
    if (req.user && (req.user.id === resourceId || req.user.role === 'admin')) {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized, resource ownership required' });
    }
  };
};

// Middleware to validate MongoDB ObjectId params
exports.validateObjectId = (...paramNames) => {
  const mongoose = require('mongoose');
  return (req, res, next) => {
    for (const param of paramNames) {
      if (req.params[param] && !mongoose.Types.ObjectId.isValid(req.params[param])) {
        return res.status(400).json({ message: `Invalid ID: ${req.params[param]}` });
      }
    }
    next();
  };
}; 