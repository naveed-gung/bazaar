import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer, scaleInHover, pulseAnimation } from "@/lib/animations";

interface HeroBannerProps {
  className?: string;
}

export default function HeroBanner({ className }: HeroBannerProps) {
  return (
    <section className={cn("relative overflow-hidden min-h-[80vh] flex items-center", className)}>
      {/* Background with gradient overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-gradient-to-r from-primary/25 to-accent/25 dark:from-primary/10 dark:to-accent/10"
      />
      
      {/* Background pattern */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute inset-0 dark:opacity-5"
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>
      </motion.div>
      
      <div className="container relative mx-auto px-6 py-16 md:py-24 lg:py-32 flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {/* Content */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex-1 text-center md:text-left"
        >
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            <span className="block">Discover Exceptional</span>
            <span className="text-gradient animate-text">Products & Styles</span>
          </motion.h1>
          
          <motion.p 
            variants={fadeInUp}
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg mx-auto md:mx-0"
          >
            Explore our curated collection of premium products designed for your modern lifestyle. Quality meets innovation.
          </motion.p>
          
          <motion.div 
            variants={fadeInUp}
            className="flex flex-wrap gap-4 justify-center md:justify-start"
          >
            <Link to="/products">
              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={scaleInHover}
              >
                <Button size="lg" className="rounded-full">
                  Shop Now
                </Button>
              </motion.div>
            </Link>
            <Link to="/collections">
              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={scaleInHover}
              >
                <Button size="lg" variant="outline" className="rounded-full">
                  Browse Collections
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
        
        {/* Hero image */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex-1 relative w-full max-w-lg mx-auto md:mx-0"
        >
          <motion.div 
            variants={pulseAnimation}
            animate="animate"
            className="relative aspect-square rounded-full overflow-hidden bg-muted"
          >
            <img
              src="https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac"
              alt="Featured product"
              className="w-full h-full object-cover"
            />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
              className="absolute -top-4 -right-4 w-24 h-24 bg-accent/80 rounded-full flex items-center justify-center text-white font-bold"
            >
              <div className="text-center">
                <div className="text-sm">UP TO</div>
                <div className="text-xl">40%</div>
                <div className="text-sm">OFF</div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, type: "spring" }}
              className="absolute -bottom-2 -left-2 w-32 h-32 bg-primary/80 rounded-full flex items-center justify-center text-white font-bold"
            >
              <div className="text-center">
                <div className="text-lg">NEW</div>
                <div className="text-sm">COLLECTION</div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
