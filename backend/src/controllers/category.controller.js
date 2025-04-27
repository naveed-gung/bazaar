const Category = require('../models/category.model');
const Product = require('../models/product.model');

// Get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({})
      .sort({ order: 'asc', name: 'asc' });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// Get featured categories
exports.getFeaturedCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ featured: true })
      .sort({ order: 'asc' })
      .limit(6);
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// Get a single category by ID
exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// Get a category with its products
exports.getCategoryWithProducts = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const products = await Product.find({ category: category._id });
    
    res.status(200).json({
      success: true,
      category,
      products
    });
  } catch (error) {
    next(error);
  }
};

// Create a new category (admin only)
exports.createCategory = async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    
    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// Update a category (admin only)
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// Delete a category (admin only)
exports.deleteCategory = async (req, res, next) => {
  try {
    // Check if there are products in this category
    const productCount = await Product.countDocuments({ category: req.params.id });
    
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category with ${productCount} products. Reassign or delete products first.`
      });
    }
    
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category removed'
    });
  } catch (error) {
    next(error);
  }
};

// Get category tree (with subcategories)
exports.getCategoryTree = async (req, res, next) => {
  try {
    // Find all root categories (without parent)
    const rootCategories = await Category.find({ parentCategory: null })
      .sort({ order: 'asc', name: 'asc' });
    
    // For each root category, find its subcategories
    const categoriesWithChildren = await Promise.all(
      rootCategories.map(async (rootCategory) => {
        const subcategories = await Category.find({ parentCategory: rootCategory._id })
          .sort({ order: 'asc', name: 'asc' });
        
        const rootCategoryObj = rootCategory.toObject();
        rootCategoryObj.subcategories = subcategories;
        
        return rootCategoryObj;
      })
    );
    
    res.status(200).json({
      success: true,
      categories: categoriesWithChildren
    });
  } catch (error) {
    next(error);
  }
}; 