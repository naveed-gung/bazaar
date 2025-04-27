import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { UserAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  status?: 'active' | 'inactive' | 'suspended';
  ordersCount?: number;
  totalSpent?: number;
}

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch customers data
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        // Fetch real customers from the API
        const response = await UserAPI.getAllUsers();
        setCustomers(response.users.map(user => ({
          ...user,
          status: user.isActive ? 'active' : 'inactive'
        })));
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Error",
          description: "Failed to fetch customer data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchCustomers();
    }
  }, [user]);

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (customerId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      // Convert frontend status to backend isActive property
      const isActive = newStatus === 'active';
      
      // Call API to update user status
      await UserAPI.updateUser(customerId, { 
        isActive: isActive 
      });
      
      // Update UI if successful
      setCustomers(prev => 
        prev.map(customer => 
          customer._id === customerId 
            ? { ...customer, status: newStatus } 
            : customer
        )
      );
      
      toast({
        title: "Status Updated",
        description: `Customer status has been updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating customer status:', error);
      toast({
        title: "Error",
        description: "Failed to update customer status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    
    try {
      // Call the API to delete the customer
      await UserAPI.deleteUser(selectedCustomer._id);
      
      // Update local state
      setCustomers(prev => prev.filter(customer => customer._id !== selectedCustomer._id));
      setIsDeleteDialogOpen(false);
      
      toast({
        title: "Customer Deleted",
        description: `${selectedCustomer.name} has been removed from the system.`,
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <Layout>
      <div className="container py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin" className="hover:text-primary">Dashboard</Link>
            <span>&gt;</span>
            <span>Customers</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Customer Management</h1>
          <p className="text-muted-foreground">View and manage customer information and purchase history.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customer List</CardTitle>
            <Button variant="outline" size="sm">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 4v16m8-8H4" 
                />
              </svg>
              Add Customer
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading customers...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left">Name</th>
                      <th className="py-3 px-4 text-left">Email</th>
                      <th className="py-3 px-4 text-left">Status</th>
                      <th className="py-3 px-4 text-left">Role</th>
                      <th className="py-3 px-4 text-right">Orders</th>
                      <th className="py-3 px-4 text-right">Total Spent</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer._id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{customer.name}</td>
                        <td className="py-3 px-4">{customer.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            customer.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : customer.status === 'inactive'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {customer.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            customer.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {customer.role.charAt(0).toUpperCase() + customer.role.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">{customer.ordersCount || 0}</td>
                        <td className="py-3 px-4 text-right">${customer.totalSpent?.toFixed(2) || '0.00'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/customers/${customer._id}`}>View</Link>
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Customer Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={() => navigate(`/admin/customers/${customer._id}/edit`)}
                                  className="cursor-pointer"
                                >
                                  Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onSelect={() => navigate(`/admin/customers/${customer._id}/orders`)}
                                  className="cursor-pointer"
                                >
                                  View Orders
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                
                                {customer.status !== 'active' && (
                                  <DropdownMenuItem 
                                    onSelect={() => handleStatusChange(customer._id, 'active')} 
                                    className="text-green-600 cursor-pointer"
                                  >
                                    Set as Active
                                  </DropdownMenuItem>
                                )}
                                
                                {customer.status !== 'inactive' && (
                                  <DropdownMenuItem 
                                    onSelect={() => handleStatusChange(customer._id, 'inactive')} 
                                    className="text-gray-600 cursor-pointer"
                                  >
                                    Set as Inactive
                                  </DropdownMenuItem>
                                )}
                                
                                {customer.status !== 'suspended' && (
                                  <DropdownMenuItem 
                                    onSelect={() => handleStatusChange(customer._id, 'suspended')} 
                                    className="text-orange-600 cursor-pointer"
                                  >
                                    Suspend Account
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={() => {
                                    setSelectedCustomer(customer);
                                    setIsDeleteDialogOpen(true);
                                  }} 
                                  className="text-red-600 cursor-pointer"
                                >
                                  Delete Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Customer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedCustomer?.name}? This action cannot be undone and will permanently remove the customer's data from our servers.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteCustomer}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}