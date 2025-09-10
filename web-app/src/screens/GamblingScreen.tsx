import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Dices, Coins } from 'lucide-react';
import Blackjack from '../components/gambling/Blackjack';
import Coinflip from '../components/gambling/Coinflip';
import { useState } from 'react';

const GamblingScreen = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<'blackjack' | 'coinflip' | null>(null);

  const games = [
    {
      id: 'blackjack' as const,
      title: 'Blackjack',
      description: 'Classic card game - get as close to 21 as possible',
      icon: Dices,
      color: 'text-red-400'
    },
    {
      id: 'coinflip' as const,
      title: 'Coinflip',
      description: 'Simple 50/50 chance - heads or tails',
      icon: Coins,
      color: 'text-yellow-400'
    }
  ];

  if (selectedGame === 'blackjack') {
    return <Blackjack onBack={() => setSelectedGame(null)} serverId={serverId!} />;
  }

  if (selectedGame === 'coinflip') {
    return <Coinflip onBack={() => setSelectedGame(null)} serverId={serverId!} />;
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
              onClick={() => navigate(`/server/${serverId}`)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hub
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Gambling</h1>
              <p className="text-muted-foreground text-sm">
                Test your luck and skill
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Game</h2>
            <p className="text-muted-foreground text-lg">
              Select a gambling game to start playing
            </p>
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {games.map((game) => (
              <Card
                key={game.id}
                className="gaming-card-interactive cursor-pointer group"
                onClick={() => setSelectedGame(game.id)}
              >
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 p-6 rounded-full bg-gaming-surface group-hover:bg-primary/10 transition-colors">
                    <game.icon className={`w-12 h-12 ${game.color} group-hover:text-primary transition-colors`} />
                  </div>
                  <CardTitle className="text-2xl">{game.title}</CardTitle>
                  <CardDescription className="text-center text-base">
                    {game.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <Button
                    className="w-full btn-gaming group-hover:scale-105 transition-transform"
                    size="lg"
                  >
                    Play {game.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Section */}
          <div className="gaming-card p-6 mt-12">
            <h3 className="text-lg font-semibold mb-4">Gambling Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
              <div>
                <h4 className="font-medium text-foreground mb-2">Blackjack</h4>
                <ul className="space-y-1">
                  <li>• Get as close to 21 as possible without going over</li>
                  <li>• Aces count as 1 or 11, face cards count as 10</li>
                  <li>• Hit to take another card, Stand to keep your total</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-2">Coinflip</h4>
                <ul className="space-y-1">
                  <li>• Choose heads or tails</li>
                  <li>• Set your bet amount</li>
                  <li>• Win double your bet if you guess correctly</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GamblingScreen;