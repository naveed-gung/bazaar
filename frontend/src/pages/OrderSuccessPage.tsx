import { Link, useLocation, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout/Layout";
import { useEffect, useState } from "react";
import { OrderAPI } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function OrderSuccessPage() {
  const location = useLocation();
  const { orderId: paramOrderId } = useParams<{ orderId: string }>();
  const stateOrder = location.state?.order;
  
  const [order, setOrder] = useState<any>(stateOrder || null);
  const [loading, setLoading] = useState(!stateOrder && !!paramOrderId);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // If no state order but we have an orderId param, fetch from API
  useEffect(() => {
    if (!stateOrder && paramOrderId) {
      setLoading(true);
      OrderAPI.getOrderById(paramOrderId)
        .then((data) => {
          setOrder(data.order || data);
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => setLoading(false));
    }
  }, [stateOrder, paramOrderId]);

  // No order in state and no orderId in URL → redirect home
  if (!stateOrder && !paramOrderId) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-3xl mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="container max-w-3xl mx-auto py-16 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find this order. It may have been removed or the link is invalid.
          </p>
          <Button asChild>
            <Link to="/orders">View My Orders</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const orderId = order._id || order.id || '';
  const orderNumber = orderId.length > 6 ? orderId.substring(orderId.length - 6).toUpperCase() : orderId.toUpperCase();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(order.createdAt));
  
  return (
    <Layout>
      <div className="container max-w-3xl mx-auto py-16 px-4">
        <div className="bg-card border rounded-lg p-8 text-center">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full dark:bg-green-900">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-green-600 dark:text-green-300" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Thank You for Your Order!</h1>
          <p className="text-muted-foreground mb-8">
            Your order has been placed successfully and is being prepared for shipping.
          </p>
          
          <div className="border rounded-lg p-6 mb-8 text-left">
            <h2 className="text-xl font-semibold mb-4">Order Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number:</span>
                <span className="font-medium">{orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span>{order.paymentMethod === 'paypal' ? 'PayPal' : order.paymentMethod === 'apple-pay' ? 'Apple Pay' : order.paymentMethod === 'stripe' ? 'Stripe' : 'Credit Card'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium mb-3">Items</h3>
              <div className="space-y-3">
                {(order.orderItems || order.items || []).map((item: { product?: string; id?: string; name: string; quantity: number; price: number }, idx: number) => (
                  <div key={item.product || item.id || idx} className="flex justify-between">
                    <div>
                      <span>{item.name}</span>
                      <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                    </div>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${(order.totalPrice ?? order.total ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to="/orders">View My Orders</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/track-order`} state={{ orderId }}>Track This Order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/products">Continue Shopping</Link>
            </Button>
          </div>
          
          <p className="mt-6 text-sm text-muted-foreground">
            We've sent a confirmation email to your registered email address with all the details.
          </p>
        </div>
      </div>
    </Layout>
  );
}
