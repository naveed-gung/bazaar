import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PromoBannerProps {
  className?: string;
}

export default function PromoBanner({ className }: PromoBannerProps) {
  return (
    <section className={cn("py-16", className)}>
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* First Promo */}
          <div className="group relative rounded-lg overflow-hidden h-80">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 dark:from-primary/20 dark:to-accent/20 z-10" />
            <img 
              src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&auto=format&fit=crop&q=80"
              alt="New Collection"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-start p-8">
              <h3 className="text-2xl font-bold text-white mb-2">Summer Collection</h3>
              <p className="text-white/80 mb-6 max-w-xs">
                Discover our latest arrivals perfect for the season.
              </p>
              <Link to="/collections/summer">
                <Button variant="secondary" className="shadow-lg">
                  Shop Collection
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Second Promo */}
          <div className="group relative rounded-lg overflow-hidden h-80">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/30 to-primary/30 dark:from-accent/20 dark:to-primary/20 z-10" />
            <img 
              src="https://images.unsplash.com/photo-1607082350899-7e105aa886ae?w=800&auto=format&fit=crop&q=80"
              alt="Special Offer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-start p-8">
              <h3 className="text-2xl font-bold text-white mb-2">Special Offer</h3>
              <p className="text-white/80 mb-6 max-w-xs">
                Up to 40% off on select items for a limited time only.
              </p>
              <Link to="/sales">
                <Button variant="destructive" className="shadow-lg">
                  View Deals
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
