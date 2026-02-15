import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer, scaleInHover, glowHover } from "@/lib/animations";
import { ProductAPI } from "@/lib/api";
import LazyImage from "@/components/ui/lazy-image";

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: {
    _id: string;
    name: string;
  };
  discountPercentage?: number;
  discountedPrice?: number;
}

interface FeaturedProductsProps {
  className?: string;
}

export default function FeaturedProducts({ className }: FeaturedProductsProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  
  // Fetch featured products
  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);
        const response = await ProductAPI.getFeaturedProducts();
        setProducts(response.products);
        setVisibleProducts(response.products);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching featured products:", err);
        setError("Failed to load featured products");
        setLoading(false);
      }
    };
    
    fetchFeaturedProducts();
  }, []);
  
  // Get unique categories from products
  const categories = ["All", ...Array.from(new Set(products.map(p => p.category?.name || "Uncategorized")))];
  
  // Filter products by category
  useEffect(() => {
    if (activeCategory === "All") {
      setVisibleProducts(products);
    } else {
      setVisibleProducts(products.filter(p => p.category?.name === activeCategory));
    }
  }, [activeCategory, products]);

  // Show loading state
  if (loading) {
    return (
      <section className={cn("py-16", className)}>
        <div className="container">
          <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden border bg-card animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Show error state
  if (error) {
    const handleRetry = () => {
      setError(null);
      setLoading(true);
      ProductAPI.getFeaturedProducts()
        .then((response) => {
          setProducts(response.products);
          setVisibleProducts(response.products);
        })
        .catch((err) => {
          console.error("Error fetching featured products:", err);
          setError("Failed to load featured products");
        })
        .finally(() => setLoading(false));
    };

    return (
      <section className={cn("py-16", className)}>
        <div className="container">
          <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
          <div className="flex flex-col justify-center items-center min-h-[300px] gap-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // If no products are found
  if (products.length === 0) {
    return (
      <section className={cn("py-16", className)}>
        <div className="container">
          <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
          <div className="flex justify-center items-center min-h-[300px]">
            <p className="text-muted-foreground">No featured products available</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("py-16", className)}>
      <div className="container">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
        >
          <motion.div variants={fadeInUp}>
            <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
            <p className="text-muted-foreground max-w-lg">
              Our best-selling items handpicked for their exceptional quality and design. Discover what our customers love most.
            </p>
          </motion.div>
          
          <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
            {categories.map(category => (
              <motion.div
                key={category}
                whileHover="hover"
                whileTap="tap"
                variants={scaleInHover}
              >
                <Button
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() => setActiveCategory(category)}
                  size="sm"
                >
                  {category}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {visibleProducts.map((product) => (
            <motion.div
              key={product._id}
              variants={fadeInUp}
              whileHover="hover"
              whileTap="tap"
            >
              <Link 
                to={`/product/${product._id}`}
                className="group block rounded-lg overflow-hidden border bg-card hover-float animated-border"
              >
                <motion.div 
                  className="aspect-square overflow-hidden bg-muted"
                  variants={scaleInHover}
                >
                  <LazyImage
                    src={product.images[0] || 'https://placehold.co/400x400/png?text=No+Image'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                    wrapperClassName="w-full h-full"
                  />
                </motion.div>
                
                <motion.div 
                  className="p-4"
                  variants={glowHover}
                >
                  <h3 className="font-medium text-lg group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {product.discountPercentage ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold">${product.discountedPrice?.toFixed(2)}</span>
                          <span className="text-muted-foreground line-through text-sm">${product.price.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="font-bold">${product.price.toFixed(2)}</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{product.category?.name || "Uncategorized"}</span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div 
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link to="/products">
            <motion.div
              whileHover="hover"
              whileTap="tap"
              variants={scaleInHover}
            >
              <Button size="lg">View All Products</Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
