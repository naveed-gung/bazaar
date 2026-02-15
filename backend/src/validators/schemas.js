const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, 'valid ObjectId');

// --- Auth Schemas ---
const register = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must include uppercase, lowercase, number, and special character',
    }),
  role: Joi.string().valid('customer').optional(), // only customers can self-register
});

const login = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const firebaseAuth = Joi.object({
  idToken: Joi.string().required(),
});

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().trim().max(20).allow('').optional(),
  avatar: Joi.string().uri().allow('').optional(),
});

const addAddress = Joi.object({
  street: Joi.string().trim().max(200).required(),
  city: Joi.string().trim().max(100).required(),
  state: Joi.string().trim().max(100).required(),
  zipCode: Joi.string().trim().max(20).required(),
  country: Joi.string().trim().max(100).required(),
  isDefault: Joi.boolean().optional(),
});

// --- Product Schemas ---
const createProduct = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  price: Joi.number().min(0).max(999999).required(),
  images: Joi.array().items(Joi.string().uri()).min(1).max(10).required(),
  category: objectId.required(),
  stock: Joi.number().integer().min(0).required(),
  isActive: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  features: Joi.array().items(Joi.string().max(500)).max(20).optional(),
  specifications: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  sku: Joi.string().trim().max(50).optional(),
  discountPercentage: Joi.number().min(0).max(100).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
});

const updateProduct = createProduct.fork(
  ['name', 'description', 'price', 'images', 'category', 'stock'],
  schema => schema.optional()
);

const addReview = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).optional(),
});

// --- Order Schemas ---
const shippingAddress = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  address: Joi.string().trim().max(200).required(),
  city: Joi.string().trim().max(100).required(),
  state: Joi.string().trim().max(100).required(),
  postalCode: Joi.string().trim().max(20).required(),
  country: Joi.string().trim().max(100).default('US'),
});

const orderItem = Joi.object({
  product: objectId.required(),
  name: Joi.string().trim().max(200).optional(),
  quantity: Joi.number().integer().min(1).max(100).required(),
  price: Joi.number().min(0).required(),
  image: Joi.string().uri().allow('').optional(),
});

const createOrder = Joi.object({
  orderItems: Joi.array().items(orderItem).min(1).max(50).required(),
  shippingAddress: shippingAddress.required(),
  paymentMethod: Joi.string().valid('credit-card', 'PayPal', 'apple-pay', 'stripe').required(),
  paymentId: Joi.string().optional(),
  email: Joi.string().email().optional(),
  notes: Joi.string().trim().max(500).optional(),
});

const updateOrderStatus = Joi.object({
  status: Joi.string().valid('pending', 'processing', 'shipped', 'delivered', 'cancelled').required(),
  trackingNumber: Joi.string().trim().max(100).optional(),
});

// --- Category Schemas ---
const createCategory = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  image: Joi.string().uri().allow('').optional(),
  isActive: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  parentCategory: objectId.allow(null).optional(),
  order: Joi.number().integer().min(0).optional(),
});

const updateCategory = createCategory.fork(['name'], schema => schema.optional());

// --- User Schemas (Admin) ---
const updateUser = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  role: Joi.string().valid('customer', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  phone: Joi.string().trim().max(20).allow('').optional(),
});

// --- Query Schemas ---
const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().max(50).optional(),
  order: Joi.string().valid('asc', 'desc').optional(),
}).unknown(true); // allow additional filter params

module.exports = {
  auth: { register, login, firebaseAuth, updateProfile, addAddress },
  product: { createProduct, updateProduct, addReview },
  order: { createOrder, updateOrderStatus },
  category: { createCategory, updateCategory },
  user: { updateUser },
  query: { paginationQuery },
};
