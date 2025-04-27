const Product = require('../models/product.model');
const Category = require('../models/category.model');

// Process chat messages and provide intelligent responses
exports.processMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const user = req.user; // Access the authenticated user
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    // Determine user intent and extract key information
    const intent = determineIntent(message);
    
    let response;
    let data = null;
    
    // Enhanced access for admin users
    const isAdmin = user && user.role === 'admin';
    
    // Handle different intents
    switch (intent.type) {
      case 'product_search':
        data = await handleProductSearch(intent.params, isAdmin);
        response = formatProductSearchResponse(data, intent);
        break;
      
      case 'product_details':
        data = await handleProductDetails(intent.params, isAdmin);
        response = formatProductDetailsResponse(data);
        break;
        
      case 'category_inquiry':
        data = await handleCategoryInquiry(isAdmin);
        response = formatCategoryResponse(data);
        break;
        
      case 'price_inquiry':
        data = await handlePriceInquiry(intent.params, isAdmin);
        response = formatPriceResponse(data);
        break;
        
      case 'stock_inquiry':
        data = await handleStockInquiry(intent.params, isAdmin);
        response = formatStockResponse(data);
        break;
        
      case 'recommendation':
        data = await handleRecommendation(intent.params, isAdmin);
        response = formatRecommendationResponse(data);
        break;
        
      case 'greeting':
        const greeting = isAdmin ? 
          `Hello admin! I'm your shopping assistant with full product access. How can I help you today?` :
          `Hello! I'm your shopping assistant. How can I help you today?`;
        response = greeting;
        break;
        
      case 'thanks':
        response = "You're welcome! Is there anything else I can help you with?";
        break;
        
      default:
        response = "I'm not sure I understand. Would you like to know about our products, categories, or do you need a recommendation?";
    }
    
    res.status(200).json({
      success: true,
      response,
      data,
      intent: intent.type
    });
  } catch (error) {
    next(error);
  }
};

// Determine the user's intent from their message
function determineIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for product search intent
  if (
    lowerMessage.includes('find') || 
    lowerMessage.includes('search') || 
    lowerMessage.includes('looking for') ||
    lowerMessage.includes('do you have') ||
    lowerMessage.includes('show me')
  ) {
    // Extract product characteristics
    const params = {};
    
    // Look for category mentions
    const categoryMatch = lowerMessage.match(/in ([a-z\s]+)/i);
    if (categoryMatch) params.category = categoryMatch[1].trim();
    
    // Look for price mentions
    const priceMatch = lowerMessage.match(/(under|less than|cheaper than) \$([\d]+)/i);
    if (priceMatch) params.maxPrice = Number(priceMatch[2]);
    
    const minPriceMatch = lowerMessage.match(/(over|more than|above) \$([\d]+)/i);
    if (minPriceMatch) params.minPrice = Number(minPriceMatch[2]);
    
    // Extract product name/type
    let product = '';
    if (lowerMessage.includes('looking for')) {
      const match = lowerMessage.match(/looking for ([a-z\s]+)/i);
      if (match) product = match[1].trim();
    } else if (lowerMessage.includes('find')) {
      const match = lowerMessage.match(/find ([a-z\s]+)/i);
      if (match) product = match[1].trim();
    } else if (lowerMessage.includes('search')) {
      const match = lowerMessage.match(/search ([a-z\s]+)/i);
      if (match) product = match[1].trim();
    } else if (lowerMessage.includes('show me')) {
      const match = lowerMessage.match(/show me ([a-z\s]+)/i);
      if (match) product = match[1].trim();
    } else {
      // Use the whole message as a search term
      product = message;
    }
    
    params.search = product;
    return { type: 'product_search', params };
  }
  
  // Check for product detail intent
  if (
    lowerMessage.includes('tell me about') ||
    lowerMessage.includes('details of') ||
    lowerMessage.includes('more about') ||
    lowerMessage.includes('describe') ||
    lowerMessage.includes('what is')
  ) {
    let product = '';
    const match = lowerMessage.match(/(tell me about|details of|more about|describe|what is) ([a-z\s]+)/i);
    if (match) product = match[2].trim();
    
    return { 
      type: 'product_details', 
      params: { search: product } 
    };
  }
  
  // Check for category inquiry
  if (
    lowerMessage.includes('category') ||
    lowerMessage.includes('categories') ||
    lowerMessage.includes('department')
  ) {
    return { type: 'category_inquiry', params: {} };
  }
  
  // Check for price inquiry
  if (
    lowerMessage.includes('how much') ||
    lowerMessage.includes('price') ||
    lowerMessage.includes('cost') ||
    lowerMessage.includes('expensive')
  ) {
    let product = '';
    const match = lowerMessage.match(/(how much|price|cost) (of|for|is) ([a-z\s]+)/i);
    if (match) product = match[3].trim();
    
    return { 
      type: 'price_inquiry', 
      params: { search: product } 
    };
  }
  
  // Check for stock inquiry
  if (
    lowerMessage.includes('in stock') ||
    lowerMessage.includes('available') ||
    lowerMessage.includes('sold out')
  ) {
    let product = '';
    const match = lowerMessage.match(/(is|are) ([a-z\s]+) (in stock|available)/i);
    if (match) product = match[2].trim();
    
    return { 
      type: 'stock_inquiry', 
      params: { search: product } 
    };
  }
  
  // Check for recommendation
  if (
    lowerMessage.includes('recommend') ||
    lowerMessage.includes('suggestion') ||
    lowerMessage.includes('what should i') ||
    lowerMessage.includes('best')
  ) {
    const params = {};
    
    if (lowerMessage.includes('under')) {
      const match = lowerMessage.match(/under \$([\d]+)/i);
      if (match) params.maxPrice = Number(match[1]);
    }
    
    // Extract product category
    let category = '';
    if (lowerMessage.includes('recommend')) {
      const match = lowerMessage.match(/recommend ([a-z\s]+)/i);
      if (match) category = match[1].trim();
    }
    
    params.category = category;
    return { type: 'recommendation', params };
  }
  
  // Check for greeting
  if (
    lowerMessage.includes('hello') ||
    lowerMessage.includes('hi') ||
    lowerMessage.includes('hey') ||
    lowerMessage.includes('greetings')
  ) {
    return { type: 'greeting', params: {} };
  }
  
  // Check for thanks
  if (
    lowerMessage.includes('thank') ||
    lowerMessage.includes('thanks') ||
    lowerMessage.includes('appreciate')
  ) {
    return { type: 'thanks', params: {} };
  }
  
  // Default intent
  return { type: 'unknown', params: {} };
}

