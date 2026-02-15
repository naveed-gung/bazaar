import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { ProductAPI, CategoryAPI } from '@/lib/api';
import { useCart } from "@/contexts/CartContext";
import { AnimationDirection } from "@/components/animation/types";

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: { _id: string; name: string } | string;
  rating: number;
  numReviews: number;
  stock: number;
  discountPercentage: number;
  discountedPrice?: number;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  bannerImage?: string;
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState("featured");
  const { addToCart } = useCart();
  
  const bannerRef = useScrollAnimation({ type: "slideRight" as AnimationDirection, animateOut: true, threshold: 0.3 }) as React.RefObject<HTMLDivElement>;
  const filtersRef = useScrollAnimation({ type: "slideRight" as AnimationDirection, animateOut: true, threshold: 0.2 }) as React.RefObject<HTMLDivElement>;
  const productsHeaderRef = useScrollAnimation({ type: "slideLeft" as AnimationDirection, animateOut: true, threshold: 0.2 }) as React.RefObject<HTMLDivElement>;

  // Create individual animation refs for each possible product position
  const ref1 = useScrollAnimation({ type: "slideRight" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 50 }) as React.RefObject<HTMLDivElement>;
  const ref2 = useScrollAnimation({ type: "slideLeft" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 100 }) as React.RefObject<HTMLDivElement>;
  const ref3 = useScrollAnimation({ type: "slideRight" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 150 }) as React.RefObject<HTMLDivElement>;
  const ref4 = useScrollAnimation({ type: "slideLeft" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 200 }) as React.RefObject<HTMLDivElement>;
  const ref5 = useScrollAnimation({ type: "slideRight" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 250 }) as React.RefObject<HTMLDivElement>;
  const ref6 = useScrollAnimation({ type: "slideLeft" as AnimationDirection, threshold: 0.1, rootMargin: '-50px', animateOut: true, delay: 300 }) as React.RefObject<HTMLDivElement>;

  // Create a fixed array of refs that we can cycle through
  const productRefs = [ref1, ref2, ref3, ref4, ref5, ref6];

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product._id,
      name: product.name,
      price: product.discountPercentage > 0 ? product.discountedPrice! : product.price,
      image: product.images[0],
      quantity: 1
    });
  };

  const renderPaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1) ||
        (totalPages <= maxVisiblePages)
      ) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`px-4 py-2 mx-1 rounded ${
              currentPage === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {i}
          </button>
        );
      } else if (
        i === currentPage - 2 ||
        i === currentPage + 2
      ) {
        pages.push(
          <span key={i} className="px-2">
            ...
          </span>
        );
      }
    }
    return pages;
  };

  useEffect(() => {
    if (categoryId) {
      CategoryAPI.getCategoryWithProducts(categoryId).then(data => {
        setCategory(data.category);
        setProducts(data.products);
      });
    }
  }, [categoryId]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { products: fetchedProducts, totalProducts } = await ProductAPI.getAllProducts({
          category: categoryId,
          page: currentPage,
          limit: itemsPerPage
        });
        setProducts(fetchedProducts);
        setTotalPages(Math.ceil(totalProducts / itemsPerPage));
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, [categoryId, currentPage]);

  if (!category) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Category Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The category you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <a href="/">Return Home</a>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div 
        ref={bannerRef}
        className="relative h-[300px] md:h-[400px] bg-muted overflow-hidden"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${category.bannerImage})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="container relative h-full flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {category.name}
          </h1>
          <p className="text-lg text-white/80 max-w-xl">
            {category.description}
          </p>
        </div>
      </div>
      
      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Section */}
          <div ref={filtersRef} className="lg:col-span-1 space-y-6">
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-medium mb-4">Filters</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Price Range</h3>
                  <Slider
                    defaultValue={[0, 1000]}
                    max={1000}
                    step={1}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    className="my-4"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">${priceRange[0]}</span>
                    <span className="text-sm">${priceRange[1]}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2">Sort By</h3>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="rating">Highest Rating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Availability</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                      <span className="text-sm">In Stock</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm">Out of Stock</span>
                    </label>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Rating</h3>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <label key={rating} className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300" />
                        <div className="flex items-center">
                          {Array.from({ length: rating }).map((_, i) => (
                            <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="text-sm ml-1">& Up</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button className="w-full">Apply Filters</Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Products Grid */}
          <div className="lg:col-span-3">
            <div ref={productsHeaderRef} className="flex justify-between items-center mb-6">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{products.length}</span> products
              </p>
              
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </Button>
                <Button variant="outline" size="sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, index) => (
                <div
                  key={product._id}
                  ref={productRefs[index % productRefs.length]}
                  className="group bg-card rounded-lg shadow-sm overflow-hidden border hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
                  </div>
                  
                  <div className="p-4 space-y-2">
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating)
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({product.numReviews ?? 0})
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="font-bold">
                        ${product.discountPercentage > 0 
                          ? product.discountedPrice?.toFixed(2) 
                          : product.price.toFixed(2)}
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock <= 0}
                      >
                        {product.stock > 0 ? "Add to Cart" : "Out of Stock"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded disabled:opacity-50"
                aria-label="Previous page"
              >
                Previous
              </button>
              {renderPaginationNumbers()}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded disabled:opacity-50"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}