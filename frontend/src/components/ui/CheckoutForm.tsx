import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from './button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

export function CheckoutForm({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe'); // 'stripe' or 'paypal'

  const handleStripeSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // In a real app, this would communicate with the Stripe API
      // For the simulation, we'll create a mock successful payment
      const mockPaymentIntent = {
        id: 'pi_' + Math.random().toString(36).substr(2, 9),
        amount: 9999,
        status: "succeeded",
        created: Date.now() / 1000,
        customer: 'cus_' + Math.random().toString(36).substr(2, 9),
      };
      
        toast({
          title: "Payment successful",
          description: "Your order has been placed successfully!",
        });
      
      // Pass the successful payment to the parent component
      onSuccess(mockPaymentIntent);
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  const handlePayPalSubmit = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate PayPal processing time
    setTimeout(() => {
      const mockPaymentIntent = {
        id: 'pp_' + Math.random().toString(36).substr(2, 9),
        amount: 9999,
        status: "succeeded",
        method: "paypal",
        created: Date.now() / 1000,
        customer: 'cus_' + Math.random().toString(36).substr(2, 9),
      };
      
      toast({
        title: "PayPal payment successful",
        description: "Your order has been placed successfully!",
      });
      
      onSuccess(mockPaymentIntent);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="w-full space-y-6">
      <Tabs defaultValue="card" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="card" 
            onClick={() => setPaymentMethod('stripe')}
            className="flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            Credit Card
          </TabsTrigger>
          <TabsTrigger 
            value="paypal" 
            onClick={() => setPaymentMethod('paypal')}
            className="flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.58 2.975-2.477 6.17-8.233 6.17h-2.19c-.133 0-.235.092-.252.213l-1.2 7.655h5.162c.37 0 .684-.255.74-.617l.03-.153.543-3.48.035-.181a.741.741 0 0 1 .74-.616h.467c3.547 0 6.52-2.418 7.477-6.648.473-2.104.216-3.815-1.201-5.055z"/>
            </svg>
            PayPal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="card" className="space-y-4">
          {paymentMethod === 'stripe' && (
            <form onSubmit={handleStripeSubmit} className="space-y-6">
              <div className="p-4 border rounded-md space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <div className="flex p-2 border rounded-md mt-1 bg-background">
                      <input 
                        id="cardNumber" 
                        type="text" 
                        placeholder="4242 4242 4242 4242" 
                        className="flex-1 outline-none bg-transparent dark:text-white"
                      />
                      <div className="flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="24" viewBox="0 0 38 24" fill="none" className="h-6 w-auto">
                          <path d="M34.0161 0H3.98394C1.78638 0 0 1.78638 0 3.98394V20.0161C0 22.2136 1.78638 24 3.98394 24H34.0161C36.2136 24 38 22.2136 38 20.0161V3.98394C38 1.78638 36.2136 0 34.0161 0Z" fill="#252525"/>
                          <path d="M22.9323 8.58908C22.4302 8.40799 21.6467 8.21884 20.7094 8.21884C18.674 8.21884 17.2139 9.29205 17.2049 10.8081C17.1868 11.9272 18.2327 12.5539 19.0071 12.9398C19.7995 13.3347 20.0639 13.5969 20.0639 13.9467C20.0549 14.4849 19.3968 14.7381 18.7836 14.7381C17.9183 14.7381 17.4612 14.6098 16.7138 14.3116L16.4225 14.1846L16.1132 15.8574C16.7084 16.107 17.7455 16.3241 18.8184 16.3331C20.9878 16.3331 22.4211 15.2689 22.4392 13.6502C22.4481 12.7669 21.9011 12.0861 20.7094 11.5028C20.0008 11.135 19.5977 10.8998 19.6067 10.5409C19.6067 10.2156 19.9792 9.8748 20.784 9.8748C21.4513 9.85674 21.9373 10.0288 22.3057 10.2156L22.5078 10.3245L22.9323 8.58908Z" fill="#FFFFFE"/>
                          <path d="M26.3325 8.40799H24.7948C24.4534 8.40799 24.1932 8.51692 24.0432 8.89583L21.5093 15.592H23.5788L23.9763 14.494H26.7299L26.9772 15.592H28.838L26.3325 8.40799ZM24.4444 13.0545C24.444 13.0545 25.1833 11.1609 25.3784 10.6407L25.6962 13.0545H24.4444Z" fill="#FFFFFE"/>
                          <path d="M11.3192 8.40799L9.40474 13.3167L9.19457 12.1796C8.8336 11.0425 7.69374 9.80981 7.69374 9.80981L9.52174 15.583H11.6105L14.5921 8.40799H11.3192Z" fill="#FFFFFE"/>
                        </svg>
                        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg" alt="Apple Pay" className="h-6 dark:invert" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <input 
                        id="expiry" 
                        type="text" 
                        placeholder="MM/YY" 
                        className="w-full p-2 border rounded-md mt-1 bg-background dark:text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvc">CVC</Label>
                      <input 
                        id="cvc" 
                        type="text" 
                        placeholder="123" 
                        className="w-full p-2 border rounded-md mt-1 bg-background dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="name">Name on Card</Label>
                    <input 
                      id="name" 
                      type="text" 
                      placeholder="John Doe" 
                      className="w-full p-2 border rounded-md mt-1 bg-background dark:text-white"
                    />
                  </div>
                </div>
              </div>
      <Button
        type="submit"
                disabled={isProcessing}
        className="w-full"
      >
        {isProcessing ? "Processing..." : "Pay now"}
      </Button>
    </form>
          )}
        </TabsContent>
        <TabsContent value="paypal">
          {paymentMethod === 'paypal' && (
            <form onSubmit={handlePayPalSubmit} className="space-y-4">
              <div className="p-6 border rounded-md text-center">
                <div className="mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 33" className="h-10 w-auto mx-auto" fill="#253B80">
                    <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z"/>
                    <path fill="#179BD7" d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z"/>
                    <path fill="#253B80" d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c3.114 0 5.263.648 6.385 1.927.526.6.861 1.227 1.023 1.917.17.724.173 1.589.007 2.644l-.012.077v.676l.526.298a3.69 3.69 0 0 1 1.065.812c.45.513.741 1.165.864 1.938.127.795.085 1.741-.123 2.812-.24 1.232-.628 2.305-1.152 3.183a6.547 6.547 0 0 1-1.825 2c-.696.494-1.523.869-2.458 1.109-.906.236-1.939.355-3.072.355h-.73c-.522 0-1.029.188-1.427.525a2.21 2.21 0 0 0-.744 1.328l-.055.299-.924 5.855-.042.215c-.011.068-.03.102-.058.125a.155.155 0 0 1-.096.035H7.266z"/>
                    <path fill="#179BD7" d="M23.048 7.667c-.028.179-.06.362-.096.55-1.237 6.351-5.469 8.545-10.874 8.545H9.326c-.661 0-1.218.48-1.321 1.132L6.596 26.83l-.399 2.533a.704.704 0 0 0 .695.814h4.881c.578 0 1.069-.42 1.16-.99l.048-.248.919-5.832.059-.32c.09-.572.582-.992 1.16-.992h.73c4.729 0 8.431-1.92 9.513-7.476.452-2.321.218-4.259-.978-5.622a4.667 4.667 0 0 0-1.336-1.03z"/>
                    <path fill="#222D65" d="M21.754 7.151a9.757 9.757 0 0 0-1.203-.267 15.284 15.284 0 0 0-2.426-.177h-7.352a1.172 1.172 0 0 0-1.159.992L8.05 17.605l-.045.289a1.336 1.336 0 0 1 1.321-1.132h2.752c5.405 0 9.637-2.195 10.874-8.545.037-.188.068-.371.096-.55a6.594 6.594 0 0 0-1.017-.516 9.045 9.045 0 0 0-.277-.1z"/>
                    <path fill="#253B80" d="M9.614 7.699a1.169 1.169 0 0 1 1.159-.991h7.352c.871 0 1.684.057 2.426.177a9.757 9.757 0 0 1 1.481.367c.365.121.704.264 1.017.516.368-2.347-.003-3.945-1.272-5.392C20.378.682 17.853 0 14.622 0h-9.38c-.66 0-1.223.48-1.325 1.133L.01 25.898a.806.806 0 0 0 .795.932h5.791l1.454-9.225 1.564-9.906z"/>
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Click the button below to pay with PayPal</p>
              </div>
              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#0070ba] hover:bg-[#003087]"
              >
                {isProcessing ? "Processing..." : "Pay with PayPal"}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}