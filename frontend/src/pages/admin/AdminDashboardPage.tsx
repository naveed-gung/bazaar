import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { OrderAPI, ProductAPI, UserAPI, CategoryAPI } from "@/lib/api";

interface OrderItem {
  product: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
}

interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  } | string;
  orderItems: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  stock: number;
  category: {
    _id: string;
    name: string;
  } | string;
  isActive: boolean;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  featured: boolean;
}

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  categories: {
    name: string;
    count: number;
  }[];
  monthlyGrowth: {
    sales: number;
    orders: number;
    products: number;
    customers: number;
  };
  recentOrders: Order[];
  lowStockProducts: Product[];
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    categories: [],
    monthlyGrowth: {
      sales: 0,
      orders: 0,
      products: 0,
      customers: 0
    },
    recentOrders: [],
    lowStockProducts: []
  });

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [ordersData, productsData, usersData, categoriesData] = await Promise.all([
          OrderAPI.getAllOrders({ limit: 5 }),
          ProductAPI.getAllProducts({ stock: 'low', limit: 5 }),
          UserAPI.getAllUsers(),
          CategoryAPI.getAllCategories()
        ]);

        const totalSales = ordersData.orders.reduce((acc: number, order: any) => 
          acc + (order.totalPrice || 0), 0);

        // Also incorporate recent orders from localStorage if needed
        const recentOrdersData = fetchRecentOrders();
        
        setStats({
          totalSales,
          totalOrders: ordersData.totalOrders || ordersData.orders.length,
          totalProducts: productsData.totalProducts || productsData.products.length,
          totalCustomers: usersData.totalUsers || usersData.users.length,
          categories: categoriesData.categories || [],
          monthlyGrowth: {
            sales: 18,
            orders: 12,
            products: 8,
            customers: 9
          },
          recentOrders: recentOrdersData.length > 0 ? recentOrdersData : ordersData.orders,
          lowStockProducts: productsData.products.filter((p: any) => p.stock < 10)
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchDashboardData();
    }
  }, [user]);

  // Add to the fetch orders section in useEffect:
  const fetchRecentOrders = () => {
    try {
      // Get orders from localStorage (our simulation)
      const storedOrders = JSON.parse(localStorage.getItem('adminOrders') || '[]');
      
      // Sort by date and take the 5 most recent
      const recentOrders = [...storedOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      return recentOrders;
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      return [];
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}. Here's an overview of your store.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/admin/products/new">Add New Product</Link>
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sales</CardDescription>
              <CardTitle className="text-3xl">${stats.totalSales.toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                <span className="text-green-500 font-medium">↑ {stats.monthlyGrowth.sales}%</span> from last month
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orders</CardDescription>
              <CardTitle className="text-3xl">{stats.totalOrders}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                <span className="text-green-500 font-medium">↑ {stats.monthlyGrowth.orders}%</span> from last month
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Products</CardDescription>
              <CardTitle className="text-3xl">{stats.totalProducts}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                <span className="text-primary font-medium">+{stats.monthlyGrowth.products}</span> new this month
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Customers</CardDescription>
              <CardTitle className="text-3xl">{stats.totalCustomers}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                <span className="text-green-500 font-medium">↑ {stats.monthlyGrowth.customers}%</span> from last month
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Dashboard / Products</div>
            <Link to="/admin/products" className="block">
              <Card className="h-full hover:border-primary transition-colors hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                      <path d="M3 6h18"></path>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    Product Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Manage your products, categories, and inventory.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">Dashboard / Orders</div>
            <Link to="/admin/orders" className="block">
              <Card className="h-full hover:border-primary transition-colors hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="21" r="1"></circle>
                      <circle cx="19" cy="21" r="1"></circle>
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                    </svg>
                    Order Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    View and manage orders, shipments, and returns.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">Dashboard / Customers</div>
            <Link to="/admin/customers" className="block">
              <Card className="h-full hover:border-primary transition-colors hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Customer Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    View customer information and purchase history.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">Dashboard / Analytics</div>
            <Link to="/admin/analytics" className="block">
              <Card className="h-full hover:border-primary transition-colors hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18"></path>
                      <path d="m19 9-5 5-4-4-3 3"></path>
                    </svg>
                    Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    View sales reports, trends, and performance metrics.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
        
        {/* Recent Orders */}
        <Card className="col-span-1 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>
                Latest customer orders
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No recent orders found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th key="order-id" className="py-2 px-4 text-left font-medium">Order ID</th>
                      <th key="customer" className="py-2 px-4 text-left font-medium">Customer</th>
                      <th key="date" className="py-2 px-4 text-left font-medium">Date</th>
                      <th key="total" className="py-2 px-4 text-left font-medium">Total</th>
                      <th key="status" className="py-2 px-4 text-left font-medium">Status</th>
                      <th key="actions" className="py-2 px-4 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentOrders.map((order, index) => (
                      <tr key={order._id || `order-${index}`} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">
                          {order._id ? order._id.substring(6).toUpperCase() : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {typeof order.user === 'object' ? order.user.name : order.user}
                        </td>
                        <td className="py-3 px-4">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">${order.totalPrice?.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'processing' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' 
                              : order.status === 'shipped'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                                : order.status === 'delivered'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/orders/${order._id}`}>View</Link>
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
        
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Low Stock Alerts</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/inventory">View Inventory</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th key="product" className="text-left font-medium py-3 px-4">Product</th>
                    <th key="category" className="text-left font-medium py-3 px-4">Category</th>
                    <th key="stock" className="text-left font-medium py-3 px-4">Current Stock</th>
                    <th key="actions" className="text-right font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowStockProducts.map((product, index) => (
                    <tr key={product._id || `product-${index}`} className="border-b">
                      <td className="py-3 px-4">{product.name}</td>
                      <td className="py-3 px-4">{typeof product.category === 'object' ? product.category.name : product.category}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          product.stock <= 0 ? 'bg-red-100 text-red-600' :
                          product.stock < 5 ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {product.stock} remaining
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/products/${product._id}`}>Restock</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
