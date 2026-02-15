import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Firebase configuration - using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Validate required Firebase config before initializing
const FIREBASE_CONFIGURED = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialize Firebase only if configured
const app = FIREBASE_CONFIGURED ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

// API URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type User = {
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
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for stored token on initial load
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        
        // Set default auth header for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch (e) {
        // Corrupt localStorage data - clear it
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    
    setLoading(false);
  }, []);

  // Show a helpful message if Firebase is not configured
  if (!FIREBASE_CONFIGURED) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', fontFamily: 'system-ui, sans-serif', textAlign: 'center', background: '#0f172a', color: '#e2e8f0' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#f87171' }}>Firebase Configuration Missing</h1>
        <p style={{ maxWidth: '480px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Create a <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>.env</code> file in the <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>frontend/</code> directory with your Firebase credentials.
        </p>
        <pre style={{ background: '#1e293b', padding: '1rem 1.5rem', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', lineHeight: 1.7, overflowX: 'auto', maxWidth: '100%' }}>{`VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}</pre>
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>Then restart the dev server.</p>
      </div>
    );
  }

  // Register with email and password
  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    
    try {
      // Create user in Firebase
      if (!auth) throw new Error('Firebase is not configured');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      
      // Register user in our backend
      const response = await axios.post(`${API_URL}/auth/firebase`, { idToken });
      
      const { token, user } = response.data;
      
      // Save to state and local storage
      setToken(token);
      setUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set default auth header for all requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Login with email and password
  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      // Sign in with Firebase
      if (!auth) throw new Error('Firebase is not configured');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      // Authenticate with our backend
      const response = await axios.post(`${API_URL}/auth/firebase`, { idToken });
      const { token, user } = response.data;
      // Save to state and local storage
      setToken(token);
      setUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      // Set default auth header for all requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    setLoading(true);
    
    try {
      // Get cart data before login if it exists
      let preLoginCart: any[] = [];
      try {
        const localCart = localStorage.getItem("cart");
        preLoginCart = localCart ? JSON.parse(localCart) : [];
        if (!Array.isArray(preLoginCart)) preLoginCart = [];
      } catch {
        preLoginCart = [];
      }

      // Sign in with Google via Firebase
      if (!auth) throw new Error('Firebase is not configured');
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      
      // Authenticate with our backend
      const response = await axios.post(`${API_URL}/auth/firebase`, { idToken });
      
      const { token, user } = response.data;
      
      // Save to state and local storage
      setToken(token);
      setUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set default auth header for all requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Merge pre-login cart with any existing cart data from previous sessions
      const existingCart = Array.isArray(user.cart) ? user.cart : [];
      const mergedCart = [...existingCart, ...preLoginCart];
      // Remove duplicates based on product ID
      const uniqueCart = Array.from(new Map(mergedCart.map((item: any) => [item.id, item])).values());
      localStorage.setItem("cart", JSON.stringify(uniqueCart));

      return user;
    } catch (error) {
      console.error("Google login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Call backend logout endpoint BEFORE clearing credentials
      try {
        await axios.post(`${API_URL}/auth/logout`);
      } catch {
        // Ignore backend logout failures
      }
      
      // Sign out from Firebase
      if (auth) await signOut(auth);
      
      // Clear state and local storage
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      localStorage.removeItem("favorites");
      localStorage.removeItem("orders");
      localStorage.removeItem("adminOrders");
      
      // Remove auth header
      delete axios.defaults.headers.common['Authorization'];

      // Navigate to login page
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local data even if backend/firebase fails
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      delete axios.defaults.headers.common['Authorization'];
      navigate("/login");
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};