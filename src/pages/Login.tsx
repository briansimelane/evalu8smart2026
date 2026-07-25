import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { KeyRound, ArrowRight, Mail, Lock, UserCheck, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'staff'>('student');
  
  // Student state
  const [code, setCode] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);

  // Staff state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const { login, loginWithEmail } = useSession();
  const navigate = useNavigate();

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setStudentLoading(true);
    setStudentError('');
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
        setStudentError(result.message || 'Invalid access code');
      }
    } catch (err) {
      console.error('Student login error:', err);
      setStudentError('An error occurred. Please try again.');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setStaffLoading(true);
    setStaffError('');
    try {
      const result = await loginWithEmail(email, password);
      if (result.success) {
        if (result.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/facilitator/classes');
        }
      } else {
        setStaffError(result.message || 'Authentication failed');
      }
    } catch (err) {
      console.error('Staff login error:', err);
      setStaffError('Failed to sign in. Please check your credentials.');
    } finally {
      setStaffLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent/10 blur-[100px]" />

      <Card className="max-w-xl w-full bg-card border-border shadow-xl overflow-hidden relative">
        <CardHeader className="text-center pt-7 pb-5 border-b border-border bg-muted/30">
          {/* Brand SVG Logos */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-5 py-2 mx-auto w-full">
            <img 
              src="/evalu8-inc-logo.svg" 
              alt="Evalu8 Inc" 
              className="h-16 sm:h-20 md:h-24 w-auto object-contain shrink-0 dark:invert dark:brightness-200" 
            />
            <div className="hidden sm:block h-14 w-px bg-border/80 shrink-0" />
            <img 
              src="/smartphone-inc-logo.svg" 
              alt="Smartphone Inc" 
              className="h-16 sm:h-20 md:h-24 w-auto object-contain shrink-0 dark:invert dark:brightness-200" 
            />
          </div>
          <CardTitle className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Evalu8 Inc / Smartphone Inc Sim
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Sign in to access your simulation dashboard
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <Tabs defaultValue="student" value={activeTab} onValueChange={(val) => setActiveTab(val as 'student' | 'staff')}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="student" className="flex items-center gap-1.5 text-xs font-semibold">
                <KeyRound className="w-3.5 h-3.5" />
                Student Access
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-1.5 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Facilitator & Admin
              </TabsTrigger>
            </TabsList>

            {/* Student Access Tab */}
            <TabsContent value="student">
              <form onSubmit={handleStudentLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium text-muted-foreground">
                    Team Access Code
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
                      disabled={studentLoading}
                      className="pl-10 py-3 bg-background border-border text-foreground rounded-lg focus:ring-ring focus:border-ring uppercase tracking-widest font-mono text-center placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
                      placeholder="e.g. TM-GREEN-1234"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setStudentError('');
                      }}
                    />
                  </div>
                  {studentError && (
                    <p className="text-xs text-destructive flex items-center mt-2 font-medium">
                      <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-2" />
                      {studentError}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={studentLoading}
                  className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md transition-colors"
                >
                  {studentLoading ? (
                    'Authenticating...'
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Enter Simulation
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Facilitator & Admin Staff Tab */}
            <TabsContent value="staff">
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="staff-email" className="text-xs font-medium text-muted-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="email"
                      id="staff-email"
                      required
                      disabled={staffLoading}
                      className="pl-9 py-2 bg-background border-border text-sm text-foreground rounded-lg"
                      placeholder="e.g. facilitator@evalu8.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setStaffError('');
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="staff-password" className="text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="password"
                      id="staff-password"
                      required
                      disabled={staffLoading}
                      className="pl-9 py-2 bg-background border-border text-sm text-foreground rounded-lg"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setStaffError('');
                      }}
                    />
                  </div>
                </div>

                {staffError && (
                  <p className="text-xs text-destructive flex items-center mt-1 font-medium">
                    <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-2" />
                    {staffError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={staffLoading}
                  className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md transition-colors mt-2"
                >
                  {staffLoading ? (
                    'Signing in...'
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In as Staff
                      <UserCheck className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
