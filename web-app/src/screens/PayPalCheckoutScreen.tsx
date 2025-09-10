import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { billingService } from '../lib/billing';
import { SERVER_PLANS, PAYPAL_CLIENT_ID } from '../config/paypal';

const PayPalCheckoutScreen = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plan, setPlan] = useState(SERVER_PLANS.find(p => p.id === planId));
  const [processing, setProcessing] = useState(false);
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    if (!plan) {
      toast({
        title: "Plan not found",
        description: "The selected plan could not be found",
        variant: "destructive"
      });
      navigate('/add-server');
    }
  }, [plan, navigate, toast]);

  // Mock PayPal Integration - In production, use PayPal SDK
  const handlePayPalCheckout = async () => {
    if (!plan || !planId) return;

    try {
      setProcessing(true);
      setShowWebView(true);

      // TODO: Replace with actual PayPal SDK integration
      // const paypal = await loadPayPalSDK();
      // const order = await paypal.createOrder({
      //   purchase_units: [{
      //     amount: {
      //       value: plan.price.toString(),
      //       currency_code: 'USD'
      //     },
      //     subscription: {
      //       plan_id: PLAN_IDS[planId]
      //     }
      //   }]
      // });

      // Simulate PayPal approval process
      setTimeout(async () => {
        try {
          // Mock successful subscription ID
          const mockSubscriptionId = `SUB_${Date.now()}`;
          
          const result = await billingService.onApproved(mockSubscriptionId, planId);
          
          if (result.success) {
            toast({
              title: "Payment Successful! 🎉",
              description: result.message,
            });
            
            // Navigate to server setup
            navigate('/setup-server', { 
              state: { 
                planId, 
                subscriptionId: mockSubscriptionId,
                planName: plan.name
              }
            });
          }
        } catch (error) {
          toast({
            title: "Payment Processing Error",
            description: "There was an issue processing your payment",
            variant: "destructive"
          });
          setShowWebView(false);
        } finally {
          setProcessing(false);
        }
      }, 3000);

    } catch (error) {
      await billingService.onError(error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Checkout Error",
        description: "Failed to initialize PayPal checkout",
        variant: "destructive"
      });
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    await billingService.onCancelled();
    toast({
      title: "Checkout Cancelled",
      description: "No charges were made to your account"
    });
    navigate('/add-server');
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  if (showWebView) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mock PayPal WebView */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="gaming-card">
              <CardHeader>
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>Processing Payment</CardTitle>
                <CardDescription>
                  Redirecting to PayPal for secure payment processing...
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="p-6 bg-muted/20 rounded-lg">
                  <h4 className="font-semibold mb-2">Order Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <span>{plan.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Fee:</span>
                      <span>${plan.price}</span>
                    </div>
                    <hr className="border-border" />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="text-primary">${plan.price}/month</span>
                    </div>
                  </div>
                </div>

                {processing && (
                  <div className="space-y-4">
                    <div className="loading-spinner w-8 h-8 mx-auto"></div>
                    <p className="text-muted-foreground">
                      Processing your subscription...
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="btn-gaming-secondary"
                  disabled={processing}
                >
                  Cancel Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
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
              onClick={() => navigate('/add-server')}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Plans
            </Button>
            
            <div>
              <h1 className="gaming-header text-xl">Checkout</h1>
              <p className="text-muted-foreground text-sm">
                Complete your server subscription
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Plan Summary */}
          <Card className="gaming-card">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>
                Review your selected server plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-muted/20 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{plan.description}</p>
                  
                  <div className="space-y-1">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold">${plan.price}</div>
                  <div className="text-sm text-muted-foreground">/month</div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Monthly subscription - cancel anytime</p>
                <p>• Immediate server activation</p>
                <p>• 7-day money-back guarantee</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="gaming-card">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>
                Secure payment processing through PayPal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* PayPal Button */}
              <Button
                onClick={handlePayPalCheckout}
                disabled={processing}
                className="w-full btn-gaming text-lg py-6"
              >
                {processing ? (
                  <div className="loading-spinner w-5 h-5 mr-3"></div>
                ) : (
                  <CreditCard className="w-5 h-5 mr-3" />
                )}
                {processing ? 'Processing...' : 'Subscribe with PayPal'}
              </Button>

              {/* Security Info */}
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-400 mb-1">Secure Payment</p>
                  <p className="text-muted-foreground">
                    Your payment is processed securely through PayPal. We never store your payment information.
                  </p>
                </div>
              </div>

              {/* Terms */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  By continuing, you agree to our Terms of Service and acknowledge that you understand 
                  our Privacy Policy. Your subscription will automatically renew monthly until cancelled.
                </p>
                <p>
                  <strong>Important:</strong> This is a demo implementation. In production, all payment 
                  verification must be handled server-side for security.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PayPalCheckoutScreen;