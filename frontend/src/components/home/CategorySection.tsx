import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import LazyImage from "@/components/ui/lazy-image";

interface CategorySectionProps {
  className?: string;
}

interface Category {
  id: string;
  name: string;
  image: string;
  count: number;
}


const CATEGORIES: Category[] = [
  {
    id: "electronics",
    name: "Electronics",
    image: "https://images.unsplash.com/photo-1550009158-9ebf69173e03",
    count: 42
  },
  {
    id: "fashion",
    name: "Fashion",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050",
    count: 86
  },
  {
    id: "home",
    name: "Home & Living",
    image: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e",
    count: 54
  },
  {
    id: "beauty",
    name: "Beauty",
    image: "https://images.unsplash.com/photo-1598452963314-b09f397a5c48",
    count: 35
  },
  {
    id: "sports",
    name: "Sports",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b",
    count: 29
  },
  {
    id: "books",
    name: "Books",
    image: "https://images.unsplash.com/photo-1524578271613-d550eacf6090",
    count: 47
  }
];

// Individual category card component to safely use hooks
function CategoryCard({ category, index }: { category: Category; index: number }) {
  const animationType = index % 3 === 0 ? 'slide-right' : (index % 3 === 1 ? 'slide-left' : 'scale-up');
  
  const cardRef = useScrollAnimation({
    type: animationType as any,
    threshold: 0.1,
    rootMargin: '-20px',
    animateOut: true,
    delay: index * 100,
  });

  return (
    <Link 
      to={`/category/${category.id}`} 
      ref={cardRef as any}
      className="group flex flex-col items-center text-center hover-float transparent-border"
    >
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-3">
        <LazyImage
          src={`${category.image}?w=400&h=400&fit=crop&crop=entropy&auto=format&q=80`}
          alt={category.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
          wrapperClassName="w-full h-full"
        />
      </div>
      
      <h3 className="font-medium group-hover:text-primary transition-colors">
        {category.name}
      </h3>
      
      <p className="text-sm text-muted-foreground">
        {category.count} products
      </p>
    </Link>
  );
}

export default function CategorySection({ className }: CategorySectionProps) {
  const titleRef = useScrollAnimation({ type: 'slide-right', animateOut: true, threshold: 0.4 });
  const descriptionRef = useScrollAnimation({ type: 'slide-left', animateOut: true, threshold: 0.4 });
  
  return (
    <section className={cn("py-16 bg-muted/30", className)}>
      <div className="container">
        <div className="text-center mb-12">
          <h2 ref={titleRef} className="text-3xl font-bold mb-4">Shop by Category</h2>
          <p ref={descriptionRef} className="text-muted-foreground max-w-2xl mx-auto">
            Browse our wide selection of products organized by category. Find exactly what you're looking for with ease.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {CATEGORIES.map((category, index) => (
            <CategoryCard key={category.id} category={category} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
