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
import LazyImage from "@/components/ui/lazy-image";
import { ProductAPI, CategoryAPI } from '../lib/api';
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import SEO from "@/components/SEO";
import StarRating from "@/components/ui/StarRating";

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
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
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
      <SEO
        title="Shop All Products"
        description="Browse our entire collection of high-quality products. Filter by category, price, and more."
        keywords="shop, products, deals, categories, online store"
      />
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
                <div className="space-y-2" role="listbox" aria-label="Product categories">
                  <button 
                    type="button"
                    role="option"
                    aria-selected={selectedCategory === null}
                    className={cn(
                      "w-full text-left cursor-pointer px-2 py-1 rounded-md hover:bg-accent",
                      selectedCategory === null && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => {
                      setSelectedCategory(null);
                      setCurrentPage(1);
                    }}
                  >
                    All Categories
                  </button>
                  {categories.map(category => (
                    <button 
                      type="button"
                      key={category._id}
                      role="option"
                      aria-selected={selectedCategory === category.name}
                      className={cn(
                        "w-full text-left cursor-pointer px-2 py-1 rounded-md hover:bg-accent",
                        selectedCategory === category.name && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => {
                        setSelectedCategory(category.name);
                        setCurrentPage(1);
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="border rounded-lg p-5 bg-card">
                <h3 className="font-medium mb-4">Price Range</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span>${priceRange[0].toLocaleString()}</span>
                    <span>${priceRange[1].toLocaleString()}</span>
                  </div>
                  {/* Dual-handle range slider */}
                  <div className="relative h-6 flex items-center">
                    {/* Track background */}
                    <div className="absolute w-full h-1.5 bg-muted rounded-full" />
                    {/* Active track */}
                    <div
                      className="absolute h-1.5 bg-primary rounded-full"
                      style={{
                        left: `${(priceRange[0] / 10000) * 100}%`,
                        right: `${100 - (priceRange[1] / 10000) * 100}%`,
                      }}
                    />
                    {/* Min handle */}
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="10"
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val < priceRange[1]) setPriceRange([val, priceRange[1]]);
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                      aria-label="Minimum price"
                    />
                    {/* Max handle */}
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="10"
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > priceRange[0]) setPriceRange([priceRange[0], val]);
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                      aria-label="Maximum price"
                    />
                  </div>
                  {/* Manual inputs */}
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      min="0"
                      max={priceRange[1]}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, priceRange[1] - 10));
                        setPriceRange([val, priceRange[1]]);
                      }}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-center text-sm"
                      aria-label="Minimum price input"
                    />
                    <span className="text-muted-foreground shrink-0">to</span>
                    <input
                      type="number"
                      min={priceRange[0]}
                      max="10000"
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = Math.min(10000, Math.max(parseInt(e.target.value) || 0, priceRange[0] + 10));
                        setPriceRange([priceRange[0], val]);
                      }}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-center text-sm"
                      aria-label="Maximum price input"
                    />
                  </div>
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
                  aria-label="Toggle filters"
                  aria-expanded={filterOpen}
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
                    aria-label="Grid view"
                    aria-pressed={displayMode === "grid"}
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
                    aria-label="List view"
                    aria-pressed={displayMode === "list"}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Products Display */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden bg-card">
                    <div className="aspect-square bg-muted animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      <div className="flex justify-between items-center">
                        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6">Try changing your filters or search for something else.</p>
                <Button onClick={() => {
                  setSelectedCategory(null);
                  setPriceRange([0, 10000]);
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
                          <LazyImage
                            src={product.images[0] || '/placeholder-product.png'}
                            alt={product.name}
                            className="object-cover w-full h-full transition-transform group-hover:scale-105"
                            wrapperClassName="w-full h-full"
                            fallback="/placeholder-product.png"
                          />
                          {product.discountPercentage > 0 && (
                            <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-medium">
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
                            <StarRating rating={product.rating} size="sm" />
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
