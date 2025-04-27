import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <Card className={cn("overflow-hidden group h-full flex flex-col", className)}>
      <Link to={`/product/${_id}`} className="flex-1 flex flex-col">
        <div className="relative overflow-hidden aspect-square">
          <img 
            src={images[0] || "https://placehold.co/400x400/png?text=No+Image"} 
            alt={name}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isNew && (
              <Badge className="bg-primary hover:bg-primary">New</Badge>
            )}
            {discount && discount > 0 && (
              <Badge className="bg-red-500 hover:bg-red-600">{discount}% Off</Badge>
            )}
            {!inStock && (
              <Badge variant="outline" className="bg-background/80">Out of Stock</Badge>
            )}
          </div>
        </div>
        
        <CardContent className="flex-1 flex flex-col p-4">
          <h3 className="font-medium line-clamp-1">{name}</h3>
          
          <div className="mt-2 flex items-center">
            {discountedPrice ? (
              <>
                <span className="font-medium text-primary">${discountedPrice.toFixed(2)}</span>
                <span className="ml-2 text-sm text-muted-foreground line-through">${price.toFixed(2)}</span>
              </>
            ) : (
              <span className="font-medium">${price.toFixed(2)}</span>
            )}
          </div>
        </CardContent>
      </Link>
      
      <CardFooter className="p-4 pt-0">
        <div className="w-full">
          {inStock ? (
            <Link 
              to={`/product/${_id}`} 
              className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
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