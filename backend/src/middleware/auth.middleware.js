const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { admin } = require('../config/firebase.config');

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
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
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
      console.error('JWT verification error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to validate Firebase ID token
exports.validateFirebaseToken = async (req, res, next) => {
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
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
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
      console.error('Firebase token verification error:', error.message);
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
exports.isOwner = (resourceId) => {
  return (req, res, next) => {
    if (req.user && (req.user.id === resourceId || req.user.role === 'admin')) {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized, resource ownership required' });
    }
  };
}; 