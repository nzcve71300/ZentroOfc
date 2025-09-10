import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authService } from '../lib/auth';
import { useAuth } from '../state/useAuth';
import { SignupForm } from '../types';

const SignupScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setUser, setLoading, isLoading } = useAuth();
  
  const [formData, setFormData] = useState<SignupForm>({
    ign: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.ign || !formData.email || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Validation Error", 
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const user = await authService.signUp(formData);
      setUser(user);
      
      toast({
        title: "Account Created!",
        description: `Welcome to Zentro, ${user.ign}!`,
      });
      
      navigate('/home');
    } catch (error) {
      toast({
        title: "Signup Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="gaming-header text-4xl mb-2">Zentro</h1>
          <p className="text-muted-foreground">Join the ultimate gaming platform</p>
        </div>

        {/* Signup Card */}
        <Card className="gaming-card">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Set up your gaming profile to get started
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ign">In-Game Name</Label>
                <Input
                  id="ign"
                  type="text"
                  placeholder="Choose your IGN"
                  value={formData.ign}
                  onChange={(e) => setFormData(prev => ({ ...prev, ign: e.target.value }))}
                  className="gaming-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="gaming-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="gaming-input"
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters long
                </p>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full btn-gaming"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="loading-spinner w-5 h-5"></div>
                ) : (
                  'Create Account'
                )}
              </Button>
              
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link 
                  to="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SignupScreen;