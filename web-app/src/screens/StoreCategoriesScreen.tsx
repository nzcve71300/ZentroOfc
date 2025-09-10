import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Store, Package, Truck, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { storeService } from '../lib/store';
import { Category } from '../types';
import { useAuth } from '../state/useAuth';

const StoreCategoriesScreen = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('coins');

  useEffect(() => {
    const loadData = async () => {
      if (!serverId) return;
      
      try {
        setLoading(true);
        
        // Load categories and balance in parallel
        const [categoryList, balanceData] = await Promise.all([
          storeService.getCategories(serverId),
          storeService.getBalance(serverId, user?.ign || 'test')
        ]);
        
        setCategories(categoryList);
        setBalance(balanceData.balance);
        setCurrency(balanceData.currency);
      } catch (error) {
        toast({
          title: "Failed to load store data",
          description: "Please try again later",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [serverId, toast]);

  const getCategoryIcon = (type: Category['type']) => {
    switch (type) {
      case 'item':
        return Package;
      case 'kit':
        return Wrench;
      case 'vehicle':
        return Truck;
      default:
        return Package;
    }
  };

  const getCategoryColor = (type: Category['type']) => {
    switch (type) {
      case 'item':
        return 'text-blue-400';
      case 'kit':
        return 'text-green-400';
      case 'vehicle':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/server/${serverId}`)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hub
            </Button>
            
            <div className="flex-1">
              <h1 className="gaming-header text-xl">Server Store</h1>
              <p className="text-muted-foreground text-sm">
                Browse categories and purchase items
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Balance</div>
              <div className="font-semibold text-primary">
                {balance.toLocaleString()} {currency}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Store Info */}
          <Card className="gaming-card mb-8">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Welcome to the Store</CardTitle>
                  <CardDescription>
                    Purchase items, kits, and vehicles to enhance your gameplay
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Categories */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Categories</h2>
              <Badge variant="secondary">
                {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
              </Badge>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="gaming-card animate-pulse">
                    <CardHeader>
                      <div className="w-12 h-12 bg-muted/20 rounded-full mb-4"></div>
                      <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/2"></div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12">
                <div className="gaming-card max-w-md mx-auto p-8">
                  <div className="text-muted-foreground mb-4">
                    <Store className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No categories available</h3>
                  <p className="text-muted-foreground">
                    The server administrator hasn't set up any store categories yet
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => {
                  const IconComponent = getCategoryIcon(category.type);
                  const iconColor = getCategoryColor(category.type);
                  
                  return (
                    <Card
                      key={category.id}
                      className="gaming-card-interactive cursor-pointer group"
                      onClick={() => navigate(`/server/${serverId}/store/${category.id}`)}
                    >
                      <CardHeader className="text-center pb-6">
                        <div className="mx-auto mb-4 p-4 rounded-full bg-gaming-surface group-hover:bg-primary/10 transition-colors">
                          <IconComponent className={`w-8 h-8 ${iconColor} group-hover:text-primary transition-colors`} />
                        </div>
                        
                        <div>
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <CardDescription>
                            <Badge variant="outline" className="mt-2">
                              {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                            </Badge>
                          </CardDescription>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <Button
                          className="w-full btn-gaming-secondary group-hover:btn-gaming"
                          variant="outline"
                        >
                          Browse Items
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Store Rules */}
          <Card className="gaming-card mt-12">
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• All purchases are processed instantly</p>
              <p>• Items will be delivered to your in-game inventory</p>
              <p>• Make sure you have enough inventory space before purchasing</p>
              <p>• All sales are final - no refunds available</p>
              <p>• Contact server administrators if you encounter any issues</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StoreCategoriesScreen;