// Handle product search
async function handleProductSearch(params, isAdmin) {
  const filter = {};
  
  if (params.search) {
    filter.$or = [
      { name: { $regex: new RegExp(params.search, 'i') } },
      { description: { $regex: new RegExp(params.search, 'i') } }
    ];
  }
  
  if (params.category) {
    const categoryObj = await Category.findOne({ 
      name: { $regex: new RegExp(params.category, 'i') } 
    });
    
    if (categoryObj) {
      filter.category = categoryObj._id;
    }
  }
  
  if (params.minPrice) {
    filter.price = filter.price || {};
    filter.price.$gte = Number(params.minPrice);
  }
  
  if (params.maxPrice) {
    filter.price = filter.price || {};
    filter.price.$lte = Number(params.maxPrice);
  }
  
  // For non-admin users, only show active products
  if (!isAdmin) {
    filter.isActive = true;
  }
  
  const products = await Product.find(filter)
    .populate('category', 'name')
    .limit(5);
  
  return products;
}

// Handle product details request
async function handleProductDetails(params, isAdmin) {
  if (!params.search) return null;
  
  const filter = {
    name: { $regex: new RegExp(params.search, 'i') }
  };
  
  // For non-admin users, only show active products
  if (!isAdmin) {
    filter.isActive = true;
  }
  
  const product = await Product.findOne(filter)
    .populate('category', 'name');
  
  return product;
}

// Handle category inquiry
async function handleCategoryInquiry(isAdmin) {
  const filter = isAdmin ? {} : { isActive: true };
  
  const categories = await Category.find(filter)
    .sort({ name: 1 })
    .limit(10);
  
  return categories;
}

// Handle price inquiry
async function handlePriceInquiry(params, isAdmin) {
  if (!params.search) return null;
  
  const filter = {
    name: { $regex: new RegExp(params.search, 'i') }
  };
  
  // For non-admin users, only show active products
  if (!isAdmin) {
    filter.isActive = true;
  }
  
  const product = await Product.findOne(filter);
  
  return product;
}

