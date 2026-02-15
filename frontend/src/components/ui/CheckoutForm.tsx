import { useState } from 'react';
import { Button } from './button';
import { useToast } from '@/hooks/use-toast';
import { Input } from './input';
import { Label } from './label';
import { CreditCard, Lock, CheckCircle2 } from 'lucide-react';
import { PaymentAPI } from '@/lib/api';

interface CheckoutFormProps {
  onSuccess: (paymentResult: { id: string; status: string; method: string }) => void;
}

export function CheckoutForm({ onSuccess }: CheckoutFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');

  // Format card number with spaces every 4 digits
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  // Format expiry as MM/YY
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13) {
      toast({ title: 'Invalid card number', description: 'Please enter a valid card number.', variant: 'destructive' });
      return;
    }
    if (expiry.length < 5) {
      toast({ title: 'Invalid expiry', description: 'Please enter a valid expiry date (MM/YY).', variant: 'destructive' });
      return;
    }
    if (cvc.length < 3) {
      toast({ title: 'Invalid CVC', description: 'Please enter a valid 3-digit CVC.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      // Call backend to get a simulated payment intent
      const data = await PaymentAPI.createStripePaymentIntent(100, 'usd');

      // Simulate a brief processing delay for realism
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Confirm the simulated payment
      await PaymentAPI.confirmStripePayment(data.paymentIntentId || data.clientSecret);

      toast({
        title: 'Payment successful!',
        description: 'Your simulated payment has been processed.',
      });

      onSuccess({
        id: data.paymentIntentId || `sim_${Date.now()}`,
        status: 'succeeded',
        method: 'credit-card',
      });
    } catch {
      toast({
        title: 'Payment error',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Simulation banner */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>Simulation Mode</strong> — No real charges will be made. Enter any card details.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Card Name */}
        <div className="space-y-2">
          <Label htmlFor="cardName">Cardholder Name</Label>
          <Input
            id="cardName"
            placeholder="John Doe"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            required
          />
        </div>

        {/* Card Number */}
        <div className="space-y-2">
          <Label htmlFor="cardNumber">Card Number</Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cardNumber"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              className="pl-10"
              maxLength={19}
              required
            />
          </div>
        </div>

        {/* Expiry + CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date</Label>
            <Input
              id="expiry"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              maxLength={5}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cvc">CVC</Label>
            <Input
              id="cvc"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isProcessing}
          className="w-full h-12 text-base font-semibold transition-all duration-200 hover:shadow-md hover:shadow-primary/25 active:scale-[0.98]"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Pay Now (Simulated)
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}