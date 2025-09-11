import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, RefreshCw, Medal, Target, Clock, Skull } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { leaderboardService } from '../lib/leaderboard';
import { PlayerStats } from '../types';

const LeaderboardScreen = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [topPlayers, setTopPlayers] = useState<PlayerStats[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = async () => {
    if (!serverId) return;
    
    try {
      setLoading(true);
      const [players, stats] = await Promise.all([
        leaderboardService.fetchTop20(serverId),
        leaderboardService.fetchMyStats(serverId, 'TestUser') // Using mock user
      ]);
      
      setTopPlayers(players);
      setMyStats(stats);
    } catch (error) {
      toast({
        title: "Failed to load leaderboard",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!serverId) return;
    
    try {
      setRefreshing(true);
      const result = await leaderboardService.refreshStats(serverId);
      
      if (result.success) {
        await loadLeaderboard();
        toast({
          title: "Stats Refreshed",
          description: result.message
        });
      }
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh stats",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [serverId]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-medium">#{position}</span>;
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
    <div className="stat-block">
      <div className={`${color} mb-2`}>
        <Icon className="w-6 h-6 mx-auto" />
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

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
              <h1 className="gaming-header text-xl">Leaderboard</h1>
              <p className="text-muted-foreground text-sm">
                Top players and your statistics
              </p>
            </div>
            
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">

          <Tabs defaultValue="leaderboard" className="space-y-8">
            <TabsList className="flex w-full gaming-card">
              <TabsTrigger value="leaderboard" className="flex-1 data-[state=active]:btn-gaming">
                Top 20 Players
              </TabsTrigger>
              <TabsTrigger value="mystats" className="flex-1 data-[state=active]:btn-gaming">
                My Stats
              </TabsTrigger>
            </TabsList>

            {/* Top 20 Leaderboard */}
            <TabsContent value="leaderboard" className="space-y-6">
              
              {/* Top 3 Podium */}
              {!loading && topPlayers.length >= 3 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
                  {/* 2nd Place */}
                  <Card className="gaming-card text-center pt-8">
                    <CardContent>
                      <div className="mb-4">
                        <Medal className="w-8 h-8 text-gray-300 mx-auto" />
                      </div>
                      <h3 className="font-semibold text-sm sm:text-lg break-words px-2">{topPlayers[1].ign}</h3>
                      <div className="text-xl sm:text-2xl font-bold text-primary mt-2">{topPlayers[1].kills}</div>
                      <div className="text-xs text-muted-foreground">KILLS</div>
                    </CardContent>
                  </Card>

                  {/* 1st Place */}
                  <Card className="gaming-card text-center pt-6 scale-110 border-yellow-400/50">
                    <CardContent>
                      <div className="mb-4">
                        <Trophy className="w-10 h-10 text-yellow-400 mx-auto" />
                      </div>
                      <h3 className="font-semibold text-base sm:text-xl break-words px-2">{topPlayers[0].ign}</h3>
                      <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mt-2">{topPlayers[0].kills}</div>
                      <div className="text-xs text-muted-foreground">KILLS</div>
                    </CardContent>
                  </Card>

                  {/* 3rd Place */}
                  <Card className="gaming-card text-center pt-8">
                    <CardContent>
                      <div className="mb-4">
                        <Medal className="w-8 h-8 text-amber-600 mx-auto" />
                      </div>
                      <h3 className="font-semibold text-sm sm:text-lg break-words px-2">{topPlayers[2].ign}</h3>
                      <div className="text-xl sm:text-2xl font-bold text-primary mt-2">{topPlayers[2].kills}</div>
                      <div className="text-xs text-muted-foreground">KILLS</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Full Leaderboard */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Full Rankings
                  </CardTitle>
                  <CardDescription>
                    Top 20 players ranked by kills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
                          <div className="w-8 h-8 bg-muted/20 rounded"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-muted/20 rounded w-1/3"></div>
                          </div>
                          <div className="w-16 h-4 bg-muted/20 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topPlayers.map((player, index) => (
                        <div
                          key={player.ign}
                          className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                            index < 3 ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center justify-center w-8">
                            {getRankIcon(index + 1)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="font-semibold">{player.ign}</div>
                            <div className="text-xs text-muted-foreground">
                              K/D: {player.kd.toFixed(2)} • {player.playtimeHours}h played
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs sm:text-sm">
                            <div>
                              <div className="font-semibold text-green-400">{player.kills}</div>
                              <div className="text-xs text-muted-foreground">Kills</div>
                            </div>
                            <div>
                              <div className="font-semibold text-red-400">{player.deaths}</div>
                              <div className="text-xs text-muted-foreground">Deaths</div>
                            </div>
                            <div>
                              <div className="font-semibold text-primary">{player.kd.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">K/D</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Stats */}
            <TabsContent value="mystats" className="space-y-6">
              {myStats ? (
                <div className="space-y-6">
                  {/* Stats Overview */}
                  <Card className="gaming-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Your Statistics
                      </CardTitle>
                      <CardDescription>
                        Personal performance on this server
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <StatCard
                          icon={Target}
                          label="Kills"
                          value={myStats.kills.toLocaleString()}
                          color="text-green-400"
                        />
                        <StatCard
                          icon={Skull}
                          label="Deaths"
                          value={myStats.deaths.toLocaleString()}
                          color="text-red-400"
                        />
                        <StatCard
                          icon={Trophy}
                          label="K/D Ratio"
                          value={myStats.kd.toFixed(2)}
                          color="text-yellow-400"
                        />
                        <StatCard
                          icon={Clock}
                          label="Playtime"
                          value={`${myStats.playtimeHours}h`}
                          color="text-blue-400"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rank Position */}
                  <Card className="gaming-card">
                    <CardContent className="text-center py-8">
                      <div className="mb-4">
                        <Badge variant="outline" className="text-lg px-4 py-2">
                          Your Rank: #{topPlayers.findIndex(p => p.ign === myStats.ign) + 1 || 'Unranked'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {topPlayers.findIndex(p => p.ign === myStats.ign) !== -1 
                          ? "You're in the top 20!" 
                          : "Keep playing to reach the top 20!"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="gaming-card text-center">
                  <CardContent className="py-12">
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No stats available</h3>
                    <p className="text-muted-foreground">
                      Start playing on this server to see your statistics
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardScreen;