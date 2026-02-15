import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ProductAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/use-favorites";
import { useCart } from "@/contexts/CartContext";
import Layout from "@/components/layout/Layout";
import ProductViewer3D from "@/components/product/ProductViewer3D";
import StarRating from "@/components/ui/StarRating";
import LazyImage from "@/components/ui/lazy-image";

interface ProductData {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string | { _id: string; name: string };
  rating: number;
  reviews: number;
  stock: number;
  colors?: Array<{ name: string; code: string }>;
  features?: string[];
  specifications?: { [key: string]: string };
}

type ProductResponse = {
  product: ProductData;
};

type RelatedProductsResponse = {
  products: ProductData[];
};

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { toast } = useToast();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [activeImage, setActiveImage] = useState(0);
  const [showingViewer3D, setShowingViewer3D] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<ProductData[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await ProductAPI.getProductById(productId!);
        const data = response as unknown as ProductResponse;
        const productData = data.product;
        setProduct(productData);
        setSelectedColor(productData.colors?.[0]?.name);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Product not found or failed to load.");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  useEffect(() => {
    const fetchRelated = async () => {
      if (!productId) return;
      try {
        const response = await ProductAPI.getRelatedProducts(productId);
        const data = response as unknown as RelatedProductsResponse;
        setRelatedProducts(data.products);
      } catch (error) {
        console.error('Error fetching related products:', error);
      }
    };
    fetchRelated();
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    
    addToCart({
      id: product._id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image: product.images[0],
      color: selectedColor
    });
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    if (isFavorite(product._id)) {
      removeFromFavorites(product._id);
      toast({
        title: "Removed from favorites",
        description: `${product.name} has been removed from your favorites.`,
      });
    } else {
      addToFavorites(product._id);
      toast({
        title: "Added to favorites",
        description: `${product.name} has been added to your favorites.`,
      });
    }
  };

  if (loading) return (
    <Layout>
      <div className="container py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square rounded-lg bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
            <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
            <div className="h-20 bg-muted rounded animate-pulse" />
            <div className="h-12 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    </Layout>
  );
  if (error || !product) return <Layout><div className="container py-16 text-center text-destructive">{error || "Product not found."}</div></Layout>;

  return (
    <Layout>
      <div className="container py-16">
        {/* Breadcrumbs */}
        <nav className="flex mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Home</Link>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2.5 text-muted-foreground">/</span>
                <Link to="/products" className="text-muted-foreground hover:text-primary transition-colors">Products</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2.5 text-muted-foreground">/</span>
                <span className="text-foreground font-medium">{product?.name || 'Loading...'}</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              {showingViewer3D ? (
                <ProductViewer3D productId={productId || "1"} />
              ) : (
                product?.images?.[activeImage] && (
                  <img
                    src={product.images[activeImage].startsWith('data:') ? 
                      product.images[activeImage] : 
                      `${product.images[activeImage]}?w=800&h=800&fit=crop&crop=entropy&auto=format&q=80`
                    }
                    alt={product.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-product.png';
                    }}
                  />
                )
              )}
            </div>
            
            {/* Thumbnail Grid */}
            {product?.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setShowingViewer3D(false);
                      setActiveImage(index);
                    }}
                    className={`relative aspect-square rounded-md overflow-hidden border-2 ${
                      activeImage === index ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img
                      src={image.startsWith('data:') ? 
                        image : 
                        `${image}?w=200&h=200&fit=crop&crop=entropy&auto=format&q=60`
                      }
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-product.png';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
              
              <div className="flex items-center gap-3 mb-4">
                <StarRating rating={product.rating} size="lg" />
                
                <span className="text-sm text-muted-foreground">
                  {product.rating} ({product.reviews} reviews)
                </span>
                
                <span className="text-sm text-muted-foreground">|</span>
                
                <span className={product.stock > 0 ? "text-success text-sm font-medium" : "text-destructive text-sm font-medium"}>
                  {product.stock > 0 ? "In Stock" : "Out of Stock"}
                </span>
              </div>
              
              <div className="text-3xl font-bold mb-6">${product.price.toFixed(2)}</div>
              
              <p className="text-muted-foreground mb-8">
                {product.description}
              </p>
              
              <div className="space-y-6">
                {product.colors && product.colors.length > 0 && (
  <div>
    <h3 className="text-sm font-medium mb-3">Color</h3>
    <div className="flex gap-3">
      {product.colors.map((color) => (
        <button
          key={color.name}
          className={`relative w-10 h-10 rounded-full ${
            selectedColor === color.name
              ? "ring-2 ring-primary ring-offset-2"
              : ""
          }`}
          style={{ backgroundColor: color.code }}
          onClick={() => setSelectedColor(color.name)}
          title={color.name}
        >
          <span className="sr-only">{color.name}</span>
          {color.name === "White" && (
            <span className="absolute inset-0 rounded-full border"></span>
          )}
        </button>
      ))}
    </div>
  </div>
)}
                
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <Select value={quantity.toString()} onValueChange={(v) => setQuantity(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Quantity" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.min(product?.stock || 10, 10) }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleAddToCart}
                    disabled={product.stock <= 0}
                  >
                    Add to Cart
                  </Button>
                  
                  <Button
                    size="icon"
                    variant={isFavorite(product?._id || '') ? "default" : "outline"}
                    className="rounded-full"
                    title={isFavorite(product?._id || '') ? "Remove from Favorites" : "Add to Favorites"}
                    onClick={handleToggleFavorite}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill={isFavorite(product?._id || '') ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
            
            <hr className="my-8" />
            
            <div>
              <h3 className="font-medium mb-3">Key Features</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 list-disc list-inside text-muted-foreground">
                {product.features && product.features.length > 0 ? (
  product.features.map((feature, index) => (
    <li key={index}>{feature}</li>
  ))
) : (
  <li>No features listed.</li>
)}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="description">
            <TabsList className="grid w-full max-w-xl grid-cols-3 mb-8">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="space-y-4">
              <div className="prose dark:prose-invert max-w-4xl">
                <h3>Product Description</h3>
                <p>{product?.description || 'No description available.'}</p>
                {product?.features && product.features.length > 0 && (
                  <>
                    <h4>Features</h4>
                    <ul>
                      {product.features.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="specifications">
              <div className="max-w-2xl">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {product.specifications && Object.entries(product.specifications).length > 0 ? (
  Object.entries(product.specifications).map(([key, value], index) => (
    <tr key={key} className={index % 2 === 0 ? "bg-muted/50" : ""}>
      <td className="px-4 py-3 font-medium border-r">{key}</td>
      <td className="px-4 py-3">{value}</td>
    </tr>
  ))
) : (
  <tr><td colSpan={2} className="px-4 py-3 text-center">No specifications provided.</td></tr>
)}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="reviews">
  <div className="max-w-3xl space-y-8">
    <div className="flex items-center gap-4">
      <div className="text-center">
        <div className="text-5xl font-bold">{product.rating}</div>
        <div className="flex items-center justify-center gap-1 my-2">
          <StarRating rating={product.rating} size="lg" />
        </div>
        <div className="text-sm text-muted-foreground">
          {product.reviews} reviews
        </div>
      </div>
    </div>
    {/* TODO: Render real reviews if available from the backend */}
    <div className="text-center text-muted-foreground">No reviews to display yet.</div>
  </div>
</TabsContent>
          </Tabs>
        </div>
        
        {/* Related Products */}
{relatedProducts.length > 0 && (
  <div className="mt-16">
    <h2 className="text-2xl font-bold mb-8">You May Also Like</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {relatedProducts.map((rp) => (
        <Link
          to={`/product/${rp._id}`}
          key={rp._id}
          className="group rounded-lg overflow-hidden border bg-card hover-float animated-border"
        >
          <div className="aspect-square overflow-hidden bg-muted">
            <LazyImage
              src={`${rp.images?.[0]}?w=400&h=400&fit=crop&crop=entropy&auto=format&q=80`}
              alt={rp.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
              wrapperClassName="w-full h-full"
            />
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg group-hover:text-primary transition-colors">
              {rp.name}
            </h3>
            <div className="flex items-center justify-between mt-2">
              <span className="font-bold">${rp.price?.toFixed(2)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  </div>
)}
      </div>
    </Layout>
  );
}
