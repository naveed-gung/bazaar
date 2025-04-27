import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Mock data for the customer detail page
const MOCK_CUSTOMERS = [
  {
    _id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'customer',
    status: 'active',
    createdAt: new Date(2023, 1, 15).toISOString(),
    ordersCount: 5,
    totalSpent: 435.75,
    phone: '+1 (555) 123-4567',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      country: 'USA'
    },
    lastLogin: new Date(2023, 7, 15).toISOString(),
    notes: 'Preferred customer with consistent ordering pattern.',
    avatar: '',
    orders: [
      { id: 'ord1', date: '2023-04-12', total: 97.50, status: 'delivered' },
      { id: 'ord2', date: '2023-05-18', total: 124.99, status: 'delivered' },
      { id: 'ord3', date: '2023-06-20', total: 78.25, status: 'delivered' },
      { id: 'ord4', date: '2023-07-05', total: 65.49, status: 'shipped' },
      { id: 'ord5', date: '2023-08-01', total: 69.52, status: 'processing' }
    ]
  },
  {
    _id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'customer',
    status: 'active',
    createdAt: new Date(2023, 2, 22).toISOString(),
    ordersCount: 8,
    totalSpent: 782.50,
    phone: '+1 (555) 987-6543',
    address: {
      street: '456 Oak Ave',
      city: 'Somewhere',
      state: 'NY',
      zip: '67890',
      country: 'USA'
    },
    lastLogin: new Date(2023, 7, 18).toISOString(),
    notes: 'Premium member. Prefers express shipping.',
    avatar: '',
    orders: [
      { id: 'ord6', date: '2023-03-02', total: 112.75, status: 'delivered' },
      { id: 'ord7', date: '2023-04-15', total: 89.99, status: 'delivered' },
      { id: 'ord8', date: '2023-05-20', total: 145.50, status: 'delivered' },
      { id: 'ord9', date: '2023-06-18', total: 76.25, status: 'delivered' },
      { id: 'ord10', date: '2023-07-01', total: 124.99, status: 'delivered' },
      { id: 'ord11', date: '2023-07-15', total: 68.75, status: 'shipped' },
      { id: 'ord12', date: '2023-07-28', total: 89.99, status: 'shipped' },
      { id: 'ord13', date: '2023-08-10', total: 74.28, status: 'processing' }
    ]
  },
  {
    _id: '3',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: new Date(2022, 10, 5).toISOString(),
    ordersCount: 0,
    totalSpent: 0,
    phone: '+1 (555) 111-2222',
    address: {
      street: '789 Admin Blvd',
      city: 'Adminville',
      state: 'CA',
      zip: '54321',
      country: 'USA'
    },
    lastLogin: new Date(2023, 7, 19).toISOString(),
    notes: 'System administrator. No purchasing history as this is a staff account.',
    avatar: '',
    orders: []
  },
  {
    _id: '4',
    name: 'Robert Johnson',
    email: 'robert@example.com',
    role: 'customer',
    status: 'inactive',
    createdAt: new Date(2023, 4, 3).toISOString(),
    ordersCount: 2,
    totalSpent: 156.25,
    phone: '+1 (555) 333-4444',
    address: {
      street: '567 Pine St',
      city: 'Elsewhere',
      state: 'TX',
      zip: '34567',
      country: 'USA'
    },
    lastLogin: new Date(2023, 5, 20).toISOString(),
    notes: 'Account inactive due to inactivity. Last order was 2 months ago.',
    avatar: '',
    orders: [
      { id: 'ord14', date: '2023-05-10', total: 89.99, status: 'delivered' },
      { id: 'ord15', date: '2023-06-12', total: 66.26, status: 'delivered' }
    ]
  },
  {
    _id: '5',
    name: 'Emily Davis',
    email: 'emily@example.com',
    role: 'customer',
    status: 'suspended',
    createdAt: new Date(2023, 3, 18).toISOString(),
    ordersCount: 1,
    totalSpent: 99.99,
    phone: '+1 (555) 555-5555',
    address: {
      street: '321 Maple Dr',
      city: 'Springfield',
      state: 'IL',
      zip: '78901',
      country: 'USA'
    },
    lastLogin: new Date(2023, 4, 25).toISOString(),
    notes: 'Account suspended due to payment issues. Reached out via email on 2023-06-01.',
    avatar: '',
    orders: [
      { id: 'ord16', date: '2023-04-28', total: 99.99, status: 'returned' }
    ]
  }
];

