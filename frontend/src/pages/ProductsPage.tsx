import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import { Grid2X2, List, SlidersHorizontal } from "lucide-react";
import ScrollAnimation from "@/components/animation/ScrollAnimation";
import { shopAnimations } from "@/lib/pageAnimations";
import { ProductAPI, CategoryAPI } from '../lib/api';
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: { _id: string; name: string } | string;
  rating: number;
  reviews: number;
  stock: number;
  discountPercentage: number;
  discountedPrice?: number;
}

interface Category {
  _id: string;
  name: string;
  description: string;
}

const ITEMS_PER_PAGE = 6;

export default function ProductsPage() {
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("featured");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const { addToCart } = useCart();

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await CategoryAPI.getAllCategories();
        setCategories(result.categories || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchCategories();
  }, [toast]);

  // Fetch products with filters
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const result = await ProductAPI.getAllProducts({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          category: selectedCategory || undefined,
          minPrice: priceRange[0],
          maxPrice: priceRange[1],
          sort: sortBy,
        });

        setProducts(result.products || []);
        setTotalProducts(result.totalProducts || 0);
        setTotalPages(Math.ceil((result.totalProducts || 0) / ITEMS_PER_PAGE));
      } catch (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch products',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, priceRange, sortBy, currentPage, toast]);

  // Apply price filter
  const applyPriceFilter = () => {
    setCurrentPage(1); // Reset to first page when filter changes
  };

  return (
    <Layout>
      <div className="container py-16">
        <ScrollAnimation {...shopAnimations.header}>
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">All Products</h1>
            <p className="text-muted-foreground max-w-2xl">
              Browse our entire collection of high-quality products. Filter and sort to find exactly what you're looking for.
            </p>
          </div>
        </ScrollAnimation>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Filters Sidebar */}
          <ScrollAnimation {...shopAnimations.filters}>
            <div className={cn(
              "w-full md:w-64 space-y-6 transition-all",
              filterOpen ? "block" : "hidden md:block"
            )}>
              <div className="border rounded-lg p-5 bg-card">
                <h3 className="font-medium mb-4">Categories</h3>
                <div className="space-y-2">
                  <div 
                    className={cn(
                      "cursor-pointer px-2 py-1 rounded-md hover:bg-accent",
                      selectedCategory === null && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => {
                      setSelectedCategory(null);
                      setCurrentPage(1);
                    }}
                  >
                    All Categories
                  </div>
                  {categories.map(category => (
                    <div 
                      key={category._id}
                      className={cn(
                        "cursor-pointer px-2 py-1 rounded-md hover:bg-accent",
                        selectedCategory === category.name && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => {
                        setSelectedCategory(category.name);
                        setCurrentPage(1);
                      }}
                    >
                      {category.name}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border rounded-lg p-5 bg-card">
                <h3 className="font-medium mb-4">Price Range</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>${priceRange[0]}</span>
                    <span>${priceRange[1]}</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1000000"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full"
                  />
                  <Button onClick={applyPriceFilter} className="w-full">
                    Apply Filter
                  </Button>
                </div>
              </div>
            </div>
          </ScrollAnimation>
          
          {/* Products Grid */}
          <div className="flex-1">
            {/* Filters and Sort Controls */}
            <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <span className="text-muted-foreground">
                  {loading ? 'Loading...' : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalProducts)} of ${totalProducts} products`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(value) => {
                  setSortBy(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-none",
                      displayMode === "grid" && "bg-accent"
                    )}
                    onClick={() => setDisplayMode("grid")}
                  >
                    <Grid2X2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-none",
                      displayMode === "list" && "bg-accent"
                    )}
                    onClick={() => setDisplayMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Products Display */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6">Try changing your filters or search for something else.</p>
                <Button onClick={() => {
                  setSelectedCategory(null);
                  setPriceRange([0, 1000000]);
                  setCurrentPage(1);
                }}>Clear All Filters</Button>
              </div>
            ) : (
              <>
                <div className={cn(
                  displayMode === "grid" 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" 
                    : "space-y-6"
                )}>
                  {products.map((product) => (
                    <ScrollAnimation key={product._id} {...shopAnimations.products}>
                      <div className={cn(
                        "group border rounded-lg overflow-hidden bg-card transition-all hover:shadow-md",
                        displayMode === "list" && "grid grid-cols-1 md:grid-cols-3 gap-4"
                      )}>
                        <div className={cn(
                          "relative aspect-square overflow-hidden bg-muted",
                          displayMode === "list" && "md:col-span-1"
                        )}>
                          <img
                            src={product.images[0] || '/placeholder-product.png'}
                            alt={product.name}
                            className="object-cover w-full h-full transition-transform group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-product.png';
                            }}
                          />
                          {product.discountPercentage > 0 && (
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                              {product.discountPercentage}% OFF
                            </div>
                          )}
                        </div>
                        
                        <div className={cn(
                          "p-4",
                          displayMode === "list" && "md:col-span-2"
                        )}>
                          <div className="text-sm text-muted-foreground mb-1">
                            {typeof product.category === 'object' ? product.category.name : 'Uncategorized'}
                          </div>
                          <h3 className="font-medium mb-1 truncate">
                            <Link to={`/product/${product._id}`} className="hover:text-primary hover:underline">
                              {product.name}
                            </Link>
                          </h3>
                          
                          <div className="flex items-center gap-1 mb-2">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <svg
                                key={index}
                                className={`w-4 h-4 ${
                                  index < Math.floor(product.rating)
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              ({product.rating.toFixed(1)})
                            </span>
                          </div>
                          
                          {displayMode === "list" && (
                            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              {product.discountPercentage > 0 && product.discountedPrice ? (
                                <>
                                  <span className="font-bold">${product.discountedPrice.toFixed(2)}</span>
                                  <span className="text-muted-foreground text-sm line-through">
                                    ${product.price.toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <span className="font-bold">${product.price.toFixed(2)}</span>
                              )}
                            </div>
                            <Button size="sm" onClick={() => addToCart({
                              id: product._id,
                              name: product.name,
                              price: product.discountPercentage > 0 ? product.discountedPrice! : product.price,
                              image: product.images[0],
                              quantity: 1
                            })}>
                              Add to Cart
                            </Button>
                          </div>
                        </div>
                      </div>
                    </ScrollAnimation>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>

                    {/* First page */}
                    <Button
                      variant={currentPage === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                    >
                      1
                    </Button>

                    {/* Ellipsis if needed */}
                    {currentPage > 3 && <span className="mx-1">...</span>}

                    {/* Current page and surrounding pages */}
                    {Array.from(
                      { length: Math.min(3, totalPages - 2) },
                      (_, i) => currentPage - 1 + i
                    )
                      .filter(page => page > 1 && page < totalPages)
                      .map(page => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}

                    {/* Ellipsis if needed */}
                    {currentPage < totalPages - 2 && <span className="mx-1">...</span>}

                    {/* Last page */}
                    {totalPages > 1 && (
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
