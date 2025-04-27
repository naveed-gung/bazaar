import { useState, useEffect, MutableRefObject } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { UserAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { createRoot } from 'react-dom/client'
import { getAuth } from "firebase/auth";

interface UserPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingNotifications: boolean;
  language: string;
  currency: string;
}

const getBrowserName = () => {
  const userAgent = navigator.userAgent;
  if (userAgent.includes("Firefox")) return "Firefox Browser";
  if (userAgent.includes("Chrome")) return "Chrome Browser";
  if (userAgent.includes("Safari")) return "Safari Browser";
  if (userAgent.includes("Edge")) return "Edge Browser";
  if (userAgent.includes("Opera")) return "Opera Browser";
  return "Other Browser";
};

const getDeviceInfo = () => {
  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  
  if (isMobile) {
    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("iPad")) return "iPad";
    if (userAgent.includes("Android")) return "Android Device";
    return "Mobile Device";
  }
  
  if (platform.includes("Win")) return "Windows PC";
  if (platform.includes("Mac")) return "Mac";
  if (platform.includes("Linux")) return "Linux";
  return platform;
};

// Convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailNotifications: true,
    smsNotifications: false,
    marketingNotifications: true,
    language: "en",
    currency: "usd"
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile section animations with proper ref typing
  const headerRef = useScrollAnimation({ type: 'right', animateOut: true }) as MutableRefObject<HTMLDivElement>;
  const profileFormRef = useScrollAnimation({ type: 'right', animateOut: true, delay: 100 }) as MutableRefObject<HTMLDivElement>;
  const securityRef = useScrollAnimation({ type: 'left', animateOut: true }) as MutableRefObject<HTMLDivElement>;

  // Ref-callbacks with proper typing
  const headerRefCallback = (node: HTMLDivElement | null) => {
    if (!headerRef) return;
    if ('current' in headerRef) {
      headerRef.current = node;
    }
  };

  const profileFormRefCallback = (node: HTMLDivElement | null) => {
    if (!profileFormRef) return;
    if ('current' in profileFormRef) {
      profileFormRef.current = node;
    }
  };

  const securityRefCallback = (node: HTMLDivElement | null) => {
    if (!securityRef) return;
    if ('current' in securityRef) {
      securityRef.current = node;
    }
  };

  // Load user data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.addresses?.[0]?.street || "",
        city: user.addresses?.[0]?.city || "",
        state: user.addresses?.[0]?.state || "",
        zipCode: user.addresses?.[0]?.zipCode || "",
      });
      
      if (user.preferences) {
        setPreferences(user.preferences);
      }
    }
  }, [user]);

  // Handle avatar change with preview and validation
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Image size should be less than 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      
      // Auto-save the avatar if we're in edit mode
      if (isEditing) {
        setLoading(true);
        try {
          const avatarBase64 = await fileToBase64(file);
          const response = await UserAPI.updateUserProfile({
            avatar: avatarBase64
          });
          
          if (response && response.user) {
            updateUser(response.user);
            toast({
              title: "Profile Picture Updated",
              description: "Your profile picture has been updated successfully.",
            });
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to update profile picture. Please try again.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let avatarBase64 = "";
      if (avatarFile) {
        avatarBase64 = await fileToBase64(avatarFile);
      }

      const response = await UserAPI.updateUserProfile({
        name: formData.name,
        phone: formData.phone,
        avatar: avatarBase64 || undefined,
      });

      // Update address if it exists
      if (user?.addresses?.length) {
        await UserAPI.updateUserAddress(user.addresses[0]._id, {
          street: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: "US", // Default to US for now
          isDefault: true
        });
      } else {
        await UserAPI.addUserAddress({
          street: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: "US",
          isDefault: true
        });
      }

      // Make sure we're updating with the full user object
      if (response && response.user) {
        updateUser(response.user);
      }
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    const currentPassword = (form.elements.namedItem('current-password') as HTMLInputElement).value;
    const newPassword = (form.elements.namedItem('new-password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirm-password') as HTMLInputElement).value;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await UserAPI.changePassword({
        currentPassword,
        newPassword
      });

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle preference updates
  const handlePreferenceChange = async (key: keyof UserPreferences, value: boolean | string) => {
    try {
      const updatedPreferences = { ...preferences, [key]: value };
      setPreferences(updatedPreferences);
      
      await UserAPI.updateUserProfile({
        preferences: updatedPreferences
      });

      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update preferences.",
        variant: "destructive",
      });
      // Revert the change
      setPreferences(preferences);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Error",
        description: "Please type DELETE to confirm account deletion",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Get the current Firebase user and token
      const firebaseUser = getAuth().currentUser;
      
      if (!firebaseUser) {
        throw new Error("No user is currently logged in");
      }
      
      // Delete from our backend first (which will handle MongoDB deletion)
      await UserAPI.deleteUserAccount();
      
      // Then delete the Firebase account
      await firebaseUser.delete();
      
      // Clear local state and storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
      
      // Navigate to login
      navigate("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="container py-10">
        <div className="max-w-5xl mx-auto">
          <div ref={headerRefCallback} className="flex items-center space-x-4 mb-8">
            <div className="relative group">
              <Avatar className="w-16 h-16 ring-2 ring-offset-2 ring-primary/10">
                {user?.avatar || avatarPreview ? (
                  <AvatarImage 
                    src={avatarPreview || user?.avatar} 
                    alt={user?.name || 'Profile'} 
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                )}
              </Avatar>
              {isEditing && (
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                >
                  <Badge variant="secondary" className="pointer-events-none">
                    Change
                  </Badge>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            
            <div>
              <h1 className="text-2xl font-bold">{user?.name}</h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          
          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid grid-cols-3 max-w-md">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>
            
            <TabsContent value="account" className="space-y-6">
              <div ref={profileFormRefCallback} className="bg-card border rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-medium">Personal Information</h2>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(!isEditing)}
                    disabled={loading}
                  >
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </Button>
                </div>
                
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="fullname">Full Name</label>
                      <Input 
                        id="fullname"
                        name="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        disabled={!isEditing || loading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="email">Email</label>
                      <Input 
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled={true} // Email cannot be changed
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="phone">Phone Number</label>
                      <Input 
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!isEditing || loading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="address">Address</label>
                    <Input 
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      disabled={!isEditing || loading}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="city">City</label>
                      <Input 
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        disabled={!isEditing || loading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="state">State</label>
                      <Input 
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        disabled={!isEditing || loading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="zip">Zip Code</label>
                      <Input 
                        id="zip"
                        value={formData.zipCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                        disabled={!isEditing || loading}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    {isEditing && (
                      <Button type="submit" disabled={loading}>
                        {loading ? "Saving Changes..." : "Save Changes"}
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
              <div ref={securityRefCallback} className="bg-card border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-medium mb-6">Change Password</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="current-password">Current Password</label>
                    <Input id="current-password" type="password" name="current-password" required />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="new-password">New Password</label>
                    <Input id="new-password" type="password" name="new-password" required minLength={6} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="confirm-password">Confirm New Password</label>
                    <Input id="confirm-password" type="password" name="confirm-password" required minLength={6} />
                  </div>
                  
                  <div className="pt-4">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Updating Password..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </div>
              
              <div className="bg-card border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-medium mb-4">Active Sessions</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {navigator.userAgent.toLowerCase().includes('firefox') ? (
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        ) : navigator.userAgent.toLowerCase().includes('chrome') ? (
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                        ) : (
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                        )}
                      </svg>
                      <div>
                        <p className="font-medium">{getBrowserName()}</p>
                        <p className="text-sm text-muted-foreground">{getDeviceInfo()}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" disabled>Current</Button>
                  </div>
                </div>
              </div>
              
              {/* Show Delete Account section only for customers, not admins */}
              {user?.role !== 'admin' && (
                <div className="bg-card border rounded-lg p-6 shadow-sm mt-6">
                  <h2 className="text-xl font-medium mb-4">Delete Account</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  
                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Delete Account</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Delete Account</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. This will permanently delete your account, orders, and personal data.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="py-4">
                        <p className="text-sm font-medium mb-2">
                          Please type <span className="font-bold">DELETE</span> to confirm:
                        </p>
                        <Input
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          className="mb-4"
                          placeholder="Type DELETE to confirm"
                        />
                      </div>
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleAccountDeletion}
                          disabled={deleteConfirmation !== "DELETE"}
                        >
                          Delete Account
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="preferences" className="space-y-6">
              <div className="bg-card border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-medium mb-6">Notification Settings</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive order updates and promotions</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        id="email-notify" 
                        checked={preferences.emailNotifications}
                        onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive order status via text</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        id="sms-notify"
                        checked={preferences.smsNotifications}
                        onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Marketing Communications</p>
                      <p className="text-sm text-muted-foreground">Receive promotions and newsletters</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        id="marketing-notify"
                        checked={preferences.marketingNotifications}
                        onChange={(e) => handlePreferenceChange('marketingNotifications', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-medium mb-4">Language & Region</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="language">Language</label>
                    <select 
                      id="language" 
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={preferences.language}
                      onChange={(e) => handlePreferenceChange('language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="currency">Currency</label>
                    <select 
                      id="currency" 
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={preferences.currency}
                      onChange={(e) => handlePreferenceChange('currency', e.target.value)}
                    >
                      <option value="usd">USD ($)</option>
                      <option value="eur">EUR (€)</option>
                      <option value="gbp">GBP (£)</option>
                      <option value="jpy">JPY (¥)</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}