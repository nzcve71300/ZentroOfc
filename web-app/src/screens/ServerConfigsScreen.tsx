import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Gamepad2, Target, Zap, Wrench, Shield, Users, Settings, DollarSign, MessageSquare, Home, Recycle, Lock } from 'lucide-react';

interface ServerConfigsScreenProps {}

const ServerConfigsScreen: React.FC<ServerConfigsScreenProps> = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<any>(null);

  useEffect(() => {
    // Load server configurations
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      // This would load from your API
      // For now, using mock data structure
      setConfigs({
        economy: {
          dailyAmount: 100,
          startingBalance: 1000,
          playerKillsAmount: 50,
          miscKillsAmount: 25,
          blackjackMin: 10,
          blackjackMax: 1000,
          coinflipMin: 10,
          coinflipMax: 1000,
          bountyRewards: 100,
          killfeedSetup: '{Killer} ☠️ {Victim}',
          blackjackToggle: true,
          coinflipToggle: true,
          bountyToggle: true,
          killfeedToggle: true,
          killfeedRandomizer: false
        },
        teleports: {
          tpn: { enabled: true, cooldown: 60, delay: 0, displayName: 'North', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpne: { enabled: true, cooldown: 60, delay: 0, displayName: 'Northeast', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpe: { enabled: true, cooldown: 60, delay: 0, displayName: 'East', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpse: { enabled: true, cooldown: 60, delay: 0, displayName: 'Southeast', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tps: { enabled: true, cooldown: 60, delay: 0, displayName: 'South', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpsw: { enabled: true, cooldown: 60, delay: 0, displayName: 'Southwest', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpw: { enabled: true, cooldown: 60, delay: 0, displayName: 'West', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 },
          tpnw: { enabled: true, cooldown: 60, delay: 0, displayName: 'Northwest', useList: false, useDelay: false, useKit: false, kitName: '', coordinates: '0,0,0', combatLock: false, combatLockTime: 0 }
        },
        events: {
          bradley: { scout: true, killMsg: '<color=#00ffff>Brad got taken</color>', respawnMsg: '<color=#00ffff>Bradley APC has respawned</color>' },
          helicopter: { scout: true, killMsg: '<color=#00ffff>Heli got taken</color>', respawnMsg: '<color=#00ffff>Patrol Helicopter has respawned</color>' }
        },
        systems: {
          bar: { enabled: true, cooldown: 300, fuelAmount: 100, welcomeMsgText: 'Welcome to Book-a-Ride!', useList: false, welcomeMessage: true, horse: true, rhib: true, mini: false, car: false },
          recycler: { enabled: false, useList: false, cooldown: 5 },
          hometp: { enabled: false, useList: false, cooldown: 5 },
          prison: { enabled: false, zoneSize: 50, zoneColor: '(255,0,0)' }
        },
        positions: {
          outpost: { enabled: true, delay: 0, cooldown: 5, combatLock: false, combatLockTime: 0 },
          bandit: { enabled: true, delay: 0, cooldown: 5, combatLock: false, combatLockTime: 0 }
        },
        misc: {
          crates: {
            'crate-1': { enabled: false, time: 60, amount: 1, message: '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>' },
            'crate-2': { enabled: false, time: 60, amount: 1, message: '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>' },
            'crate-3': { enabled: false, time: 60, amount: 1, message: '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>' },
            'crate-4': { enabled: false, time: 60, amount: 1, message: '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>' }
          },
          zorp: { useList: false }
        }
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading configurations:', error);
      setLoading(false);
    }
  };

  const updateConfiguration = async (category: string, config: string, value: any) => {
    try {
      // Map the config to the Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      // Map economy configs
      if (category === 'economy') {
        switch (config) {
          case 'dailyAmount':
            discordConfig = 'DAILY-AMOUNT';
            break;
          case 'startingBalance':
            discordConfig = 'STARTING-BALANCE';
            break;
          case 'playerKillsAmount':
            discordConfig = 'PLAYERKILLS-AMOUNT';
            break;
          case 'misckillsAmount':
            discordConfig = 'MISCKILLS-AMOUNT';
            break;
          case 'blackjackMin':
            discordConfig = 'BLACKJACK-MIN';
            break;
          case 'blackjackMax':
            discordConfig = 'BLACKJACK-MAX';
            break;
          case 'coinflipMin':
            discordConfig = 'COINFLIP-MIN';
            break;
          case 'coinflipMax':
            discordConfig = 'COINFLIP-MAX';
            break;
          case 'bountyRewards':
            discordConfig = 'BOUNTY-REWARDS';
            break;
          case 'killfeedSetup':
            discordConfig = 'KILLFEED-SETUP';
            break;
          case 'blackjackToggle':
            discordConfig = 'BLACKJACK-TOGGLE';
            discordOption = value ? 'on' : 'off';
            break;
          case 'coinflipToggle':
            discordConfig = 'COINFLIP-TOGGLE';
            discordOption = value ? 'on' : 'off';
            break;
          case 'bountyToggle':
            discordConfig = 'BOUNTY-TOGGLE';
            discordOption = value ? 'on' : 'off';
            break;
          case 'killfeedToggle':
            discordConfig = 'KILLFEEDGAME';
            discordOption = value ? 'on' : 'off';
            break;
          case 'killfeedRandomizer':
            discordConfig = 'KILLFEED-RANDOMIZER';
            discordOption = value ? 'on' : 'off';
            break;
        }
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            [category]: {
              ...prev[category],
              [config]: value
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating configuration:', error);
    }
  };

  const updateTeleportConfig = async (teleport: string, config: string, value: any) => {
    try {
      // Map teleport config to Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      const teleportUpper = teleport.toUpperCase();
      
      switch (config) {
        case 'enabled':
          discordConfig = `${teleportUpper}-USE`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'cooldown':
          discordConfig = `${teleportUpper}-TIME`;
          break;
        case 'delay':
          discordConfig = `${teleportUpper}-DELAYTIME`;
          break;
        case 'displayName':
          discordConfig = `${teleportUpper}-NAME`;
          break;
        case 'useList':
          discordConfig = `${teleportUpper}-USELIST`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'useDelay':
          discordConfig = `${teleportUpper}-USE-DELAY`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'useKit':
          discordConfig = `${teleportUpper}-USE-KIT`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'kitName':
          discordConfig = `${teleportUpper}-KITNAME`;
          break;
        case 'coordinates':
          discordConfig = `${teleportUpper}-COORDINATES`;
          break;
        case 'combatLock':
          discordConfig = `${teleportUpper}-CBL`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'combatLockTime':
          discordConfig = `${teleportUpper}-CBL-TIME`;
          break;
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Teleport configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            teleports: {
              ...prev.teleports,
              [teleport]: {
                ...prev.teleports[teleport],
                [config]: value
              }
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating teleport configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating teleport configuration:', error);
    }
  };

  const updateEventConfig = async (event: string, config: string, value: any) => {
    try {
      // Map event config to Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      const eventUpper = event.toUpperCase();
      
      switch (config) {
        case 'scout':
          discordConfig = `${eventUpper}-SCOUT`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'killMsg':
          discordConfig = `${eventUpper}-KILLMSG`;
          break;
        case 'respawnMsg':
          discordConfig = `${eventUpper}-RESPAWNMSG`;
          break;
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Event configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            events: {
              ...prev.events,
              [event]: {
                ...prev.events[event],
                [config]: value
              }
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating event configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating event configuration:', error);
    }
  };

  const updateSystemConfig = async (system: string, config: string, value: any) => {
    try {
      // Map system config to Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      switch (system) {
        case 'bar':
          switch (config) {
            case 'enabled':
              discordConfig = 'BAR-USE';
              discordOption = value ? 'on' : 'off';
              break;
            case 'cooldown':
              discordConfig = 'BAR-COOLDOWN';
              break;
            case 'fuelAmount':
              discordConfig = 'BAR-FUEL-AMOUNT';
              break;
            case 'welcomeMsgText':
              discordConfig = 'BAR-WELCOME-MSG-TEXT';
              break;
            case 'useList':
              discordConfig = 'BAR-USELIST';
              discordOption = value ? 'on' : 'off';
              break;
            case 'welcomeMessage':
              discordConfig = 'BAR-WELCOME-MESSAGE';
              discordOption = value ? 'on' : 'off';
              break;
            case 'horse':
              discordConfig = 'BAR-HORSE';
              discordOption = value ? 'on' : 'off';
              break;
            case 'rhib':
              discordConfig = 'BAR-RHIB';
              discordOption = value ? 'on' : 'off';
              break;
            case 'mini':
              discordConfig = 'BAR-MINI';
              discordOption = value ? 'on' : 'off';
              break;
            case 'car':
              discordConfig = 'BAR-CAR';
              discordOption = value ? 'on' : 'off';
              break;
          }
          break;
        case 'recycler':
          switch (config) {
            case 'enabled':
              discordConfig = 'RECYCLER-USE';
              discordOption = value ? 'on' : 'off';
              break;
            case 'useList':
              discordConfig = 'RECYCLER-USELIST';
              discordOption = value ? 'on' : 'off';
              break;
            case 'cooldown':
              discordConfig = 'RECYCLER-TIME';
              break;
          }
          break;
        case 'hometp':
          switch (config) {
            case 'enabled':
              discordConfig = 'HOMETP-USE';
              discordOption = value ? 'on' : 'off';
              break;
            case 'useList':
              discordConfig = 'HOMETP-USELIST';
              discordOption = value ? 'on' : 'off';
              break;
            case 'cooldown':
              discordConfig = 'HOMETP-TIME';
              break;
          }
          break;
        case 'prison':
          switch (config) {
            case 'enabled':
              discordConfig = 'Prison-System';
              discordOption = value ? 'on' : 'off';
              break;
            case 'zoneSize':
              discordConfig = 'Prison-Z-Size';
              break;
            case 'zoneColor':
              discordConfig = 'Prison-Z-Color';
              break;
          }
          break;
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('System configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            systems: {
              ...prev.systems,
              [system]: {
                ...prev.systems[system],
                [config]: value
              }
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating system configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating system configuration:', error);
    }
  };

  const updatePositionConfig = async (position: string, config: string, value: any) => {
    try {
      // Map position config to Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      const positionUpper = position.toUpperCase();
      
      switch (config) {
        case 'enabled':
          discordConfig = positionUpper;
          discordOption = value ? 'on' : 'off';
          break;
        case 'delay':
          discordConfig = `${positionUpper}-DELAY`;
          break;
        case 'cooldown':
          discordConfig = `${positionUpper}-COOLDOWN`;
          break;
        case 'combatLock':
          discordConfig = `${positionUpper}-CBL`;
          discordOption = value ? 'on' : 'off';
          break;
        case 'combatLockTime':
          discordConfig = `${positionUpper}-CBL-TIME`;
          break;
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Position configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            positions: {
              ...prev.positions,
              [position]: {
                ...prev.positions[position],
                [config]: value
              }
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating position configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating position configuration:', error);
    }
  };

  const updateCrateConfig = async (crate: string, config: string, value: any) => {
    try {
      // Map crate config to Discord bot format
      let discordConfig = '';
      let discordOption = value;
      
      const crateUpper = crate.toUpperCase();
      
      switch (config) {
        case 'enabled':
          discordConfig = crateUpper;
          discordOption = value ? 'on' : 'off';
          break;
        case 'time':
          discordConfig = `${crateUpper}-TIME`;
          break;
        case 'amount':
          discordConfig = `${crateUpper}-AMOUNT`;
          break;
        case 'message':
          discordConfig = `${crateUpper}-MSG`;
          break;
      }
      
      if (discordConfig) {
        const response = await fetch(`/api/servers/${selectedServer?.id}/configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: discordConfig,
            option: discordOption,
            server: selectedServer?.name
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Crate configuration updated:', result.message);
          
          // Update local state
          setConfigs((prev: any) => ({
            ...prev,
            misc: {
              ...prev.misc,
              crates: {
                ...prev.misc.crates,
                [crate]: {
                  ...prev.misc.crates[crate],
                  [config]: value
                }
              }
            }
          }));
        } else {
          const error = await response.json();
          console.error('Error updating crate configuration:', error);
        }
      }
    } catch (error) {
      console.error('Error updating crate configuration:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading configurations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/server-settings')}
            className="text-white hover:bg-gray-800 w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Server Settings</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Server Configurations</h1>
        </div>

        {/* Configuration Cards Grid - Mobile First */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          
          {/* Economy Configuration */}
          <Card className="gaming-card border-orange-500 hover:border-orange-400 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-500 flex items-center gap-2 text-sm sm:text-base">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                Economy Settings
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Currency, rewards, and gambling configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {/* Daily Reward */}
              <div className="space-y-1 sm:space-y-2">
                <div>
                  <Label className="text-white text-xs sm:text-sm">Daily Reward Amount</Label>
                  <p className="text-gray-400 text-xs">Amount players receive daily from /daily command</p>
                </div>
                <Input
                  placeholder="100"
                  className="bg-gray-700 border-gray-600 text-white text-xs sm:text-sm h-8 sm:h-10"
                  defaultValue={configs.economy?.dailyAmount || ''}
                  onBlur={(e) => updateConfiguration('economy', 'dailyAmount', e.target.value)}
                />
              </div>

              {/* Starting Balance */}
              <div className="space-y-1 sm:space-y-2">
                <div>
                  <Label className="text-white text-xs sm:text-sm">Starting Balance</Label>
                  <p className="text-gray-400 text-xs">Initial currency amount for new players</p>
                </div>
                <Input
                  placeholder="1000"
                  className="bg-gray-700 border-gray-600 text-white text-xs sm:text-sm h-8 sm:h-10"
                  defaultValue={configs.economy?.startingBalance || ''}
                  onBlur={(e) => updateConfiguration('economy', 'startingBalance', e.target.value)}
                />
              </div>

              {/* Player Kill Reward */}
              <div className="space-y-1 sm:space-y-2">
                <div>
                  <Label className="text-white text-xs sm:text-sm">Player Kill Reward</Label>
                  <p className="text-gray-400 text-xs">Currency reward for killing other players</p>
                </div>
                <Input
                  placeholder="50"
                  className="bg-gray-700 border-gray-600 text-white text-xs sm:text-sm h-8 sm:h-10"
                  defaultValue={configs.economy?.playerKillsAmount || ''}
                  onBlur={(e) => updateConfiguration('economy', 'playerKillsAmount', e.target.value)}
                />
              </div>

              {/* Misc Kill Reward */}
              <div className="space-y-1 sm:space-y-2">
                <div>
                  <Label className="text-white text-xs sm:text-sm">Misc Kill Reward</Label>
                  <p className="text-gray-400 text-xs">Currency reward for killing NPCs and animals</p>
                </div>
                <Input
                  placeholder="25"
                  className="bg-gray-700 border-gray-600 text-white text-xs sm:text-sm h-8 sm:h-10"
                  defaultValue={configs.economy?.misckillsAmount || ''}
                  onBlur={(e) => updateConfiguration('economy', 'misckillsAmount', e.target.value)}
                />
              </div>

              {/* Bounty Rewards */}
              <div className="space-y-1 sm:space-y-2">
                <div>
                  <Label className="text-white text-xs sm:text-sm">Bounty Rewards Amount</Label>
                  <p className="text-gray-400 text-xs">Currency amount for completing bounty contracts</p>
                </div>
                <Input
                  placeholder="100"
                  className="bg-gray-700 border-gray-600 text-white text-xs sm:text-sm h-8 sm:h-10"
                  defaultValue={configs.economy?.bountyRewards || ''}
                  onBlur={(e) => updateConfiguration('economy', 'bountyRewards', e.target.value)}
                />
              </div>

              {/* Blackjack Settings */}
              <div className="space-y-2 p-2 sm:p-3 bg-gray-800 rounded-lg">
                <div>
                  <Label className="text-white text-xs sm:text-sm font-semibold">Blackjack Settings</Label>
                  <p className="text-gray-400 text-xs">Configure gambling game limits and availability</p>
                </div>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Min Bet</p>
                    <Input
                      placeholder="Min Bet"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.economy?.blackjackMin || ''}
                      onBlur={(e) => updateConfiguration('economy', 'blackjackMin', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Max Bet</p>
                    <Input
                      placeholder="Max Bet"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.economy?.blackjackMax || ''}
                      onBlur={(e) => updateConfiguration('economy', 'blackjackMax', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={configs.economy?.blackjackToggle || false}
                    onCheckedChange={(checked) => updateConfiguration('economy', 'blackjackToggle', checked)}
                    className="scale-75 sm:scale-100"
                  />
                  <Label className="text-white text-xs">Enable Blackjack</Label>
                </div>
              </div>

              {/* Coinflip Settings */}
              <div className="space-y-2 p-2 sm:p-3 bg-gray-800 rounded-lg">
                <div>
                  <Label className="text-white text-xs sm:text-sm font-semibold">Coinflip Settings</Label>
                  <p className="text-gray-400 text-xs">Configure 50/50 gambling game limits and availability</p>
                </div>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Min Bet</p>
                    <Input
                      placeholder="Min Bet"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.economy?.coinflipMin || ''}
                      onBlur={(e) => updateConfiguration('economy', 'coinflipMin', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Max Bet</p>
                    <Input
                      placeholder="Max Bet"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.economy?.coinflipMax || ''}
                      onBlur={(e) => updateConfiguration('economy', 'coinflipMax', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={configs.economy?.coinflipToggle || false}
                    onCheckedChange={(checked) => updateConfiguration('economy', 'coinflipToggle', checked)}
                    className="scale-75 sm:scale-100"
                  />
                  <Label className="text-white text-xs">Enable Coinflip</Label>
                </div>
              </div>

              {/* Killfeed Settings */}
              <div className="space-y-2 p-2 sm:p-3 bg-gray-800 rounded-lg">
                <div>
                  <Label className="text-white text-xs sm:text-sm font-semibold">Killfeed Settings</Label>
                  <p className="text-gray-400 text-xs">Configure kill notification messages and features</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Message Format</p>
                  <Input
                    placeholder="{Killer} ☠️ {Victim}"
                    className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                    defaultValue={configs.economy?.killfeedSetup || ''}
                    onBlur={(e) => updateConfiguration('economy', 'killfeedSetup', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <Switch
                      checked={configs.economy?.killfeedToggle || false}
                      onCheckedChange={(checked) => updateConfiguration('economy', 'killfeedToggle', checked)}
                      className="scale-75 sm:scale-100"
                    />
                    <Label className="text-white text-xs">Enable Killfeed</Label>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <Switch
                      checked={configs.economy?.killfeedRandomizer || false}
                      onCheckedChange={(checked) => updateConfiguration('economy', 'killfeedRandomizer', checked)}
                      className="scale-75 sm:scale-100"
                    />
                    <Label className="text-white text-xs">Randomizer</Label>
                  </div>
                </div>
              </div>

              {/* Bounty Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={configs.economy?.bountyToggle || false}
                  onCheckedChange={(checked) => updateConfiguration('economy', 'bountyToggle', checked)}
                  className="scale-75 sm:scale-100"
                />
                <Label className="text-white text-xs sm:text-sm">Enable Bounty System</Label>
              </div>
            </CardContent>
          </Card>

          {/* Teleports Configuration */}
          <Card className="gaming-card border-blue-500 hover:border-blue-400 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-500 flex items-center gap-2 text-sm sm:text-base">
                <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                Teleport Settings
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Configure all 8 teleport locations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {['TPN', 'TPNE', 'TPE', 'TPSE', 'TPS', 'TPSW', 'TPW', 'TPNW'].map((tp) => (
                <div key={tp} className="space-y-2 p-2 sm:p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-xs sm:text-sm font-semibold">{tp} Teleport</Label>
                    <Switch
                      checked={configs.teleports?.[tp.toLowerCase()]?.enabled || false}
                      onCheckedChange={(checked) => updateTeleportConfig(tp.toLowerCase(), 'enabled', checked)}
                      className="scale-75 sm:scale-100"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 sm:gap-2">
                    <Input
                      placeholder="Display Name"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.teleports?.[tp.toLowerCase()]?.displayName || ''}
                      onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'displayName', e.target.value)}
                    />
                    <Input
                      placeholder="Cooldown (min)"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.teleports?.[tp.toLowerCase()]?.cooldown || ''}
                      onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'cooldown', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 sm:gap-2">
                    <Input
                      placeholder="Delay (sec)"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.teleports?.[tp.toLowerCase()]?.delay || ''}
                      onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'delay', e.target.value)}
                    />
                    <Input
                      placeholder="Kit Name"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.teleports?.[tp.toLowerCase()]?.kitName || ''}
                      onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'kitName', e.target.value)}
                    />
                  </div>
                  
                  <Input
                    placeholder="Coordinates (x,y,z)"
                    className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                    defaultValue={configs.teleports?.[tp.toLowerCase()]?.coordinates || ''}
                    onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'coordinates', e.target.value)}
                  />
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                    <div className="flex items-center space-x-1">
                      <Switch
                        checked={configs.teleports?.[tp.toLowerCase()]?.useList || false}
                        onCheckedChange={(checked) => updateTeleportConfig(tp.toLowerCase(), 'useList', checked)}
                        className="scale-75 sm:scale-100"
                      />
                      <Label className="text-white text-xs">Use List</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Switch
                        checked={configs.teleports?.[tp.toLowerCase()]?.useDelay || false}
                        onCheckedChange={(checked) => updateTeleportConfig(tp.toLowerCase(), 'useDelay', checked)}
                        className="scale-75 sm:scale-100"
                      />
                      <Label className="text-white text-xs">Use Delay</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Switch
                        checked={configs.teleports?.[tp.toLowerCase()]?.useKit || false}
                        onCheckedChange={(checked) => updateTeleportConfig(tp.toLowerCase(), 'useKit', checked)}
                        className="scale-75 sm:scale-100"
                      />
                      <Label className="text-white text-xs">Use Kit</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Switch
                        checked={configs.teleports?.[tp.toLowerCase()]?.combatLock || false}
                        onCheckedChange={(checked) => updateTeleportConfig(tp.toLowerCase(), 'combatLock', checked)}
                        className="scale-75 sm:scale-100"
                      />
                      <Label className="text-white text-xs">Combat Lock</Label>
                    </div>
                  </div>
                  
                  {configs.teleports?.[tp.toLowerCase()]?.combatLock && (
                    <Input
                      placeholder="Combat Lock Time (min)"
                      className="bg-gray-700 border-gray-600 text-white text-xs h-7 sm:h-8"
                      defaultValue={configs.teleports?.[tp.toLowerCase()]?.combatLockTime || ''}
                      onBlur={(e) => updateTeleportConfig(tp.toLowerCase(), 'combatLockTime', e.target.value)}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Events Configuration */}
          <Card className="gaming-card border-yellow-500 hover:border-yellow-400 transition-colors">
            <CardHeader>
              <CardTitle className="text-yellow-500 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Event Settings
              </CardTitle>
              <CardDescription>
                Bradley and Helicopter event configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['BRADLEY', 'HELICOPTER'].map((event) => (
                <div key={event} className="space-y-2 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-sm font-semibold">{event} Event</Label>
                    <Switch
                      checked={configs.events?.[event.toLowerCase()]?.scout || false}
                      onCheckedChange={(checked) => updateEventConfig(event.toLowerCase(), 'scout', checked)}
                    />
                  </div>
                  
                  <Input
                    placeholder="Kill Message"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.events?.[event.toLowerCase()]?.killMsg || ''}
                    onBlur={(e) => updateEventConfig(event.toLowerCase(), 'killMsg', e.target.value)}
                  />
                  
                  <Input
                    placeholder="Respawn Message"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.events?.[event.toLowerCase()]?.respawnMsg || ''}
                    onBlur={(e) => updateEventConfig(event.toLowerCase(), 'respawnMsg', e.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Systems Configuration */}
          <Card className="gaming-card border-green-500 hover:border-green-400 transition-colors">
            <CardHeader>
              <CardTitle className="text-green-500 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                System Settings
              </CardTitle>
              <CardDescription>
                Book-a-Ride, Recycler, Home TP, and Prison systems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Book-a-Ride (BAR) */}
              <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm font-semibold">Book-a-Ride (BAR)</Label>
                  <Switch
                    checked={configs.systems?.bar?.enabled || false}
                    onCheckedChange={(checked) => updateSystemConfig('bar', 'enabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Cooldown (min)"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.bar?.cooldown || ''}
                    onBlur={(e) => updateSystemConfig('bar', 'cooldown', e.target.value)}
                  />
                  <Input
                    placeholder="Fuel Amount"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.bar?.fuelAmount || ''}
                    onBlur={(e) => updateSystemConfig('bar', 'fuelAmount', e.target.value)}
                  />
                </div>
                
                <Input
                  placeholder="Welcome Message Text"
                  className="bg-gray-700 border-gray-600 text-white text-xs"
                  defaultValue={configs.systems?.bar?.welcomeMsgText || ''}
                  onBlur={(e) => updateSystemConfig('bar', 'welcomeMsgText', e.target.value)}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configs.systems?.bar?.useList || false}
                      onCheckedChange={(checked) => updateSystemConfig('bar', 'useList', checked)}
                    />
                    <Label className="text-white text-xs">Use List</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configs.systems?.bar?.welcomeMessage || false}
                      onCheckedChange={(checked) => updateSystemConfig('bar', 'welcomeMessage', checked)}
                    />
                    <Label className="text-white text-xs">Welcome Message</Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {['HORSE', 'RHIB', 'MINI', 'CAR'].map((vehicle) => (
                    <div key={vehicle} className="flex items-center space-x-2">
                      <Switch
                        checked={configs.systems?.bar?.[vehicle.toLowerCase()] || false}
                        onCheckedChange={(checked) => updateSystemConfig('bar', vehicle.toLowerCase(), checked)}
                      />
                      <Label className="text-white text-xs">{vehicle}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recycler */}
              <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm font-semibold">Recycler</Label>
                  <Switch
                    checked={configs.systems?.recycler?.enabled || false}
                    onCheckedChange={(checked) => updateSystemConfig('recycler', 'enabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configs.systems?.recycler?.useList || false}
                      onCheckedChange={(checked) => updateSystemConfig('recycler', 'useList', checked)}
                    />
                    <Label className="text-white text-xs">Use List</Label>
                  </div>
                  <Input
                    placeholder="Cooldown (min)"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.recycler?.cooldown || ''}
                    onBlur={(e) => updateSystemConfig('recycler', 'cooldown', e.target.value)}
                  />
                </div>
              </div>

              {/* Home Teleport */}
              <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm font-semibold">Home Teleport</Label>
                  <Switch
                    checked={configs.systems?.hometp?.enabled || false}
                    onCheckedChange={(checked) => updateSystemConfig('hometp', 'enabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configs.systems?.hometp?.useList || false}
                      onCheckedChange={(checked) => updateSystemConfig('hometp', 'useList', checked)}
                    />
                    <Label className="text-white text-xs">Use List</Label>
                  </div>
                  <Input
                    placeholder="Cooldown (min)"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.hometp?.cooldown || ''}
                    onBlur={(e) => updateSystemConfig('hometp', 'cooldown', e.target.value)}
                  />
                </div>
              </div>

              {/* Prison System */}
              <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm font-semibold">Prison System</Label>
                  <Switch
                    checked={configs.systems?.prison?.enabled || false}
                    onCheckedChange={(checked) => updateSystemConfig('prison', 'enabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Zone Size"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.prison?.zoneSize || ''}
                    onBlur={(e) => updateSystemConfig('prison', 'zoneSize', e.target.value)}
                  />
                  <Input
                    placeholder="Zone Color (R,G,B)"
                    className="bg-gray-700 border-gray-600 text-white text-xs"
                    defaultValue={configs.systems?.prison?.zoneColor || ''}
                    onBlur={(e) => updateSystemConfig('prison', 'zoneColor', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Positions Configuration */}
          <Card className="gaming-card border-purple-500 hover:border-purple-400 transition-colors">
            <CardHeader>
              <CardTitle className="text-purple-500 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Position Settings
              </CardTitle>
              <CardDescription>
                Outpost and Bandit position configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['OUTPOST', 'BANDIT'].map((position) => (
                <div key={position} className="space-y-2 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-sm font-semibold">{position}</Label>
                    <Switch
                      checked={configs.positions?.[position.toLowerCase()]?.enabled || false}
                      onCheckedChange={(checked) => updatePositionConfig(position.toLowerCase(), 'enabled', checked)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Delay (sec)"
                      className="bg-gray-700 border-gray-600 text-white text-xs"
                      defaultValue={configs.positions?.[position.toLowerCase()]?.delay || ''}
                      onBlur={(e) => updatePositionConfig(position.toLowerCase(), 'delay', e.target.value)}
                    />
                    <Input
                      placeholder="Cooldown (min)"
                      className="bg-gray-700 border-gray-600 text-white text-xs"
                      defaultValue={configs.positions?.[position.toLowerCase()]?.cooldown || ''}
                      onBlur={(e) => updatePositionConfig(position.toLowerCase(), 'cooldown', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={configs.positions?.[position.toLowerCase()]?.combatLock || false}
                        onCheckedChange={(checked) => updatePositionConfig(position.toLowerCase(), 'combatLock', checked)}
                      />
                      <Label className="text-white text-xs">Combat Lock</Label>
                    </div>
                    {configs.positions?.[position.toLowerCase()]?.combatLock && (
                      <Input
                        placeholder="Combat Lock Time (min)"
                        className="bg-gray-700 border-gray-600 text-white text-xs"
                        defaultValue={configs.positions?.[position.toLowerCase()]?.combatLockTime || ''}
                        onBlur={(e) => updatePositionConfig(position.toLowerCase(), 'combatLockTime', e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Miscellaneous Configuration */}
          <Card className="gaming-card border-red-500 hover:border-red-400 transition-colors">
            <CardHeader>
              <CardTitle className="text-red-500 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Miscellaneous Settings
              </CardTitle>
              <CardDescription>
                Crate events and Zorp system configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Crate Events */}
              <div className="space-y-2">
                <Label className="text-white text-sm font-semibold">Crate Events</Label>
                {['CRATE-1', 'CRATE-2', 'CRATE-3', 'CRATE-4'].map((crate) => (
                  <div key={crate} className="space-y-2 p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-semibold">{crate}</span>
                      <Switch
                        checked={configs.misc?.crates?.[crate.toLowerCase()]?.enabled || false}
                        onCheckedChange={(checked) => updateCrateConfig(crate.toLowerCase(), 'enabled', checked)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Time (min)"
                        className="bg-gray-700 border-gray-600 text-white text-xs"
                        defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.time || ''}
                        onBlur={(e) => updateCrateConfig(crate.toLowerCase(), 'time', e.target.value)}
                      />
                      <Input
                        placeholder="Amount (max 2)"
                        className="bg-gray-700 border-gray-600 text-white text-xs"
                        defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.amount || ''}
                        onBlur={(e) => updateCrateConfig(crate.toLowerCase(), 'amount', e.target.value)}
                      />
                    </div>
                    
                    <Input
                      placeholder="Spawn Message"
                      className="bg-gray-700 border-gray-600 text-white text-xs"
                      defaultValue={configs.misc?.crates?.[crate.toLowerCase()]?.message || ''}
                      onBlur={(e) => updateCrateConfig(crate.toLowerCase(), 'message', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Zorp System */}
              <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
                <Label className="text-white text-sm font-semibold">Zorp System</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={configs.misc?.zorp?.useList || false}
                    onCheckedChange={(checked) => updateConfiguration('misc', 'zorp', { ...configs.misc?.zorp, useList: checked })}
                  />
                  <Label className="text-white text-sm">Use List</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ServerConfigsScreen;