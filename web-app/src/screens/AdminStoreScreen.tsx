import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Package, Car, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import { serverService } from '../lib/servers-api';
import { storeService } from '@/lib/store';
import { useAuth } from '../state/useAuth';

interface Category {
  id: number;
  name: string;
  type: 'item' | 'kit' | 'vehicle';
  role?: string;
}

interface Item {
  id: number;
  display_name: string;
  short_name: string;
  price: number;
  description?: string;
  command?: string;
  icon_url?: string;
  cooldown_minutes?: number;
  quantity?: number;
  timer?: number;
  categoryId: number;
}

interface Server {
  id: number;
  display_name: string;
  web_rcon_host: string;
  web_rcon_port: number;
}

export default function AdminStoreScreen() {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'item' as 'item' | 'kit' | 'vehicle',
    role: ''
  });

  // Item form
  const [itemForm, setItemForm] = useState({
    name: '',
    shortName: '',
    price: '',
    description: '',
    command: '',
    iconUrl: '',
    cooldownMinutes: '',
    quantity: '',
    timer: ''
  });

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadCategories();
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedCategory) {
      loadItems();
    }
  }, [selectedCategory]);

  const loadServers = async () => {
    try {
      setLoading(true);
      const serverList = await serverService.list();
      setServers(serverList);
      if (serverList.length > 0) {
        setSelectedServer(serverList[0].id);
      }
    } catch (err) {
      setError('Failed to load servers');
      console.error('Error loading servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!selectedServer) return;
    
    try {
      setLoading(true);
      const categoryList = await storeService.getCategories(selectedServer);
      setCategories(categoryList);
      if (categoryList.length > 0) {
        setSelectedCategory(categoryList[0].id);
      }
    } catch (err) {
      setError('Failed to load categories');
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    if (!selectedServer || !selectedCategory) return;
    
    try {
      setLoading(true);
      const itemList = await storeService.getItems(selectedServer, selectedCategory);
      setItems(itemList);
    } catch (err) {
      setError('Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${selectedServer}/store/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });

      if (!response.ok) {
        throw new Error('Failed to create category');
      }

      setCategoryForm({ name: '', type: 'item', role: '' });
      setShowCategoryForm(false);
      loadCategories();
    } catch (err) {
      setError('Failed to create category');
      console.error('Error creating category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer || !editingCategory) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${selectedServer}/store/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setEditingCategory(null);
      setCategoryForm({ name: '', type: 'item', role: '' });
      loadCategories();
    } catch (err) {
      setError('Failed to update category');
      console.error('Error updating category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!selectedServer || !confirm('Are you sure you want to delete this category?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${selectedServer}/store/categories/${categoryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      loadCategories();
    } catch (err) {
      setError('Failed to delete category');
      console.error('Error deleting category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer || !selectedCategory) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${selectedServer}/store/categories/${selectedCategory}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemForm.name,
          shortName: itemForm.shortName,
          price: parseFloat(itemForm.price),
          description: itemForm.description,
          command: itemForm.command,
          iconUrl: itemForm.iconUrl,
          cooldownMinutes: parseInt(itemForm.cooldownMinutes) || 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create item');
      }

      setItemForm({
        name: '', shortName: '', price: '', description: '', command: '',
        iconUrl: '', cooldownMinutes: '', quantity: '', timer: ''
      });
      setShowItemForm(false);
      loadItems();
    } catch (err) {
      setError('Failed to create item');
      console.error('Error creating item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedServer || !selectedCategory || !confirm('Are you sure you want to delete this item?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${selectedServer}/store/categories/${selectedCategory}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      loadItems();
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error deleting item:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'item': return <Package className="w-4 h-4" />;
      case 'kit': return <Wrench className="w-4 h-4" />;
      case 'vehicle': return <Car className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'item': return 'bg-blue-100 text-blue-800';
      case 'kit': return 'bg-green-100 text-green-800';
      case 'vehicle': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-500">Please sign in to access admin features.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Store Administration</h1>
        <p className="text-gray-600">Manage store categories, items, kits, and vehicles</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Server Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Server</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedServer?.toString()} onValueChange={(value) => setSelectedServer(parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id.toString()}>
                  {server.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedServer && (
        <Card className="bg-black border-orange-500">
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
                <TabsList className="bg-gray-800">
                  <TabsTrigger value="categories" className="text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">Categories</TabsTrigger>
                  <TabsTrigger value="items" className="text-orange-500 data-[state=active]:bg-orange-500 data-[state=active]:text-black">Items</TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="space-y-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-orange-500">Categories</CardTitle>
                      <Button 
                        onClick={() => setShowCategoryForm(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-black"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Category
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {categories.map((category) => (
                          <div key={category.id} className="flex items-center justify-between p-4 border border-gray-600 rounded-lg bg-gray-700">
                            <div className="flex items-center space-x-3">
                              {getCategoryIcon(category.type)}
                              <div>
                                <h3 className="font-medium text-white">{category.name}</h3>
                                <Badge className={getCategoryColor(category.type)}>
                                  {category.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                                onClick={() => {
                                  setEditingCategory(category);
                                  setCategoryForm({
                                    name: category.name,
                                    type: category.type,
                                    role: category.role || ''
                                  });
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="items" className="space-y-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-orange-500">Items</CardTitle>
                      <div className="flex space-x-2">
                        <Select value={selectedCategory?.toString()} onValueChange={(value) => setSelectedCategory(parseInt(value))}>
                          <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()} className="text-white hover:bg-gray-700">
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => setShowItemForm(true)} 
                          disabled={!selectedCategory}
                          className="bg-orange-500 hover:bg-orange-600 text-black disabled:bg-gray-600 disabled:text-gray-400"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-4 border border-gray-600 rounded-lg bg-gray-700">
                            <div>
                              <h3 className="font-medium text-white">{item.display_name}</h3>
                              <p className="text-sm text-gray-300">
                                {item.short_name} - ${item.price}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      )}

      {/* Category Form Modal */}
      {(showCategoryForm || editingCategory) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-orange-500">{editingCategory ? 'Edit Category' : 'Add Category'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Name</Label>
                  <Input
                    id="name"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="type" className="text-white">Type</Label>
                  <Select value={categoryForm.type} onValueChange={(value: any) => setCategoryForm({ ...categoryForm, type: value })}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="item" className="text-white hover:bg-gray-700">Item</SelectItem>
                      <SelectItem value="kit" className="text-white hover:bg-gray-700">Kit</SelectItem>
                      <SelectItem value="vehicle" className="text-white hover:bg-gray-700">Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role" className="text-white">Required Role (optional)</Label>
                  <Input
                    id="role"
                    value={categoryForm.role}
                    onChange={(e) => setCategoryForm({ ...categoryForm, role: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-black"
                  >
                    {editingCategory ? 'Update' : 'Create'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 text-white hover:bg-gray-700"
                    onClick={() => {
                      setShowCategoryForm(false);
                      setEditingCategory(null);
                      setCategoryForm({ name: '', type: 'item', role: '' });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Add Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <Label htmlFor="itemName" className="text-white">Display Name</Label>
                  <Input
                    id="itemName"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="shortName" className="text-white">Short Name</Label>
                  <Input
                    id="shortName"
                    value={itemForm.shortName}
                    onChange={(e) => setItemForm({ ...itemForm, shortName: e.target.value })}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="price" className="text-white">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-white">Description</Label>
                  <Textarea
                    id="description"
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="command" className="text-white">RCON Command</Label>
                  <Input
                    id="command"
                    value={itemForm.command}
                    onChange={(e) => setItemForm({ ...itemForm, command: e.target.value })}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="iconUrl" className="text-white">Icon URL</Label>
                  <Input
                    id="iconUrl"
                    value={itemForm.iconUrl}
                    onChange={(e) => setItemForm({ ...itemForm, iconUrl: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="cooldownMinutes" className="text-white">Cooldown (minutes)</Label>
                  <Input
                    id="cooldownMinutes"
                    type="number"
                    value={itemForm.cooldownMinutes}
                    onChange={(e) => setItemForm({ ...itemForm, cooldownMinutes: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-black"
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 text-white hover:bg-gray-700"
                    onClick={() => {
                      setShowItemForm(false);
                      setItemForm({
                        name: '', shortName: '', price: '', description: '', command: '',
                        iconUrl: '', cooldownMinutes: '', quantity: '', timer: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
