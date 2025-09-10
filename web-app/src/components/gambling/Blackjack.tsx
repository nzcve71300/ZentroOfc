import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BlackjackProps {
  onBack: () => void;
  serverId: string;
}

interface GameCard {
  suit: '♠️' | '♥️' | '♦️' | '♣️';
  value: string;
  numericValue: number;
}

interface GameState {
  playerCards: GameCard[];
  dealerCards: GameCard[];
  playerScore: number;
  dealerScore: number;
  gameStatus: 'betting' | 'playing' | 'finished';
  result: string;
}

const Blackjack = ({ onBack, serverId }: BlackjackProps) => {
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState(100);
  const [balance] = useState(2450); // Mock balance
  const [gameState, setGameState] = useState<GameState>({
    playerCards: [],
    dealerCards: [],
    playerScore: 0,
    dealerScore: 0,
    gameStatus: 'betting',
    result: ''
  });

  // INSERT GAME LOGIC HERE - Replace with actual game mechanics
  const createDeck = useCallback((): GameCard[] => {
    const suits: GameCard['suit'][] = ['♠️', '♥️', '♦️', '♣️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: GameCard[] = [];

    suits.forEach(suit => {
      values.forEach(value => {
        let numericValue = parseInt(value);
        if (value === 'A') numericValue = 11;
        else if (['J', 'Q', 'K'].includes(value)) numericValue = 10;
        
        deck.push({ suit, value, numericValue });
      });
    });

    return deck.sort(() => Math.random() - 0.5); // Shuffle
  }, []);

  const calculateScore = useCallback((cards: GameCard[]): number => {
    let score = 0;
    let aces = 0;

    cards.forEach(card => {
      if (card.value === 'A') {
        aces++;
        score += 11;
      } else {
        score += card.numericValue;
      }
    });

    // Adjust for aces
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return score;
  }, []);

  const startGame = useCallback(() => {
    if (betAmount > balance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough coins for this bet",
        variant: "destructive"
      });
      return;
    }

    const deck = createDeck();
    const playerCards = [deck[0], deck[2]];
    const dealerCards = [deck[1]]; // Only show one dealer card initially

    const playerScore = calculateScore(playerCards);

    setGameState({
      playerCards,
      dealerCards,
      playerScore,
      dealerScore: calculateScore(dealerCards),
      gameStatus: 'playing',
      result: ''
    });

    toast({
      title: "Game Started",
      description: `Bet placed: ${betAmount} coins`
    });
  }, [betAmount, balance, createDeck, calculateScore, toast]);

  const hit = useCallback(() => {
    // INSERT GAME LOGIC HERE - Add card to player hand
    const deck = createDeck();
    const newCard = deck[Math.floor(Math.random() * deck.length)];
    const newPlayerCards = [...gameState.playerCards, newCard];
    const newScore = calculateScore(newPlayerCards);

    setGameState(prev => ({
      ...prev,
      playerCards: newPlayerCards,
      playerScore: newScore,
      gameStatus: newScore > 21 ? 'finished' : 'playing',
      result: newScore > 21 ? 'Bust! You lose.' : ''
    }));

    if (newScore > 21) {
      toast({
        title: "Bust!",
        description: `You went over 21 and lost ${betAmount} coins`,
        variant: "destructive"
      });
    }
  }, [gameState, calculateScore, createDeck, betAmount, toast]);

  const stand = useCallback(() => {
    // INSERT GAME LOGIC HERE - Dealer plays, determine winner
    const deck = createDeck();
    let dealerCards = [...gameState.dealerCards];
    
    // Dealer draws until 17 or higher
    while (calculateScore(dealerCards) < 17) {
      dealerCards.push(deck[Math.floor(Math.random() * deck.length)]);
    }

    const dealerScore = calculateScore(dealerCards);
    const playerScore = gameState.playerScore;
    
    let result = '';
    if (dealerScore > 21) {
      result = 'Dealer busts! You win!';
    } else if (dealerScore > playerScore) {
      result = 'Dealer wins!';
    } else if (playerScore > dealerScore) {
      result = 'You win!';
    } else {
      result = 'Push (tie)!';
    }

    setGameState(prev => ({
      ...prev,
      dealerCards,
      dealerScore,
      gameStatus: 'finished',
      result
    }));

    toast({
      title: result,
      description: result.includes('win') ? `You won ${betAmount * 2} coins!` : 
                  result.includes('Push') ? 'Your bet has been returned' : 
                  `You lost ${betAmount} coins`
    });
  }, [gameState, calculateScore, createDeck, betAmount, toast]);

  const resetGame = () => {
    setGameState({
      playerCards: [],
      dealerCards: [],
      playerScore: 0,
      dealerScore: 0,
      gameStatus: 'betting',
      result: ''
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
              <h1 className="gaming-header text-xl">Blackjack</h1>
              <p className="text-muted-foreground text-sm">
                Balance: {balance.toLocaleString()} coins
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Betting Section */}
          {gameState.gameStatus === 'betting' && (
            <Card className="gaming-card">
              <CardHeader>
                <CardTitle>Place Your Bet</CardTitle>
                <CardDescription>
                  Enter your bet amount and start the game
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                </div>
                <Button
                  onClick={startGame}
                  className="btn-gaming w-full"
                  disabled={betAmount < 1 || betAmount > balance}
                >
                  Deal Cards
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Game Table */}
          {gameState.gameStatus !== 'betting' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Dealer Section */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle>Dealer</CardTitle>
                  <CardDescription>
                    Score: {gameState.gameStatus === 'finished' ? gameState.dealerScore : '?'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {gameState.dealerCards.map((card, index) => (
                      <div
                        key={index}
                        className="w-16 h-24 bg-card border-2 border-border rounded-lg flex flex-col items-center justify-center font-mono text-lg"
                      >
                        <div>{card.suit}</div>
                        <div>{card.value}</div>
                      </div>
                    ))}
                    {gameState.gameStatus === 'playing' && (
                      <div className="w-16 h-24 bg-muted border-2 border-border rounded-lg flex items-center justify-center">
                        <div className="text-muted-foreground">?</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Player Section */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle>Your Hand</CardTitle>
                  <CardDescription>
                    Score: {gameState.playerScore}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {gameState.playerCards.map((card, index) => (
                      <div
                        key={index}
                        className="w-16 h-24 bg-card border-2 border-primary/20 rounded-lg flex flex-col items-center justify-center font-mono text-lg"
                      >
                        <div>{card.suit}</div>
                        <div>{card.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Game Controls */}
          {gameState.gameStatus === 'playing' && (
            <div className="flex gap-4 justify-center">
              <Button onClick={hit} className="btn-gaming">
                Hit
              </Button>
              <Button onClick={stand} className="btn-gaming-secondary">
                Stand
              </Button>
            </div>
          )}

          {/* Game Result */}
          {gameState.gameStatus === 'finished' && (
            <Card className="gaming-card text-center">
              <CardHeader>
                <CardTitle className="text-2xl">{gameState.result}</CardTitle>
                <CardDescription>
                  Final Scores - You: {gameState.playerScore} | Dealer: {gameState.dealerScore}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={resetGame} className="btn-gaming">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Play Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Blackjack;