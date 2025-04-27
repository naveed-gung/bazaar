import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { ChatAPI } from "@/lib/api";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  products?: any[];
  intent?: string;
  adminData?: {
    type: 'inventory' | 'orders' | 'accounts';
    data: any[];
  };
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Initialize welcome message based on user role
  useEffect(() => {
    // Only set welcome message if no messages exist yet
    if (messages.length === 0) {
      const isAdmin = user?.role === 'admin';
      let welcomeMessage = "Hello! How can I help you today?";
      
      if (isAdmin) {
        welcomeMessage = "Hello admin! I can provide real-time data on inventory, orders, and customer accounts. What would you like to know?";
      } else {
        welcomeMessage = "Hello! I'm your shopping assistant. You can ask me about products, prices, shipping, or get personalized recommendations!";
      }
      
      setMessages([{
        id: "welcome",
        content: welcomeMessage,
        sender: "bot",
        timestamp: new Date(),
      }]);
    }
  }, [user, messages.length]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    
    try {
      // Call chat API with user role context
      const isAdmin = user?.role === 'admin';
      const response = await ChatAPI.sendMessage(inputValue, isAdmin);
      
      // Add bot message with API response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        sender: "bot",
        timestamp: new Date(),
        products: response.data?.products,
        intent: response.intent,
        adminData: response.data?.adminData
      };
      
      setMessages((prev) => [...prev, botMessage]);
      
      // If not found result, suggest alternatives
      if (response.intent === 'product_search' && (!response.data?.products || response.data.products.length === 0)) {
        setTimeout(() => {
          const followUpMessage: Message = {
            id: (Date.now() + 2).toString(),
            content: "Would you like me to suggest some popular products instead?",
            sender: "bot",
            timestamp: new Date()
          };
          setMessages((prev) => [...prev, followUpMessage]);
        }, 1000);
      }
    } catch (error) {
      console.error('Chat API error:', error);
      
      // Add fallback error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I couldn't process your request right now. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: "Chat Error",
        description: "Failed to get a response from the shopping assistant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render product cards for product search results
  const renderProductResults = (message: Message) => {
    if (!message.products || !Array.isArray(message.products) || message.products.length === 0) {
      return null;
    }
    
    const intents = ['product_search', 'recommendation', 'category_search'];
    if (!message.intent || !intents.includes(message.intent)) {
      return null;
    }
    
    return (
      <div className="mt-3 grid grid-cols-1 gap-2 max-w-full overflow-x-auto">
        {message.products.map((product) => (
          <div 
            key={product._id} 
            className="flex flex-row items-center p-2 rounded-md bg-background border"
          >
            {product.images && product.images[0] && (
              <img 
                src={product.images[0]} 
                alt={product.name} 
                className="w-16 h-16 object-cover rounded mr-3"
              />
            )}
            <div className="flex-1 min-w-0">
              <Link to={`/product/${product._id}`} className="font-medium text-primary hover:underline">
                {product.name}
              </Link>
              <div className="text-xs text-muted-foreground truncate">
                {product.description?.substring(0, 60)}...
              </div>
              <div className="flex items-center mt-1">
                <span className="font-semibold">
                  ${product.discountPercentage > 0 
                    ? product.discountedPrice.toFixed(2)
                    : product.price.toFixed(2)
                  }
                </span>
                {product.discountPercentage > 0 && (
                  <span className="ml-2 text-xs line-through text-muted-foreground">
                    ${product.price.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs">
                <span className={cn(
                  "px-2 py-0.5 rounded-full",
                  product.stock > 0 ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                )}>
                  {product.stock > 0 ? `In Stock (${product.stock})` : "Out of Stock"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render admin-specific data (inventory, orders, accounts)
  const renderAdminData = (message: Message) => {
    if (!message.adminData || !user || user.role !== 'admin') {
      return null;
    }
    
    const { type, data } = message.adminData;
    
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    
    // Different rendering based on data type
    switch (type) {
      case 'inventory':
        return (
          <div className="mt-3 overflow-x-auto">
            <div className="text-sm font-medium mb-2">Inventory Status:</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any) => (
                  <tr key={item._id} className="border-b">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2 text-right">{item.stock}</td>
                    <td className="p-2 text-right">
                      <span className={
                        item.stock > 20 ? "text-green-600" : 
                        item.stock > 5 ? "text-amber-600" : 
                        "text-red-600"
                      }>
                        {item.stock > 20 ? "Good" : item.stock > 5 ? "Low" : "Critical"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'orders':
        return (
          <div className="mt-3 overflow-x-auto">
            <div className="text-sm font-medium mb-2">Recent Orders:</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Order ID</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((order: any) => (
                  <tr key={order._id} className="border-b">
                    <td className="p-2">#{order._id.substring(0, 8)}</td>
                    <td className="p-2">{order.user.name}</td>
                    <td className="p-2 text-right">${order.totalPrice.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px]",
                        order.status === 'delivered' ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" : 
                        order.status === 'shipped' ? "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100" :
                        order.status === 'processing' ? "bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100" :
                        order.status === 'cancelled' ? "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" :
                        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                      )}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'accounts':
        return (
          <div className="mt-3 overflow-x-auto">
            <div className="text-sm font-medium mb-2">Recent Customer Accounts:</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-right">Joined</th>
                  <th className="p-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((account: any) => (
                  <tr key={account._id} className="border-b">
                    <td className="p-2">{account.name}</td>
                    <td className="p-2">{account.email}</td>
                    <td className="p-2 text-right">{new Date(account.createdAt).toLocaleDateString()}</td>
                    <td className="p-2 text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px]",
                        account.isActive ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" : 
                        "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                      )}>
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Render product details for single product results
  const renderProductDetails = (message: Message) => {
    if (!message.products || !Array.isArray(message.products)) {
      return null;
    }
    
    const product = message.products[0];
    if (!product) return null;
    
    const intents = ['product_details', 'price_inquiry', 'stock_inquiry'];
    if (!message.intent || !intents.includes(message.intent)) {
      return null;
    }
    
    return (
      <div className="mt-3 p-3 rounded-md bg-background border">
        <div className="flex">
          {product.images && product.images[0] && (
            <img 
              src={product.images[0]} 
              alt={product.name} 
              className="w-20 h-20 object-cover rounded mr-3"
            />
          )}
          <div>
            <Link to={`/product/${product._id}`} className="font-medium text-primary hover:underline">
              {product.name}
            </Link>
            
            <div className="flex items-center mt-1">
              <span className="font-semibold">
                ${product.discountPercentage > 0 
                  ? product.discountedPrice.toFixed(2)
                  : product.price.toFixed(2)
                }
              </span>
              {product.discountPercentage > 0 && (
                <span className="ml-2 text-xs line-through text-muted-foreground">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
            
            <div className="mt-1 text-xs">
              <span className={cn(
                "px-2 py-0.5 rounded-full",
                product.stock > 0 ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
              )}>
                {product.stock > 0 ? `In Stock (${product.stock})` : "Out of Stock"}
              </span>
            </div>
            
            {product.features && product.features.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-medium">Key Features:</span>
                <ul className="list-disc list-inside mt-1">
                  {product.features.slice(0, 3).map((feature: string, index: number) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Button
        onClick={toggleChat}
        className={cn(
          "fixed right-6 bottom-6 rounded-full p-3 shadow-lg z-40 transition-transform hover:scale-105",
          isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="sr-only">{isOpen ? "Close chat" : "Open chat"}</span>
      </Button>

      <div
        className={cn(
          "fixed bottom-20 right-6 w-[350px] max-w-[calc(100vw-2rem)] z-50 rounded-lg shadow-lg border bg-background transition-all duration-300 transform origin-bottom-right",
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Chat Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium">{user?.role === 'admin' ? 'Admin Assistant' : 'Shopping Assistant'}</h3>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleChat}>
            <span className="sr-only">Close chat</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>

        {/* Chat Messages */}
        <div className="p-4 h-[400px] overflow-y-auto flex flex-col gap-3">
          {messages.map((message) => (
            <div key={message.id}>
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-3 animate-fade-in",
                message.sender === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted"
              )}
            >
              {message.content}
              <div className="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              </div>
              
              {/* Render product results if available */}
              {message.sender === "bot" && renderProductResults(message)}
              
              {/* Render product details if available */}
              {message.sender === "bot" && renderProductDetails(message)}
              
              {/* Render admin data if available */}
              {message.sender === "bot" && renderAdminData(message)}
            </div>
          ))}
          
          {isLoading && (
            <div className="mr-auto bg-muted max-w-[80%] rounded-lg p-3 animate-pulse">
              <div className="flex space-x-2">
                <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "600ms" }}></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={user?.role === 'admin' ? "Ask about inventory, orders, customers..." : "Ask about products, shipping, etc..."}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isLoading}
          />
          <Button type="submit" size="sm" disabled={isLoading}>
            Send
          </Button>
        </form>
      </div>
    </>
  );
}
