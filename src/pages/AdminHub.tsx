import React, { useState, useEffect, useMemo } from 'react';
import { useSession, MASTER_FACILITATOR_EMAIL } from '@/contexts/SessionContext';
import { Trash2, ShieldAlert, LogOut, LayoutGrid, RefreshCw, UserPlus, Users, KeyRound, Mail, Lock, Plus, ExternalLink, Copy, Check, Archive, RotateCcw, PauseCircle, PlayCircle, Crown, Globe, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ClassTeamCodesTable } from './FacilitatorHub';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession } from '@/types/multiworld';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';

export const AdminHub: React.FC = () => {
  const { 
    classes, 
    facilitators, 
    currentUserEmail, 
    archiveClass,
    restoreClass,
    deleteClassPermanently,
    deleteClass, 
    logout, 
    migrateLegacyClass, 
    createFacilitatorAccount,
    pauseFacilitatorAccount,
    resumeFacilitatorAccount,
    deleteFacilitatorAccount,
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
  const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

  // Expandable facilitator games & team codes state
  const [expandedFacilitators, setExpandedFacilitators] = useState<Record<string, boolean>>({});
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [multiWorldSessions, setMultiWorldSessions] = useState<MultiWorldSession[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'multiworld_sessions'), (snap) => {
      const list: MultiWorldSession[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as MultiWorldSession);
      });
      setMultiWorldSessions(list);
    }, (err) => {
      console.error("Error fetching multiworld sessions in AdminHub:", err);
    });

    return () => unsub();
  }, []);

  const activeFacilitators = useMemo(() => {
    return facilitators.filter(f => f.status !== 'PAUSED');
  }, [facilitators]);

  const pausedFacilitators = useMemo(() => {
    return facilitators.filter(f => f.status === 'PAUSED');
  }, [facilitators]);

  const toggleExpandFacilitator = (key: string) => {
    setExpandedFacilitators(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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

  const handlePauseFacilitator = async (uid: string, name: string, email: string) => {
    if (email.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      toast.error('Master Facilitator account cannot be paused.');
      return;
    }
    if (confirm(`Pause (Archive) facilitator "${name}" (${email})?\n\nThey will not be able to log in while paused, but all of their created games will remain intact and accessible to you.`)) {
      setActionLoadingUid(uid);
      try {
        const res = await pauseFacilitatorAccount(uid, email);
        if (res.success) {
          toast.success(`Facilitator "${name}" has been paused (archived).`);
        } else {
          toast.error(res.message || 'Failed to pause facilitator.');
        }
      } finally {
        setActionLoadingUid(null);
      }
    }
  };

  const handleResumeFacilitator = async (uid: string, name: string, email: string) => {
    setActionLoadingUid(uid);
    try {
      const res = await resumeFacilitatorAccount(uid, email);
      if (res.success) {
        toast.success(`Facilitator "${name}" has been restored to Active.`);
      } else {
        toast.error(res.message || 'Failed to restore facilitator.');
      }
    } finally {
      setActionLoadingUid(null);
    }
  };

  const handleDeleteFacilitator = async (uid: string, name: string, email: string) => {
    if (email.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      toast.error('Master Facilitator account cannot be deleted.');
      return;
    }
    if (confirm(`DELETE FACILITATOR: Are you sure you want to remove "${name}" (${email})?\n\nThey will no longer be authorized to sign in as a facilitator. Any games they created will remain in the system under your Master Facilitator oversight.`)) {
      setActionLoadingUid(uid);
      try {
        const res = await deleteFacilitatorAccount(uid, email);
        if (res.success) {
          toast.success(`Facilitator "${name}" has been removed.`);
        } else {
          toast.error(res.message || 'Failed to delete facilitator.');
        }
      } finally {
        setActionLoadingUid(null);
      }
    }
  };

  const handleArchiveClass = async (id: string, name: string) => {
    if (confirm(`Move class "${name}" to archive?`)) {
      try {
        await archiveClass(id);
        toast.success(`Class "${name}" archived.`);
      } catch (err) {
        toast.error('Failed to archive class.');
      }
    }
  };

  const handleRestoreClass = async (id: string, name: string) => {
    try {
      await restoreClass(id);
      toast.success(`Class "${name}" restored.`);
    } catch (err) {
      toast.error('Failed to restore class.');
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`ADMIN FORCE: Are you sure you want to permanently delete class "${name}"? This action cannot be undone.`)) {
      try {
        await deleteClassPermanently(id);
        toast.success(`Class "${name}" has been permanently deleted.`);
      } catch (err) {
        toast.error('Failed to delete class.');
      }
    }
  };

  const handleArchiveMultiWorld = async (id: string, name: string) => {
    if (confirm(`Move Multi-World Session "${name}" to Archive?`)) {
      try {
        await updateDoc(doc(db, 'multiworld_sessions', id), {
          isArchived: true,
          archivedAt: new Date().toISOString()
        });
        toast.success(`Session "${name}" archived.`);
      } catch (err) {
        toast.error('Failed to archive session.');
      }
    }
  };

  const handleRestoreMultiWorld = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, 'multiworld_sessions', id), {
        isArchived: false,
        archivedAt: deleteField()
      });
      toast.success(`Session "${name}" restored.`);
    } catch (err) {
      toast.error('Failed to restore session.');
    }
  };

  const handlePermanentDeleteMultiWorld = async (id: string, name: string) => {
    if (confirm(`ADMIN FORCE: Are you sure you want to permanently delete Multi-World Session "${name}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'multiworld_sessions', id));
        toast.success(`Session "${name}" permanently deleted.`);
      } catch (err) {
        toast.error('Failed to permanently delete session.');
      }
    }
  };

  const getFacilitatorGames = (email: string) => {
    const emailLower = (email || '').trim().toLowerCase();
    return classes.filter(c => 
      (c.createdByEmail && c.createdByEmail.trim().toLowerCase() === emailLower) ||
      (c.facilitatorCode && c.facilitatorCode.toLowerCase().includes(emailLower))
    );
  };

  const getFacilitatorMultiWorlds = (email: string) => {
    const emailLower = (email || '').trim().toLowerCase();
    return multiWorldSessions.filter(mw => 
      mw.createdByEmail && mw.createdByEmail.trim().toLowerCase() === emailLower
    );
  };

  const renderFacilitatorRow = (fac: (typeof facilitators)[number]) => {
    const isMaster = fac.email?.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL || !!fac.isMaster;
    const isPaused = fac.status === 'PAUSED';
    const facClasses = getFacilitatorGames(fac.email);
    const facMultiWorlds = getFacilitatorMultiWorlds(fac.email);
    const totalGamesCount = facClasses.length + facMultiWorlds.length;
    const isResetting = resettingEmail === fac.email;
    const isRowLoading = actionLoadingUid === fac.uid;
    const rowKey = fac.uid || fac.email;
    const isFacExpanded = !!expandedFacilitators[rowKey];

    return (
      <React.Fragment key={rowKey}>
        <TableRow className={`border-border hover:bg-muted/10 ${isPaused ? 'bg-amber-500/5 opacity-80' : ''}`}>
          <TableCell className="font-semibold text-foreground">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{fac.name}</span>
              {isMaster && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-[10px] px-2 py-0.5">
                  <Crown className="h-3 w-3" />
                  Master Facilitator
                </Badge>
              )}
              {isPaused ? (
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px]">
                  Paused / Archived
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[10px]">
                  Active
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell className="font-mono text-sm text-primary">
            {fac.email}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {isMaster ? 'Permanent Master' : (fac.createdAt ? new Date(fac.createdAt).toLocaleDateString() : 'N/A')}
          </TableCell>
          <TableCell>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => toggleExpandFacilitator(rowKey)}
              className="h-7 text-xs font-bold gap-1.5"
            >
              <span>{totalGamesCount} {totalGamesCount === 1 ? 'game' : 'games'}</span>
              {totalGamesCount > 0 && (
                isFacExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              {totalGamesCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleExpandFacilitator(rowKey)}
                  className="text-xs gap-1 h-8"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isFacExpanded ? 'Hide Games' : 'View Games'}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResetPassword(fac.email)}
                disabled={isResetting || isRowLoading}
                className="text-xs gap-1.5 h-8"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {isResetting ? 'Sending...' : 'Reset Password'}
              </Button>

              {!isMaster && (
                <>
                  {isPaused ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResumeFacilitator(fac.uid, fac.name, fac.email)}
                      disabled={isRowLoading}
                      className="text-xs gap-1.5 h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePauseFacilitator(fac.uid, fac.name, fac.email)}
                      disabled={isRowLoading}
                      title="Pause (Archive) Facilitator"
                      className="text-xs gap-1.5 h-8 border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-300"
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      Pause
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteFacilitator(fac.uid, fac.name, fac.email)}
                    disabled={isRowLoading}
                    title="Delete Facilitator Account"
                    className="text-xs gap-1 h-8 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>

        {isFacExpanded && (
          <TableRow className="border-border bg-muted/10 hover:bg-muted/10">
            <TableCell colSpan={5} className="p-4">
              <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Games Created by {fac.name} ({fac.email})
                  </div>
                  <span className="text-xs text-muted-foreground">
                    As Master Facilitator, you can enter and interact with any of these games directly.
                  </span>
                </div>

                {totalGamesCount === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    This facilitator has not created any games yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {facMultiWorlds.map((mw) => (
                      <div key={mw.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-purple-200 dark:border-purple-800/60 shadow-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Globe className="h-4 w-4 text-purple-600" />
                            <span>{mw.name}</span>
                            <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                              Multi-World ({mw.sessionCode})
                            </Badge>
                            {mw.isArchived && (
                              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                Archived
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created {new Date(mw.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/facilitator/multiworld/${mw.id}`)}
                            className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Enter Multi-World Control
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/viewer/multi/${mw.sessionCode}`)}
                            className="h-8 text-xs gap-1.5 border-purple-300 text-purple-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Viewer
                          </Button>
                        </div>
                      </div>
                    ))}

                    {facClasses.map((cls) => {
                      const teamCount = cls.teamRegistry?.length || cls.gameState?.teams?.length || Object.keys(cls.teamCodes || {}).length || 0;
                      const isClsExpanded = !!expandedClasses[cls.id];
                      return (
                        <div key={cls.id} className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                <span>{cls.name}</span>
                                <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {cls.facilitatorCode}
                                </span>
                                {cls.isArchived && (
                                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                    Archived
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {teamCount} teams · Created {new Date(cls.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleExpandClass(cls.id)}
                                className="h-8 text-xs font-semibold"
                              >
                                {isClsExpanded ? 'Hide Teams' : 'Teams & Codes'}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  selectClass(cls.id);
                                  navigate(`/class/${cls.id}`);
                                }}
                                className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Enter Game Control
                              </Button>
                            </div>
                          </div>
                          {isClsExpanded && (
                            <div className="border-t border-border p-3 bg-muted/5">
                              <ClassTeamCodesTable cls={cls} handleCopy={handleCopy} copiedCode={copiedCode} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400">
                Master Facilitator Control Room
              </h1>
              <Badge className="bg-amber-500 text-white gap-1 text-xs">
                <Crown className="h-3.5 w-3.5" />
                Master
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Evalu8 Inc / Smartphone Inc Sim — Brian Simelane ({currentUserEmail || MASTER_FACILITATOR_EMAIL})
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
            Create / Launch Games (Facilitator Hub)
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
            All Games ({classes.length + multiWorldSessions.length})
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
                Provision a new facilitator with an email, name, and default password. Note: Standard facilitators only see and manage the games they create themselves. As Master Facilitator, you can see and interact with all games across all facilitators.
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
                Active Facilitator Accounts ({activeFacilitators.length})
              </CardTitle>
              <CardDescription>
                Active facilitators authorized to sign in and run their own simulation games. Click on a facilitator's game count or "View Games" to inspect and enter any of their games.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeFacilitators.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No active facilitator accounts found.
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
                    {activeFacilitators.map(renderFacilitatorRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {pausedFacilitators.length > 0 && (
            <Card className="bg-card border-amber-300/60 dark:border-amber-800/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <PauseCircle className="h-5 w-5" />
                  Paused / Archived Facilitators ({pausedFacilitators.length})
                </CardTitle>
                <CardDescription>
                  Paused facilitators cannot sign in until restored, but their historical games remain preserved and accessible to you.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                    {pausedFacilitators.map(renderFacilitatorRow)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Global Games & Overview Tab */}
        <TabsContent value="games" className="space-y-6">
          {multiWorldSessions.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-600" />
                  All Multi-World Sessions ({multiWorldSessions.length})
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Multi-World simulation sessions across all facilitators.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="border border-border">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border">
                      <TableHead className="text-foreground font-semibold">Session Name</TableHead>
                      <TableHead className="text-foreground font-semibold">Created By</TableHead>
                      <TableHead className="text-foreground font-semibold">Session Code</TableHead>
                      <TableHead className="text-foreground font-semibold">Worlds & Teams</TableHead>
                      <TableHead className="text-foreground font-semibold">Created Date</TableHead>
                      <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multiWorldSessions.map((mw) => {
                      const norm = normaliseSession(mw);
                      const totalTeams = norm.worlds.reduce((sum, w) => sum + (w.teamCount || 5), 0);
                      return (
                        <TableRow key={mw.id} className="border-border hover:bg-muted/10 transition-colors">
                          <TableCell className="font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{mw.name}</span>
                              {mw.isArchived && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                                  Archived
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {mw.createdByEmail || 'Facilitator'}
                          </TableCell>
                          <TableCell className="font-mono text-purple-700 dark:text-purple-400 font-bold">
                            {mw.sessionCode}
                          </TableCell>
                          <TableCell className="text-xs">
                            {norm.worlds.length} Worlds ({totalTeams} Teams)
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(mw.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/facilitator/multiworld/${mw.id}`)}
                                className="h-8 gap-1 text-xs font-semibold"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Enter Multi-World
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/viewer/multi/${mw.sessionCode}`)}
                                className="h-8 gap-1 text-xs font-semibold border-purple-200 text-purple-700"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Viewer
                              </Button>
                              {mw.isArchived ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestoreMultiWorld(mw.id, mw.name)}
                                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-8 gap-1 text-xs font-semibold"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleArchiveMultiWorld(mw.id, mw.name)}
                                  className="border-amber-200 text-amber-700 hover:bg-amber-50 h-8 gap-1 text-xs font-semibold"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="destructive"
                                title="Admin Permanent Delete"
                                onClick={() => handlePermanentDeleteMultiWorld(mw.id, mw.name)}
                                className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-red-600" />
                All Single-World Games & Classes ({classes.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Overview of all simulation games created by facilitators and administrators. Expand any class to view team codes, convert seats, or jump directly into a specific team or game control panel.
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
                                {cls.isArchived && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Archived
                                  </span>
                                )}
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

                                {cls.isArchived ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestoreClass(cls.id, cls.name)}
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 h-8 gap-1 text-xs font-semibold"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Restore
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleArchiveClass(cls.id, cls.name)}
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:text-amber-300 h-8 gap-1 text-xs font-semibold"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                    Archive
                                  </Button>
                                )}

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
                                  title="Admin Permanent Delete"
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