export default function AdminCustomerDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch customer data
  useEffect(() => {
    const fetchCustomerData = () => {
      setLoading(true);
      try {
        // Find the customer by ID from our mock data
        const foundCustomer = MOCK_CUSTOMERS.find(c => c._id === id);
        
        if (foundCustomer) {
          setCustomer(foundCustomer);
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
        console.error('Error fetching customer details:', error);
        toast({
          title: "Error",
          description: "Failed to load customer details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin' && id) {
      fetchCustomerData();
    }
  }, [id, user, navigate, toast]);

  const handleStatusChange = (newStatus: string) => {
    setCustomer(prev => ({
      ...prev,
      status: newStatus
    }));
    
    toast({
      title: "Status Updated",
      description: `Customer status has been changed to ${newStatus}.`,
    });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'inactive': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'suspended': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'shipped': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
      case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'returned': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:text-primary">Dashboard</Link>
            <span>&gt;</span>
            <Link to="/admin/customers" className="hover:text-primary">Customers</Link>
            <span>&gt;</span>
            <span>{customer.name}</span>
          </div>
          
          {/* Header with Customer Info and Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={customer.avatar} />
                <AvatarFallback className="text-xl">{customer.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold">{customer.name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-muted-foreground">{customer.email}</span>
                  <Badge className={getStatusColor(customer.status)}>
                    {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                  </Badge>
                  <Badge variant="outline">
                    {customer.role.charAt(0).toUpperCase() + customer.role.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select 
                defaultValue={customer.status} 
                onValueChange={(value) => handleStatusChange(value)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Set Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" asChild>
                <Link to={`/admin/customers/${customer._id}/edit`}>Edit Customer</Link>
              </Button>
              
              <Button variant="default" asChild>
                <Link to={`/admin/customers/${customer._id}/message`}>Send Message</Link>
              </Button>
            </div>
          </div>
          
          {/* Tabs for Different Sections */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Customer Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Full Name</p>
                        <p className="font-medium">{customer.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{customer.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{customer.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Member Since</p>
                        <p className="font-medium">{format(new Date(customer.createdAt), 'PPP')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Login</p>
                        <p className="font-medium">{customer.lastLogin ? format(new Date(customer.lastLogin), 'PPP') : 'Never'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Account Type</p>
                        <p className="font-medium">{customer.role.charAt(0).toUpperCase() + customer.role.slice(1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Shipping Address */}
                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customer.address ? (
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p>{customer.address.street}</p>
                        <p>{customer.address.city}, {customer.address.state} {customer.address.zip}</p>
                        <p>{customer.address.country}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No address on file.</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm">Edit Address</Button>
                  </CardFooter>
                </Card>
                
                {/* Order Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Orders</p>
                        <p className="text-2xl font-bold">{customer.ordersCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Spent</p>
                        <p className="text-2xl font-bold">${customer.totalSpent.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Order</p>
                        <p className="font-medium">
                          {customer.orders.length > 0 
                            ? format(new Date(customer.orders[0].date), 'PP')
                            : 'No orders'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Average Order Value</p>
                        <p className="font-medium">
                          {customer.ordersCount > 0
                            ? `$${(customer.totalSpent / customer.ordersCount).toFixed(2)}`
                            : '$0.00'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Order History</CardTitle>
                  <CardDescription>
                    Showing all orders for this customer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {customer.orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      This customer has no orders yet.
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
                          {customer.orders.map((order: any) => (
                            <tr key={order.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4 font-medium">{order.id.toUpperCase()}</td>
                              <td className="py-3 px-4">{format(new Date(order.date), 'PP')}</td>
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
            </TabsContent>
            
            {/* Notes Tab */}
            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Notes</CardTitle>
                  <CardDescription>
                    Internal notes and information about this customer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {customer.notes ? (
                    <div className="whitespace-pre-wrap">{customer.notes}</div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No notes have been added for this customer.
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button>Add Note</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
} 