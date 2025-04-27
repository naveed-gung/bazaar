import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Terms & Conditions</h1>
          <p className="text-muted-foreground text-center mb-8">
            Last updated: June 1, 2023
          </p>

          <Card>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6">
              <section>
                <h2 className="text-xl font-semibold">Introduction</h2>
                <p>
                  These Terms and Conditions ("Terms") govern your use of the Bazaar website and services. By accessing or using our website, you agree to be bound by these Terms. If you do not agree with any part of the Terms, you may not use our website.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Use of the Website</h2>
                <p>
                  By using our website, you represent that you are at least 18 years of age or that you are using the website with the supervision of a parent or guardian.
                </p>
                <h3 className="font-medium mt-4">User Account</h3>
                <p>
                  If you create an account on our website, you are responsible for:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Promptly notifying us of any unauthorized use of your account</li>
                </ul>
                <p className="mt-3">
                  We reserve the right to suspend or terminate your account if any information provided during the registration process or thereafter proves to be inaccurate, false, or misleading.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Products and Purchases</h2>
                <h3 className="font-medium mt-4">Product Information</h3>
                <p>
                  We strive to provide accurate product descriptions, pricing, and availability information. However, we do not warrant that product descriptions, pricing, or other content on the website is accurate, complete, reliable, current, or error-free.
                </p>
                <h3 className="font-medium mt-4">Order Acceptance</h3>
                <p>
                  Your receipt of an order confirmation does not constitute our acceptance of your order. We reserve the right to accept or decline your order for any reason, including unavailability of product, errors in product information, or errors in pricing.
                </p>
                <h3 className="font-medium mt-4">Pricing and Payment</h3>
                <p>
                  All prices are listed in USD and are subject to change without notice. We reserve the right to correct pricing errors. Payment must be made at the time of order. We accept major credit cards, PayPal, and other payment methods as displayed at checkout.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Shipping and Delivery</h2>
                <p>
                  We ship to the addresses provided by customers at the time of purchase. Delivery times are estimates and not guaranteed. We are not responsible for delays caused by unforeseen circumstances beyond our control.
                </p>
                <p className="mt-3">
                  Risk of loss and title for items purchased pass to you upon delivery of the items to the carrier. You are responsible for filing any claims with carriers for damaged and/or lost shipments.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Returns and Refunds</h2>
                <p>
                  Our return policy allows for returns within 30 days of delivery for most items in their original condition. Some products may have specific return restrictions which will be noted in the product description.
                </p>
                <p className="mt-3">
                  Refunds will be issued to the original payment method used for purchase. Processing times for refunds vary depending on the payment method and financial institution.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Intellectual Property</h2>
                <p>
                  The content on our website, including text, graphics, logos, images, and software, is the property of Bazaar or its content suppliers and is protected by copyright, trademark, and other intellectual property laws.
                </p>
                <p className="mt-3">
                  You may not reproduce, duplicate, copy, sell, resell, or exploit any portion of the website without our express written permission.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">User Content</h2>
                <p>
                  By posting, uploading, or otherwise submitting content to our website (including product reviews or comments), you grant us a non-exclusive, royalty-free, perpetual, irrevocable right to use, reproduce, modify, adapt, publish, translate, distribute, and display such content throughout the world in any media.
                </p>
                <p className="mt-3">
                  You represent and warrant that you own or control all rights to the content you submit, that the content is accurate, and that use of the content does not violate these Terms and will not cause injury to any person or entity.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Limitation of Liability</h2>
                <p>
                  In no event shall Bazaar, its officers, directors, employees, or agents, be liable to you for any direct, indirect, incidental, special, punitive, or consequential damages resulting from any:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Errors, mistakes, or inaccuracies of content</li>
                  <li>Personal injury or property damage of any nature</li>
                  <li>Unauthorized access to or use of our servers or personal information</li>
                  <li>Interruption or cessation of transmission to or from our website</li>
                  <li>Bugs, viruses, or the like transmitted by third parties</li>
                  <li>Errors or omissions in content or for any loss or damage incurred as a result of the use of content posted, emailed, transmitted, or otherwise made available</li>
                </ul>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless Bazaar, its officers, directors, employees, and agents, from and against any claims, liabilities, damages, losses, and expenses, including, without limitation, reasonable legal and accounting fees, arising out of or in any way connected with your access to or use of the website or your violation of these Terms.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions. You agree to submit to the personal jurisdiction of the courts located in New York County, New York for the resolution of any disputes.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the website following the posting of revised Terms means that you accept and agree to the changes.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Contact Us</h2>
                <p>
                  If you have any questions about these Terms, please contact us at:
                </p>
                <address className="not-italic mt-2">
                  Bazaar<br />
                  123 Commerce St<br />
                  New York, NY 10001<br />
                  Email: legal@bazaar.com<br />
                  Phone: (555) 123-4567
                </address>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}