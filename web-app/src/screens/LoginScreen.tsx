import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authService } from '../lib/auth';
import { useAuth } from '../state/useAuth';
import { LoginForm } from '../types';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setUser, setLoading, isLoading } = useAuth();
  
  const [formData, setFormData] = useState<LoginForm>({
    ign: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.ign || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const user = await authService.signIn(formData);
      setUser(user);
      
      toast({
        title: "Welcome back!",
        description: `Signed in as ${user.ign}`,
      });
      
      navigate('/home');
    } catch (error) {
      toast({
        title: "Login Failed",
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
          <p className="text-muted-foreground">Welcome back, gamer</p>
        </div>

        {/* Login Card */}
        <Card className="gaming-card">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your servers
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ign">In-Game Name</Label>
                <Input
                  id="ign"
                  type="text"
                  placeholder="Your IGN"
                  value={formData.ign}
                  onChange={(e) => setFormData(prev => ({ ...prev, ign: e.target.value }))}
                  className="gaming-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="gaming-input"
                />
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
                  'Sign In'
                )}
              </Button>
              
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link 
                  to="/signup"
                  className="text-primary hover:underline font-medium"
                >
                  Create account
                </Link>
              </div>
              
              {/* Demo credentials */}
              <div className="text-xs text-muted-foreground text-center p-2 bg-muted/20 rounded">
                <p>Demo: IGN: <strong>test</strong> | Password: <strong>test</strong></p>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginScreen;