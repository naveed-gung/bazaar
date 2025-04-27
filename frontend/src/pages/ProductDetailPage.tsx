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

  if (loading) return <Layout><div className="container py-16 text-center">Loading product…</div></Layout>;
  if (error || !product) return <Layout><div className="container py-16 text-center text-red-500">{error || "Product not found."}</div></Layout>;

  return (
    <Layout>
      <div className="container py-16">
        {/* Breadcrumbs */}
        <nav className="flex mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link to="/" className="text-gray-700 hover:text-primary">Home</Link>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2.5">/</span>
                <Link to="/products" className="text-gray-700 hover:text-primary">Products</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2.5">/</span>
                <span className="text-gray-500">{product?.name || 'Loading...'}</span>
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
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating)
                          ? "text-yellow-400"
                          : i < product.rating
                          ? "text-yellow-400/50"
                          : "text-gray-300"
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                
                <span className="text-sm text-muted-foreground">
                  {product.rating} ({product.reviews} reviews)
                </span>
                
                <span className="text-sm text-muted-foreground">|</span>
                
                <span className={product.stock > 0 ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
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
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
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
                <p>
                  Experience audio like never before with our Premium Wireless Headphones. Designed to deliver exceptional sound quality, these headphones feature advanced noise cancellation technology that blocks out ambient sound, allowing you to focus on what you're listening to.
                </p>
                <p>
                  With a sleek, modern design and premium materials, these headphones aren't just functional—they're a statement. The soft, cushioned ear cups provide comfort for hours of listening, while the adjustable headband ensures a perfect fit for any user.
                </p>
                <h4>Superior Audio Performance</h4>
                <p>
                  Our headphones are equipped with high-definition drivers that deliver crystal-clear highs, rich mids, and deep, powerful bass. Whether you're listening to music, podcasts, or taking calls, you'll hear every detail with stunning clarity.
                </p>
                <h4>Long-lasting Battery</h4>
                <p>
                  Enjoy up to 40 hours of playtime on a single charge. A quick 10-minute charge provides up to 4 hours of listening time, perfect for when you're in a hurry.
                </p>
                <h4>Smart Features</h4>
                <p>
                  With built-in voice assistant compatibility, you can control your music, make calls, and get information—all without reaching for your device. The intuitive touch controls allow you to adjust volume, skip tracks, and answer calls with simple gestures.
                </p>
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
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              className={`w-5 h-5 ${
                i < Math.floor(product.rating)
                  ? "text-yellow-400"
                  : i < product.rating
                  ? "text-yellow-400/50"
                  : "text-gray-300"
              }`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
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
            <img
              src={`${rp.images?.[0]}?w=400&h=400&fit=crop&crop=entropy&auto=format&q=80`}
              alt={rp.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
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
