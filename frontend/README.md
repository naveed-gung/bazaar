# Bazaar Frontend

This directory contains the React-based frontend for the Bazaar e-commerce platform.

## Technology Stack

- **React**: Core UI library
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework for styling
- **Redux**: State management
- **React Router**: Navigation and routing

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   The server will start on http://localhost:5173

3. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

- **`/public`**: Static assets including images and favicon
- **`/src`**: Application source code
  - **`/components`**: Reusable UI components
  - **`/pages`**: Full page components
  - **`/redux`**: Redux store, actions, and reducers
  - **`/services`**: API services and backend communication
  - **`/styles`**: Global styles and Tailwind configuration
  - **`/utils`**: Utility functions and helpers

## Environment Variables

Create a `.env` file in the frontend directory with these variables:

```
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## Features

- Modern, responsive user interface
- Product browsing by category
- Product search and filtering
- Shopping cart management
- User authentication
- Order management and tracking
- Admin panel for authorized users
