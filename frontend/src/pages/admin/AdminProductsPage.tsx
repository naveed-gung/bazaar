import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ProductAPI } from "@/lib/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: string | { _id: string; name: string };
  stock: number;
  status?: "active" | "draft" | "archived";
  isActive?: boolean;
}


export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchProducts();
  }, [currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Use regular pagination instead of fetching all products
      const res = await ProductAPI.getAllProducts({
        page: currentPage,
        limit: ITEMS_PER_PAGE
      });
      setProducts(res.products || []);
      setTotalProducts(res.totalProducts || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      // Optionally show a toast or error
    } finally {
      setLoading(false);
    }
  };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Filter products based on search term and category
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryName = typeof product.category === "object" ? (product.category as any).name : product.category;
    const matchesCategory = selectedCategory ? categoryName === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories by name
  const categories = Array.from(new Set(products.map((product) => typeof product.category === "object" ? (product.category as any).name : product.category)));

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);
  
  if (!user || user.role !== "admin") {
    return null; // Prevent rendering if not admin
  }
  
  const handleDeleteProduct = async (id: string) => {
    try {
      await ProductAPI.deleteProduct(id);
      toast({
        title: "Product deleted",
        description: "The product has been removed from inventory.",
      });
      fetchProducts();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete product.",
        variant: "destructive"
      });
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Layout>
      <div className="container py-16">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/admin">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Product Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Product Management</h1>
            <p className="text-muted-foreground">
              Manage your products, inventory, and categories.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/admin/products/new">Add New Product</Link>
            </Button>
          </div>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle>Filter Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedCategory || ""}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="sm:col-span-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory(null);
                  }}
                >
                  Clear Filters
                </Button>
                
                <Button>Apply Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left font-medium py-4 px-4">Product</th>
                <th className="text-left font-medium py-4 px-4">Category</th>
                <th className="text-left font-medium py-4 px-4">Price</th>
                <th className="text-left font-medium py-4 px-4">Stock</th>
                <th className="text-left font-medium py-4 px-4">Status</th>
                <th className="text-right font-medium py-4 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                          <img
                            src={product.images?.[0] || '/placeholder-product.png'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.png';
                            }}
                          />
                        </div>
                        <div className="font-medium">
                          <Link to={`/admin/products/${product._id}`} className="hover:text-primary underline">
                            {product.name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">{typeof product.category === "object" ? (product.category as any).name : product.category}</td>
                    <td className="py-4 px-4">${product.price.toFixed(2)}</td>
                    <td className="py-4 px-4">
                      {product.stock <= 0 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">
                          Out of stock
                        </span>
                      ) : product.stock < 10 ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs">
                          Low: {product.stock}
                        </span>
                      ) : (
                        <span>{product.stock}</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.status === "active" || product.isActive
                            ? "bg-green-100 text-green-600"
                            : product.status === "draft"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.status 
                          ? product.status.charAt(0).toUpperCase() + product.status.slice(1)
                          : product.isActive 
                            ? "Active" 
                            : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/products/${product._id}`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product._id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No products found. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {loading 
              ? "Loading..." 
              : `Showing ${filteredProducts.length} of ${totalProducts} products`}
          </div>
          
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                
                // Calculate which page numbers to show
                if (totalPages <= 5) {
                  // Show all pages if 5 or fewer
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  // Near the start
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  // Near the end
                  pageNumber = totalPages - 4 + i;
                } else {
                  // In the middle
                  pageNumber = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={loading}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
