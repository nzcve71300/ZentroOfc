import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CoinflipProps {
  onBack: () => void;
  serverId: string;
}

type CoinSide = 'heads' | 'tails';

interface GameState {
  status: 'betting' | 'flipping' | 'finished';
  playerChoice: CoinSide | null;
  result: CoinSide | null;
  won: boolean;
  betAmount: number;
}

const Coinflip = ({ onBack, serverId }: CoinflipProps) => {
  const { toast } = useToast();
  const [balance] = useState(2450); // Mock balance
  const [betAmount, setBetAmount] = useState(100);
  const [gameState, setGameState] = useState<GameState>({
    status: 'betting',
    playerChoice: null,
    result: null,
    won: false,
    betAmount: 0
  });

  const selectSide = (side: CoinSide) => {
    setGameState(prev => ({ ...prev, playerChoice: side }));
  };

  // INSERT GAME LOGIC HERE - Replace with actual game mechanics
  const flipCoin = async () => {
    if (!gameState.playerChoice) {
      toast({
        title: "No Selection",
        description: "Please choose heads or tails first",
        variant: "destructive"
      });
      return;
    }

    if (betAmount > balance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough coins for this bet",
        variant: "destructive"
      });
      return;
    }

    if (betAmount < 1) {
      toast({
        title: "Invalid Bet",
        description: "Please enter a valid bet amount",
        variant: "destructive"
      });
      return;
    }

    // Set flipping state
    setGameState(prev => ({ 
      ...prev, 
      status: 'flipping',
      betAmount 
    }));

    // Simulate coin flip animation delay
    setTimeout(() => {
      // Generate random result
      const result: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === gameState.playerChoice;

      setGameState(prev => ({
        ...prev,
        status: 'finished',
        result,
        won
      }));

      // Show result toast
      if (won) {
        toast({
          title: "You Won! 🎉",
          description: `${result.toUpperCase()}! You won ${betAmount * 2} coins!`,
        });
      } else {
        toast({
          title: "You Lost",
          description: `${result.toUpperCase()}! You lost ${betAmount} coins.`,
          variant: "destructive"
        });
      }
    }, 2000);
  };

  const resetGame = () => {
    setGameState({
      status: 'betting',
      playerChoice: null,
      result: null,
      won: false,
      betAmount: 0
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Games
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Coinflip</h1>
              <p className="text-muted-foreground text-sm">
                Balance: {balance.toLocaleString()} coins
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Betting Section */}
          {gameState.status === 'betting' && (
            <div className="space-y-6">
              {/* Bet Amount */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle>Set Your Bet</CardTitle>
                  <CardDescription>
                    Choose how much you want to wager
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="bet">Bet Amount (coins)</Label>
                    <Input
                      id="bet"
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                      min={1}
                      max={balance}
                      className="gaming-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Win 2x your bet amount if you guess correctly
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Side Selection */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle>Choose Your Side</CardTitle>
                  <CardDescription>
                    Select heads or tails for the coin flip
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={gameState.playerChoice === 'heads' ? "default" : "outline"}
                      className={`h-24 text-lg ${gameState.playerChoice === 'heads' ? 'btn-gaming' : 'btn-gaming-secondary'}`}
                      onClick={() => selectSide('heads')}
                    >
                      <div className="text-center">
                        <Coins className="w-8 h-8 mx-auto mb-2" />
                        <div>Heads</div>
                      </div>
                    </Button>
                    
                    <Button
                      variant={gameState.playerChoice === 'tails' ? "default" : "outline"}
                      className={`h-24 text-lg ${gameState.playerChoice === 'tails' ? 'btn-gaming' : 'btn-gaming-secondary'}`}
                      onClick={() => selectSide('tails')}
                    >
                      <div className="text-center">
                        <Coins className="w-8 h-8 mx-auto mb-2 rotate-180" />
                        <div>Tails</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Flip Button */}
              <Button
                onClick={flipCoin}
                disabled={!gameState.playerChoice || betAmount < 1 || betAmount > balance}
                className="w-full btn-gaming text-lg py-6"
              >
                Flip Coin for {betAmount} coins
              </Button>
            </div>
          )}

          {/* Flipping Animation */}
          {gameState.status === 'flipping' && (
            <Card className="gaming-card text-center">
              <CardContent className="py-16">
                <div className="animate-spin w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-gaming flex items-center justify-center">
                  <Coins className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">Flipping...</h3>
                <p className="text-muted-foreground">
                  You chose {gameState.playerChoice?.toUpperCase()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {gameState.status === 'finished' && (
            <div className="space-y-6">
              {/* Result Display */}
              <Card className={`gaming-card border-2 ${gameState.won ? 'border-green-500' : 'border-red-500'}`}>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4">
                    <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-gaming flex items-center justify-center ${gameState.result === 'tails' ? 'rotate-180' : ''}`}>
                      <Coins className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl">
                    {gameState.result?.toUpperCase()}!
                  </CardTitle>
                  <CardDescription className="text-lg">
                    <Badge variant={gameState.won ? "default" : "destructive"} className="text-sm">
                      {gameState.won ? `You Won ${gameState.betAmount * 2} coins!` : `You Lost ${gameState.betAmount} coins`}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <div>Your choice: {gameState.playerChoice?.toUpperCase()}</div>
                    <div>Result: {gameState.result?.toUpperCase()}</div>
                  </div>
                  
                  <Button onClick={resetGame} className="btn-gaming">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Game Rules */}
          <Card className="gaming-card">
            <CardHeader>
              <CardTitle>How to Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Set your bet amount (minimum 1 coin)</p>
              <p>• Choose either heads or tails</p>
              <p>• If you guess correctly, you win 2x your bet</p>
              <p>• If you guess wrong, you lose your bet</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Coinflip;