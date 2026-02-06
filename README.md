<div align="center">
  <img src="frontend/public/image.png" alt="Bazaar Logo" width="250px"/>
  
  # BAZAAR
  ### Next-Gen E-Commerce Platform
  
  <p>Where Shopping Meets Innovation</p>
  
  <p>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18.x-20232A?logo=react&logoColor=61DAFB" alt="React"/></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-20.x-5FA04E?logo=nodedotjs&logoColor=white" alt="Node.js"/></a>
    <a href="https://www.mongodb.com"><img src="https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white" alt="MongoDB"/></a>
  </p>
  
  <p>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/naveed-gung/bazaar?color=blue" alt="License"/></a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"/>
    <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-orange" alt="Contributions"/></a>
  </p>
</div>

---

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Telescope.png" width="25" /></picture> Vision

**Bazaar** is redefining the e-commerce experience for the modern digital age. Our platform combines cutting-edge technology with intuitive design to create a seamless shopping journey.

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Glowing%20Star.png" width="25" /></picture> Core Features

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

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Hammer%20and%20Wrench.png" width="25" /></picture> Tech Stack

```
Frontend: React + TypeScript + Vite | Tailwind CSS + Shadcn UI | Framer Motion
Backend: Node.js + Express | MongoDB | JWT Authentication | Firebase Admin SDK
Payments: Stripe API | PayPal SDK | Apple Pay integration
State Management: Context API | Local Storage for persistence
```

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" width="25" /></picture> Quick Start

```bash
# Clone the repository
git clone https://github.com/naveed-gung/bazaar.git

# Install dependencies for both frontend and backend
cd bazaar
npm run setup

# Start development servers
npm run dev
```

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Mobile%20Phone.png" width="25" /></picture> App Preview

| Home Page | Product Details | Shopping Cart |
|-----------|-----------------|---------------|
| Modern UI with trending items | Interactive product view | Smart checkout process |

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Gear.png" width="25" /></picture> Environment Setup

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

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Credit%20Card.png" width="25" /></picture> Payment Processing

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

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Locked%20with%20Key.png" width="25" /></picture> Authentication System

- Firebase Authentication for frontend
- JWT-based session management
- Role-based access control
- Secure API routes with middleware

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Milky%20Way.png" width="25" /></picture> Future Roadmap

- Voice-assisted shopping experience
- Blockchain-based payment system
- Customer loyalty NFT program
- Global CDN for faster content delivery
- AR/VR shopping environment
- Subscription-based product offerings
- AI chatbot for customer service

## <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Package.png" width="25" /></picture> Project Structure

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
    <picture><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Sparkling%20Heart.png" width="20" /></picture> Made with love
  </p>
  <strong>BAZAAR</strong> — Shopping Reimagined for the Digital Future
  <p>
    <a href="./CONTRIBUTING.md">
      <img src="https://img.shields.io/badge/Contribute-Guide-5865F2?logo=github" alt="Contributing Guide"/>
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-97CA00?logo=opensourceinitiative&logoColor=white" alt="MIT License"/>
    </a>
  </p>
</div>
 
