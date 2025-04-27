# Bazaar Backend

This directory contains the Node.js/Express backend API for the Bazaar e-commerce platform.

## Technology Stack

- **Node.js**: JavaScript runtime
- **Express**: Web framework for API endpoints
- **MongoDB**: NoSQL database for data storage
- **Mongoose**: ODM for MongoDB
- **JWT**: Authentication mechanism
- **Firebase Admin**: User management integration

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the environment variables by copying the template:
   ```bash
   cp .env.example .env
   ```
   
3. Start the development server:
   ```bash
   npm run dev
   ```
   The server will start on http://localhost:5000

4. Initialize the database with sample data:
   ```bash
   npm run seed
   ```

## Project Structure

- **`/src`**: Source code directory
  - **`/config`**: Configuration files and database setup
  - **`/controllers`**: Request handlers for API endpoints
  - **`/middleware`**: Express middleware functions
  - **`/models`**: Mongoose schemas and models
  - **`/routes`**: API route definitions
  - **`/utils`**: Utility functions and helpers

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/profile` - Get user profile (authenticated)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create a new product (admin)
- `PUT /api/products/:id` - Update a product (admin)
- `DELETE /api/products/:id` - Delete a product (admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create a new category (admin)
- `PUT /api/categories/:id` - Update a category (admin)
- `DELETE /api/categories/:id` - Delete a category (admin)

### Orders
- `GET /api/orders` - Get user orders (authenticated)
- `GET /api/orders/:id` - Get order by ID (authenticated)
- `POST /api/orders` - Create a new order (authenticated)
- `PUT /api/orders/:id/pay` - Update order to paid (authenticated)
- `GET /api/orders/admin` - Get all orders (admin)

### Admin Dashboard
- `GET /api/admin/summary` - Get sales summary data (admin)

## Environment Variables

Required environment variables:
```
MONGODB_URI=mongodb://localhost:27017/bazaar
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=7d
PORT=5000
NODE_ENV=development

# Firebase credentials
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
FIREBASE_APP_ID=your_firebase_app_id

# Payment processing (for development)
STRIPE_SECRET_KEY=your_stripe_secret_key
PAYPAL_CLIENT_ID=your_paypal_client_id 