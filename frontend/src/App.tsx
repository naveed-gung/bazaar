import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import ProductsPage from "@/pages/ProductsPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderSuccessPage from "@/pages/OrderSuccessPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminProductsPage from "@/pages/admin/AdminProductsPage";
import AdminProductNewPage from "@/pages/admin/AdminProductNewPage";
import AdminOrdersPage from "@/pages/admin/AdminOrdersPage";
import AdminCustomersPage from "@/pages/admin/AdminCustomersPage";
import AdminCustomerDetailPage from "@/pages/admin/AdminCustomerDetailPage";
import AdminCustomerEditPage from "@/pages/admin/AdminCustomerEditPage";
import AdminCustomerOrdersPage from "@/pages/admin/AdminCustomerOrdersPage";
import AdminCustomerMessagePage from "@/pages/admin/AdminCustomerMessagePage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";
import AdminInventoryPage from "@/pages/admin/AdminInventoryPage";
import NotFound from "@/pages/NotFound";
import AboutPage from "@/pages/AboutPage";
import CategoryPage from "@/pages/CategoryPage";
import ProfilePage from "@/pages/ProfilePage";
import OrdersPage from "@/pages/OrdersPage";
import FavoritesPage from "@/pages/FavoritesPage";
import CategoriesPage from "@/pages/CategoriesPage";
import CollectionsPage from "@/pages/CollectionsPage";
import NewArrivalsPage from "@/pages/NewArrivalsPage";
import FAQPage from "@/pages/FAQPage";
import ShippingPage from "@/pages/ShippingPage";
import TrackOrderPage from "@/pages/TrackOrderPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import CareersPage from "@/pages/CareersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="zenith-theme">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/product/:productId" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order-success" element={<OrderSuccessPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/category/:categoryId" element={<CategoryPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  
                  {/* New Routes */}
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/new-arrivals" element={<NewArrivalsPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/shipping" element={<ShippingPage />} />
                  <Route path="/track-order" element={<TrackOrderPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/careers" element={<CareersPage />} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/products/new" element={<AdminProductNewPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/customers" element={<AdminCustomersPage />} />
                  <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
                  <Route path="/admin/customers/:id/edit" element={<AdminCustomerEditPage />} />
                  <Route path="/admin/customers/:id/orders" element={<AdminCustomerOrdersPage />} />
                  <Route path="/admin/customers/:id/message" element={<AdminCustomerMessagePage />} />
                  <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                  <Route path="/admin/inventory" element={<AdminInventoryPage />} />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
