import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Dices, Store, Trophy, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { serverService } from '../lib/servers-api';
import { useServers } from '../state/useServers';
import { Server } from '../types';

const ServerHubScreen = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedServer, setSelectedServer } = useServers();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServer = async () => {
      if (!serverId) return;
      
      try {
        setLoading(true);
        const server = await serverService.getById(serverId);
        
        if (!server) {
          toast({
            title: "Server not found",
            description: "The requested server could not be found",
            variant: "destructive"
          });
          navigate('/home');
          return;
        }
        
        setSelectedServer(server);
      } catch (error) {
        toast({
          title: "Error loading server",
          description: "Failed to load server details",
          variant: "destructive"
        });
        navigate('/home');
      } finally {
        setLoading(false);
      }
    };

    loadServer();
  }, [serverId, navigate, setSelectedServer, toast]);

  if (loading || !selectedServer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  const hubOptions = [
    {
      title: 'Gambling',
      description: 'Test your luck with Blackjack and Coinflip',
      icon: Dices,
      path: `/server/${serverId}/gambling`,
      color: 'text-green-400'
    },
    {
      title: 'Store',
      description: 'Browse and purchase server items',
      icon: Store,
      path: `/server/${serverId}/store`,
      color: 'text-blue-400'
    },
    {
      title: 'Leaderboard',
      description: 'View top players and your stats',
      icon: Trophy,
      path: `/server/${serverId}/leaderboard`,
      color: 'text-yellow-400'
    }
  ];

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
              Back to Servers
            </Button>
            
            <div className="flex-1">
              <h1 className="gaming-header text-xl">{selectedServer.name}</h1>
              <p className="text-muted-foreground text-sm">
                {selectedServer.ip}:{selectedServer.rconPort}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={selectedServer.hasActiveSub ? "default" : "destructive"}>
                {selectedServer.hasActiveSub ? "Active" : "Inactive"}
              </Badge>
              
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
        <div className="max-w-4xl mx-auto">
          
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Server Hub</h2>
            <p className="text-muted-foreground text-lg">
              Choose an option to get started
            </p>
          </div>

          {/* Hub Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {hubOptions.map((option) => (
              <Card
                key={option.title}
                className="gaming-card-interactive cursor-pointer group"
                onClick={() => navigate(option.path)}
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-gaming-surface group-hover:bg-primary/10 transition-colors">
                    <option.icon className={`w-8 h-8 ${option.color} group-hover:text-primary transition-colors`} />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <CardDescription className="text-center">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <Button
                    className="w-full btn-gaming-secondary group-hover:btn-gaming"
                    variant="outline"
                  >
                    Enter {option.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Server Info Section */}
          <div className="gaming-card p-6">
            <h3 className="text-lg font-semibold mb-4">Server Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Server Name</dt>
                <dd className="text-sm">{selectedServer.name}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">IP Address</dt>
                <dd className="text-sm font-mono">{selectedServer.ip}:{selectedServer.rconPort}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Status</dt>
                <dd className="text-sm">
                  <Badge variant={selectedServer.hasActiveSub ? "default" : "destructive"}>
                    {selectedServer.hasActiveSub ? "Active Subscription" : "Inactive"}
                  </Badge>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Description</dt>
                <dd className="text-sm">{selectedServer.description || "No description available"}</dd>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ServerHubScreen;