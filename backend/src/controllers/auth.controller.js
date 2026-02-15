const User = require('../models/user.model');
const { admin, firebaseInitialized } = require('../config/firebase.config');
const logger = require('../utils/logger');
const {
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/tokens');
const { NotFoundError, AuthenticationError } = require('../utils/errors');

// Register a new user with email and password
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }
    
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Create a new user
    const user = await User.create({
      name: name.trim(),
      email,
      password
    });
    
    // Generate tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    setRefreshCookie(res, refreshToken);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login with email and password
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
    }
    
    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = Date.now();
    
    // Generate tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    setRefreshCookie(res, refreshToken);
    
    // Remove password from response
    const userWithoutPassword = user.toJSON();
    
    res.status(200).json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
};

// Login or register with Firebase
exports.firebaseAuth = async (req, res, next) => {
  try {
    if (!firebaseInitialized) {
      return res.status(503).json({ message: 'Firebase authentication is not configured on this server' });
    }

    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }
    
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;
    
    // Check if user already exists by Firebase UID first, then by email
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      // Try finding by email
      user = await User.findOne({ email });
      
      if (user) {
        // Bind Firebase UID to existing account
        if (!user.firebaseUid) {
          user.firebaseUid = uid;
          await user.save();
        } else if (user.firebaseUid !== uid) {
          // Account exists with a different Firebase UID - security concern
          return res.status(403).json({ message: 'This email is already associated with a different account' });
        }
      } else {
        // Create a new user with Firebase data
        user = await User.create({
          firebaseUid: uid,
          name: name || email.split('@')[0],
          email,
          avatar: picture || ''
        });
      }
    }
    
    // Update last login
    user.lastLogin = Date.now();
    
    // Generate tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    setRefreshCookie(res, refreshToken);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Logout — clear refresh token
exports.logout = async (req, res) => {
  try {
    // Invalidate refresh token in DB
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }
};

// Refresh access token using httpOnly cookie
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      throw new AuthenticationError('No refresh token provided');
    }
    
    // Find user with this refresh token
    const user = await User.findOne({ refreshToken }).select('+refreshToken');
    if (!user) {
      clearRefreshCookie(res);
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Token rotation: issue new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    user.refreshToken = newRefreshToken;
    await user.save();
    setRefreshCookie(res, newRefreshToken);
    
    res.status(200).json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (name) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
      }
      user.name = name.trim();
    }
    if (phone) {
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,20}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Please provide a valid phone number' });
      }
      user.phone = phone;
    }
    if (avatar) user.avatar = avatar;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Add a new address
exports.addAddress = async (req, res, next) => {
  try {
    const { street, city, state, zipCode, country, isDefault } = req.body;
    
    // Validate required address fields
    if (!street || !city || !state || !zipCode || !country) {
      return res.status(400).json({ message: 'All address fields are required: street, city, state, zipCode, country' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const newAddress = {
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false
    };
    
    // If new address is default, unset default for other addresses
    if (newAddress.isDefault) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
    }
    
    user.addresses.push(newAddress);
    await user.save();
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
}; 