import axios from 'axios';

// Ensure the API URL always includes /api
let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Fix API URL if it doesn't include /api
if (!API_URL.endsWith('/api')) {
  API_URL = API_URL + '/api';
}

// Interfaces
interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: Category | string;
  stock: number;
  isActive: boolean;
  featured: boolean;
  rating: number;
  numReviews: number;
  discountPercentage: number;
  discountedPrice?: number;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  featured: boolean;
  parentCategory?: string;
  order: number;
}

interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  } | string;
  orderItems: Array<{
    product: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
  }>;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  createdAt: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  avatar?: string;
  phone?: string;
  addresses: Array<{
    _id: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
  }>;
  preferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingNotifications: boolean;
    language: string;
    currency: string;
  };
  isActive: boolean;
  lastLogin?: Date;
}

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add authentication interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Product API
export const ProductAPI = {
  getAllProducts: async (params = {}): Promise<{ products: Product[]; totalProducts: number }> => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getAllProductsWithoutPagination: async (params = {}): Promise<{ products: Product[]; totalProducts: number }> => {
    const response = await api.get('/products', { 
      params: { ...params, all: true }
    });
    return response.data;
  },

  getProductById: async (id: string): Promise<{ product: Product }> => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  getFeaturedProducts: async (): Promise<{ products: Product[] }> => {
    const response = await api.get('/products/featured');
    return response.data;
  },

  getTopProducts: async (): Promise<{ products: Product[] }> => {
    const response = await api.get('/products/top');
    return response.data;
  },

  getRelatedProducts: async (id: string): Promise<{ products: Product[] }> => {
    const response = await api.get(`/products/${id}/related`);
    return response.data;
  },

  createReview: async (id: string, reviewData: { rating: number; comment: string }) => {
    const response = await api.post(`/products/${id}/reviews`, reviewData);
    return response.data;
  },

  // Admin methods
  createProduct: async (productData: Omit<Product, '_id'>) => {
    // Ensure category is properly formatted as a string ID
    const formattedData = {
      ...productData,
      // Make sure category is a string (MongoDB ObjectId)
      category: typeof productData.category === 'object' 
        ? productData.category._id 
        : productData.category
    };
    
    const response = await api.post('/products', formattedData);
    return response.data;
  },

  updateProduct: async (id: string, productData: Partial<Product>) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  deleteProduct: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  updateStock: async (id: string, quantity: number) => {
    const response = await api.put(`/products/${id}/stock`, { quantity });
    return response.data;
  }
};

// Category API
export const CategoryAPI = {
  getAllCategories: async (): Promise<{ categories: Category[] }> => {
    const response = await api.get('/categories');
    return response.data;
  },

  getFeaturedCategories: async (): Promise<{ categories: Category[] }> => {
    const response = await api.get('/categories/featured');
    return response.data;
  },

  getCategoryById: async (id: string): Promise<{ category: Category }> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  getCategoryWithProducts: async (id: string): Promise<{ category: Category; products: Product[] }> => {
    const response = await api.get(`/categories/${id}/products`);
    return response.data;
  },

  getCategoryTree: async (): Promise<{ categories: Category[] }> => {
    const response = await api.get('/categories/tree');
    return response.data;
  },

  // Admin methods
  createCategory: async (categoryData: Omit<Category, '_id'>) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  updateCategory: async (id: string, categoryData: Partial<Category>) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};

// Order API
export const OrderAPI = {
  createOrder: async (orderData: Omit<Order, '_id' | 'user' | 'createdAt'>) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },

  getMyOrders: async (): Promise<{ orders: Order[] }> => {
    const response = await api.get('/orders/myorders');
    return response.data;
  },

  getOrderById: async (id: string): Promise<{ order: Order }> => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  cancelOrder: async (id: string) => {
    const response = await api.put(`/orders/${id}/cancel`);
    return response.data;
  },

  updateOrderToPaid: async (id: string, paymentResult: any) => {
    const response = await api.put(`/orders/${id}/pay`, { paymentResult });
    return response.data;
  },

  // Admin methods
  getAllOrders: async (params = {}): Promise<{ orders: Order[]; totalOrders: number }> => {
    const response = await api.get('/orders/all', { params });
    return response.data;
  },

  updateOrderStatus: async (id: string, status: Order['status']) => {
    const response = await api.put(`/orders/${id}/status`, { status });
    return response.data;
  }
};

// User API
export const UserAPI = {
  getUserProfile: async (): Promise<{ user: User }> => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateUserProfile: async (userData: Partial<Omit<User, '_id' | 'email' | 'role' | 'isActive'>>): Promise<{ user: User }> => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  },

  changePassword: async (passwordData: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> => {
    const response = await api.put('/users/password', passwordData);
    return response.data;
  },

  getUserAddresses: async (): Promise<{ addresses: User['addresses'] }> => {
    const response = await api.get('/users/addresses');
    return response.data;
  },

  addUserAddress: async (addressData: Omit<User['addresses'][0], '_id'>): Promise<{ address: User['addresses'][0] }> => {
    const response = await api.post('/users/addresses', addressData);
    return response.data;
  },

  updateUserAddress: async (addressId: string, addressData: Partial<Omit<User['addresses'][0], '_id'>>): Promise<{ address: User['addresses'][0] }> => {
    const response = await api.put(`/users/addresses/${addressId}`, addressData);
    return response.data;
  },

  deleteUserAddress: async (addressId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/users/addresses/${addressId}`);
    return response.data;
  },

  // Admin methods
  getAllUsers: async (params = {}): Promise<{ users: User[]; totalUsers: number; currentPage: number; totalPages: number }> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id: string): Promise<{ user: User }> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, userData: Partial<User>): Promise<{ user: User }> => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  
  deleteUserAccount: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/users/profile');
    return response.data;
  }
};

// Payment API
export const PaymentAPI = {
  createStripePaymentIntent: async (amount: number, currency = 'usd') => {
    const response = await api.post('/payments/stripe/create-payment-intent', { amount, currency });
    return response.data;
  },

  confirmStripePayment: async (paymentIntentId: string) => {
    const response = await api.post('/payments/stripe/confirm-payment', { paymentIntentId });
    return response.data;
  },

  createPayPalOrder: async (amount: number) => {
    const response = await api.post('/payments/paypal/create-order', { amount });
    return response.data;
  },

  capturePayPalPayment: async (orderId: string) => {
    const response = await api.post('/payments/paypal/capture-payment', { orderId });
    return response.data;
  }
};

// Chat API
export const ChatAPI = {
  sendMessage: async (message: string, isAdmin: boolean = false) => {
    const response = await api.post('/chat/message', { message, isAdmin });
    return response.data;
  }
};

export default api;