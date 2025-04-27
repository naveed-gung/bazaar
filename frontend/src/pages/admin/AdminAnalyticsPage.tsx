import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { OrderAPI } from "@/lib/api";

interface AnalyticsData {
  revenue: {
    daily: { date: string; amount: number }[];
    weekly: { week: string; amount: number }[];
    monthly: { month: string; amount: number }[];
  };
  salesTrends: {
    totalOrders: number;
    averageOrderValue: number;
    topProducts: { name: string; sales: number }[];
    topCategories: { name: string; sales: number }[];
  };
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    revenue: {
      daily: [],
      weekly: [],
      monthly: []
    },
    salesTrends: {
      totalOrders: 0,
      averageOrderValue: 0,
      topProducts: [],
      topCategories: []
    }
  });

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const ordersData = await OrderAPI.getAllOrders();
        
        // Calculate revenue data
        const orders = ordersData.orders || [];
        const today = new Date();
        const daily = Array(7).fill(0).map((_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const amount = orders
            .filter(order => new Date(order.createdAt).toDateString() === date.toDateString())
            .reduce((sum, order) => sum + (order.totalPrice || 0), 0);
          return {
            date: date.toLocaleDateString(),
            amount
          };
        }).reverse();

        // Group orders by product and category
        const productSales = {};
        const categorySales = {};
        orders.forEach(order => {
          order.orderItems?.forEach(item => {
            productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
            if (item.category) {
              const categoryName = typeof item.category === 'object' ? item.category.name : item.category;
              categorySales[categoryName] = (categorySales[categoryName] || 0) + item.quantity;
            }
          });
        });

        // Calculate analytics
        setAnalytics({
          revenue: {
            daily,
            weekly: [], // TODO: Implement weekly aggregation
            monthly: [] // TODO: Implement monthly aggregation
          },
          salesTrends: {
            totalOrders: orders.length,
            averageOrderValue: orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0) / orders.length,
            topProducts: Object.entries(productSales)
              .map(([name, sales]) => ({ name, sales: sales as number }))
              .sort((a, b) => b.sales - a.sales)
              .slice(0, 5),
            topCategories: Object.entries(categorySales)
              .map(([name, sales]) => ({ name, sales: sales as number }))
              .sort((a, b) => b.sales - a.sales)
              .slice(0, 5)
          }
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchAnalytics();
    }
  }, [user]);

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
            <span>Analytics</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">View sales reports, trends, and performance metrics.</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Loading revenue data...
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Daily Revenue (Last 7 Days)</h3>
                    <div className="grid grid-cols-7 gap-4">
                      {analytics.revenue.daily.map((day) => (
                        <div key={day.date} className="text-center">
                          <div className="text-sm text-muted-foreground mb-2">{day.date}</div>
                          <div className="text-lg font-medium">${day.amount.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Loading sales trends...
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Top Selling Products</h3>
                    <div className="space-y-4">
                      {analytics.salesTrends.topProducts.map((product) => (
                        <div key={product.name} className="flex justify-between items-center">
                          <span className="text-muted-foreground">{product.name}</span>
                          <span className="font-medium">{product.sales} units</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Top Categories</h3>
                    <div className="space-y-4">
                      {analytics.salesTrends.topCategories.map((category) => (
                        <div key={category.name} className="flex justify-between items-center">
                          <span className="text-muted-foreground">{category.name}</span>
                          <span className="font-medium">{category.sales} units</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Orders</span>
                    <span className="text-2xl font-medium">{analytics.salesTrends.totalOrders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Order Value</span>
                    <span className="text-2xl font-medium">${analytics.salesTrends.averageOrderValue.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}