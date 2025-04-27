import Layout from "@/components/layout/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQPage() {
  const faqs = [
    {
      question: "How do I place an order?",
      answer:
        "To place an order, browse our products, add items to your cart, and proceed to checkout. Follow the steps to provide shipping information and payment details to complete your purchase."
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept credit cards (Visa, MasterCard, American Express), PayPal, and Apple Pay. All transactions are secure and encrypted."
    },
    {
      question: "How long will shipping take?",
      answer:
        "Shipping times vary by location. Domestic orders typically arrive within 3-5 business days. International shipping can take 7-14 business days. Expedited shipping options are available at checkout."
    },
    {
      question: "What is your return policy?",
      answer:
        "We offer a 30-day return policy for unused items in original packaging. Refunds are processed within 5-7 business days after we receive the returned item."
    },
    {
      question: "Do you ship internationally?",
      answer:
        "Yes, we ship to most international destinations. Shipping costs and delivery times vary by country. Import duties or taxes may apply and are the responsibility of the customer."
    },
    {
      question: "How can I track my order?",
      answer:
        "Once your order ships, you'll receive a confirmation email with tracking information. You can also track your order by logging into your account or using our order tracking tool on the website."
    },
    {
      question: "Are my payment details secure?",
      answer:
        "Yes, we use industry-standard encryption and secure payment processors. We do not store your full credit card information on our servers."
    },
    {
      question: "Do you offer discounts or promotions?",
      answer:
        "Yes, we regularly offer promotions and seasonal discounts. Sign up for our newsletter to stay informed about special offers, or check our social media pages for the latest deals."
    },
    {
      question: "What if my order arrives damaged?",
      answer:
        "If your item arrives damaged, please contact our customer service within 48 hours with photos of the damaged item. We'll arrange a replacement or refund as soon as possible."
    },
    {
      question: "How do I contact customer support?",
      answer:
        "You can reach our customer support team via email at support@bazaar.com, through the contact form on our website, or by phone at (555) 123-4567 during business hours (Monday-Friday, 9am-5pm EST)."
    },
  ];

  return (
    <Layout>
      <div className="container py-12">
        <h1 className="text-3xl font-bold text-center mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground text-center mb-8">
          Find answers to common questions about our products and services
        </p>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">
            Our customer service team is here to help
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <div className="bg-card border rounded-lg p-6 flex flex-col items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="mb-3"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <h3 className="font-medium">Call Us</h3>
              <p className="text-muted-foreground">(555) 123-4567</p>
            </div>
            <div className="bg-card border rounded-lg p-6 flex flex-col items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="mb-3"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <h3 className="font-medium">Email Us</h3>
              <p className="text-muted-foreground">support@bazaar.com</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 