import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, Plus, Trash2, Edit, Lock, Server as ServerIcon, Store, Package, Clock, DollarSign, ChevronDown, ChevronRight, Wrench, Gamepad2, Target, Zap, Shield, Users, Home } from 'lucide-react';
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
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isConfigsExpanded, setIsConfigsExpanded] = useState(false);
  const [configs, setConfigs] = useState<any>({});
  const [configsLoading, setConfigsLoading] = useState(false);

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

  // Load server configurations
  const loadConfigurations = async (serverId: string) => {
    if (!serverId) return;
    
    try {
      setConfigsLoading(true);
      const response = await fetch(`/api/servers/${serverId}/configs`);
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (error) {
      console.error('Failed to load configurations:', error);
      toast({
        title: "Failed to load configurations",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setConfigsLoading(false);
    }
  };

  // Update configuration
  const updateConfiguration = async (configType: string, configName: string, value: string) => {
    if (!selectedServer) return;

    try {
      const response = await fetch(`/api/servers/${selectedServer.id}/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: configName,
          option: value,
          server: selectedServer.name
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Configuration Update Requested",
          description: result.message || `${configName} update has been sent to Discord bot`
        });
        loadConfigurations(selectedServer.id);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update configuration');
      }
    } catch (error) {
      toast({
        title: "Failed to update configuration",
        description: "Please try again later",
        variant: "destructive"
      });
    }
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
            <div className="space-y-6">
              {/* Collapsible Categories and Items Section */}
              <Card className="gaming-card border-orange-500">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-900 transition-colors"
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-orange-500 flex items-center">
                      {isCategoriesExpanded ? (
                        <ChevronDown className="w-5 h-5 mr-2" />
                      ) : (
                        <ChevronRight className="w-5 h-5 mr-2" />
                      )}
                      Categories and Items
                    </CardTitle>
                  </div>
                </CardHeader>
                
                {isCategoriesExpanded && (
                  <CardContent className="bg-gray-900">
                    <Tabs defaultValue="categories" className="space-y-6">
                      <TabsList className="grid w-full grid-cols-2 gaming-card bg-gray-800">
                        <TabsTrigger value="categories" className="text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          Categories
                        </TabsTrigger>
                        <TabsTrigger value="items" className="text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          Items
                        </TabsTrigger>
                      </TabsList>

                      {/* Categories Tab */}
                      <TabsContent value="categories" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500">Categories</CardTitle>
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
                                    className="bg-gray-700 border-gray-600 text-white"
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
                                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-600">
                                      <SelectItem value="item" className="text-white hover:bg-gray-700">Item Type</SelectItem>
                                      <SelectItem value="kit" className="text-white hover:bg-gray-700">Kit Type</SelectItem>
                                      <SelectItem value="vehicle" className="text-white hover:bg-gray-700">Vehicle Type</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-end">
                                  <Button 
                                    onClick={editingCategory ? handleEditCategory : handleAddCategory}
                                    className="bg-orange-500 hover:bg-orange-600 text-black w-full"
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
                                  className="border-gray-600 text-white hover:bg-gray-700"
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
                                    className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-gray-600 bg-gray-700"
                                  >
                                    <div>
                                      <div className="font-medium text-white">{category.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        Type: {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => startEditCategory(category)}
                                        className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="destructive" size="sm" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
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
                      </TabsContent>

                      {/* Items Tab */}
                      <TabsContent value="items" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500">Items</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            
                            {/* Category Selection */}
                            <div className="space-y-4">
                              <Label>Select Category</Label>
                              <Select value={selectedCategory} onValueChange={handleCategorySelect}>
                                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                  <SelectValue placeholder="Choose a category to manage items" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-600">
                                  {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id} className="text-white hover:bg-gray-700">
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
                                      className="bg-gray-700 border-gray-600 text-white"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="shortName">Short Name *</Label>
                                    <Input
                                      id="shortName"
                                      placeholder="e.g., rifle.ak"
                                      value={itemForm.shortName}
                                      onChange={(e) => setItemForm(prev => ({ ...prev, shortName: e.target.value }))}
                                      className="bg-gray-700 border-gray-600 text-white"
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
                                      className="bg-gray-700 border-gray-600 text-white"
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
                                      className="bg-gray-700 border-gray-600 text-white"
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
                                      className="bg-gray-700 border-gray-600 text-white"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Time before player can purchase again
                                    </p>
                                  </div>

                                  <div className="flex items-end">
                                    <Button 
                                      onClick={editingItem ? handleEditItem : handleAddItem}
                                      className="bg-orange-500 hover:bg-orange-600 text-black w-full"
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
                                    className="border-gray-600 text-white hover:bg-gray-700"
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
                                        className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border border-gray-600 bg-gray-700"
                                      >
                                        <div className="flex-1">
                                          <div className="font-medium text-white">{item.name}</div>
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
                                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="destructive" size="sm" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
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
                  </CardContent>
                )}
              </Card>

              {/* Set Configs Card */}
              <Card className="gaming-card border-orange-500">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-900 transition-colors"
                  onClick={() => {
                    setIsConfigsExpanded(!isConfigsExpanded);
                    if (!isConfigsExpanded && selectedServer) {
                      loadConfigurations(selectedServer.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-orange-500 flex items-center">
                      {isConfigsExpanded ? (
                        <ChevronDown className="w-5 h-5 mr-2" />
                      ) : (
                        <ChevronRight className="w-5 h-5 mr-2" />
                      )}
                      Set Configs
                    </CardTitle>
                  </div>
                </CardHeader>
                
                {isConfigsExpanded && (
                  <CardContent className="bg-gray-900">
                    <Tabs defaultValue="economy" className="space-y-6">
                      <TabsList className="flex w-full overflow-x-auto gaming-card bg-gray-800">
                        <TabsTrigger value="economy" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Gamepad2 className="w-4 h-4 mr-1" />
                          Economy
                        </TabsTrigger>
                        <TabsTrigger value="teleports" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Target className="w-4 h-4 mr-1" />
                          Teleports
                        </TabsTrigger>
                        <TabsTrigger value="events" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Zap className="w-4 h-4 mr-1" />
                          Events
                        </TabsTrigger>
                        <TabsTrigger value="systems" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Wrench className="w-4 h-4 mr-1" />
                          Systems
                        </TabsTrigger>
                        <TabsTrigger value="positions" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Shield className="w-4 h-4 mr-1" />
                          Positions
                        </TabsTrigger>
                        <TabsTrigger value="misc" className="flex-shrink-0 text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">
                          <Users className="w-4 h-4 mr-1" />
                          Misc
                        </TabsTrigger>
                      </TabsList>

                      {/* Economy Configs */}
                      <TabsContent value="economy" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Gamepad2 className="w-5 h-5 mr-2" />
                              Economy Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-2">
                                <Label>Daily Reward Amount</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="100"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.dailyAmount || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'DAILY-AMOUNT', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Starting Balance</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="1000"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.startingBalance || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'STARTING-BALANCE', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Player Kill Reward</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="50"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.playerKillsAmount || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'PLAYERKILLS-AMOUNT', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Misc Kill Reward</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="25"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.miscKillsAmount || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'MISCKILLS-AMOUNT', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Blackjack Min Bet</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="10"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.blackjackMin || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'BLACKJACK-MIN', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Blackjack Max Bet</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="1000"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.blackjackMax || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'BLACKJACK-MAX', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Bounty Rewards Amount</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="100"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.bountyRewards || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'BOUNTY-REWARDS', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Killfeed Format</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="{Killer} ☠️ {Victim}"
                                    className="bg-gray-700 border-gray-600 text-white"
                                    defaultValue={configs.economy?.killfeedSetup || ''}
                                    onBlur={(e) => updateConfiguration('economy', 'KILLFEED-SETUP', e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="blackjack-toggle"
                                  className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                  defaultChecked={configs.economy?.blackjackToggle}
                                  onChange={(e) => updateConfiguration('economy', 'BLACKJACK-TOGGLE', e.target.checked ? 'on' : 'off')}
                                />
                                <Label htmlFor="blackjack-toggle" className="text-white">Blackjack</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="coinflip-toggle"
                                  className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                  defaultChecked={configs.economy?.coinflipToggle}
                                  onChange={(e) => updateConfiguration('economy', 'COINFLIP-TOGGLE', e.target.checked ? 'on' : 'off')}
                                />
                                <Label htmlFor="coinflip-toggle" className="text-white">Coinflip</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="bounty-toggle"
                                  className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                  defaultChecked={configs.economy?.bountyToggle}
                                  onChange={(e) => updateConfiguration('economy', 'BOUNTY-TOGGLE', e.target.checked ? 'on' : 'off')}
                                />
                                <Label htmlFor="bounty-toggle" className="text-white">Bounty System</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="killfeed-toggle"
                                  className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                  defaultChecked={configs.economy?.killfeedToggle}
                                  onChange={(e) => updateConfiguration('economy', 'KILLFEEDGAME', e.target.checked ? 'on' : 'off')}
                                />
                                <Label htmlFor="killfeed-toggle" className="text-white">Killfeed</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="killfeed-randomizer"
                                  className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                  defaultChecked={configs.economy?.killfeedRandomizer}
                                  onChange={(e) => updateConfiguration('economy', 'KILLFEED-RANDOMIZER', e.target.checked ? 'on' : 'off')}
                                />
                                <Label htmlFor="killfeed-randomizer" className="text-white">Killfeed Randomizer</Label>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Teleports Configs */}
                      <TabsContent value="teleports" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Target className="w-5 h-5 mr-2" />
                              Teleport Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              {['TPN', 'TPNE', 'TPE', 'TPSE', 'TPS', 'TPSW', 'TPW', 'TPNW'].map((tp) => (
                                <div key={tp} className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                  <Label className="text-white font-semibold">{tp} Teleport</Label>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`${tp.toLowerCase()}-use`}
                                        className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.teleports?.[tp.toLowerCase()]?.enabled}
                                        onChange={(e) => updateConfiguration('teleports', `${tp}-USE`, e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor={`${tp.toLowerCase()}-use`} className="text-white text-sm">Enable</Label>
                                    </div>
                                    <div className="space-y-1">
                                      <Input
                                        placeholder="Display Name"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.teleports?.[tp.toLowerCase()]?.displayName || ''}
                                        onBlur={(e) => updateConfiguration('teleports', `${tp}-NAME`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Cooldown (minutes)"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.teleports?.[tp.toLowerCase()]?.cooldown || ''}
                                        onBlur={(e) => updateConfiguration('teleports', `${tp}-TIME`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Delay (seconds)"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.teleports?.[tp.toLowerCase()]?.delay || ''}
                                        onBlur={(e) => updateConfiguration('teleports', `${tp}-DELAYTIME`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Kit Name"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.teleports?.[tp.toLowerCase()]?.kitName || ''}
                                        onBlur={(e) => updateConfiguration('teleports', `${tp}-KITNAME`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Coordinates (x,y,z)"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.teleports?.[tp.toLowerCase()]?.coordinates || ''}
                                        onBlur={(e) => updateConfiguration('teleports', `${tp}-COORDINATES`, e.target.value)}
                                      />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`${tp.toLowerCase()}-uselist`}
                                          className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                          defaultChecked={configs.teleports?.[tp.toLowerCase()]?.useList}
                                          onChange={(e) => updateConfiguration('teleports', `${tp}-USELIST`, e.target.checked ? 'on' : 'off')}
                                        />
                                        <Label htmlFor={`${tp.toLowerCase()}-uselist`} className="text-white text-xs">Use List</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`${tp.toLowerCase()}-usedelay`}
                                          className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                          defaultChecked={configs.teleports?.[tp.toLowerCase()]?.useDelay}
                                          onChange={(e) => updateConfiguration('teleports', `${tp}-USE-DELAY`, e.target.checked ? 'on' : 'off')}
                                        />
                                        <Label htmlFor={`${tp.toLowerCase()}-usedelay`} className="text-white text-xs">Use Delay</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`${tp.toLowerCase()}-usekit`}
                                          className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                          defaultChecked={configs.teleports?.[tp.toLowerCase()]?.useKit}
                                          onChange={(e) => updateConfiguration('teleports', `${tp}-USE-KIT`, e.target.checked ? 'on' : 'off')}
                                        />
                                        <Label htmlFor={`${tp.toLowerCase()}-usekit`} className="text-white text-xs">Use Kit</Label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Events Configs */}
                      <TabsContent value="events" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Zap className="w-5 h-5 mr-2" />
                              Event Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {['BRADLEY', 'HELICOPTER'].map((event) => (
                                <div key={event} className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                  <Label className="text-white font-semibold">{event} Event</Label>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`${event.toLowerCase()}-scout`}
                                        className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.events?.[event.toLowerCase()]?.scout}
                                        onChange={(e) => updateConfiguration('events', `${event}-SCOUT`, e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor={`${event.toLowerCase()}-scout`} className="text-white text-sm">Scout</Label>
                                    </div>
                                    <div className="space-y-1">
                                      <Input
                                        placeholder="Kill Message"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.events?.[event.toLowerCase()]?.killMsg || ''}
                                        onBlur={(e) => updateConfiguration('events', `${event}-KILLMSG`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Respawn Message"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.events?.[event.toLowerCase()]?.respawnMsg || ''}
                                        onBlur={(e) => updateConfiguration('events', `${event}-RESPAWNMSG`, e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Systems Configs */}
                      <TabsContent value="systems" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Wrench className="w-5 h-5 mr-2" />
                              System Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Book-a-Ride (BAR)</Label>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="bar-use"
                                      className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                      defaultChecked={configs.systems?.bar?.enabled}
                                      onChange={(e) => updateConfiguration('systems', 'BAR-USE', e.target.checked ? 'on' : 'off')}
                                    />
                                    <Label htmlFor="bar-use" className="text-white text-sm">Enable</Label>
                                  </div>
                                  <div className="space-y-1">
                                    <Input
                                      placeholder="Cooldown (minutes)"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.bar?.cooldown || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'BAR-COOLDOWN', e.target.value)}
                                    />
                                    <Input
                                      placeholder="Fuel Amount"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.bar?.fuelAmount || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'BAR-FUEL-AMOUNT', e.target.value)}
                                    />
                                    <Input
                                      placeholder="Welcome Message Text"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.bar?.welcomeMsgText || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'BAR-WELCOME-MSG-TEXT', e.target.value)}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="bar-uselist"
                                        className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.systems?.bar?.useList}
                                        onChange={(e) => updateConfiguration('systems', 'BAR-USELIST', e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor="bar-uselist" className="text-white text-xs">Use List</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="bar-welcome-message"
                                        className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.systems?.bar?.welcomeMessage}
                                        onChange={(e) => updateConfiguration('systems', 'BAR-WELCOME-MESSAGE', e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor="bar-welcome-message" className="text-white text-xs">Welcome Message</Label>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {['HORSE', 'RHIB', 'MINI', 'CAR'].map((vehicle) => (
                                      <div key={vehicle} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`bar-${vehicle.toLowerCase()}`}
                                          className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                          defaultChecked={configs.systems?.bar?.[vehicle.toLowerCase()]}
                                          onChange={(e) => updateConfiguration('systems', `BAR-${vehicle}`, e.target.checked ? 'on' : 'off')}
                                        />
                                        <Label htmlFor={`bar-${vehicle.toLowerCase()}`} className="text-white text-xs">{vehicle}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Recycler</Label>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="recycler-use"
                                      className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                      defaultChecked={configs.systems?.recycler?.enabled}
                                      onChange={(e) => updateConfiguration('systems', 'RECYCLER-USE', e.target.checked ? 'on' : 'off')}
                                    />
                                    <Label htmlFor="recycler-use" className="text-white text-sm">Enable</Label>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="recycler-uselist"
                                        className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.systems?.recycler?.useList}
                                        onChange={(e) => updateConfiguration('systems', 'RECYCLER-USELIST', e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor="recycler-uselist" className="text-white text-xs">Use List</Label>
                                    </div>
                                    <Input
                                      placeholder="Cooldown (minutes)"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.recycler?.cooldown || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'RECYCLER-TIME', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Home Teleport</Label>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="hometp-use"
                                      className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                      defaultChecked={configs.systems?.hometp?.enabled}
                                      onChange={(e) => updateConfiguration('systems', 'HOMETP-USE', e.target.checked ? 'on' : 'off')}
                                    />
                                    <Label htmlFor="hometp-use" className="text-white text-sm">Enable</Label>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="hometp-uselist"
                                        className="w-3 h-3 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.systems?.hometp?.useList}
                                        onChange={(e) => updateConfiguration('systems', 'HOMETP-USELIST', e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor="hometp-uselist" className="text-white text-xs">Use List</Label>
                                    </div>
                                    <Input
                                      placeholder="Cooldown (minutes)"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.hometp?.cooldown || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'HOMETP-TIME', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Prison System</Label>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="prison-system"
                                      className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                      defaultChecked={configs.systems?.prison?.enabled}
                                      onChange={(e) => updateConfiguration('systems', 'Prison-System', e.target.checked ? 'on' : 'off')}
                                    />
                                    <Label htmlFor="prison-system" className="text-white text-sm">Enable</Label>
                                  </div>
                                  <div className="space-y-1">
                                    <Input
                                      placeholder="Zone Size"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.prison?.zoneSize || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'Prison-Z-Size', e.target.value)}
                                    />
                                    <Input
                                      placeholder="Zone Color"
                                      className="bg-gray-600 border-gray-500 text-white text-sm"
                                      defaultValue={configs.systems?.prison?.zoneColor || ''}
                                      onBlur={(e) => updateConfiguration('systems', 'Prison-Z-Color', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Positions Configs */}
                      <TabsContent value="positions" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Shield className="w-5 h-5 mr-2" />
                              Position Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {['OUTPOST', 'BANDIT'].map((position) => (
                                <div key={position} className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                  <Label className="text-white font-semibold">{position}</Label>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`${position.toLowerCase()}-enable`}
                                        className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                        defaultChecked={configs.positions?.[position.toLowerCase()]?.enabled}
                                        onChange={(e) => updateConfiguration('positions', `${position}-ENABLE`, e.target.checked ? 'on' : 'off')}
                                      />
                                      <Label htmlFor={`${position.toLowerCase()}-enable`} className="text-white text-sm">Enable</Label>
                                    </div>
                                    <div className="space-y-1">
                                      <Input
                                        placeholder="Delay (seconds)"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.positions?.[position.toLowerCase()]?.delay || ''}
                                        onBlur={(e) => updateConfiguration('positions', `${position}-DELAY`, e.target.value)}
                                      />
                                      <Input
                                        placeholder="Cooldown (minutes)"
                                        className="bg-gray-600 border-gray-500 text-white text-sm"
                                        defaultValue={configs.positions?.[position.toLowerCase()]?.cooldown || ''}
                                        onBlur={(e) => updateConfiguration('positions', `${position}-COOLDOWN`, e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Misc Configs */}
                      <TabsContent value="misc" className="space-y-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-orange-500 flex items-center">
                              <Users className="w-5 h-5 mr-2" />
                              Miscellaneous Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Crate Events</Label>
                                <div className="space-y-2">
                                  {['CRATE-1', 'CRATE-2', 'CRATE-3', 'CRATE-4'].map((crate) => (
                                    <div key={crate} className="space-y-2 p-3 bg-gray-600 rounded">
                                      <div className="flex items-center justify-between">
                                        <span className="text-white text-sm font-semibold">{crate}</span>
                                        <input
                                          type="checkbox"
                                          id={`${crate.toLowerCase()}-enable`}
                                          className="w-4 h-4 text-orange-500 bg-gray-500 border-gray-400 rounded focus:ring-orange-500"
                                          defaultChecked={configs.misc?.crates?.[crate.toLowerCase()]?.enabled}
                                          onChange={(e) => updateConfiguration('misc', `${crate}-ON/OFF`, e.target.checked ? 'on' : 'off')}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <Input
                                          placeholder="Time (min)"
                                          className="bg-gray-500 border-gray-400 text-white text-xs"
                                          defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.time || ''}
                                          onBlur={(e) => updateConfiguration('misc', `${crate}-TIME`, e.target.value)}
                                        />
                                        <Input
                                          placeholder="Amount (max 2)"
                                          className="bg-gray-500 border-gray-400 text-white text-xs"
                                          defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.amount || ''}
                                          onBlur={(e) => updateConfiguration('misc', `${crate}-AMOUNT`, e.target.value)}
                                        />
                                      </div>
                                      <Input
                                        placeholder="Spawn Message"
                                        className="bg-gray-500 border-gray-400 text-white text-xs"
                                        defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.message || ''}
                                        onBlur={(e) => updateConfiguration('misc', `${crate}-MSG`, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2 p-4 bg-gray-700 rounded-lg">
                                <Label className="text-white font-semibold">Zorp System</Label>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="zorp-uselist"
                                      className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500"
                                      defaultChecked={configs.misc?.zorp?.useList}
                                      onChange={(e) => updateConfiguration('misc', 'ZORP-USELIST', e.target.checked ? 'on' : 'off')}
                                    />
                                    <Label htmlFor="zorp-uselist" className="text-white text-sm">Use List</Label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                )}
              </Card>

              <Tabs defaultValue="details" className="space-y-6">
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

              </Tabs>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServerSettingsScreen;