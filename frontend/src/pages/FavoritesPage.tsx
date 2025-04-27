import { useState, useEffect } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { ProductAPI } from "@/lib/api";
import Layout from "@/components/layout/Layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Category {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string | Category;
  rating: number;
  discountPercentage: number;
  discountedPrice?: number;
}

interface APIResponse {
  product: Product;
}

export default function FavoritesPage() {
  const { favorites, removeFromFavorites } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavoriteProducts = async () => {
      setLoading(true);
      try {
        const favoriteProducts = await Promise.all(
          favorites.map(id => ProductAPI.getProductById(id))
        );
        setProducts(favoriteProducts.map((data: Product | APIResponse) => {
          if ('product' in data) {
            return data.product;
          }
          return data;
        }));
      } catch (error) {
        console.error('Error fetching favorite products:', error);
      }
      setLoading(false);
    };

    fetchFavoriteProducts();
  }, [favorites]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
        
        {products.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No favorites yet</h2>
            <p className="text-muted-foreground mb-6">
              Start adding products to your favorites list while you shop
            </p>
            <Button asChild>
              <Link to="/products">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[600px] rounded-md border p-4">
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                >
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-md"
                  />
                  <div className="flex-1">
                    <Link
                      to={`/product/${product._id}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-muted-foreground">{product.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-semibold">
                        ${product.discountedPrice || product.price}
                      </span>
                      {product.discountPercentage > 0 && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${product.price}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => removeFromFavorites(product._id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Layout>
  );
}