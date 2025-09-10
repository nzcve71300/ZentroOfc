import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, Plus, Trash2, Edit, Lock, Server as ServerIcon, Store, Package, Clock, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { serverService } from '../lib/servers-api';
import { storeService } from '../lib/store';
import { useServers } from '../state/useServers';
import { useStoreConfig } from '../state/useStoreConfig';
import { Server, Category, CategoryForm, StoreItem } from '../types';

const ServerSettingsScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { servers } = useServers();
  const { categories, setCategories } = useStoreConfig();
  
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: '', type: 'item' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Item management state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemForm, setItemForm] = useState({
    displayName: '',
    shortName: '',
    price: 0,
    quantity: 1,
    timerMinutes: 0
  });
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);

  useEffect(() => {
    if (servers.length === 1) {
      setSelectedServer(servers[0]);
      loadCategories(servers[0].id);
    }
  }, [servers]);

  const loadCategories = async (serverId: string) => {
    try {
      setLoading(true);
      const categoryList = await storeService.getCategories(serverId);
      setCategories(categoryList);
    } catch (error) {
      toast({
        title: "Failed to load categories",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServerSelect = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setSelectedServer(server);
      loadCategories(serverId);
      setSelectedCategory(''); // Reset category selection
      setItems([]); // Clear items
    }
  };

  // Load items for selected category
  const loadItems = async (serverId: string, categoryId: string) => {
    try {
      setItemsLoading(true);
      const itemList = await storeService.getItemsByCategory(serverId, categoryId);
      setItems(itemList);
    } catch (error) {
      toast({
        title: "Failed to load items",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setItemsLoading(false);
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (selectedServer && categoryId) {
      loadItems(selectedServer.id, categoryId);
    }
  };

  // Add new item
  const handleAddItem = async () => {
    if (!selectedServer || !selectedCategory) return;
    
    if (!itemForm.displayName || !itemForm.shortName || itemForm.price <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const newItem = await storeService.addItem(selectedServer.id, {
        categoryId: selectedCategory,
        displayName: itemForm.displayName,
        shortName: itemForm.shortName,
        price: itemForm.price,
        quantity: itemForm.quantity,
        timerMinutes: itemForm.timerMinutes
      });
      
      setItems(prev => [...prev, newItem]);
      setItemForm({ displayName: '', shortName: '', price: 0, quantity: 1, timerMinutes: 0 });
      
      toast({
        title: "Item Added Successfully! 🎉",
        description: `${newItem.name} has been added to the store`,
      });
    } catch (error) {
      toast({
        title: "Failed to add item",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Edit item
  const handleEditItem = async () => {
    if (!selectedServer || !editingItem) return;

    try {
      setLoading(true);
      await storeService.updateItem(selectedServer.id, editingItem.id, {
        displayName: itemForm.displayName,
        shortName: itemForm.shortName,
        price: itemForm.price,
        quantity: itemForm.quantity,
        timerMinutes: itemForm.timerMinutes
      });
      
      setItems(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, ...itemForm }
          : item
      ));
      
      setEditingItem(null);
      setItemForm({ displayName: '', shortName: '', price: 0, quantity: 1, timerMinutes: 0 });
      
      toast({
        title: "Item Updated Successfully! ✅",
        description: "Item details have been updated",
      });
    } catch (error) {
      toast({
        title: "Failed to update item",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!selectedServer) return;

    try {
      setLoading(true);
      await storeService.deleteItem(selectedServer.id, itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      
      toast({
        title: "Item Deleted Successfully! 🗑️",
        description: "Item has been removed from the store",
      });
    } catch (error) {
      toast({
        title: "Failed to delete item",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!selectedServer) return;

    if (!categoryForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const newCategory = await storeService.addCategory(selectedServer.id, categoryForm);
      setCategories([...categories, newCategory]);
      setCategoryForm({ name: '', type: 'item' });
      
      toast({
        title: "Category Added",
        description: `${newCategory.name} has been added to the store`
      });
    } catch (error) {
      toast({
        title: "Failed to add category",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const handleEditCategory = async () => {
    if (!selectedServer || !editingCategory) return;

    if (!categoryForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const updatedCategory = await storeService.updateCategory(
        selectedServer.id, 
        editingCategory.id, 
        categoryForm
      );
      
      setCategories(categories.map(cat => 
        cat.id === editingCategory.id ? updatedCategory : cat
      ));
      
      setEditingCategory(null);
      setCategoryForm({ name: '', type: 'item' });
      
      toast({
        title: "Category Updated",
        description: `${updatedCategory.name} has been updated`
      });
    } catch (error) {
      toast({
        title: "Failed to update category",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const handleRemoveCategory = async (category: Category) => {
    if (!selectedServer) return;

    try {
      await storeService.removeCategory(selectedServer.id, category.id);
      setCategories(categories.filter(cat => cat.id !== category.id));
      
      toast({
        title: "Category Removed",
        description: `${category.name} has been removed from the store`
      });
    } catch (error) {
      toast({
        title: "Failed to remove category",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, type: category.type });
  };

  // Show locked state if no servers
  if (servers.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/home')}
                className="text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
              
              <div>
                <h1 className="gaming-header text-xl">Server Settings</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your server configuration
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="gaming-card">
              <CardContent className="py-12">
                <div className="mb-6">
                  <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Server Settings Locked</h3>
                <p className="text-muted-foreground mb-8">
                  You need to configure at least one server before accessing settings. 
                  Get started by adding your first server.
                </p>
                <Button
                  onClick={() => navigate('/add-server')}
                  className="btn-gaming"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Server
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/home')}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Server Settings</h1>
              <p className="text-muted-foreground text-sm">
                Manage your server configuration
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Server Selection */}
          <Card className="gaming-card">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerIcon className="w-5 h-5" />
              Server Selection
            </CardTitle>
              <CardDescription>
                Choose which server to configure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Select Server</Label>
                <Select 
                  value={selectedServer?.id || ''} 
                  onValueChange={handleServerSelect}
                >
                  <SelectTrigger className="gaming-input">
                    <SelectValue placeholder="Please select a server" />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map(server => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name} ({server.ip})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedServer && (
            <Tabs defaultValue="store" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 gaming-card">
                <TabsTrigger value="details" className="data-[state=active]:btn-gaming">
                  Server Details
                </TabsTrigger>
                <TabsTrigger value="store" className="data-[state=active]:btn-gaming">
                  Store Configuration
                </TabsTrigger>
              </TabsList>

              {/* Server Details Tab */}
              <TabsContent value="details">
                <Card className="gaming-card">
                  <CardHeader>
                    <CardTitle>Server Information</CardTitle>
                    <CardDescription>
                      Basic server details and management options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Server Name</Label>
                        <div className="text-sm font-medium">{selectedServer.name}</div>
                      </div>
                      <div>
                        <Label>IP Address</Label>
                        <div className="text-sm font-mono">{selectedServer.ip}:{selectedServer.rconPort}</div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button variant="outline" className="btn-gaming-secondary">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Server Details
                      </Button>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Server
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Store Configuration Tab */}
              <TabsContent value="store" className="space-y-6">
                
                {/* Add Category */}
                <Card className="gaming-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="w-5 h-5" />
                      Store Categories
                    </CardTitle>
                    <CardDescription>
                      Manage store categories for your server
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Add Category Form */}
                    <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                      <h4 className="font-semibold">Add New Category</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="categoryName">Category Name</Label>
                          <Input
                            id="categoryName"
                            placeholder="e.g., Weapons"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                            className="gaming-input"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Category Type</Label>
                          <Select 
                            value={categoryForm.type} 
                            onValueChange={(value: 'item' | 'kit' | 'vehicle') => 
                              setCategoryForm(prev => ({ ...prev, type: value }))
                            }
                          >
                            <SelectTrigger className="gaming-input">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="item">Item Type</SelectItem>
                              <SelectItem value="kit">Kit Type</SelectItem>
                              <SelectItem value="vehicle">Vehicle Type</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button 
                            onClick={editingCategory ? handleEditCategory : handleAddCategory}
                            className="btn-gaming w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {editingCategory ? 'Update Category' : 'Add Category'}
                          </Button>
                        </div>
                      </div>

                      {editingCategory && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingCategory(null);
                            setCategoryForm({ name: '', type: 'item' });
                          }}
                          className="btn-gaming-secondary"
                        >
                          Cancel Edit
                        </Button>
                      )}
                    </div>

                    {/* Categories List */}
                    <div className="space-y-3">
                      {loading ? (
                        <div className="text-center py-4">
                          <div className="loading-spinner w-6 h-6 mx-auto"></div>
                        </div>
                      ) : categories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No categories configured yet</p>
                        </div>
                      ) : (
                        categories.map(category => (
                          <div
                            key={category.id} 
                            className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border"
                          >
                            <div>
                              <div className="font-medium">{category.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Type: {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditCategory(category)}
                                className="btn-gaming-secondary"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="gaming-card border-0">
                                  <DialogHeader>
                                    <DialogTitle>Remove Category</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to remove "{category.name}"? 
                                      This will also remove all items in this category.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline" className="btn-gaming-secondary">
                                      Cancel
                                    </Button>
                                    <Button 
                                      variant="destructive"
                                      onClick={() => handleRemoveCategory(category)}
                                    >
                                      Remove Category
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Item Management */}
                <Card className="gaming-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Store Items Management
                    </CardTitle>
                    <CardDescription>
                      Select a category to manage items
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Category Selection */}
                    <div className="space-y-4">
                      <Label>Select Category</Label>
                      <Select value={selectedCategory} onValueChange={handleCategorySelect}>
                        <SelectTrigger className="gaming-input">
                          <SelectValue placeholder="Choose a category to manage items" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name} ({category.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Item Form */}
                    {selectedCategory && (
                      <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                        <h4 className="font-semibold">
                          {editingItem ? 'Edit Item' : 'Add New Item'}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name *</Label>
                            <Input
                              id="displayName"
                              placeholder="e.g., Assault Rifle"
                              value={itemForm.displayName}
                              onChange={(e) => setItemForm(prev => ({ ...prev, displayName: e.target.value }))}
                              className="gaming-input"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="shortName">Short Name *</Label>
                            <Input
                              id="shortName"
                              placeholder="e.g., rifle.ak"
                              value={itemForm.shortName}
                              onChange={(e) => setItemForm(prev => ({ ...prev, shortName: e.target.value }))}
                              className="gaming-input"
                            />
                            <p className="text-xs text-muted-foreground">
                              Exact item name for in-game delivery
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="price">Price (Coins) *</Label>
                            <Input
                              id="price"
                              type="number"
                              placeholder="150.00"
                              value={itemForm.price}
                              onChange={(e) => setItemForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                              className="gaming-input"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input
                              id="quantity"
                              type="number"
                              placeholder="1"
                              value={itemForm.quantity}
                              onChange={(e) => setItemForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                              className="gaming-input"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="timerMinutes">Cooldown (Minutes)</Label>
                            <Input
                              id="timerMinutes"
                              type="number"
                              placeholder="60"
                              value={itemForm.timerMinutes}
                              onChange={(e) => setItemForm(prev => ({ ...prev, timerMinutes: parseInt(e.target.value) || 0 }))}
                              className="gaming-input"
                            />
                            <p className="text-xs text-muted-foreground">
                              Time before player can purchase again
                            </p>
                          </div>

                          <div className="flex items-end">
                            <Button 
                              onClick={editingItem ? handleEditItem : handleAddItem}
                              className="btn-gaming w-full"
                              disabled={loading}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {editingItem ? 'Update Item' : 'Add Item'}
                            </Button>
                          </div>
                        </div>

                        {editingItem && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingItem(null);
                              setItemForm({ displayName: '', shortName: '', price: 0, quantity: 1, timerMinutes: 0 });
                            }}
                            className="btn-gaming-secondary"
                          >
                            Cancel Edit
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Items List */}
                    {selectedCategory && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">Items in Category</h4>
                        
                        {itemsLoading ? (
                          <div className="text-center py-4">
                            <div className="loading-spinner w-6 h-6 mx-auto"></div>
                          </div>
                        ) : items.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No items in this category yet</p>
                            <p className="text-sm">Add your first item above</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border border-border"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div>Short Name: <code className="bg-muted px-1 rounded">{item.shortName}</code></div>
                                    <div className="flex items-center gap-4">
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        {item.price} coins
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        Qty: {item.quantity}
                                      </span>
                                      {item.timerMinutes > 0 && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {item.timerMinutes}min cooldown
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setItemForm({
                                        displayName: item.name,
                                        shortName: item.shortName,
                                        price: item.price,
                                        quantity: item.quantity,
                                        timerMinutes: item.timerMinutes
                                      });
                                    }}
                                    className="btn-gaming-secondary"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="gaming-card border-0">
                                      <DialogHeader>
                                        <DialogTitle>Remove Item</DialogTitle>
                                        <DialogDescription>
                                          Are you sure you want to remove "{item.name}"? 
                                          This action cannot be undone.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <Button variant="outline" className="btn-gaming-secondary">
                                          Cancel
                                        </Button>
                                        <Button 
                                          variant="destructive"
                                          onClick={() => handleDeleteItem(item.id)}
                                        >
                                          Remove Item
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServerSettingsScreen;