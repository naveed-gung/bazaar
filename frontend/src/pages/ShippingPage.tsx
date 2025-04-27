import Layout from "@/components/layout/Layout";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ShippingPage() {
  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Shipping & Returns</h1>
          <p className="text-muted-foreground text-center mb-8">
            Everything you need to know about our shipping policies and return process
          </p>

          <Tabs defaultValue="shipping" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="shipping">Shipping Information</TabsTrigger>
              <TabsTrigger value="returns">Returns & Exchanges</TabsTrigger>
            </TabsList>
            
            <TabsContent value="shipping" className="mt-6">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <section>
                    <h2 className="text-xl font-semibold mb-3">Shipping Methods</h2>
                    <div className="space-y-4">
                      <div className="border rounded-md p-4">
                        <h3 className="font-medium mb-1">Standard Shipping</h3>
                        <p className="text-muted-foreground mb-2">Delivery in 3-5 business days</p>
                        <p className="text-sm">Free for orders over $50, otherwise $4.99</p>
                      </div>
                      <div className="border rounded-md p-4">
                        <h3 className="font-medium mb-1">Express Shipping</h3>
                        <p className="text-muted-foreground mb-2">Delivery in 1-2 business days</p>
                        <p className="text-sm">$9.99 (Free for orders over $100)</p>
                      </div>
                      <div className="border rounded-md p-4">
                        <h3 className="font-medium mb-1">Next Day Delivery</h3>
                        <p className="text-muted-foreground mb-2">Guaranteed delivery by next business day</p>
                        <p className="text-sm">$14.99 (Not available for all locations)</p>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-xl font-semibold mb-3">International Shipping</h2>
                    <p className="mb-4">
                      We ship to most countries worldwide. International shipping rates depend on location and package weight.
                    </p>
                    <p className="mb-2 text-muted-foreground">Typical delivery times:</p>
                    <ul className="list-disc pl-5 space-y-1 mb-4">
                      <li>Europe: 7-14 business days</li>
                      <li>Asia: 10-20 business days</li>
                      <li>Australia: 10-21 business days</li>
                      <li>Rest of world: 14-30 business days</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Please note that customs duties, taxes, and fees are not included in the item price or shipping cost. These charges are the responsibility of the recipient.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-xl font-semibold mb-3">Tracking Your Order</h2>
                    <p className="mb-4">
                      Once your order ships, you'll receive a tracking number via email. You can also track your order by:
                    </p>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Logging into your account and viewing your order history</li>
                      <li>Using our order tracking tool on the Track Order page</li>
                      <li>Contacting our customer service team</li>
                    </ol>
                  </section>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="returns" className="mt-6">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <section>
                    <h2 className="text-xl font-semibold mb-3">Return Policy</h2>
                    <p className="mb-4">
                      We want you to be completely satisfied with your purchase. If you're not, we offer a hassle-free return policy:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 mb-4">
                      <li>Returns are accepted within 30 days of delivery</li>
                      <li>Items must be unworn, unwashed, and in original condition with all tags attached</li>
                      <li>Original packaging should be included when possible</li>
                      <li>Sale items are final sale and cannot be returned (unless defective)</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-xl font-semibold mb-3">How to Return an Item</h2>
                    <ol className="list-decimal pl-5 space-y-2 mb-4">
                      <li>Log into your account and navigate to your order history</li>
                      <li>Select the order containing the item you wish to return</li>
                      <li>Click "Return Item" and follow the prompts</li>
                      <li>Print the prepaid return shipping label (if eligible)</li>
                      <li>Package the item securely and attach the return label</li>
                      <li>Drop off the package at your nearest shipping carrier location</li>
                    </ol>
                    <p className="text-sm text-muted-foreground">
                      Standard returns are free. We'll deduct a $5.99 return shipping fee for express or next-day returns.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-xl font-semibold mb-3">Refund Process</h2>
                    <p className="mb-4">
                      Once we receive and inspect your return, we'll process your refund:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Refunds are issued to the original payment method</li>
                      <li>Processing time is typically 3-5 business days</li>
                      <li>You'll receive an email confirmation when your refund is processed</li>
                      <li>Credit card refunds may take an additional 3-7 business days to appear on your statement</li>
                    </ul>
                  </section>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
} 