import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { KeyRound, ArrowRight, ShieldCheck, Gamepad2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const Login: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useSession();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      const result = await login(code.trim());
      if (result.success) {
        if (result.role === 'ADMIN') {
          navigate('/admin');
        } else if (result.role === 'FACILITATOR') {
          navigate('/facilitator/classes');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent/10 blur-[100px]" />

      <Card className="max-w-md w-full bg-card border-border shadow-xl overflow-hidden relative">
        <CardHeader className="text-center pt-7 pb-5 border-b border-border bg-muted/30">
          <div className="mx-auto w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-3 shadow-lg ring-4 ring-accent/15">
            <Gamepad2 className="text-white w-7 h-7" />
          </div>
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">Evalu8 Smart Sim</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">Enter your access code to start</CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-muted-foreground">
                Access Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  id="code"
                  autoFocus
                  required
                  disabled={loading}
                  className="pl-10 py-3 bg-background border-border text-foreground rounded-lg focus:ring-ring focus:border-ring uppercase tracking-widest font-mono text-center placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
                  placeholder="e.g. FAC-1234 or TM-GREEN-1234"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                />
              </div>
              {error && (
                <p className="text-xs text-destructive flex items-center mt-2">
                  <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-2" />
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md transition-colors"
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Enter Simulation
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>Demo Admin: <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">ADMIN-MASTER</code></p>
              <p>Demo Facilitator: <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">FACILITATOR</code></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
