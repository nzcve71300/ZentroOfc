// Billing & PayPal Service Stubs
import { PayPalPlan } from '../types';
import { SERVER_PLANS } from '../config/paypal';

export const billingService = {
  onApproved: async (subscriptionId: string, planId: string): Promise<{ success: boolean; message: string }> => {
    console.log('✅ Billing Service: PayPal approved called', subscriptionId, planId);
    
    // TODO: CRITICAL - This must be handled by secure backend
    // NEVER trust client-side subscription verification
    // Backend must:
    // 1. Verify subscription with PayPal API
    // 2. Create user subscription record
    // 3. Enable server access
    // 4. Handle webhook events for cancellations/failures
    
    // const response = await fetch('/api/billing/paypal/approve', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ subscriptionId, planId })
    // });
    // return response.json();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const plan = SERVER_PLANS.find(p => p.id === planId);
    
    return {
      success: true,
      message: `Successfully subscribed to ${plan?.name || 'Server Plan'}! Your server access is now active.`
    };
  },

  onCancelled: async (): Promise<void> => {
    console.log('❌ Billing Service: PayPal cancelled');
    
    // TODO: Handle cancellation logic
    // await fetch('/api/billing/paypal/cancel', { method: 'POST' });
  },

  onError: async (error: string): Promise<void> => {
    console.error('💥 Billing Service: PayPal error', error);
    
    // TODO: Log error to backend
    // await fetch('/api/billing/paypal/error', {
    //   method: 'POST',
    //   body: JSON.stringify({ error })
    // });
  },

  getPlans: (): PayPalPlan[] => {
    return SERVER_PLANS.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      features: plan.features
    }));
  },

  getUserSubscriptions: async (userId: string): Promise<any[]> => {
    console.log('📋 Billing Service: Get user subscriptions called', userId);
    
    // TODO: Call backend API
    // const response = await fetch(`/api/users/${userId}/subscriptions`);
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Mock active subscriptions
    return [
      {
        id: 'sub_123',
        planId: 'server1', 
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    ];
  }
};