import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { serverService } from '../lib/servers-api';
import { useServers } from '../state/useServers';
import { useAuth } from '../state/useAuth';
import { Server } from '../types';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { servers, setServers, setLoading, isLoading } = useServers();
  const [refreshing, setRefreshing] = useState(false);

  const loadServers = async () => {
    try {
      setLoading(true);
      // For now, use a default guild ID - in production this would come from user context
      const guildId = '1342235198175182921'; // Default guild ID
      const serverList = await serverService.list(guildId);
      setServers(serverList);
    } catch (error) {
      toast({
        title: "Failed to load servers",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadServers();
    setRefreshing(false);
    
    toast({
      title: "Refreshed",
      description: "Server list updated"
    });
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleServerClick = (server: Server) => {
    navigate(`/server/${server.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="gaming-header text-2xl">Zentro</h1>
              <p className="text-muted-foreground">Welcome back, {user?.ign}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-gaming-secondary"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/server-settings')}
                className="btn-gaming-secondary"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            onClick={() => navigate('/add-server')}
            className="btn-gaming flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Server
          </Button>
        </div>

        {/* Servers Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Servers</h2>
            <Badge variant="secondary">
              {servers.length} {servers.length === 1 ? 'Server' : 'Servers'}
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="gaming-card animate-pulse">
                  <div className="aspect-video bg-muted/20 rounded-t-xl"></div>
                  <CardHeader>
                    <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                    <div className="h-3 bg-muted/20 rounded w-1/2"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-12">
              <div className="gaming-card max-w-md mx-auto p-8">
                <div className="text-muted-foreground mb-4">
                  <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No servers yet</h3>
                <p className="text-muted-foreground mb-6">
                  Get started by adding your first gaming server to manage with Zentro
                </p>
                <Button
                  onClick={() => navigate('/add-server')}
                  className="btn-gaming"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Server
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((server) => (
                <Card
                  key={server.id}
                  className="gaming-card-interactive cursor-pointer"
                  onClick={() => handleServerClick(server)}
                >
                  {/* Server Image */}
                  <div className="aspect-video relative overflow-hidden rounded-t-xl">
                    {server.imageUrl ? (
                      <img
                        src={server.imageUrl}
                        alt={server.name}
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-gaming flex items-center justify-center">
                        <Settings className="w-12 h-12 text-white/80" />
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <Badge variant={server.hasActiveSub ? "default" : "destructive"}>
                        {server.hasActiveSub ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {/* Server Info */}
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{server.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {server.description || `Server at ${server.ip}:${server.rconPort}`}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomeScreen;