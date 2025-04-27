const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// PayPal API configuration
const PAYPAL_API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

/**
 * Get PayPal access token
 * @returns {Promise<string>} Access token
 */
const getAccessToken = async () => {
  try {
    const response = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET
      },
      data: 'grant_type=client_credentials'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('PayPal Authentication Error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with PayPal');
  }
};

/**
 * Create a PayPal order
 * @param {Object} orderData Order data including items, amounts, and customer details
 * @returns {Promise<Object>} PayPal order response
 */
const createOrder = async (orderData) => {
  try {
    const accessToken = await getAccessToken();
    
    // Generate a unique request ID
    const requestId = `order-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Map our order data to PayPal's expected format
    const paypalOrderData = formatOrderForPayPal(orderData);
    
    const response = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': requestId
      },
      data: paypalOrderData
    });
    
    return response.data;
  } catch (error) {
    console.error('PayPal Order Creation Error:', error.response?.data || error.message);
    throw new Error('Failed to create PayPal order');
  }
};

/**
 * Capture payment for an approved PayPal order
 * @param {string} orderId PayPal order ID to capture
 * @returns {Promise<Object>} Capture response
 */
const capturePayment = async (orderId) => {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('PayPal Payment Capture Error:', error.response?.data || error.message);
    throw new Error('Failed to capture PayPal payment');
  }
};

/**
 * Format our internal order data for PayPal API
 * @param {Object} orderData Our internal order data
 * @returns {Object} Formatted data for PayPal API
 */
const formatOrderForPayPal = (orderData) => {
  const { items, shipping = 0, tax = 0, customer, returnUrl, cancelUrl } = orderData;
  
  // Calculate item total
  const itemTotal = items.reduce((sum, item) => {
    return sum + (Number(item.price) * Number(item.quantity));
  }, 0).toFixed(2);
  
  // Calculate order total
  const orderTotal = (Number(itemTotal) + Number(shipping) + Number(tax)).toFixed(2);
  
  // Format items for PayPal
  const paypalItems = items.map(item => ({
    name: item.name,
    description: item.description || '',
    sku: item.sku || '',
    unit_amount: {
      currency_code: 'USD',
      value: item.price.toFixed(2)
    },
    quantity: item.quantity.toString(),
    category: 'PHYSICAL_GOODS'
  }));
  
  // Build the PayPal order object
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: orderTotal,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: itemTotal
            },
            shipping: {
              currency_code: 'USD',
              value: shipping.toFixed(2)
            },
            tax_total: {
              currency_code: 'USD',
              value: tax.toFixed(2)
            }
          }
        },
        items: paypalItems
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          shipping_preference: 'GET_FROM_FILE',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      }
    }
  };
};

module.exports = {
  createOrder,
  capturePayment
}; 