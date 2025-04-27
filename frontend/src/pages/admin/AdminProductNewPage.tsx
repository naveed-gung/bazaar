import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useEffect } from "react";
import { CategoryAPI, ProductAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function AdminProductNewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    stock: "10",
    images: [] as File[],
    featured: false,
    published: true,
  });
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    CategoryAPI.getAllCategories().then(res => {
      setCategories(res.categories || []);
    }).catch(error => {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories. Please try again.",
        variant: "destructive"
      });
    });
  }, []);

  // Scroll animations
  const headerRef = useScrollAnimation({ type: 'slide-right', animateOut: true });
  const formRef = useScrollAnimation({ type: 'slide-left', animateOut: true, threshold: 0.1 });

  // Ref-callbacks to avoid "Unexpected ref object provided" warning
  const headerRefCallback = (node: HTMLDivElement | null) => {
    if (headerRef && typeof headerRef === 'function') headerRef(node);
    else if (headerRef && 'current' in headerRef) (headerRef as any).current = node;
  };
  const formRefCallback = (node: HTMLFormElement | null) => {
    if (formRef && typeof formRef === 'function') formRef(node);
    else if (formRef && 'current' in formRef) (formRef as any).current = node;
  };

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : value
    }));
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

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newImageUrls = filesArray.map(file => URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...filesArray]
      }));
      setImagePreviewUrls(prev => [...prev, ...newImageUrls]);
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);

    const newImageUrls = [...imagePreviewUrls];
    URL.revokeObjectURL(newImageUrls[index]); // Free memory
    newImageUrls.splice(index, 1);

    setFormData(prev => ({
      ...prev,
      images: newImages
    }));

    setImagePreviewUrls(newImageUrls);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate required fields
      if (!formData.category) {
        throw new Error("Please select a category");
      }
      
      if (formData.images.length === 0) {
        throw new Error("Please upload at least one product image");
      }
      
      // Convert images to Base64
      const imagesBase64 = await Promise.all(
        formData.images.map(file => fileToBase64(file))
      );
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        images: imagesBase64,
      };
      
      console.log('Creating product with payload:', payload);
      await ProductAPI.createProduct(payload);
      toast({ title: "Product created!", description: "The product was added successfully." });
      // Optionally: refetch products list or redirect
      navigate("/admin/products");
    } catch (err: any) {
      console.error('Error creating product:', err);
      toast({ 
        title: "Error", 
        description: err.message || "Failed to create product. Please check all required fields.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      setFormData({
        name: "",
        price: "",
        category: "",
        description: "",
        stock: "10",
        images: [],
        featured: false,
        published: true,
      });
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setImagePreviewUrls([]);
    }
  };

  // Redirect if not an admin
  if (!user || user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <div className="container py-10">
        <div ref={headerRefCallback} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Add New Product</h1>
              <p className="text-muted-foreground">
                Create a new product to add to your inventory
              </p>
            </div>
          </div>
        </div>

        <form id="product-form" ref={formRefCallback} onSubmit={handleSubmit} className="space-y-8">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="bg-card p-6 border rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Enter product name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        value={formData.price}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      name="category"
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <div className="flex items-center space-x-4 pt-2">
                      <div className="flex items-center">
                        <input
                          id="published"
                          name="published"
                          type="checkbox"
                          checked={formData.published}
                          onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="published" className="ml-2 text-sm">Published</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="featured"
                          name="featured"
                          type="checkbox"
                          checked={formData.featured}
                          onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="featured" className="ml-2 text-sm">Featured</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={6}
                      placeholder="Enter product description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="images" className="space-y-6">
              <div className="bg-card p-6 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">Product Images</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="images">Upload Images</Label>
                    <Input
                      id="images"
                      name="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-muted-foreground">
                      You can upload multiple images. Recommended size: 1000x1000px.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Image Preview</Label>
                    {imagePreviewUrls.length === 0 ? (
                      <div className="border-2 border-dashed border-muted rounded-lg p-12 text-center">
                        <p className="text-muted-foreground">No images uploaded yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {imagePreviewUrls.map((url, index) => (
                          <div key={index} className="relative">
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="h-24 w-24 object-cover rounded-md border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground h-6 w-6 rounded-full flex items-center justify-center text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="inventory" className="space-y-6">
              <div className="bg-card p-6 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">Inventory Management</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      name="sku"
                      placeholder="Enter SKU"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode (UPC, EAN)</Label>
                    <Input
                      id="barcode"
                      name="barcode"
                      placeholder="Enter barcode"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="backorder">Allow Backorders</Label>
                    <Select defaultValue="no">
                      <SelectTrigger>
                        <SelectValue placeholder="Backorder policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Do not allow</SelectItem>
                        <SelectItem value="notify">Allow, but notify customer</SelectItem>
                        <SelectItem value="yes">Allow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="shipping" className="space-y-6">
              <div className="bg-card p-6 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">Shipping Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (lbs)</Label>
                    <Input
                      id="weight"
                      name="weight"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dimensions">Dimensions (inches)</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Length" />
                      <Input placeholder="Width" />
                      <Input placeholder="Height" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="shipping_class">Shipping Class</Label>
                    <Select defaultValue="standard">
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="express">Express</SelectItem>
                        <SelectItem value="free">Free Shipping</SelectItem>
                        <SelectItem value="bulky">Bulky Items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="seo" className="space-y-6">
              <div className="bg-card p-6 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">SEO Settings</h3>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="meta_title">Meta Title</Label>
                    <Input
                      id="meta_title"
                      name="meta_title"
                      placeholder="Enter meta title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="meta_description">Meta Description</Label>
                    <Textarea
                      id="meta_description"
                      name="meta_description"
                      rows={3}
                      placeholder="Enter meta description"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="meta_keywords">Meta Keywords</Label>
                    <Input
                      id="meta_keywords"
                      name="meta_keywords"
                      placeholder="Enter keywords separated by commas"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button">Cancel</Button>
            <Button type="submit">Save Product</Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}