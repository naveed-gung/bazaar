# Smart Shopping Assistant Chatbot

This chatbot component provides an intelligent shopping assistant experience that can help users find products, get details, check prices and stock levels, and receive personalized recommendations.

## Features

- Natural language understanding for product queries
- Real-time access to product database
- Rich UI with product cards and details
- Role-based access control:
  - Admin users get full access to all product data including inactive products
  - Regular users only see active products
- Loading indicators and error handling
- Responsive design that works on all devices

## Authentication

The chatbot uses JWT authentication through the application's auth context:

1. Authentication token is automatically included in all API requests
2. Admin users receive special recognition and extended data access
3. User role determines the scope of product data visible in responses

## Usage Examples

Users can ask questions like:

- "Show me smartphones under $500"
- "What's the price of the MacBook Pro?"
- "Is the Samsung TV in stock?"
- "Tell me about the Sony headphones"
- "Recommend some gaming laptops"
- "What categories do you have?"

## Implementation

The chatbot combines a React frontend with a Node.js backend:

- Frontend: React component with TypeScript and Tailwind CSS
- Backend: Express.js API with MongoDB integration
- Authentication: JWT tokens with role-based access
- Natural Language Processing: Custom pattern matching for intent detection 