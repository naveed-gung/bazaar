import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Mock customer data to match the format used in other admin pages
const MOCK_CUSTOMERS = [
  {
    _id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'customer',
    status: 'active',
  },
  {
    _id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'customer',
    status: 'active',
  },
  {
    _id: '3',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
  },
  {
    _id: '4',
    name: 'Robert Johnson',
    email: 'robert@example.com',
    role: 'customer',
    status: 'inactive',
  },
  {
    _id: '5',
    name: 'Emily Davis',
    email: 'emily@example.com',
    role: 'customer',
    status: 'suspended',
  }
];

export default function AdminCustomerMessagePage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    sendCopy: false
  });

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch customer data
  useEffect(() => {
    const fetchCustomerData = () => {
      setLoading(true);
      try {
        // Find the customer by ID from mock data
        const foundCustomer = MOCK_CUSTOMERS.find(c => c._id === id);
        
        if (foundCustomer) {
          setCustomer(foundCustomer);
        } else {
          // If customer not found, show error and navigate back
          toast({
            title: "Customer Not Found",
            description: "The requested customer could not be found.",
            variant: "destructive",
          });
          navigate("/admin/customers");
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
        toast({
          title: "Error",
          description: "Failed to load customer details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin' && id) {
      fetchCustomerData();
    }
  }, [id, user, navigate, toast]);

  // Handle form changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle switch change
  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sendCopy: checked
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    try {
      // In a real app, this would send an email via the API
      // await UserAPI.sendCustomerEmail(id, formData.subject, formData.message, formData.sendCopy);
      
      // Simulate API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Message Sent",
        description: `Your message has been sent to ${customer.name}.`,
      });
      
      // Navigate back to customer details
      navigate(`/admin/customers/${id}`);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="container py-16">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!customer) {
    return (
      <Layout>
        <div className="container py-16">
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-2">Customer Not Found</h2>
            <p className="text-muted-foreground mb-4">The customer you're looking for doesn't exist or has been removed.</p>
            <Button asChild>
              <Link to="/admin/customers">Return to Customers</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:text-primary">Dashboard</Link>
            <span>&gt;</span>
            <Link to="/admin/customers" className="hover:text-primary">Customers</Link>
            <span>&gt;</span>
            <Link to={`/admin/customers/${id}`} className="hover:text-primary">{customer.name}</Link>
            <span>&gt;</span>
            <span>Send Message</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold">Send Message to Customer</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/admin/customers/${id}`)}>
                Cancel
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient</Label>
                  <Input 
                    id="recipient" 
                    value={`${customer.name} <${customer.email}>`}
                    disabled
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    name="subject" 
                    value={formData.subject} 
                    onChange={handleInputChange} 
                    placeholder="Enter message subject"
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea 
                    id="message" 
                    name="message" 
                    value={formData.message} 
                    onChange={handleInputChange} 
                    placeholder="Type your message here..."
                    rows={10}
                    required 
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="sendCopy" 
                    checked={formData.sendCopy}
                    onCheckedChange={handleSwitchChange}
                  />
                  <Label htmlFor="sendCopy">Send me a copy of this message</Label>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(`/admin/customers/${id}`)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sending}>
                    {sending ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 