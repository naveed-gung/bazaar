import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ProductAPI } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Package, Search } from "lucide-react";

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
  images: string[];
}

export default function AdminInventoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { products } = await ProductAPI.getAllProductsWithoutPagination();
        setProducts(products);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "admin") {
      fetchProducts();
    }
  }, [user]);

  const handleStockUpdate = async (id: string, currentStock: number, amount: number) => {
    const newStock = Math.max(0, currentStock + amount);
    try {
      await ProductAPI.updateStock(id, newStock);
      setProducts(products.map(p => 
        p._id === id ? { ...p, stock: newStock } : p
      ));
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      // Apply search filter
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply stock filter
      const matchesStock = 
        stockFilter === "all" ? true :
        stockFilter === "low" ? product.stock < 10 :
        stockFilter === "out" ? product.stock === 0 :
        true;
        
      return matchesSearch && matchesStock;
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "stock") {
        comparison = a.stock - b.stock;
      } else if (sortBy === "price") {
        comparison = a.price - b.price;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getStockClass = (stock: number) => {
    if (stock === 0) return "text-red-500";
    if (stock < 10) return "text-amber-500";
    return "text-green-500";
  };

  return (
    <Layout>
      <div className="container py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Inventory Management</h1>
            <p className="text-muted-foreground">
              Track and manage your product stock levels
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/products/new")}>
              Add New Product
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Product Inventory</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search products..."
                    className="pl-8 w-full sm:w-[300px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock levels</SelectItem>
                    <SelectItem value="low">Low stock (&lt;10)</SelectItem>
                    <SelectItem value="out">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Package className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">
                        <Button variant="ghost" className="p-0 font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortBy === "name") {
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setSortBy("name");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Product Name
                          {sortBy === "name" && (
                            <ArrowUpDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>
                        <Button variant="ghost" className="p-0 font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortBy === "price") {
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setSortBy("price");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Price
                          {sortBy === "price" && (
                            <ArrowUpDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" className="p-0 font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortBy === "stock") {
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setSortBy("stock");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Stock
                          {sortBy === "stock" && (
                            <ArrowUpDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          No products found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product._id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-md bg-muted overflow-hidden">
                                {product.images && product.images.length > 0 ? (
                                  <img
                                    src={product.images[0]}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-secondary">
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <span className="truncate max-w-[200px]">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {product._id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>${product.price.toFixed(2)}</TableCell>
                          <TableCell className={getStockClass(product.stock)}>
                            {product.stock}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.isActive ? "default" : "secondary"}>
                              {product.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStockUpdate(product._id, product.stock, -1)}
                                disabled={product.stock <= 0}
                              >
                                -
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStockUpdate(product._id, product.stock, 1)}
                              >
                                +
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/products/${product._id}`)}
                              >
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 