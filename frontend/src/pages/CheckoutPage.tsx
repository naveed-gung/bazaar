import { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCart } from '@/contexts/CartContext';
import { CheckoutForm } from '@/components/ui/CheckoutForm';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/layout/Layout';

// Initialize Stripe
// NOTE: For production, make sure to serve this page over HTTPS to avoid Stripe warnings.
// The warning "You may test your Stripe.js integration over HTTP. However, live Stripe.js integrations must use HTTPS."
// is expected in development/testing environments. In production, make sure SSL is properly configured.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_sample');

export default function CheckoutPage() {
  const { cart, clearCart, cartTotal } = useCart();
  const [clientSecret, setClientSecret] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Simulate creating a PaymentIntent
    const createPaymentIntent = async () => {
      setIsLoading(true);
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock client secret for simulation
        setClientSecret('pi_simulated_secret_' + Math.random().toString(36).substring(2));
      } catch (err) {
        console.error('Error creating payment intent:', err);
        toast({
          title: "Error",
          description: "Could not initialize payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (cart.length > 0) {
      createPaymentIntent();
    }
  }, []);

  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      setIsLoading(true);
      
      // Simulate creating the order in backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a new order object with proper formatting
      const newOrder = {
        id: 'order_' + Math.random().toString(36).substring(2),
        _id: 'order_' + Math.random().toString(36).substring(2), // Added for compatibility
        paymentIntentId: paymentIntent.id,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image
        })),
        total: cartTotal,
        status: 'processing',
        paymentMethod: paymentIntent.method || 'card',
        createdAt: new Date().toISOString(),
        shippingAddress: {
          name: 'John Doe',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'USA'
        },
        user: JSON.parse(localStorage.getItem('user') || '{}')
      };
      
      // In a real app, this would be sent to an API
      // For simulation, we'll store in localStorage
      const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
      localStorage.setItem('orders', JSON.stringify([...existingOrders, newOrder]));
      
      // Also add to admin recent orders
      const adminOrders = JSON.parse(localStorage.getItem('adminOrders') || '[]');
      localStorage.setItem('adminOrders', JSON.stringify([...adminOrders, newOrder]));
      
      // Clear the cart
      clearCart();
      
      // Show success notification
      toast({
        title: "Order placed successfully!",
        description: `Order #${newOrder.id.substring(6)} has been created.`,
      });
      
      // Navigate to success page
      navigate('/order-success', { state: { order: newOrder } });
    } catch (err) {
      console.error('Error creating order:', err);
      toast({
        title: "Error",
        description: "Failed to process your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#0f172a',
    },
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-12">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="md:col-span-1">
            <div className="border rounded-lg p-6 bg-card shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between py-2">
                    <div className="flex-1">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-right">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between py-1">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Shipping</span>
                    <span>$5.99</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Tax</span>
                    <span>${(cartTotal * 0.08).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold border-t mt-2">
                    <span>Total</span>
                    <span>${(cartTotal + 5.99 + cartTotal * 0.08).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Payment Section */}
          <div className="md:col-span-2">
            <div className="border rounded-lg p-6 bg-card shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-muted-foreground">Initializing payment...</p>
                </div>
              ) : clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                  <CheckoutForm onSuccess={handlePaymentSuccess} />
                </Elements>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No items in cart to checkout</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
