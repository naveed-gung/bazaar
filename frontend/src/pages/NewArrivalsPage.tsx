import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { ProductAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/product/ProductCard";
import SEO from "@/components/SEO";

export default function NewArrivalsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        setLoading(true);
        // You might need to create a specific endpoint for new arrivals
        // For now, we'll use getAllProducts and limit results
        const response = await ProductAPI.getAllProducts({ 
          sort: '-createdAt',
          limit: 12 
        });
        setProducts(response.products || []);
      } catch (error) {
        console.error("Error fetching new arrivals:", error);
        toast({
          title: "Error",
          description: "Failed to load new arrivals. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchNewArrivals();
  }, [toast]);

  return (
    <Layout>
      <SEO title="New Arrivals" description="Discover the latest products and fresh designs at Bazaar. Shop our newest collection now." />
      <div className="container py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">New Arrivals</h1>
            <p className="text-muted-foreground mt-2">
              Check out our latest products and fresh designs
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button asChild variant="outline">
              <Link to="/products">View All Products</Link>
            </Button>
          </div>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="flex flex-col space-y-3">
                <Skeleton className="h-[250px] w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-medium mb-2">No new arrivals found</h2>
            <p className="text-muted-foreground mb-6">
              Please check back later for new products.
            </p>
            <Button asChild>
              <Link to="/products">Browse All Products</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
} 