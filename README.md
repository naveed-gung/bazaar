<div align="center">
  <img src="frontend/public/image.png" alt="Bazaar Logo" width="250px"/>
  
  # BAZAAR
  ### Next-Gen E-Commerce Platform
  
  <p>Where Shopping Meets Innovation</p>
  
  <p>
    <img src="https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/MongoDB-7.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  </p>
  
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"/>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome"/>
    <img src="https://img.shields.io/badge/contributions-welcome-orange?style=flat-square" alt="Contributions"/>
  </p>
</div>

---

## <img src="https://img.shields.io/badge/-Vision-8B5CF6?style=flat-square" alt="Vision"/> Vision

**Bazaar** is redefining the e-commerce experience for the modern digital age. Our platform combines cutting-edge technology with intuitive design to create a seamless shopping journey.

## <img src="https://img.shields.io/badge/-Features-10B981?style=flat-square" alt="Features"/> Core Features

- **AI-Powered Recommendations** - Personalized suggestions based on browsing patterns
- **Immersive Product Exploration** - Interactive 3D models and AR product visualization
- **Seamless Checkout Process** - Frictionless payments with multiple options
- **Real-time Inventory Management** - Always accurate product availability
- **Responsive Design** - Perfect experience on any device
- **Multi-Payment Support** - Integrated Stripe, PayPal, and Apple Pay
- **Smart Shopping Cart** - Persistent cart with local storage
- **User Authentication** - Secure login with Firebase and JWT
- **Interactive Product Filtering** - Dynamic category and price filters
- **Favorites System** - Save and manage favorite products

## <img src="https://img.shields.io/badge/-Tech_Stack-3B82F6?style=flat-square" alt="Tech Stack"/> Tech Stack

```
Frontend: React + TypeScript + Vite | Tailwind CSS + Shadcn UI | Framer Motion
Backend: Node.js + Express | MongoDB | JWT Authentication | Firebase Admin SDK
Payments: Stripe API | PayPal SDK | Apple Pay integration
State Management: Context API | Local Storage for persistence
```

## <img src="https://img.shields.io/badge/-Quick_Start-F59E0B?style=flat-square" alt="Quick Start"/> Quick Start

```bash
# Clone the repository
git clone https://github.com/naveed-gung/bazaar.git

# Install dependencies for both frontend and backend
cd bazaar
npm run setup

# Start development servers
npm run dev
```

## <img src="https://img.shields.io/badge/-App_Preview-EC4899?style=flat-square" alt="App Preview"/> App Preview

| Home Page | Product Details | Shopping Cart |
|-----------|-----------------|---------------|
| Modern UI with trending items | Interactive product view | Smart checkout process |

## <img src="https://img.shields.io/badge/-Environment_Setup-6366F1?style=flat-square" alt="Environment Setup"/> Environment Setup

Both frontend and backend include environment templates. Copy and configure them for your setup:

```
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

### Required Environment Variables

#### Frontend
- `VITE_API_URL` - Backend API URL
- `VITE_FIREBASE_CONFIG` - Firebase credentials for authentication

#### Backend
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT authentication
- `STRIPE_SECRET_KEY` - Stripe payment processing API key
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal client secret
- `FIREBASE_PROJECT_ID` - Firebase project ID for admin SDK
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase private key

## <img src="https://img.shields.io/badge/-Payment_Processing-22C55E?style=flat-square" alt="Payment Processing"/> Payment Processing

### Stripe Integration
The platform uses Stripe for credit card processing with a custom checkout form that supports:
- Credit/Debit cards
- Apple Pay
- Dark mode compatible UI
- Secure token-based transactions

### PayPal Integration
Alternative payment option with:
- Express checkout
- PayPal account payments
- Credit card processing through PayPal

## <img src="https://img.shields.io/badge/-Authentication-EF4444?style=flat-square" alt="Authentication"/> Authentication System

- Firebase Authentication for frontend
- JWT-based session management
- Role-based access control
- Secure API routes with middleware

## <img src="https://img.shields.io/badge/-Future_Roadmap-A855F7?style=flat-square" alt="Future Roadmap"/> Future Roadmap

- Voice-assisted shopping experience
- Blockchain-based payment system
- Customer loyalty NFT program
- Global CDN for faster content delivery
- AR/VR shopping environment
- Subscription-based product offerings
- AI chatbot for customer service

## <img src="https://img.shields.io/badge/-Project_Structure-14B8A6?style=flat-square" alt="Project Structure"/> Project Structure

```
/frontend            - React frontend application
  /src
    /components      - Reusable UI components
    /contexts        - Context API providers
    /hooks           - Custom React hooks
    /pages           - Page components
    /lib             - Utility functions

/backend             - Node.js Express API
  /src
    /controllers     - Request handlers
    /models          - MongoDB schemas
    /routes          - API endpoints
    /middleware      - Express middleware
    /services        - Business logic
```

---

<div align="center">
  <p>
    <img src="https://img.shields.io/badge/Made_with-❤️-red?style=flat-square" alt="Made with love"/>
  </p>
  <strong>BAZAAR</strong> — Shopping Reimagined for the Digital Future
  <p>
    <a href="./CONTRIBUTING.md">
      <img src="https://img.shields.io/badge/Contribute-Guide-blue?style=flat-square" alt="Contributing Guide"/>
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License"/>
    </a>
  </p>
</div>
 
