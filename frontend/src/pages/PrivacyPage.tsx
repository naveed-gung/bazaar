import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-center mb-8">
            Last updated: June 1, 2023
          </p>

          <Card>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6">
              <section>
                <h2 className="text-xl font-semibold">Introduction</h2>
                <p>
                  At Bazaar, we value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or make a purchase.
                </p>
                <p>
                  Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access the site.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Collection of Your Information</h2>
                <p>
                  We may collect information about you in a variety of ways. The information we may collect includes:
                </p>
                <h3 className="font-medium mt-4">Personal Data</h3>
                <p>
                  When you register an account, place an order, or subscribe to our newsletter, we collect personally identifiable information, such as your:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Mailing address</li>
                  <li>Payment information</li>
                </ul>

                <h3 className="font-medium mt-4">Derivative Data</h3>
                <p>
                  Our servers automatically collect information when you access our website, such as your IP address, browser type, operating system, access times, and the pages you have viewed directly before and after accessing the site.
                </p>

                <h3 className="font-medium mt-4">Mobile Device Data</h3>
                <p>
                  If you access our site via a mobile device, we may collect device information such as your mobile device ID, model, manufacturer, and location information if enabled.
                </p>

                <h3 className="font-medium mt-4">Cookies</h3>
                <p>
                  We use cookies to enhance your experience on our site. A cookie is a piece of data stored on a site visitor's hard drive to help us improve your access to our site and identify repeat visitors. Cookies can also enable us to track and target the interests of our users to enhance the experience on our site.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Use of Your Information</h2>
                <p>
                  We may use the information we collect about you for various purposes, including to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Process and fulfill your orders</li>
                  <li>Send you order confirmations and updates</li>
                  <li>Respond to customer service requests</li>
                  <li>Send you promotional emails about products, offers, and events</li>
                  <li>Administer contests, promotions, surveys, or other site features</li>
                  <li>Improve our website and marketing efforts</li>
                  <li>Conduct research and analysis</li>
                  <li>Prevent fraudulent transactions and monitor against theft</li>
                </ul>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Disclosure of Your Information</h2>
                <p>
                  We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                </p>
                <h3 className="font-medium mt-4">By Law or to Protect Rights</h3>
                <p>
                  If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
                </p>

                <h3 className="font-medium mt-4">Third-Party Service Providers</h3>
                <p>
                  We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.
                </p>

                <h3 className="font-medium mt-4">Marketing Communications</h3>
                <p>
                  With your consent, or with an opportunity for you to withdraw consent, we may share your information with third parties for marketing purposes.
                </p>

                <h3 className="font-medium mt-4">Business Transfers</h3>
                <p>
                  If we are involved in a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred as part of that transaction.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Security of Your Information</h2>
                <p>
                  We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Your Rights Regarding Your Information</h2>
                <p>
                  You have certain rights regarding the personal information we collect about you:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Right to Access:</strong> You have the right to request copies of your personal information.
                  </li>
                  <li>
                    <strong>Right to Rectification:</strong> You have the right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.
                  </li>
                  <li>
                    <strong>Right to Erasure:</strong> You have the right to request that we erase your personal data, under certain conditions.
                  </li>
                  <li>
                    <strong>Right to Restrict Processing:</strong> You have the right to request that we restrict the processing of your personal data, under certain conditions.
                  </li>
                  <li>
                    <strong>Right to Object to Processing:</strong> You have the right to object to our processing of your personal data, under certain conditions.
                  </li>
                  <li>
                    <strong>Right to Data Portability:</strong> You have the right to request that we transfer the data we have collected to another organization, or directly to you, under certain conditions.
                  </li>
                </ul>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Children's Information</h2>
                <p>
                  Our website is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If you are under 13, please do not provide any information on this website.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-semibold">Contact Us</h2>
                <p>
                  If you have questions or concerns about this Privacy Policy, please contact us at:
                </p>
                <address className="not-italic mt-2">
                  Bazaar<br />
                  123 Commerce St<br />
                  New York, NY 10001<br />
                  Email: privacy@bazaar.com<br />
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