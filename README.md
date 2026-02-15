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

## Vision

**Bazaar** is a modern e-commerce platform that combines cutting-edge technology with intuitive design to deliver a seamless shopping experience — from browsing to checkout to order tracking.

## Core Features

### Shopping Experience
- **AI-Powered Chatbot** — Ultra-friendly shopping assistant with 30+ intent handlers, product search, stock checks, personalized recommendations, order tracking, and role-based quick-action chips
- **Multi-Step Checkout** — 3-step flow (Shipping → Payment → Review) with visual step indicator, inline validation, animated transitions, and empty-cart guard
- **Toast Notifications** — Stacked notification queue with auto-dismiss, undo actions, and smooth animations
- **Image Lazy Loading** — Blur-up placeholder effect with intersection observer for performant image loading
- **Dual-Handle Price Slider** — Interactive price range filter with manual min/max inputs and visual active track
- **Smart Search** — Debounced autocomplete on desktop and mobile with product thumbnails, names, and prices
- **Favorites System** — Save and manage favorite products with persistent local storage
- **Order Tracking** — Real-time order status with timeline view, carrier info, and estimated delivery dates
- **Responsive Design** — Fully responsive across all devices with mobile-optimized navigation and search

### Product Management
- **Real-Time Inventory** — Accurate stock levels with low-stock warnings and quantity caps (max 99)
- **Dynamic Filtering** — Category, price range, rating, and sort filters with clear-all functionality
- **Product Detail Pages** — Full product info with prose-styled descriptions, image galleries, reviews, and related products

### Authentication & Security
- **Firebase Authentication** — Frontend auth with Google/Email providers and graceful SDK initialization
- **JWT Session Management** — Secure token-based auth with httpOnly cookies and refresh tokens
- **Login Redirect-Back** — Users return to their original page after logging in
- **Password Strength Meter** — 5-criteria checklist with visual progress bar (min 8 characters)
- **Role-Based Access Control** — Admin and customer roles with protected routes and middleware
- **50+ Security Hardening Fixes** — Input sanitization, rate limiting, CORS protection, XSS prevention, Helmet headers, mongoSanitize, and more

### Admin Features
- **Admin Dashboard** — Product CRUD, order management, user management
- **Chatbot Admin Mode** — Real-time inventory status, recent orders, low stock alerts, customer accounts, and unavailable product request tracking
- **Product Form** — Full-featured product creation/editing with image upload and validation

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS 3.4 · @tailwindcss/typography · Shadcn/Radix UI · Framer Motion · Lucide Icons · TanStack React Query |
| **Backend** | Node.js · Express · MongoDB Atlas (Mongoose) · JWT Authentication · Firebase Admin SDK · Helmet · express-rate-limit · Joi validation |
| **Payments** | Simulation mode — simple card form with mock payment IDs (`pi_sim_*`) |
| **State** | React Context API (Auth, Cart, Favorites, Theme) · Local Storage persistence |
| **Deployment** | Frontend: Netlify · Backend: Render |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/naveed-gung/bazaar.git

# Install dependencies for both frontend and backend
cd bazaar
npm run setup

# Start development servers
npm run dev
```

The frontend runs on `http://localhost:8080` and the backend on `http://localhost:5000`.

### Seeding the Database

```bash
cd backend
node src/config/seed.js
```

This creates 1 admin account (`admin@bazaar.com` / `admin123`), 10 categories, and 220 products.

## Environment Setup

Both frontend and backend require `.env` files. Copy the templates:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

### Required Environment Variables

#### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:5000/api`) |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

#### Backend
| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |
| `PORT` | Server port (default: `5000`) |

## Payment Processing

The platform uses a **simulation-only** payment system for development and demonstration:

- Simple credit card form (name, number, expiry, CVC)
- Simulated payment processing with mock payment IDs (`pi_sim_*`)
- Amber "Simulation Mode" banner displayed at checkout
- No real payment SDKs — all transactions are simulated
- Full checkout flow: Shipping Address → Payment → Order Review → Confirmation

## Authentication System

- **Firebase Authentication** — Frontend sign-up/sign-in with email/password and Google OAuth
- **JWT Tokens** — Backend issues access + refresh tokens stored in httpOnly cookies
- **Firebase Admin SDK** — Backend verifies Firebase tokens for SSO flow
- **Graceful Initialization** — Firebase Admin SDK initializes safely with missing credentials
- **Protected Routes** — Auth middleware validates tokens on every protected API call
- **Redirect-Back** — Login preserves the user's intended destination via location state

## Chatbot Intelligence

The AI shopping assistant supports **30+ intents** with an ultra-friendly personality:

**For Customers:**
- Product search, price checks, stock availability, and comparisons
- Personalized recommendations, deal highlights, and new arrival notifications
- Category browsing, order tracking, return/refund policy, and shipping info
- Payment help, account assistance, size guides, and gift suggestions
- Quick-action chips: "Show deals", "Popular products", "Track my order", "New arrivals", "Browse categories"

**For Admins:**
- Real-time inventory overview with critical stock alerts
- Recent order summaries with revenue totals
- Customer account listings with activity status
- Unavailable product request tracking (missed search analytics)
- Quick-action chips: "Inventory status", "Recent orders", "Low stock alerts", "Customer accounts"

## Project Structure

```
bazaar/
├── frontend/                React + TypeScript + Vite
│   └── src/
│       ├── components/
│       │   ├── admin/       Admin dashboard components
│       │   ├── animation/   Animation wrappers (ScrollReveal, AnimatedPage)
│       │   ├── chatbot/     AI chatbot assistant
│       │   ├── home/        Home page sections (Hero, Featured, Categories)
│       │   ├── layout/      Navbar, Footer
│       │   ├── product/     Product cards, detail views, filters
│       │   └── ui/          Shadcn/Radix primitives (35 components)
│       ├── contexts/        Auth, Cart, Favorites, Theme providers
│       ├── hooks/           useAuth, useCart, useFavorites, useScrollAnimation
│       ├── lib/             API client, utilities, animations
│       └── pages/           20+ pages including admin panel
│           └── admin/       Admin management pages
├── backend/                 Node.js + Express API
│   └── src/
│       ├── config/          Firebase config, database seeding
│       ├── controllers/     Auth, Product, Order, Chat, Payment, etc.
│       ├── middleware/      Auth middleware, rate limiters
│       ├── models/          User, Product, Order, Category schemas
│       └── routes/          RESTful API endpoints
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── package.json             Root scripts (setup, dev)
```

## Future Roadmap

- Wishlist sharing and social features
- Product review images and video uploads
- Email notification system (order confirmation, shipping updates)
- Advanced search with fuzzy matching and filters
- Customer loyalty points program
- Multi-language support (i18n)

---

<div align="center">
  <p>Made with care</p>
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
