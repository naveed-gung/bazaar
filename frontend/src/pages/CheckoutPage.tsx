import { useEffect, useState, useMemo } from 'react';
import { useCart } from '@/contexts/CartContext';
import { CheckoutForm } from '@/components/ui/CheckoutForm';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { OrderAPI } from '@/lib/api';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, MapPin, CreditCard, ClipboardList, ChevronRight, ChevronLeft, Package, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const TAX_RATE = 0.08;
const SHIPPING_COST = 5.99;

interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const STEPS = [
  { id: 1, label: 'Address', icon: MapPin },
  { id: 2, label: 'Payment', icon: CreditCard },
  { id: 3, label: 'Review', icon: ClipboardList },
];

export default function CheckoutPage() {
  const { cart, clearCart, cartTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentResult, setPaymentResult] = useState<{ id: string; status: string; method: string } | null>(null);

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: user?.name || '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
  });

  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  // Pre-fill from user's saved address
  useEffect(() => {
    if (user?.addresses?.[0]) {
      const addr = user.addresses[0];
      setShippingAddress({
        name: user.name || '',
        address: addr.street || '',
        city: addr.city || '',
        state: addr.state || '',
        postalCode: addr.zipCode || '',
        country: addr.country || 'USA',
      });
    }
  }, [user]);

  const taxAmount = useMemo(() => +(cartTotal * TAX_RATE).toFixed(2), [cartTotal]);
  const totalPrice = useMemo(() => +(cartTotal + SHIPPING_COST + taxAmount).toFixed(2), [cartTotal, taxAmount]);

  const validateAddress = (): boolean => {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!shippingAddress.name.trim()) errors.name = 'Full name is required';
    if (!shippingAddress.address.trim()) errors.address = 'Street address is required';
    if (!shippingAddress.city.trim()) errors.city = 'City is required';
    if (!shippingAddress.state.trim()) errors.state = 'State is required';
    if (!shippingAddress.postalCode.trim()) errors.postalCode = 'ZIP code is required';
    if (!shippingAddress.country.trim()) errors.country = 'Country is required';
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateAddress()) return;
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handlePaymentSuccess = (result: { id: string; status: string; method: string }) => {
    setPaymentResult(result);
    setCurrentStep(3);
  };

  const handlePlaceOrder = async () => {
    if (!paymentResult) {
      toast({ title: 'Error', description: 'Please complete payment first.', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);
      const orderData = {
        orderItems: cart.map((item) => ({
          product: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        shippingAddress,
        paymentMethod: paymentResult.method || 'credit-card',
        itemsPrice: cartTotal,
        taxPrice: taxAmount,
        shippingPrice: SHIPPING_COST,
        totalPrice,
      };

      const result = await OrderAPI.createOrder(orderData);
      clearCart();

      toast({
        title: 'Order placed successfully!',
        description: 'Your order has been created.',
      });

      const orderId = result.order._id || result.order.id;
      navigate(`/order-success/${orderId}`, { state: { order: result.order } });
    } catch (err) {
      console.error('Error creating order:', err);
      toast({
        title: 'Error',
        description: 'Failed to process your order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Layout>
      <div className="container max-w-5xl mx-auto py-12">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add some items to your cart before checking out.</p>
            <Button onClick={() => navigate('/products')}>Browse Products</Button>
          </div>
        ) : (
        <>
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-muted-foreground mb-8">Complete your order in 3 easy steps</p>

        {/* Step Indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCompleted) setCurrentStep(step.id);
                      }}
                      disabled={!isCompleted}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                        isCompleted && 'bg-primary border-primary text-primary-foreground cursor-pointer hover:opacity-80',
                        isCurrent && 'border-primary text-primary bg-primary/10',
                        !isCompleted && !isCurrent && 'border-muted-foreground/30 text-muted-foreground/50'
                      )}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                    </button>
                    <span
                      className={cn(
                        'text-xs mt-2 font-medium absolute -bottom-6 whitespace-nowrap',
                        isCurrent && 'text-primary',
                        isCompleted && 'text-primary',
                        !isCompleted && !isCurrent && 'text-muted-foreground/50'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-3 rounded transition-colors duration-300',
                        currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/20'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Step 1: Shipping Address */}
              {currentStep === 1 && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="border rounded-lg p-6 bg-card shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Shipping Address
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">Where should we deliver your order?</p>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="John Doe"
                          value={shippingAddress.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          className={addressErrors.name ? 'border-destructive' : ''}
                        />
                        {addressErrors.name && <p className="text-xs text-destructive">{addressErrors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Street Address</Label>
                        <Input
                          id="address"
                          placeholder="123 Main Street, Apt 4"
                          value={shippingAddress.address}
                          onChange={(e) => updateField('address', e.target.value)}
                          className={addressErrors.address ? 'border-destructive' : ''}
                        />
                        {addressErrors.address && <p className="text-xs text-destructive">{addressErrors.address}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            placeholder="New York"
                            value={shippingAddress.city}
                            onChange={(e) => updateField('city', e.target.value)}
                            className={addressErrors.city ? 'border-destructive' : ''}
                          />
                          {addressErrors.city && <p className="text-xs text-destructive">{addressErrors.city}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            placeholder="NY"
                            value={shippingAddress.state}
                            onChange={(e) => updateField('state', e.target.value)}
                            className={addressErrors.state ? 'border-destructive' : ''}
                          />
                          {addressErrors.state && <p className="text-xs text-destructive">{addressErrors.state}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="postalCode">ZIP Code</Label>
                          <Input
                            id="postalCode"
                            placeholder="10001"
                            value={shippingAddress.postalCode}
                            onChange={(e) => updateField('postalCode', e.target.value)}
                            className={addressErrors.postalCode ? 'border-destructive' : ''}
                          />
                          {addressErrors.postalCode && <p className="text-xs text-destructive">{addressErrors.postalCode}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            placeholder="USA"
                            value={shippingAddress.country}
                            onChange={(e) => updateField('country', e.target.value)}
                            className={addressErrors.country ? 'border-destructive' : ''}
                          />
                          {addressErrors.country && <p className="text-xs text-destructive">{addressErrors.country}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleNextStep} className="gap-2">
                        Continue to Payment
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {currentStep === 2 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="border rounded-lg p-6 bg-card shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Payment Method
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">Enter your payment details</p>

                    {cart.length > 0 ? (
                      <CheckoutForm onSuccess={handlePaymentSuccess} />
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-muted-foreground">No items in cart to checkout</p>
                      </div>
                    )}

                    <div className="mt-6 flex justify-start">
                      <Button variant="outline" onClick={handlePrevStep} className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        Back to Address
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="border rounded-lg p-6 bg-card shadow-sm space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Review Your Order
                      </h2>
                      <p className="text-sm text-muted-foreground">Please confirm everything looks correct</p>
                    </div>

                    {/* Shipping Summary */}
                    <div className="border rounded-md p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Shipping To
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs h-7">
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm">{shippingAddress.name}</p>
                      <p className="text-sm text-muted-foreground">{shippingAddress.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                      </p>
                      <p className="text-sm text-muted-foreground">{shippingAddress.country}</p>
                    </div>

                    {/* Payment Summary */}
                    <div className="border rounded-md p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Payment
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="text-xs h-7">
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm">
                        {paymentResult ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" />
                            Payment confirmed (ID: {paymentResult.id.slice(0, 12)}...)
                          </span>
                        ) : (
                          <span className="text-amber-600">Payment pending</span>
                        )}
                      </p>
                    </div>

                    {/* Items list */}
                    <div className="border rounded-md p-4 bg-muted/30">
                      <h3 className="font-medium flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4" />
                        Items ({cart.length})
                      </h3>
                      <div className="space-y-2">
                        {cart.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-sm py-1">
                            <span>
                              {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                            </span>
                            <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handlePrevStep} className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handlePlaceOrder}
                        disabled={isLoading || !paymentResult}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Placing Order...
                          </span>
                        ) : (
                          'Place Order'
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-6 bg-card shadow-sm sticky top-24">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between py-2">
                    <div className="flex-1">
                      <p className="font-medium truncate text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-right text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 mt-4 space-y-1">
                <div className="flex justify-between py-1 text-sm">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span>Shipping</span>
                  <span>${SHIPPING_COST.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span>Tax</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold border-t mt-2 text-lg">
                  <span>Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </Layout>
  );
}
