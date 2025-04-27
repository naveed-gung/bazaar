import { useState } from "react";
import { useForm } from "react-hook-form";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Package, Truck, CheckCircle2 } from "lucide-react";

interface OrderTrackingForm {
  orderNumber: string;
  email: string;
}

export default function TrackOrderPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<OrderTrackingForm>();
  const [loading, setLoading] = useState(false);
  const [orderFound, setOrderFound] = useState(false);
  const [error, setError] = useState("");

  // Mock order data - this would come from API in a real app
  const mockOrderData = {
    orderNumber: "ORD-123456789",
    status: "shipped",
    statusText: "Your order is on the way",
    placedDate: "May 15, 2023",
    estimatedDelivery: "May 20, 2023",
    items: [
      { name: "Premium Cotton T-Shirt", quantity: 2, price: 29.99, image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dCUyMHNoaXJ0fGVufDB8fDB8fHww" },
      { name: "Classic Denim Jeans", quantity: 1, price: 59.99, image: "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8amVhbnN8ZW58MHx8MHx8fDA%3D" }
    ],
    tracking: {
      number: "TRK-7890123456",
      carrier: "FedEx",
      url: "https://www.fedex.com/tracking",
      events: [
        { date: "May 18, 2023 - 10:30 AM", status: "Out for delivery", location: "Local Distribution Center" },
        { date: "May 17, 2023 - 8:15 PM", status: "Arrived at destination facility", location: "City Distribution Hub" },
        { date: "May 16, 2023 - 2:45 PM", status: "In transit", location: "Regional Sorting Facility" },
        { date: "May 15, 2023 - 5:20 PM", status: "Shipment picked up", location: "Origin Facility" },
        { date: "May 15, 2023 - 11:30 AM", status: "Order processed", location: "Warehouse" },
      ]
    },
    shippingAddress: {
      name: "John Doe",
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "United States"
    }
  };

  const onSubmit = (data: OrderTrackingForm) => {
    setLoading(true);
    setError("");
    
    // Simulate API call with a delay
    setTimeout(() => {
      // For demo, always show the order if orderNumber is not empty
      if (data.orderNumber && data.email) {
        setOrderFound(true);
      } else {
        setError("Order not found. Please check your order number and email address.");
      }
      setLoading(false);
    }, 1500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Package className="h-6 w-6 text-primary" />;
      case "shipped":
        return <Truck className="h-6 w-6 text-primary" />;
      case "delivered":
        return <CheckCircle2 className="h-6 w-6 text-primary" />;
      default:
        return <Package className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Track Your Order</h1>
          <p className="text-muted-foreground text-center mb-8">
            Enter your order details to check the current status
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Order Tracking</CardTitle>
              <CardDescription>
                Please provide your order number and the email address used for the purchase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="orderNumber">Order Number</Label>
                  <Input 
                    id="orderNumber"
                    placeholder="e.g. ORD-123456789"
                    {...register("orderNumber", { 
                      required: "Order number is required" 
                    })}
                  />
                  {errors.orderNumber && (
                    <p className="text-sm text-destructive">{errors.orderNumber.message}</p>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email"
                    type="email"
                    placeholder="e.g. your@email.com"
                    {...register("email", { 
                      required: "Email address is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address"
                      }
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Searching..." : "Track Order"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {loading && (
            <Card className="mt-8">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Separator />
                  <Skeleton className="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {orderFound && !loading && (
            <Card className="mt-8">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">Order {mockOrderData.orderNumber}</h2>
                    <p className="text-muted-foreground">Placed on {mockOrderData.placedDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(mockOrderData.status)}
                    <span className="font-medium">{mockOrderData.statusText}</span>
                  </div>
                </div>
                
                <div className="bg-muted p-4 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Estimated Delivery</p>
                      <p className="text-lg">{mockOrderData.estimatedDelivery}</p>
                    </div>
                    <Button variant="outline" asChild>
                      <a href={mockOrderData.tracking.url} target="_blank" rel="noopener noreferrer">
                        View Carrier Details
                      </a>
                    </Button>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Tracking Information</h3>
                  <div className="border rounded-md divide-y">
                    {mockOrderData.tracking.events.map((event, index) => (
                      <div key={index} className="p-3">
                        <p className="font-medium">{event.status}</p>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{event.date}</span>
                          <span>{event.location}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div>
                  <h3 className="font-medium mb-3">Order Summary</h3>
                  <div className="space-y-4">
                    {mockOrderData.items.map((item, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Quantity: {item.quantity}</span>
                            <span>${item.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div>
                  <h3 className="font-medium mb-3">Shipping Address</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <p>{mockOrderData.shippingAddress.name}</p>
                    <p>{mockOrderData.shippingAddress.street}</p>
                    <p>
                      {mockOrderData.shippingAddress.city}, {mockOrderData.shippingAddress.state} {mockOrderData.shippingAddress.zipCode}
                    </p>
                    <p>{mockOrderData.shippingAddress.country}</p>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={() => setOrderFound(false)}>
                    Track Another Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
} 