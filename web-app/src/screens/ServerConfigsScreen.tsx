import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Settings, Gamepad2, Target, Zap, Wrench, Shield, Users, Home, Car, Truck, Plane, Package, Clock, DollarSign, AlertTriangle, MapPin, Building, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServers } from '../state/useServers';
import { Server } from '../types';

const ServerConfigsScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { servers } = useServers();
  
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [configs, setConfigs] = useState<any>({});
  const [configsLoading, setConfigsLoading] = useState(false);

  useEffect(() => {
    if (servers.length === 1) {
      setSelectedServer(servers[0]);
      loadConfigurations(servers[0].id);
    }
  }, [servers]);

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

  const handleServerSelect = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setSelectedServer(server);
      loadConfigurations(serverId);
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
          title: "Configuration Updated",
          description: result.message || `${configName} has been updated`
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
                onClick={() => navigate('/server-settings')}
                className="text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </Button>
              
              <div>
                <h1 className="gaming-header text-xl">Server Configurations</h1>
                <p className="text-muted-foreground text-sm">
                  Configure your server settings
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
                <h3 className="text-2xl font-semibold mb-4">No Servers Available</h3>
                <p className="text-muted-foreground mb-8">
                  You need to add a server before configuring settings.
                </p>
                <Button
                  onClick={() => navigate('/add-server')}
                  className="btn-gaming"
                >
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
              onClick={() => navigate('/server-settings')}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Server Configurations</h1>
              <p className="text-muted-foreground text-sm">
                Configure your server settings and features
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Server Selection */}
          <Card className="gaming-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Economy Config Card */}
              <Card className="gaming-card border-orange-500 hover:border-orange-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-orange-500 flex items-center gap-2 text-lg">
                    <Gamepad2 className="w-5 h-5" />
                    Economy
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Currency, rewards, and gambling settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Daily Reward</Label>
                      <Input
                        placeholder="100"
                        className="bg-gray-800 border-gray-600 text-white text-sm"
                        defaultValue={configs.economy?.dailyAmount || ''}
                        onBlur={(e) => updateConfiguration('economy', 'DAILY-AMOUNT', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Starting Balance</Label>
                      <Input
                        placeholder="1000"
                        className="bg-gray-800 border-gray-600 text-white text-sm"
                        defaultValue={configs.economy?.startingBalance || ''}
                        onBlur={(e) => updateConfiguration('economy', 'STARTING-BALANCE', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Player Kill Reward</Label>
                      <Input
                        placeholder="50"
                        className="bg-gray-800 border-gray-600 text-white text-sm"
                        defaultValue={configs.economy?.playerKillsAmount || ''}
                        onBlur={(e) => updateConfiguration('economy', 'PLAYERKILLS-AMOUNT', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Blackjack</Label>
                      <Switch
                        defaultChecked={configs.economy?.blackjackToggle}
                        onCheckedChange={(checked) => updateConfiguration('economy', 'BLACKJACK-TOGGLE', checked ? 'on' : 'off')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Coinflip</Label>
                      <Switch
                        defaultChecked={configs.economy?.coinflipToggle}
                        onCheckedChange={(checked) => updateConfiguration('economy', 'COINFLIP-TOGGLE', checked ? 'on' : 'off')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Bounty System</Label>
                      <Switch
                        defaultChecked={configs.economy?.bountyToggle}
                        onCheckedChange={(checked) => updateConfiguration('economy', 'BOUNTY-TOGGLE', checked ? 'on' : 'off')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Teleports Config Card */}
              <Card className="gaming-card border-blue-500 hover:border-blue-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-500 flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5" />
                    Teleports
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Configure teleport locations and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {['TPN', 'TPNE', 'TPE', 'TPSE', 'TPS', 'TPSW', 'TPW', 'TPNW'].map((tp) => (
                      <div key={tp} className="space-y-2 p-2 bg-gray-800 rounded border border-gray-600">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-blue-400">{tp}</Label>
                          <Switch
                            size="sm"
                            defaultChecked={configs.teleports?.[tp.toLowerCase()]?.enabled}
                            onCheckedChange={(checked) => updateConfiguration('teleports', `${tp}-USE`, checked ? 'on' : 'off')}
                          />
                        </div>
                        <Input
                          placeholder="Name"
                          className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                          defaultValue={configs.teleports?.[tp.toLowerCase()]?.displayName || ''}
                          onBlur={(e) => updateConfiguration('teleports', `${tp}-NAME`, e.target.value)}
                        />
                        <Input
                          placeholder="Cooldown (min)"
                          className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                          defaultValue={configs.teleports?.[tp.toLowerCase()]?.cooldown || ''}
                          onBlur={(e) => updateConfiguration('teleports', `${tp}-TIME`, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Events Config Card */}
              <Card className="gaming-card border-yellow-500 hover:border-yellow-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-yellow-500 flex items-center gap-2 text-lg">
                    <Zap className="w-5 h-5" />
                    Events
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Bradley and Helicopter event settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {['BRADLEY', 'HELICOPTER'].map((event) => (
                    <div key={event} className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-yellow-400">{event}</Label>
                        <Switch
                          defaultChecked={configs.events?.[event.toLowerCase()]?.scout}
                          onCheckedChange={(checked) => updateConfiguration('events', `${event}-SCOUT`, checked ? 'on' : 'off')}
                        />
                      </div>
                      <Input
                        placeholder="Kill Message"
                        className="bg-gray-700 border-gray-500 text-white text-sm"
                        defaultValue={configs.events?.[event.toLowerCase()]?.killMsg || ''}
                        onBlur={(e) => updateConfiguration('events', `${event}-KILLMSG`, e.target.value)}
                      />
                      <Input
                        placeholder="Respawn Message"
                        className="bg-gray-700 border-gray-500 text-white text-sm"
                        defaultValue={configs.events?.[event.toLowerCase()]?.respawnMsg || ''}
                        onBlur={(e) => updateConfiguration('events', `${event}-RESPAWNMSG`, e.target.value)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Systems Config Card */}
              <Card className="gaming-card border-green-500 hover:border-green-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-green-500 flex items-center gap-2 text-lg">
                    <Wrench className="w-5 h-5" />
                    Systems
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Book-a-Ride, Recycler, Home TP, Prison
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Book-a-Ride */}
                  <div className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-green-400">Book-a-Ride</Label>
                      <Switch
                        defaultChecked={configs.systems?.bar?.enabled}
                        onCheckedChange={(checked) => updateConfiguration('systems', 'BAR-USE', checked ? 'on' : 'off')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Cooldown (min)"
                        className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                        defaultValue={configs.systems?.bar?.cooldown || ''}
                        onBlur={(e) => updateConfiguration('systems', 'BAR-COOLDOWN', e.target.value)}
                      />
                      <Input
                        placeholder="Fuel Amount"
                        className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                        defaultValue={configs.systems?.bar?.fuelAmount || ''}
                        onBlur={(e) => updateConfiguration('systems', 'BAR-FUEL-AMOUNT', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {['HORSE', 'RHIB', 'MINI', 'CAR'].map((vehicle) => (
                        <div key={vehicle} className="flex items-center space-x-1">
                          <Switch
                            size="sm"
                            defaultChecked={configs.systems?.bar?.[vehicle.toLowerCase()]}
                            onCheckedChange={(checked) => updateConfiguration('systems', `BAR-${vehicle}`, checked ? 'on' : 'off')}
                          />
                          <Label className="text-xs">{vehicle}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recycler */}
                  <div className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-green-400">Recycler</Label>
                      <Switch
                        defaultChecked={configs.systems?.recycler?.enabled}
                        onCheckedChange={(checked) => updateConfiguration('systems', 'RECYCLER-USE', checked ? 'on' : 'off')}
                      />
                    </div>
                    <Input
                      placeholder="Cooldown (minutes)"
                      className="bg-gray-700 border-gray-500 text-white text-sm"
                      defaultValue={configs.systems?.recycler?.cooldown || ''}
                      onBlur={(e) => updateConfiguration('systems', 'RECYCLER-TIME', e.target.value)}
                    />
                  </div>

                  {/* Home Teleport */}
                  <div className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-green-400">Home Teleport</Label>
                      <Switch
                        defaultChecked={configs.systems?.hometp?.enabled}
                        onCheckedChange={(checked) => updateConfiguration('systems', 'HOMETP-USE', checked ? 'on' : 'off')}
                      />
                    </div>
                    <Input
                      placeholder="Cooldown (minutes)"
                      className="bg-gray-700 border-gray-500 text-white text-sm"
                      defaultValue={configs.systems?.hometp?.cooldown || ''}
                      onBlur={(e) => updateConfiguration('systems', 'HOMETP-TIME', e.target.value)}
                    />
                  </div>

                  {/* Prison System */}
                  <div className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-green-400">Prison System</Label>
                      <Switch
                        defaultChecked={configs.systems?.prison?.enabled}
                        onCheckedChange={(checked) => updateConfiguration('systems', 'Prison-System', checked ? 'on' : 'off')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Zone Size"
                        className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                        defaultValue={configs.systems?.prison?.zoneSize || ''}
                        onBlur={(e) => updateConfiguration('systems', 'Prison-Z-Size', e.target.value)}
                      />
                      <Input
                        placeholder="Zone Color"
                        className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                        defaultValue={configs.systems?.prison?.zoneColor || ''}
                        onBlur={(e) => updateConfiguration('systems', 'Prison-Z-Color', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Positions Config Card */}
              <Card className="gaming-card border-purple-500 hover:border-purple-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-purple-500 flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Positions
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Outpost and Bandit position settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {['OUTPOST', 'BANDIT'].map((position) => (
                    <div key={position} className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-purple-400">{position}</Label>
                        <Switch
                          defaultChecked={configs.positions?.[position.toLowerCase()]?.enabled}
                          onCheckedChange={(checked) => updateConfiguration('positions', `${position}-ENABLE`, checked ? 'on' : 'off')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Delay (sec)"
                          className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                          defaultValue={configs.positions?.[position.toLowerCase()]?.delay || ''}
                          onBlur={(e) => updateConfiguration('positions', `${position}-DELAY`, e.target.value)}
                        />
                        <Input
                          placeholder="Cooldown (min)"
                          className="bg-gray-700 border-gray-500 text-white text-xs h-7"
                          defaultValue={configs.positions?.[position.toLowerCase()]?.cooldown || ''}
                          onBlur={(e) => updateConfiguration('positions', `${position}-COOLDOWN`, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Misc Config Card */}
              <Card className="gaming-card border-red-500 hover:border-red-400 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-500 flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5" />
                    Miscellaneous
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Crate events and Zorp system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Crate Events */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-red-400">Crate Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['CRATE-1', 'CRATE-2', 'CRATE-3', 'CRATE-4'].map((crate) => (
                        <div key={crate} className="space-y-1 p-2 bg-gray-800 rounded border border-gray-600">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-red-300">{crate}</Label>
                            <Switch
                              size="sm"
                              defaultChecked={configs.misc?.crates?.[crate.toLowerCase()]?.enabled}
                              onCheckedChange={(checked) => updateConfiguration('misc', `${crate}-ON/OFF`, checked ? 'on' : 'off')}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <Input
                              placeholder="Time (min)"
                              className="bg-gray-700 border-gray-500 text-white text-xs h-6"
                              defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.time || ''}
                              onBlur={(e) => updateConfiguration('misc', `${crate}-TIME`, e.target.value)}
                            />
                            <Input
                              placeholder="Amount"
                              className="bg-gray-700 border-gray-500 text-white text-xs h-6"
                              defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.amount || ''}
                              onBlur={(e) => updateConfiguration('misc', `${crate}-AMOUNT`, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zorp System */}
                  <div className="space-y-2 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-red-400">Zorp System</Label>
                      <Switch
                        defaultChecked={configs.misc?.zorp?.useList}
                        onCheckedChange={(checked) => updateConfiguration('misc', 'ZORP-USELIST', checked ? 'on' : 'off')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServerConfigsScreen;