// Handle stock inquiry
async function handleStockInquiry(params, isAdmin) {
  if (!params.search) return null;
  
  const filter = {
    name: { $regex: new RegExp(params.search, 'i') }
  };
  
  // For non-admin users, only show active products
  if (!isAdmin) {
    filter.isActive = true;
  }
  
  const product = await Product.findOne(filter);
  
  return product;
}

// Handle recommendation
async function handleRecommendation(params, isAdmin) {
  const filter = {};
  
  if (params.category) {
    const categoryObj = await Category.findOne({ 
      name: { $regex: new RegExp(params.category, 'i') } 
    });
    
    if (categoryObj) {
      filter.category = categoryObj._id;
    }
  }
  
  if (params.maxPrice) {
    filter.price = { $lte: Number(params.maxPrice) };
  }
  
  // For non-admin users, only show active products
  if (!isAdmin) {
    filter.isActive = true;
  }
  
  // Find top-rated products that match the criteria
  const products = await Product.find(filter)
    .populate('category', 'name')
    .sort({ rating: -1 })
    .limit(3);
  
  return products;
}

// Format responses
function formatProductSearchResponse(products, intent) {
  if (!products || products.length === 0) {
    return `I couldn't find any products matching your search. Would you like to try a different search term?`;
  }
  
  let response = `Here are some products that match your search: `;
  
  products.forEach((product, index) => {
    if (index > 0) response += `, `;
    response += `${product.name} ($${product.price.toFixed(2)})`;
  });
  
  response += `. Would you like more details about any of these products?`;
  
  return response;
}

function formatProductDetailsResponse(product) {
  if (!product) {
    return `I couldn't find details for that product. Can you be more specific?`;
  }
  
  let price = product.discountPercentage > 0 
    ? `$${product.discountedPrice.toFixed(2)} (${product.discountPercentage}% off from $${product.price.toFixed(2)})` 
    : `$${product.price.toFixed(2)}`;
  
  let response = `${product.name}: ${product.description}. Price: ${price}. `;
  
  if (product.stock > 0) {
    response += `This item is in stock (${product.stock} available). `;
  } else {
    response += `This item is currently out of stock. `;
  }
  
  response += `Category: ${product.category ? product.category.name : 'Uncategorized'}. `;
  
  if (product.rating > 0) {
    response += `Rating: ${product.rating.toFixed(1)}/5 stars based on ${product.numReviews} reviews.`;
  }
  
  return response;
}

function formatCategoryResponse(categories) {
  if (!categories || categories.length === 0) {
    return `I couldn't find any categories in our store. Please try again later.`;
  }
  
  let response = `We have the following categories: `;
  
  categories.forEach((category, index) => {
    if (index > 0) response += `, `;
    response += category.name;
  });
  
  response += `. Would you like to browse products in any of these categories?`;
  
  return response;
}

function formatPriceResponse(product) {
  if (!product) {
    return `I couldn't find price information for that product. Can you be more specific?`;
  }
  
  let price = product.discountPercentage > 0 
    ? `$${product.discountedPrice.toFixed(2)} (${product.discountPercentage}% off from $${product.price.toFixed(2)})` 
    : `$${product.price.toFixed(2)}`;
  
  return `The price of ${product.name} is ${price}.`;
}

function formatStockResponse(product) {
  if (!product) {
    return `I couldn't find stock information for that product. Can you be more specific?`;
  }
  
  if (product.stock > 10) {
    return `Yes, ${product.name} is in stock! We currently have ${product.stock} units available.`;
  } else if (product.stock > 0) {
    return `${product.name} is in stock, but we only have ${product.stock} units left. Order soon!`;
  } else {
    return `I'm sorry, ${product.name} is currently out of stock.`;
  }
}

function formatRecommendationResponse(products) {
  if (!products || products.length === 0) {
    return `I don't have any recommendations matching your criteria at the moment. Would you like to browse our featured products instead?`;
  }
  
  let response = `Based on your preferences, I recommend: `;
  
  products.forEach((product, index) => {
    if (index > 0) response += `, `;
    response += `${product.name} ($${product.price.toFixed(2)})`;
  });
  
  response += `. Would you like more details about any of these recommendations?`;
  
  return response;
} 