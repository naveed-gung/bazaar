import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { CategoryAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/SEO";
import LazyImage from "@/components/ui/lazy-image";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await CategoryAPI.getAllCategories();
        setCategories(response.categories || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [toast]);

  return (
    <Layout>
      <SEO title="Categories" description="Browse all product categories at Bazaar. Find electronics, fashion, home decor and more." />
      <div className="container py-12">
        <h1 className="text-3xl font-bold mb-8">Browse Categories</h1>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="flex flex-col space-y-3">
                <Skeleton className="h-[200px] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-medium mb-2">No categories found</h2>
            <p className="text-muted-foreground">
              Please check back later for new categories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Link
                key={category._id}
                to={`/category/${category._id}`}
                className="group block overflow-hidden rounded-lg border shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-white/5"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {category.image ? (
                    <LazyImage
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      wrapperClassName="w-full h-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/20">
                      <span className="text-muted-foreground">No image</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium mb-1 group-hover:text-primary transition-colors duration-200">
                      {category.name}
                    </h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">
                      {category.description.substring(0, 100)}
                      {category.description.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
} 