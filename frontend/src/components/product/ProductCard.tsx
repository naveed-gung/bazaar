import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import LazyImage from "@/components/ui/lazy-image";

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    discount?: number;
    isNew?: boolean;
    inStock?: boolean;
  };
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const { _id, name, price, images, discount, isNew, inStock = true } = product;
  
  // Calculate the discounted price if there's a discount
  const discountedPrice = discount ? price - (price * (discount / 100)) : null;
  
  return (
    <Card className={cn(
      "overflow-hidden group h-full flex flex-col",
      "transition-shadow duration-300 ease-out",
      "hover:shadow-lg hover:shadow-black/10",
      "dark:hover:shadow-white/5",
      className
    )}>
      <Link to={`/product/${_id}`} className="flex-1 flex flex-col">
        <div className="relative overflow-hidden aspect-square">
          <LazyImage 
            src={images[0] || "https://placehold.co/400x400/png?text=No+Image"} 
            alt={name}
            className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-110"
            wrapperClassName="w-full h-full"
          />

          {/* Hover overlay with quick actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
              <span className="bg-background/90 backdrop-blur-sm text-foreground rounded-full p-2.5 shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                <Eye className="h-4 w-4" />
              </span>
              {inStock && (
                <span className="bg-background/90 backdrop-blur-sm text-foreground rounded-full p-2.5 shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                  <ShoppingBag className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isNew && (
              <Badge className="bg-primary hover:bg-primary shadow-md">New</Badge>
            )}
            {discount && discount > 0 && (
              <Badge className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md">{discount}% Off</Badge>
            )}
            {!inStock && (
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">Out of Stock</Badge>
            )}
          </div>
        </div>
        
        <CardContent className="flex-1 flex flex-col p-4">
          <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors duration-200">{name}</h3>
          
          <div className="mt-2 flex items-center">
            {discountedPrice ? (
              <>
                <span className="font-semibold text-primary">${discountedPrice.toFixed(2)}</span>
                <span className="ml-2 text-sm text-muted-foreground line-through">${price.toFixed(2)}</span>
              </>
            ) : (
              <span className="font-semibold">${price.toFixed(2)}</span>
            )}
          </div>
        </CardContent>
      </Link>
      
      <CardFooter className="p-4 pt-0">
        <div className="w-full">
          {inStock ? (
            <Link 
              to={`/product/${_id}`} 
              className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-md transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 active:scale-[0.98]"
            >
              View Details
            </Link>
          ) : (
            <button 
              disabled 
              className="block w-full text-center py-2 px-4 bg-muted text-muted-foreground rounded-md cursor-not-allowed"
            >
              Out of Stock
            </button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 