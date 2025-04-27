import Layout from "@/components/layout/Layout";
import ScrollAnimation from "@/components/animation/ScrollAnimation";
import { aboutAnimations } from "@/lib/pageAnimations";

export default function AboutPage() {
  return (
    <Layout>
      <div className="container py-16 space-y-16">
        <ScrollAnimation {...aboutAnimations.hero}>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gradient animate-text">Welcome to Bazaar</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your premier destination for unique and quality products
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation {...aboutAnimations.mission} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Quality Products",
              description: "Curated selection of premium items from trusted sources",
              icon: "🎯"
            },
            {
              title: "Fast Shipping",
              description: "Quick and reliable delivery to your doorstep",
              icon: "🚚"
            },
            {
              title: "24/7 Support",
              description: "Always here to help with your shopping needs",
              icon: "💬"
            }
          ].map((feature, index) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg glass-card hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </ScrollAnimation>

        <ScrollAnimation {...aboutAnimations.values}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
            <p className="text-muted-foreground mb-10 text-center">
              Founded with a vision to revolutionize online shopping, Bazaar brings together the finest products and the most seamless shopping experience. Our commitment to quality, innovation, and customer satisfaction drives everything we do.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { number: "10K+", label: "Products" },
                { number: "50K+", label: "Customers" },
                { number: "99%", label: "Satisfaction" },
                { number: "24/7", label: "Support" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-6 rounded-lg border bg-card shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl font-bold text-primary mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </Layout>
  );
}
