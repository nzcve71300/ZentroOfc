// Auth Service Stubs for Zentro Gaming
import { AuthUser, LoginForm, SignupForm } from '../types';
import { mockCurrentUser } from '../mocks/me';

export const authService = {
  // TODO: Replace with real API calls
  signIn: async (data: LoginForm): Promise<AuthUser> => {
    console.log('🔐 Auth Service: Sign in called', data);
    
    // TODO: Call backend API
    // const response = await fetch('/api/auth/signin', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (data.ign === 'test' && data.password === 'test') {
      return mockCurrentUser;
    }
    
    throw new Error('Invalid credentials');
  },

  signUp: async (data: SignupForm): Promise<AuthUser> => {
    console.log('📝 Auth Service: Sign up called', data);
    
    // TODO: Call backend API
    // const response = await fetch('/api/auth/signup', {
    //   method: 'POST', 
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      ign: data.ign,
      email: data.email,
      token: `mock_token_${Date.now()}`
    };
  },

  signOut: async (): Promise<void> => {
    console.log('🚪 Auth Service: Sign out called');
    
    // TODO: Call backend API
    // await fetch('/api/auth/signout', { method: 'POST' });
    
    // Clear local storage or any cached data
    localStorage.removeItem('zentro_auth_token');
  },

  getCurrentUser: (): AuthUser | null => {
    // TODO: Get from secure storage or verify token with backend
    const token = localStorage.getItem('zentro_auth_token');
    return token ? mockCurrentUser : null;
  }
};