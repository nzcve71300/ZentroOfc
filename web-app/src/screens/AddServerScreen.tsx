import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { SERVER_PLANS } from '../config/paypal';

const AddServerScreen = () => {
  const navigate = useNavigate();

  const handleSubscribe = (planId: string) => {
    const plan = SERVER_PLANS.find(p => p.id === planId);
    
    if (plan?.disabled) {
      return; // Do nothing for disabled plans
    }
    
    navigate(`/checkout/${planId}`);
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
              onClick={() => navigate('/home')}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Add Server</h1>
              <p className="text-muted-foreground text-sm">
                Choose a subscription plan for your gaming server
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Server Plan</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Select the perfect plan for your gaming community. All plans include 24/7 server management, 
              RCON access, and our comprehensive admin tools.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {SERVER_PLANS.map((plan) => (
              <Card 
                key={plan.id} 
                className={`gaming-card ${plan.disabled ? 'opacity-60' : 'gaming-card-interactive'} ${
                  plan.id === 'server3' ? 'border-primary/50 scale-105' : ''
                }`}
              >
                <CardHeader className="text-center pb-4">
                  {plan.id === 'server3' && (
                    <Badge className="mb-2 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}
                  
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {plan.description}
                  </CardDescription>
                  
                  <div className="mt-4">
                    {plan.disabled ? (
                      <div className="text-2xl font-bold text-muted-foreground">
                        Coming Soon
                      </div>
                    ) : (
                      <div className="text-3xl font-bold">
                        ${plan.price}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pb-6">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        {plan.disabled ? (
                          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                        <span className={plan.disabled ? 'text-muted-foreground' : ''}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button
                    className={`w-full ${plan.disabled ? 'btn-gaming-secondary' : 'btn-gaming'}`}
                    disabled={plan.disabled}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {plan.disabled ? 'Coming Soon' : 'Subscribe with PayPal'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-16 space-y-8">
            
            {/* Payment Info */}
            <Card className="gaming-card">
              <CardHeader>
                <CardTitle>Secure Payment Processing</CardTitle>
                <CardDescription>
                  All payments are processed securely through PayPal
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">What's Included:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Full RCON access to your server</li>
                    <li>• 24/7 server monitoring and support</li>
                    <li>• Automatic plugin updates</li>
                    <li>• Custom store configuration</li>
                    <li>• Player statistics tracking</li>
                    <li>• Gambling system integration</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Payment Terms:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Monthly subscription billing</li>
                    <li>• Cancel anytime from your PayPal account</li>
                    <li>• Immediate server activation</li>
                    <li>• No setup fees or hidden costs</li>
                    <li>• 7-day money-back guarantee</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="gaming-card border-yellow-500/20 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  ⚠️ Important Security Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>For Production Use:</strong> All subscription verification and server access 
                  must be handled by a secure backend API. Never trust client-side payment verification.
                </p>
                <p>
                  <strong>RCON Security:</strong> Server credentials should never be stored on the client-side. 
                  All server management should go through encrypted API endpoints.
                </p>
                <p>
                  <strong>Webhook Integration:</strong> Implement PayPal webhooks to handle subscription 
                  cancellations, payment failures, and automatic access revocation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddServerScreen;