import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { storeService } from '../lib/store';
import { StoreItem, BalanceSummary } from '../types';
import { useAuth } from '../state/useAuth';

const StoreItemsScreen = () => {
  const { serverId, categoryId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('coins');
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!serverId || !categoryId) return;
      
      try {
        setLoading(true);
        
        // Load items and balance in parallel
        const [itemList, balanceData] = await Promise.all([
          storeService.getItemsByCategory(serverId, categoryId),
          storeService.getBalance(serverId, user?.ign || 'test')
        ]);
        
        setItems(itemList);
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
  }, [serverId, categoryId, toast]);

  const calculateBalance = (item: StoreItem, qty: number): BalanceSummary => {
    const totalCost = item.price * qty;
    return {
      current: balance,
      afterPurchase: balance - totalCost,
      currency: currency
    };
  };

  const handlePurchase = async (item: StoreItem) => {
    if (!serverId) return;

    const totalCost = item.price * quantity;
    
    if (totalCost > balance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough ${currency} for this purchase`,
        variant: "destructive"
      });
      return;
    }

    try {
      setPurchasing(true);
      const result = await storeService.purchaseItem(serverId, item.id, quantity);
      
      if (result.success) {
        toast({
          title: "Purchase Successful! 🎉",
          description: result.message,
        });
        
        // Refresh balance after successful purchase
        const balanceData = await storeService.getBalance(serverId, user?.ign || 'test');
        setBalance(balanceData.balance);
        
        setSelectedItem(null);
        setQuantity(1);
      } else {
        toast({
          title: "Purchase Failed",
          description: "Something went wrong with your purchase",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Purchase Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleCancel = () => {
    setSelectedItem(null);
    setQuantity(1);
    
    toast({
      title: "Purchase Cancelled",
      description: "No charges were made to your account"
    });
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
              onClick={() => navigate(`/server/${serverId}/store`)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Categories
            </Button>
            
            <div className="flex-1">
              <h1 className="gaming-header text-xl">Store Items</h1>
              <p className="text-muted-foreground text-sm">
                Select items to purchase
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
        <div className="max-w-6xl mx-auto">

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="gaming-card animate-pulse">
                  <div className="aspect-square bg-muted/20 rounded-t-xl"></div>
                  <CardHeader>
                    <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                    <div className="h-3 bg-muted/20 rounded w-1/2"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="gaming-card max-w-md mx-auto p-8">
                <div className="text-muted-foreground mb-4">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No items available</h3>
                <p className="text-muted-foreground">
                  This category doesn't have any items yet
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((item) => (
                <Card key={item.id} className="gaming-card-interactive">
                  {/* Item Image */}
                  <div className="aspect-square relative overflow-hidden rounded-t-xl">
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-gaming flex items-center justify-center">
                        <Package className="w-12 h-12 text-white/80" />
                      </div>
                    )}
                    
                    {/* Price Badge */}
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-black/70 text-white">
                        {item.price} {currency}
                      </Badge>
                    </div>
                  </div>

                  {/* Item Info */}
                  <CardHeader className="pb-3">
                    <CardTitle className="line-clamp-1 text-lg">{item.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {item.shortName}
                    </CardDescription>
                  </CardHeader>

                  {/* Purchase Button */}
                  <CardContent className="pt-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          className="w-full btn-gaming"
                          onClick={() => setSelectedItem(item)}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Buy Now
                        </Button>
                      </DialogTrigger>
                      
                      {selectedItem?.id === item.id && (
                        <DialogContent className="gaming-card border-0">
                          <DialogHeader>
                            <DialogTitle>Confirm Purchase</DialogTitle>
                            <DialogDescription>
                              You are about to purchase {selectedItem.name}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            {/* Quantity Selection */}
                            <div className="space-y-2">
                              <Label htmlFor="quantity">Quantity</Label>
                              <Input
                                id="quantity"
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                min={1}
                                max={Math.floor(balance / selectedItem.price)}
                                className="gaming-input"
                              />
                            </div>
                            
                            {/* Balance Summary */}
                            <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                              <div className="flex justify-between text-sm">
                                <span>Item Cost:</span>
                                <span>{selectedItem.price} {currency} each</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Quantity:</span>
                                <span>{quantity}</span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold">
                                <span>Total Cost:</span>
                                <span className="text-primary">{selectedItem.price * quantity} {currency}</span>
                              </div>
                              <hr className="border-border" />
                              <div className="flex justify-between text-sm">
                                <span>Balance before:</span>
                                <span>{balance.toLocaleString()} {currency}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Balance after:</span>
                                <span className={calculateBalance(selectedItem, quantity).afterPurchase < 0 ? 'text-red-400' : 'text-green-400'}>
                                  {calculateBalance(selectedItem, quantity).afterPurchase.toLocaleString()} {currency}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <DialogFooter className="gap-2">
                            <Button
                              variant="outline"
                              onClick={handleCancel}
                              className="btn-gaming-secondary"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handlePurchase(selectedItem)}
                              disabled={purchasing || calculateBalance(selectedItem, quantity).afterPurchase < 0}
                              className="btn-gaming"
                            >
                              {purchasing ? (
                                <div className="loading-spinner w-4 h-4 mr-2"></div>
                              ) : (
                                <ShoppingCart className="w-4 h-4 mr-2" />
                              )}
                              {purchasing ? 'Processing...' : 'Confirm Purchase'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      )}
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StoreItemsScreen;