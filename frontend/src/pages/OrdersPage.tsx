import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { OrderAPI } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Package2, ShoppingBag, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  } | string;
  orderItems: Array<{
    product: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
  }>;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  createdAt: string;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setFetchError(false);
        const response = await OrderAPI.getMyOrders();
        setOrders(response.orders);
      } catch (error) {
        console.error("Error fetching orders:", error);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      shipped: "default",
      delivered: "default",
      cancelled: "destructive",
    };
    return statusColors[status.toLowerCase()] || "secondary";
  };

  const getOrderProgress = (status: string) => {
    const statusSteps = {
      pending: 25,
      processing: 50,
      shipped: 75,
      delivered: 100,
      cancelled: 0,
    };
    return statusSteps[status.toLowerCase()] || 0;
  };

  const filteredOrders = filterStatus === "all" 
    ? orders 
    : orders.filter(order => order.status.toLowerCase() === filterStatus);

  return (
    <Layout>
      <SEO title="My Orders" description="Track and manage your orders." />
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Orders</h1>
            <p className="text-muted-foreground">
              Track and manage your orders
            </p>
          </div>
          <Select
            value={filterStatus}
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin">
              <Package2 className="w-8 h-8" />
            </div>
          </div>
        ) : fetchError ? (
          <Card className="p-8 text-center">
            <Package2 className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-xl font-semibold mb-2">Failed to load orders</h3>
            <p className="text-muted-foreground mb-4">
              Something went wrong while fetching your orders. Please try again.
            </p>
            <Button onClick={() => { setLoading(true); setFetchError(false); window.location.reload(); }}>
              Retry
            </Button>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-4">
              {filterStatus === "all" 
                ? "You haven't placed any orders yet." 
                : `No orders with status "${filterStatus}" found.`}
            </p>
            <Button asChild>
              <Link to="/products">Start Shopping</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <Card key={order._id} className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">
                          Order #{order._id}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Placed on {format(new Date(order.createdAt), "PPP")}
                        </p>
                      </div>
                      <Badge variant={order.isPaid ? "default" : "destructive"}>
                        {order.isPaid ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>

                    <div className="space-y-4 mb-4">
                      {order.orderItems.map((item) => (
                        <div key={item.product} className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg border overflow-hidden">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <Link 
                              to={`/product/${item.product}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {item.name}
                            </Link>
                            <div className="text-sm text-muted-foreground">
                              Quantity: {item.quantity} × ${item.price}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Order Status</h4>
                        <Badge 
                          variant={getStatusColor(order.status)}
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <Progress 
                        value={getOrderProgress(order.status)} 
                        className="h-2 mb-4"
                      />
                    </div>
                  </div>

                  <div className="lg:w-72 flex flex-col justify-between">
                    <div>
                      <h4 className="font-medium mb-2">Shipping Address</h4>
                      <address className="text-sm text-muted-foreground not-italic">
                        {order.shippingAddress.name}<br />
                        {order.shippingAddress.address}<br />
                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                        {order.shippingAddress.country}
                      </address>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-center font-medium mb-4">
                        <span>Total Amount</span>
                        <span>${order.totalPrice.toFixed(2)}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        asChild
                      >
                        <Link to={`/track-order`} state={{ orderId: order._id }}>
                          Track Order
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}