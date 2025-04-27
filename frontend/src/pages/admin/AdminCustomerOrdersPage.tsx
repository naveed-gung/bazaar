import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Mock orders for the customers
const MOCK_ORDERS = {
  '1': [
    { id: 'ord1', date: '2023-04-12', total: 97.50, status: 'delivered' },
    { id: 'ord2', date: '2023-05-18', total: 124.99, status: 'delivered' },
    { id: 'ord3', date: '2023-06-20', total: 78.25, status: 'delivered' },
    { id: 'ord4', date: '2023-07-05', total: 65.49, status: 'shipped' },
    { id: 'ord5', date: '2023-08-01', total: 69.52, status: 'processing' }
  ],
  '2': [
    { id: 'ord6', date: '2023-03-02', total: 112.75, status: 'delivered' },
    { id: 'ord7', date: '2023-04-15', total: 89.99, status: 'delivered' },
    { id: 'ord8', date: '2023-05-20', total: 145.50, status: 'delivered' },
    { id: 'ord9', date: '2023-06-18', total: 76.25, status: 'delivered' },
    { id: 'ord10', date: '2023-07-01', total: 124.99, status: 'delivered' },
    { id: 'ord11', date: '2023-07-15', total: 68.75, status: 'shipped' },
    { id: 'ord12', date: '2023-07-28', total: 89.99, status: 'shipped' },
    { id: 'ord13', date: '2023-08-10', total: 74.28, status: 'processing' }
  ],
  '3': [],
  '4': [
    { id: 'ord14', date: '2023-05-10', total: 89.99, status: 'delivered' },
    { id: 'ord15', date: '2023-06-12', total: 66.26, status: 'delivered' }
  ],
  '5': [
    { id: 'ord16', date: '2023-04-28', total: 99.99, status: 'returned' }
  ]
};

// Mock customer data
const MOCK_CUSTOMERS = [
  {
    _id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  },
  {
    _id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
  },
  {
    _id: '3',
    name: 'Admin User',
    email: 'admin@example.com',
  },
  {
    _id: '4',
    name: 'Robert Johnson',
    email: 'robert@example.com',
  },
  {
    _id: '5',
    name: 'Emily Davis',
    email: 'emily@example.com',
  }
];

export default function AdminCustomerOrdersPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch customer data and orders
  useEffect(() => {
    const fetchData = () => {
      setLoading(true);
      try {
        // Find the customer by ID from mock data
        const foundCustomer = MOCK_CUSTOMERS.find(c => c._id === id);
        
        if (foundCustomer) {
          setCustomer(foundCustomer);
          
          // Get customer orders
          const customerOrders = MOCK_ORDERS[id as keyof typeof MOCK_ORDERS] || [];
          setOrders(customerOrders);
        } else {
          // If customer not found, show error and navigate back
          toast({
            title: "Customer Not Found",
            description: "The requested customer could not be found.",
            variant: "destructive",
          });
          navigate("/admin/customers");
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
        toast({
          title: "Error",
          description: "Failed to load customer data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin' && id) {
      fetchData();
    }
  }, [id, user, navigate, toast]);

  // Filter orders based on search term
  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'shipped': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
      case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'returned': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="container py-16">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!customer) {
    return (
      <Layout>
        <div className="container py-16">
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-2">Customer Not Found</h2>
            <p className="text-muted-foreground mb-4">The customer you're looking for doesn't exist or has been removed.</p>
            <Button asChild>
              <Link to="/admin/customers">Return to Customers</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:text-primary">Dashboard</Link>
            <span>&gt;</span>
            <Link to="/admin/customers" className="hover:text-primary">Customers</Link>
            <span>&gt;</span>
            <Link to={`/admin/customers/${id}`} className="hover:text-primary">{customer.name}</Link>
            <span>&gt;</span>
            <span>Orders</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold">Customer Orders</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/admin/customers/${id}`)}>
                Back to Customer
              </Button>
            </div>
          </div>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Orders for {customer.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <Input
                  placeholder="Search by order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {orders.length === 0 
                    ? "This customer has no orders yet." 
                    : "No orders match your search criteria."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4 text-left font-medium">Order ID</th>
                        <th className="py-3 px-4 text-left font-medium">Date</th>
                        <th className="py-3 px-4 text-left font-medium">Status</th>
                        <th className="py-3 px-4 text-right font-medium">Total</th>
                        <th className="py-3 px-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{order.id.toUpperCase()}</td>
                          <td className="py-3 px-4">{format(new Date(order.date), 'MMM d, yyyy')}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">${order.total.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/orders/${order.id}`}>View</Link>
                            </Button>
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
      </div>
    </Layout>
  );
} 