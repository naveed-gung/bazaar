import Layout from "@/components/layout/Layout";
import HeroBanner from "@/components/home/HeroBanner";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CategorySection from "@/components/home/CategorySection";
import PromoBanner from "@/components/home/PromoBanner";
import TestimonialSection from "@/components/home/TestimonialSection";
import NewsletterSection from "@/components/home/NewsletterSection";
import ScrollAnimation from "@/components/animation/ScrollAnimation";
import SEO from "@/components/SEO";

const Index = () => {
  return (
    <Layout>
      <SEO
        title="Home"
        description="Discover premium products at Bazaar — your modern online shopping destination for electronics, fashion, home & garden, and more."
        keywords="online shopping, e-commerce, electronics, fashion, home decor"
      />
      {/* Hero Banner with fade down animation */}
      <ScrollAnimation 
        direction="down" 
        once={false}
        duration={0.7}
        distance={30}
      >
        <HeroBanner />
      </ScrollAnimation>
      
      {/* Featured Products with staggered children animation */}
      <ScrollAnimation 
        direction="up" 
        delay={0.1} 
        duration={0.6}
        staggerChildren={true}
        staggerDelay={0.1}
        bounce={true}
      >
        <FeaturedProducts />
      </ScrollAnimation>
      
      {/* Category Section with slide in from left */}
      <ScrollAnimation 
        direction="left" 
        delay={0.1}
        distance={100}
        threshold={0.2}
      >
        <CategorySection />
      </ScrollAnimation>
      
      {/* Promo Banner with slide in from right and bounce effect */}
      <ScrollAnimation 
        direction="right" 
        delay={0.1}
        bounce={true}
        springiness={0.8}
        distance={70}
      >
        <PromoBanner />
      </ScrollAnimation>
      
      {/* Testimonial Section with scale animation */}
      <ScrollAnimation 
        direction="scale" 
        delay={0.2}
        duration={0.8}
        staggerChildren={true}
      >
        <TestimonialSection />
      </ScrollAnimation>
      
      {/* Newsletter Section with translate up animation instead of rotation */}
      <ScrollAnimation 
        direction="translateUp" 
        delay={0.1}
        bounce={true}
        distance={70}
      >
        <NewsletterSection />
      </ScrollAnimation>
    </Layout>
  );
};

export default Index;
