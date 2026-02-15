import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { OrderAPI } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  paymentIntentId: string;
  total: number;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  createdAt: string;
  items: any[];
  customer?: {
    name: string;
    email: string;
    id: string;
  };
  shippingAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch orders data
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        // Try to get orders from localStorage (our simulation)
        const storedOrders = JSON.parse(localStorage.getItem('adminOrders') || '[]');
        
        // If we have stored orders, use them, otherwise create sample data
        const ordersData = storedOrders.length > 0 ? storedOrders : [
          {
            id: 'order_12345',
            paymentIntentId: 'pi_123456789',
            total: 129.99,
            status: 'processing',
            paymentMethod: 'card',
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            items: [
              { id: 'prod1', name: 'Blue Hoodie', price: 59.99, quantity: 1 },
              { id: 'prod2', name: 'Black Jeans', price: 35.00, quantity: 2 }
            ],
            customer: {
              name: 'John Doe',
              email: 'john@example.com',
              id: '1'
            },
            shippingAddress: {
              name: 'John Doe',
              street: '123 Main St',
              city: 'Anytown',
              state: 'CA',
              zip: '12345',
              country: 'USA'
            }
          },
          {
            id: 'order_67890',
            paymentIntentId: 'pi_987654321',
            total: 75.50,
            status: 'shipped',
            paymentMethod: 'paypal',
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            items: [
              { id: 'prod3', name: 'Running Shoes', price: 75.50, quantity: 1 }
            ],
            customer: {
              name: 'Jane Smith',
              email: 'jane@example.com',
              id: '2'
            },
            shippingAddress: {
              name: 'Jane Smith',
              street: '456 Oak Ave',
              city: 'Somewhere',
              state: 'NY',
              zip: '67890',
              country: 'USA'
            }
          }
        ];
        
        // Save to localStorage if we created sample data
        if (storedOrders.length === 0) {
          localStorage.setItem('adminOrders', JSON.stringify(ordersData));
        }
        
        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchOrders();
    }
  }, [user]);

  const handleUpdateStatus = (orderId: string, newStatus: 'processing' | 'shipped' | 'delivered' | 'cancelled') => {
    // Update admin orders
    const updatedOrders = orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    
    setOrders(updatedOrders);
    localStorage.setItem('adminOrders', JSON.stringify(updatedOrders));
    
    // Also update customer orders in localStorage
    const customerOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedCustomerOrders = customerOrders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    
    localStorage.setItem('orders', JSON.stringify(updatedCustomerOrders));
    
    // Call the API method to update order status (in a real application)
    try {
      // In a real app, we would call: OrderAPI.updateOrderStatus(orderId, newStatus);
      // For now, just show the success toast
      toast({
        title: "Order Updated",
        description: `Order ${orderId.substring(6).toUpperCase()} status changed to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter orders based on status
  const filteredOrders = statusFilter === "all" 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  // Sort orders by date (newest first)
  const sortedOrders = [...filteredOrders].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'shipped': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'delivered': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:text-primary">Dashboard</Link>
            <span>&gt;</span>
            <span>Orders</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Management</h1>
          <p className="text-muted-foreground">View and manage all customer orders.</p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Filter Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading orders...</div>
            ) : sortedOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left">Order ID</th>
                      <th className="py-3 px-4 text-left">Date</th>
                      <th className="py-3 px-4 text-left">Customer</th>
                      <th className="py-3 px-4 text-left">Items</th>
                      <th className="py-3 px-4 text-left">Total</th>
                      <th className="py-3 px-4 text-left">Payment</th>
                      <th className="py-3 px-4 text-left">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">
                          {order.id.substring(6).toUpperCase()}
                        </td>
                        <td className="py-3 px-4">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {order.customer?.name || order.shippingAddress?.name || 'Anonymous'}
                        </td>
                        <td className="py-3 px-4">
                          {order.items.length} item{order.items.length > 1 ? 's' : ''}
                        </td>
                        <td className="py-3 px-4">${order.total.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          {order.paymentMethod === 'paypal' ? 'PayPal' : 'Credit Card'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/orders/${order.id}`}>View</Link>
                            </Button>
                            <Select 
                              value={order.status} 
                              onValueChange={(value) => handleUpdateStatus(
                                order.id, 
                                value as 'processing' | 'shipped' | 'delivered' | 'cancelled'
                              )}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue placeholder="Update" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
