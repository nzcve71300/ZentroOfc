import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { serverService } from '../lib/servers-api';
import { useServers } from '../state/useServers';
import { ServerConfig } from '../types';

const ServerSetupScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { addServer } = useServers();
  
  const [formData, setFormData] = useState<ServerConfig>({
    name: '',
    ip: '',
    rconPort: 28015,
    rconPassword: ''
  });
  const [creating, setCreating] = useState(false);

  // Get plan info from navigation state
  const { planName, subscriptionId } = location.state || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.ip || !formData.rconPort || !formData.rconPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.rconPort < 1 || formData.rconPort > 65535) {
      toast({
        title: "Invalid Port",
        description: "RCON port must be between 1 and 65535",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      
      // Test RCON connection first
      toast({
        title: "Testing Connection",
        description: "Verifying RCON connection to your server...",
      });

      const connectionTest = await serverService.testConnection(formData);
      
      if (!connectionTest) {
        toast({
          title: "Connection Failed",
          description: "Could not connect to your server. Please check your RCON settings.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Connection Successful!",
        description: "RCON connection verified. Creating server...",
      });

      // Get current user ID (in a real app, this would come from auth context)
      const currentUserId = 1; // TODO: Get from auth context
      
      // Create server with real RCON connection
      const newServer = await serverService.create(currentUserId, formData);
      addServer(newServer);
      
      toast({
        title: "Server Created Successfully! 🎉",
        description: `Server "${newServer.name}" is now connected and ready to use!`,
      });
      
      // Navigate to server settings to show it's now unlocked
      navigate('/server-settings');
      
    } catch (error) {
      console.error('Server creation error:', error);
      toast({
        title: "Setup Failed",
        description: error instanceof Error ? error.message : "Failed to create server",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="gaming-header text-xl">Server Setup</h1>
            <p className="text-muted-foreground text-sm">
              Configure your new gaming server
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Success Message */}
          {planName && (
            <Card className="gaming-card border-green-500/20 bg-green-500/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <div>
                    <CardTitle className="text-green-400">Thank you & welcome!</CardTitle>
                    <CardDescription>
                      Your {planName} subscription is now active
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Subscription ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{subscriptionId}</code>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Setup Form */}
          <Card className="gaming-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Let's set up your server!</CardTitle>
                  <CardDescription>
                    Enter your server details to get started
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="name">Server Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="My Gaming Server"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="gaming-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will appear in your server list
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ip">Server IP Address</Label>
                  <Input
                    id="ip"
                    type="text"
                    placeholder="192.168.1.100 or game.myserver.com"
                    value={formData.ip}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip: e.target.value }))}
                    className="gaming-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    The IP address or hostname of your game server
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rconPort">RCON Port</Label>
                  <Input
                    id="rconPort"
                    type="number"
                    placeholder="28015"
                    value={formData.rconPort}
                    onChange={(e) => setFormData(prev => ({ ...prev, rconPort: parseInt(e.target.value) || 0 }))}
                    min={1}
                    max={65535}
                    className="gaming-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    The RCON port for server management (usually 28015 for Rust)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rconPassword">RCON Password</Label>
                  <Input
                    id="rconPassword"
                    type="password"
                    placeholder="Your secure RCON password"
                    value={formData.rconPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, rconPassword: e.target.value }))}
                    className="gaming-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    The RCON password for accessing your server
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full btn-gaming text-lg py-6"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <div className="loading-spinner w-5 h-5 mr-3"></div>
                      Creating Server...
                    </>
                  ) : (
                    <>
                      <Server className="w-5 h-5 mr-3" />
                      Confirm & Create Server
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>

          {/* Security Notice */}
          <Card className="gaming-card border-yellow-500/20 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                🔒 Security Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>IMPORTANT:</strong> In a production environment, RCON credentials should 
                never be stored on the client-side or transmitted unencrypted.
              </p>
              <p>
                All server management should be handled through secure API endpoints with proper 
                encryption and authentication.
              </p>
              <p>
                This demo stores credentials temporarily for demonstration purposes only.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ServerSetupScreen;