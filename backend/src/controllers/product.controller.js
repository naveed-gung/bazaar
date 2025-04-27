const Product = require('../models/product.model');
const Category = require('../models/category.model');
const mongoose = require('mongoose');

// Get all products with filtering, sorting, and pagination
exports.getAllProducts = async (req, res, next) => {
  try {
    const { 
      category, 
      featured, 
      minPrice, 
      maxPrice, 
      rating,
      search,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 10,
      all = false // New parameter to get all products
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (category) {
      const categoryObj = await Category.findOne({ name: { $regex: new RegExp(category, 'i') } });
      if (categoryObj) {
        filter.category = categoryObj._id;
      }
    }
    
    if (featured) {
      filter.featured = featured === 'true';
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    
    if (rating) {
      filter.rating = { $gte: Number(rating) };
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } }
      ];
    }
    
    // Set up pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Set up sorting
    const sortOption = {};
    sortOption[sort] = order === 'asc' ? 1 : -1;
    
    // Execute query
    let query = Product.find(filter)
      .populate('category', 'name description')
      .sort(sortOption);
      
    // Apply pagination only if not requesting all products
    if (all !== 'true') {
      query = query.skip(skip).limit(Number(limit));
    }
    
    const products = await query;
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: products.length,
      totalPages: all === 'true' ? 1 : Math.ceil(totalProducts / Number(limit)),
      currentPage: Number(page),
      totalProducts,
      products
    });
  } catch (error) {
    next(error);
  }
};

// Get a single product by ID
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name description')
      .populate('reviews.user', 'name avatar');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// Create a new product (admin only)
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    
    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// Update a product (admin only)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// Delete a product (admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Product removed'
    });
  } catch (error) {
    next(error);
  }
};

// Update product stock (admin only)
exports.updateStock = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ message: 'Quantity is required' });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    product.stock = Math.max(0, Number(quantity));
    await product.save();
    
    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// Create a product review
exports.createProductReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    
    if (!rating) {
      return res.status(400).json({ message: 'Rating is required' });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user already reviewed this product
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === req.user.id
    );
    
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }
    
    const review = {
      user: req.user.id,
      name: req.user.name,
      rating: Number(rating),
      comment
    };
    
    product.reviews.push(review);
    product.updateRating();
    
    await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Review added'
    });
  } catch (error) {
    next(error);
  }
};

// Get top rated products
exports.getTopProducts = async (req, res, next) => {
  try {
    const products = await Product.find({})
      .sort({ rating: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    next(error);
  }
};

// Get featured products
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ featured: true })
      .populate('category', 'name')
      .limit(8);
    
    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    next(error);
  }
};

// Get related products by category
exports.getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category
    })
      .limit(4);
    
    res.status(200).json({
      success: true,
      products: relatedProducts
    });
  } catch (error) {
    next(error);
  }
};

// Search products
exports.searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(200).json({
        success: true,
        products: []
      });
    }

    // Search in name and description
    const products = await Product.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: new RegExp(q, 'i') } },
            { description: { $regex: new RegExp(q, 'i') } }
          ]
        }
      ]
    })
    .select('name price images') // Only select fields we need for search results
    .limit(5) // Limit to 5 results
    .sort({ featured: -1, createdAt: -1 }); // Prioritize featured products

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    next(error);
  }
};