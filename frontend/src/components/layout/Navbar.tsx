import { Link } from "react-router-dom";
import { ShoppingCart, User, Menu, Sun, Moon, Search, LogOut, Settings, ShoppingBag, UserCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/hooks/use-favorites";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Product = {
  _id: string;
  name: string;
  price: number;
  images: string[];
};

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { favoritesCount } = useFavorites();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleUserDropdown = () => setIsUserDropdownOpen(!isUserDropdownOpen);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  // Debounced search function
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/products/search?q=${searchQuery}`);
          const data = await response.json();
          setSearchResults(data.products || []);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Check if user is admin
  const isAdmin = user && user.role === "admin";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link 
            to="/" 
            className="flex items-center space-x-2 transition-transform hover:scale-105"
          >
            <span className="text-xl font-bold text-gradient animate-pulse">Bazaar</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium transition-all hover:text-primary hover:scale-105">
              Home
            </Link>
            <Link to="/products" className="text-sm font-medium transition-all hover:text-primary hover:scale-105">
              Shop
            </Link>
            <Link to="/about" className="text-sm font-medium transition-all hover:text-primary hover:scale-105">
              About
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div ref={searchRef} className="hidden sm:flex relative rounded-md">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input 
                type="search" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] rounded-md border border-input bg-background pl-8 pr-4 py-2 text-sm transition-all focus:w-[300px] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </form>
            
            {/* Search Results Dropdown */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="absolute top-full left-0 right-0 mt-2 max-h-[300px] overflow-y-auto rounded-md border bg-background shadow-lg">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((product) => (
                      <Link
                        key={product._id}
                        to={`/products/${product._id}`}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                      >
                        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.png';
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">${product.price.toFixed(2)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:scale-110 transition-transform"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 animate-spin-slow" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Show cart and favorites icons for non-admin users */}
          {!isAdmin && (
            <>
              <Link to="/favorites">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full relative hover:scale-110 transition-transform"
                >
                  <Heart className="h-5 w-5" />
                  {favoritesCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center animate-bounce-subtle">
                      {favoritesCount}
                    </span>
                  )}
                </Button>
              </Link>
              
              <Link to="/cart">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full relative hover:scale-110 transition-transform"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center animate-bounce-subtle">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            </>
          )}

          {user ? (
            <div ref={dropdownRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:scale-110 transition-transform"
                onClick={toggleUserDropdown}
              >
                {user.avatar ? (
                  <img 
                    src={user.avatar}
                    alt={user.name || "User avatar"}
                    className="h-8 w-8 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/user-placeholder.png';
                    }}
                  />
                ) : (
                  <UserCircle className="h-6 w-6" />
                )}
              </Button>
              
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-background border border-border overflow-hidden animate-scale-in z-50">
                  <div className="p-3 border-b border-border bg-muted/30">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link 
                      to="/profile" 
                      className="flex items-center px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      <UserCircle className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                    {!isAdmin && (
                      <Link 
                        to="/orders" 
                        className="flex items-center px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        My Orders
                      </Link>
                    )}
                    {isAdmin && (
                      <>
                        <Link 
                          to="/admin" 
                          className="flex items-center px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => setIsUserDropdownOpen(false)}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                        <Link 
                          to="/admin/products/new" 
                          className="flex items-center px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => setIsUserDropdownOpen(false)}
                        >
                          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add New Product
                        </Link>
                      </>
                    )}
                    <button 
                      onClick={() => {
                        logout();
                        setIsUserDropdownOpen(false);
                      }} 
                      className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login">
              <Button 
                variant="ghost" 
                className="hidden md:flex hover:scale-105 transition-transform"
              >
                Sign In
              </Button>
            </Link>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden hover:scale-110 transition-transform" 
            onClick={toggleMenu}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu with futuristic animation */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-lg z-50 transform transition-all duration-500 md:hidden",
          isMenuOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        )}
      >
        <div className="container pt-20 pb-6 flex flex-col h-full">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4" 
            onClick={toggleMenu}
          >
            <span className="sr-only">Close</span>
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
              className="h-6 w-6"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
          <nav className="flex flex-col gap-4">
            <Link to="/" className="text-lg font-medium px-2 py-2" onClick={toggleMenu}>
              Home
            </Link>
            <Link to="/products" className="text-lg font-medium px-2 py-2" onClick={toggleMenu}>
              Shop
            </Link>
            <Link to="/about" className="text-lg font-medium px-2 py-2" onClick={toggleMenu}>
              About
            </Link>
            
            {!user && (
              <Link to="/login" onClick={toggleMenu}>
                <Button className="w-full mt-4">Sign In</Button>
              </Link>
            )}
          </nav>
          
          {user && (
            <div className="mt-auto border-t pt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {isAdmin && (
                  <>
                    <Link to="/admin" className="block py-2" onClick={toggleMenu}>
                      Admin Dashboard
                    </Link>
                    <Link to="/admin/products/new" className="block py-2" onClick={toggleMenu}>
                      Add New Product
                    </Link>
                  </>
                )}
                <Link to="/profile" className="block py-2" onClick={toggleMenu}>
                  Profile
                </Link>
                {!isAdmin && (
                  <Link to="/orders" className="block py-2" onClick={toggleMenu}>
                    Orders
                  </Link>
                )}
                <Button variant="ghost" className="w-full justify-start pl-0 hover:bg-transparent" 
                  onClick={() => {
                    logout();
                    toggleMenu();
                  }}
                >
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
