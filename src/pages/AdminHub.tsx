import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Trash2, ShieldAlert, LogOut, LayoutGrid, RefreshCw, UserPlus, Users, KeyRound, Mail, Lock, Plus, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ClassTeamCodesTable } from './FacilitatorHub';

export const AdminHub: React.FC = () => {
  const { 
    classes, 
    facilitators, 
    currentUserEmail, 
    deleteClass, 
    logout, 
    migrateLegacyClass, 
    createFacilitatorAccount, 
    sendFacilitatorPasswordReset,
    selectClass
  } = useSession();
  
  const navigate = useNavigate();

  // Create Facilitator form state
  const [facName, setFacName] = useState('');
  const [facEmail, setFacEmail] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [creatingFac, setCreatingFac] = useState(false);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  // Expandable team codes state
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleExpandClass = (id: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateFacilitator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facName.trim() || !facEmail.trim() || !facPassword) return;

    setCreatingFac(true);
    try {
      const res = await createFacilitatorAccount(facName, facEmail, facPassword);
      if (res.success) {
        toast.success(`Facilitator account for ${facEmail} created successfully!`);
        setFacName('');
        setFacEmail('');
        setFacPassword('');
      } else {
        toast.error(res.message || 'Failed to create facilitator account.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred.');
    } finally {
      setCreatingFac(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    setResettingEmail(email);
    try {
      const res = await sendFacilitatorPasswordReset(email);
      if (res.success) {
        toast.success(`Password reset email sent to ${email}`);
      } else {
        toast.error(res.message || 'Failed to send password reset email.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send password reset email.');
    } finally {
      setResettingEmail(null);
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`ADMIN FORCE: Are you sure you want to permanently delete class "${name}"?`)) {
      try {
        await deleteClass(id);
        toast.success(`Class "${name}" has been permanently deleted.`);
      } catch (err) {
        toast.error('Failed to delete class.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-10">
      {/* Top Navbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-5 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400">
              System Admin Control Room
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Evalu8 Inc / Smartphone Inc Sim — Master Management ({currentUserEmail || 'Admin'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate('/facilitator/classes')} 
            variant="outline"
            className="gap-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Create / Launch Games
          </Button>

          <Button 
            variant="destructive" 
            onClick={logout} 
            className="gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="facilitators" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="facilitators" className="flex items-center gap-2 text-xs font-semibold">
            <Users className="h-4 w-4" />
            Facilitators ({facilitators.length})
          </TabsTrigger>
          <TabsTrigger value="games" className="flex items-center gap-2 text-xs font-semibold">
            <LayoutGrid className="h-4 w-4" />
            All Games ({classes.length})
          </TabsTrigger>
        </TabsList>

        {/* Facilitator Management Tab */}
        <TabsContent value="facilitators" className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Add New Facilitator Account
              </CardTitle>
              <CardDescription>
                Provision a new facilitator with an email, name, and default password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFacilitator} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                  <Input 
                    type="text" 
                    required 
                    placeholder="e.g. Professor Sarah Jenkins" 
                    value={facName}
                    onChange={(e) => setFacName(e.target.value)}
                    disabled={creatingFac}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                  <Input 
                    type="email" 
                    required 
                    placeholder="e.g. sjenkins@university.edu" 
                    value={facEmail}
                    onChange={(e) => setFacEmail(e.target.value)}
                    disabled={creatingFac}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Default Password</label>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      required 
                      minLength={6}
                      placeholder="••••••••" 
                      value={facPassword}
                      onChange={(e) => setFacPassword(e.target.value)}
                      disabled={creatingFac}
                    />
                    <Button type="submit" disabled={creatingFac} className="shrink-0">
                      {creatingFac ? 'Creating...' : 'Create Account'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Registered Facilitator Accounts
              </CardTitle>
              <CardDescription>
                List of active facilitators authorized to create and run simulation games.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {facilitators.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No facilitator accounts registered yet. Use the form above to add your first facilitator.
                </div>
              ) : (
                <Table className="border border-border">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border">
                      <TableHead className="font-semibold">Facilitator Name</TableHead>
                      <TableHead className="font-semibold">Email Address</TableHead>
                      <TableHead className="font-semibold">Created Date</TableHead>
                      <TableHead className="font-semibold">Games Created</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilitators.map((fac) => {
                      const gamesCount = classes.filter(c => c.createdByEmail === fac.email || c.facilitatorCode.includes(fac.email)).length;
                      const isResetting = resettingEmail === fac.email;

                      return (
                        <TableRow key={fac.uid || fac.email} className="border-border hover:bg-muted/10">
                          <TableCell className="font-semibold text-foreground">
                            {fac.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-primary">
                            {fac.email}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fac.createdAt ? new Date(fac.createdAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-bold">
                              {gamesCount} games
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetPassword(fac.email)}
                              disabled={isResetting}
                              className="text-xs gap-1.5"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              {isResetting ? 'Sending...' : 'Reset Password'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Games & Overview Tab */}
        <TabsContent value="games" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-red-600" />
                All Global Games & Sessions ({classes.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Overview of all simulation games created by facilitators and administrators.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No classes exist in the database.</p>
              ) : (
                <Table className="border border-border">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border">
                      <TableHead className="text-foreground font-semibold">Game / Class Name</TableHead>
                      <TableHead className="text-foreground font-semibold">Created By</TableHead>
                      <TableHead className="text-foreground font-semibold">Facilitator Code</TableHead>
                      <TableHead className="text-foreground font-semibold">Teams Count</TableHead>
                      <TableHead className="text-foreground font-semibold">Created Date</TableHead>
                      <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => {
                      const teamCount = cls.teamRegistry?.length || cls.gameState?.teams?.length || Object.keys(cls.teamCodes || {}).length || 0;
                      const isLegacy = !!cls.gameState;
                      const isExpanded = !!expandedClasses[cls.id];

                      return (
                        <React.Fragment key={cls.id}>
                          <TableRow className="border-border hover:bg-muted/10 transition-colors">
                            <TableCell className="font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <span>{cls.name}</span>
                                {isLegacy && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Legacy
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">
                              {cls.createdByEmail || 'System / Facilitator'}
                            </TableCell>
                            <TableCell className="font-mono text-emerald-700 dark:text-emerald-400 font-bold tracking-wider">
                              <div className="flex items-center gap-1.5">
                                <span>{cls.facilitatorCode}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleExpandClass(cls.id)}
                                  className="h-6 px-2 text-[10px] font-semibold border-border"
                                >
                                  {isExpanded ? 'Hide Codes' : 'Show Codes'}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground text-sm">
                              {teamCount} teams
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(cls.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    selectClass(cls.id);
                                    navigate(`/class/${cls.id}`);
                                  }}
                                  className="h-8 gap-1 text-xs font-semibold"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Enter Game
                                </Button>

                                {isLegacy && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => migrateLegacyClass(cls.id)}
                                    className="border-amber-300 text-amber-700 hover:bg-amber-50 h-8 gap-1 text-xs"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Migrate
                                  </Button>
                                )}

                                <Button
                                  size="icon"
                                  variant="destructive"
                                  onClick={() => handleDeleteClass(cls.id, cls.name)}
                                  className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Collapsible Team Access Codes Table */}
                          {isExpanded && (
                            <TableRow className="border-border bg-muted/5 hover:bg-muted/5">
                              <TableCell colSpan={6} className="p-4 bg-muted/5">
                                <div className="space-y-4 max-w-4xl mx-auto py-2">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Team Access Codes & Controls</div>
                                  <ClassTeamCodesTable cls={cls} handleCopy={handleCopy} copiedCode={copiedCode} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
