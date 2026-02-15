import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TestimonialSectionProps {
  className?: string;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar?: string;
  rating: number;
}


const TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    role: "Verified Customer",
    content: "I'm absolutely in love with my purchase! The quality far exceeded my expectations and the shipping was incredibly fast. Customer service was also top-notch when I had questions.",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face&auto=format&q=80",
    rating: 5
  },
  {
    id: "2",
    name: "Michael Rodriguez",
    role: "Verified Customer",
    content: "This is my third time ordering from Bazaar and I'm never disappointed. The products are always as described and the website makes it so easy to find what I'm looking for.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face&auto=format&q=80",
    rating: 5
  },
  {
    id: "3",
    name: "Emma Williams",
    role: "Verified Customer",
    content: "Great prices, beautiful designs, and excellent customer service. I had an issue with my order and it was resolved promptly. Will definitely be shopping here again!",
    avatar: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=face&auto=format&q=80",
    rating: 4
  },
  {
    id: "4",
    name: "David Chen",
    role: "Verified Customer",
    content: "The attention to detail on every product is remarkable. I've recommended Bazaar to all my friends and family. My new favorite online shopping destination!",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face&auto=format&q=80",
    rating: 5
  }
];

export default function TestimonialSection({ className }: TestimonialSectionProps) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <section className={cn("py-16 bg-gradient-to-b from-background to-muted/30", className)}>
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">What Our Customers Say</h2>
          <p className="text-muted-foreground">
            Don't just take our word for it — see what our satisfied customers have to say about their shopping experience.
          </p>
        </div>
        
        <div className="relative">
          {/* Testimonial Cards */}
          <div className="overflow-hidden">
            <div 
              className="transition-transform duration-500 ease-out flex"
              style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}
            >
              {TESTIMONIALS.map((testimonial) => (
                <div 
                  key={testimonial.id}
                  className="min-w-full p-1"
                >
                  <div className="bg-card border rounded-lg p-8 shadow-sm">
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={cn(
                            "w-5 h-5",
                            i < testimonial.rating ? "text-yellow-400" : "text-gray-300"
                          )}
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    
                    <blockquote className="text-lg mb-8">"{testimonial.content}"</blockquote>
                    
                    <div className="flex items-center gap-4">
                      {testimonial.avatar && (
                        <img 
                          src={testimonial.avatar}
                          alt={testimonial.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Navigation Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveTestimonial(index)}
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  index === activeTestimonial
                    ? "bg-primary"
                    : "bg-muted hover:bg-primary/50"
                )}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
