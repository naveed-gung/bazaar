const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Not required because guest checkout is possible
  },
  email: {
    type: String,
    required: true
  },
  orderItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: String,
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
      },
      price: {
        type: Number,
        required: true
      },
      image: String
    }
  ],
  shippingAddress: {
    name: String,
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'US'
    }
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit-card', 'PayPal', 'apple-pay', 'stripe']
  },
  paymentId: {
    type: String,
    // This stores the PayPal order ID or Stripe payment intent ID
  },
  paymentResult: {
    id: String,
    status: String,
    updateTime: String,
    email: String,
    providerData: Object // Raw data from payment provider
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  trackingNumber: String,
  notes: String
}, {
  timestamps: true
});

// Method to calculate order totals
orderSchema.methods.calculateTotals = function() {
  // Calculate subtotal
  this.itemsPrice = this.orderItems.reduce(
    (acc, item) => acc + item.price * item.quantity, 
    0
  );
  
  // Calculate tax (e.g., 8% of subtotal)
  this.taxPrice = parseFloat((this.itemsPrice * 0.08).toFixed(2));
  
  // Calculate shipping (flat fee or free above certain amount)
  this.shippingPrice = this.itemsPrice > 100 ? 0 : 12.99;
  
  // Calculate total
  this.totalPrice = parseFloat(
    (this.itemsPrice + this.taxPrice + this.shippingPrice).toFixed(2)
  );
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 