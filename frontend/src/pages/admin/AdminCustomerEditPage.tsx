import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UserAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock customer data to match the format used in other admin pages
const MOCK_CUSTOMERS = [
  {
    _id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'customer',
    status: 'active',
    createdAt: new Date(2023, 1, 15).toISOString(),
    ordersCount: 5,
    totalSpent: 435.75,
    phone: '+1 (555) 123-4567',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      country: 'USA'
    }
  },
  {
    _id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'customer',
    status: 'active',
    createdAt: new Date(2023, 2, 22).toISOString(),
    ordersCount: 8,
    totalSpent: 782.50,
    phone: '+1 (555) 987-6543',
    address: {
      street: '456 Oak Ave',
      city: 'Somewhere',
      state: 'NY',
      zip: '67890',
      country: 'USA'
    }
  },
  {
    _id: '3',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: new Date(2022, 10, 5).toISOString(),
    ordersCount: 0,
    totalSpent: 0,
    phone: '+1 (555) 111-2222',
    address: {
      street: '789 Admin Blvd',
      city: 'Adminville',
      state: 'CA',
      zip: '54321',
      country: 'USA'
    }
  },
  {
    _id: '4',
    name: 'Robert Johnson',
    email: 'robert@example.com',
    role: 'customer',
    status: 'inactive',
    createdAt: new Date(2023, 4, 3).toISOString(),
    ordersCount: 2,
    totalSpent: 156.25,
    phone: '+1 (555) 333-4444',
    address: {
      street: '567 Pine St',
      city: 'Elsewhere',
      state: 'TX',
      zip: '34567',
      country: 'USA'
    }
  },
  {
    _id: '5',
    name: 'Emily Davis',
    email: 'emily@example.com',
    role: 'customer',
    status: 'suspended',
    createdAt: new Date(2023, 3, 18).toISOString(),
    ordersCount: 1,
    totalSpent: 99.99,
    phone: '+1 (555) 555-5555',
    address: {
      street: '321 Maple Dr',
      city: 'Springfield',
      state: 'IL',
      zip: '78901',
      country: 'USA'
    }
  }
];

export default function AdminCustomerEditPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: ''
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
          
          // Set form data
          setFormData({
            name: foundCustomer.name,
            email: foundCustomer.email,
            phone: foundCustomer.phone || '',
            role: foundCustomer.role,
            status: foundCustomer.status,
            street: foundCustomer.address?.street || '',
            city: foundCustomer.address?.city || '',
            state: foundCustomer.address?.state || '',
            zip: foundCustomer.address?.zip || '',
            country: foundCustomer.address?.country || ''
          });
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle dropdown changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Create updated customer object
      const updatedCustomer = {
        ...customer,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        status: formData.status,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          country: formData.country
        }
      };
      
      // In a real app, this would be an API call
      // await UserAPI.updateUser(id, updatedCustomer);
      
      toast({
        title: "Customer Updated",
        description: "Customer information has been updated successfully.",
      });
      
      // Navigate back to customer details
      navigate(`/admin/customers/${id}`);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
            <span>Edit</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold">Edit Customer</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/admin/customers/${id}`)}>
                Cancel
              </Button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => handleSelectChange('role', value)}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleSelectChange('status', value)}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="street">Street Address</Label>
                  <Input 
                    id="street" 
                    name="street" 
                    value={formData.street} 
                    onChange={handleInputChange} 
                  />
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      name="city" 
                      value={formData.city} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="state">State/Province</Label>
                    <Input 
                      id="state" 
                      name="state" 
                      value={formData.state} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="zip">ZIP/Postal Code</Label>
                    <Input 
                      id="zip" 
                      name="zip" 
                      value={formData.zip} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input 
                      id="country" 
                      name="country" 
                      value={formData.country} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(`/admin/customers/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
} 