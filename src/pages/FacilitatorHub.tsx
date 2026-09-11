import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, Copy, Check, LogOut, Users, Settings, Eye, Bot, RefreshCw, Globe, Sparkles, Archive, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Team, SimulationClass, ClassTeam, BotProfile, BotDifficulty } from '@/types/game';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiWorldCreationModal } from '@/components/multiworld/MultiWorldCreationModal';
import { MultiWorldSession } from '@/types/multiworld';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';

// Predefined colors for teams
const DEFAULT_TEAMS = [
  { name: 'Green Team', color: '#22c55e', isBot: false, botProfile: 'BALANCED' as BotProfile, botDifficulty: 'MEDIUM' as BotDifficulty },
  { name: 'Blue Team', color: '#3b82f6', isBot: false, botProfile: 'BALANCED' as BotProfile, botDifficulty: 'MEDIUM' as BotDifficulty },
  { name: 'Black Team', color: '#1f2937', isBot: false, botProfile: 'BALANCED' as BotProfile, botDifficulty: 'MEDIUM' as BotDifficulty },
  { name: 'Yellow Team', color: '#eab308', isBot: false, botProfile: 'BALANCED' as BotProfile, botDifficulty: 'MEDIUM' as BotDifficulty },
  { name: 'Red Team', color: '#ef4444', isBot: false, botProfile: 'BALANCED' as BotProfile, botDifficulty: 'MEDIUM' as BotDifficulty }
];

export interface ClassTeamCodesTableProps {
  cls: SimulationClass;
  handleCopy: (code: string) => void;
  copiedCode: string | null;
}

export const ClassTeamCodesTable: React.FC<ClassTeamCodesTableProps> = ({ cls, handleCopy, copiedCode }) => {
  const { selectClass, selectTeam, facilitatorReleaseCeoSlot, facilitatorChangeCeoPin, convertTeamSeat } = useSession();
  const [subcollectionTeams, setSubcollectionTeams] = useState<Record<string, ClassTeam>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!cls.id) return;
    const unsubscribe = onSnapshot(collection(db, 'classes', cls.id, 'teams'), (snapshot) => {
      const map: Record<string, ClassTeam> = {};
      snapshot.forEach(docSnap => {
        map[docSnap.id] = docSnap.data() as ClassTeam;
      });
      setSubcollectionTeams(map);
    }, (error) => {
      console.error(`Error listening to subcollection teams for class ${cls.id}:`, error);
    });

    return () => unsubscribe();
  }, [cls.id]);

  const rawTeams = (cls.teamRegistry && cls.teamRegistry.length > 0) ? cls.teamRegistry : cls.gameState?.teams;
  const teamsToRender = (rawTeams && rawTeams.length > 0)
    ? rawTeams
    : Object.keys(cls.teamCodes || {}).map((tId, idx) => ({
        id: tId,
        name: `Team ${idx + 1}`,
        color: ['#22c55e', '#3b82f6', '#1f2937', '#eab308', '#ef4444'][idx % 5],
        ceoName: '',
        ceoPin: '',
        isBot: false
      }));

  if (teamsToRender.length === 0) {
    return (
      <Table className="border border-border bg-card">
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">
              No teams found in team registry.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table className="border border-border bg-card">
      <TableHeader className="bg-muted/40">
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground font-semibold">Team</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Color</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Access Code</TableHead>
          <TableHead className="text-muted-foreground font-semibold">CEO Spot</TableHead>
          <TableHead className="text-right text-muted-foreground font-semibold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teamsToRender.map((team, idx) => {
          if (!team) return null;
          const teamId = team.id || `team_${idx + 1}`;
          const code = cls.teamCodes?.[teamId];
          const liveTeamDoc = subcollectionTeams[teamId];
          
          const isBot = !!liveTeamDoc?.isBot || !!team.isBot || code === 'BOT';
          const profile = liveTeamDoc?.botProfile || team.botProfile || 'BALANCED';
          const difficulty = liveTeamDoc?.botDifficulty || team.botDifficulty || 'MEDIUM';

          const effectiveCeoName = liveTeamDoc?.ceoName || team.ceoName || '';
          const effectiveCeoPin = liveTeamDoc?.ceoPin || team.ceoPin || '';
          const hasCeo = !!effectiveCeoName;

          return (
            <TableRow key={team.id} className="border-border hover:bg-muted/10 transition-colors">
              <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                {team.name}
                {isBot && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-normal flex items-center gap-1">🤖 Bot</span>}
              </TableCell>
              <TableCell>
                <span
                  className="inline-block w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: team.color }}
                />
              </TableCell>
              <TableCell className="font-mono text-blue-600 font-bold tracking-wider text-xs">
                {isBot ? (
                  <span className="text-xs px-2 py-0.5 rounded border border-blue-250 bg-blue-50 text-blue-700 capitalize">
                    {profile.toLowerCase()} ({difficulty.toLowerCase()})
                  </span>
                ) : code ? (
                  <div className="flex items-center gap-1.5">
                    <span>{code}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 hover:bg-muted text-muted-foreground"
                      onClick={() => handleCopy(code)}
                    >
                      {copiedCode === code ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <span className="text-red-500 font-semibold text-xs border border-red-200 bg-red-50 px-2 py-0.5 rounded">
                    code missing — data integrity issue
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {isBot ? (
                  <span className="text-muted-foreground text-xs flex items-center gap-1">
                    🤖 Auto Play
                  </span>
                ) : hasCeo ? (
                  <span className="text-emerald-600 font-semibold">
                    {effectiveCeoName} <span className="text-xs text-muted-foreground">(PIN: {effectiveCeoPin || 'N/A'})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Vacant</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1.5 justify-end items-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      selectClass(cls.id);
                      selectTeam(team.id);
                      navigate(`/class/${cls.id}`);
                    }}
                    className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1 shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View/Edit Team
                  </Button>

                  {/* Convert Seat Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (isBot) {
                        if (confirm(`Are you sure you want to convert ${team.name} to a Human team?`)) {
                          await convertTeamSeat(cls.id, teamId, 'HUMAN');
                        }
                      } else {
                        const prof = prompt("Enter bot profile (BALANCED, RESEARCHER, EXPANDER, PRICE_FIGHTER):", "BALANCED");
                        if (prof !== null) {
                          const diff = prompt("Enter bot difficulty (EASY, MEDIUM, HARD):", "MEDIUM");
                          if (diff !== null) {
                            await convertTeamSeat(cls.id, teamId, 'BOT', prof.toUpperCase() as BotProfile, diff.toUpperCase() as BotDifficulty);
                          }
                        }
                      }
                    }}
                    className="h-7 px-2 border-border text-foreground hover:bg-muted text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {isBot ? 'Make Human' : 'Make Bot'}
                  </Button>

                  {!isBot && hasCeo && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newPin = prompt(`Enter new CEO PIN code for ${team.name}:`, effectiveCeoPin || '');
                          if (newPin !== null && newPin.trim().length > 0) {
                            facilitatorChangeCeoPin(cls.id, team.id, newPin.trim());
                          }
                        }}
                        className="h-7 px-2 border-border text-foreground hover:bg-muted text-xs"
                      >
                        Change PIN
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Are you sure you want to release the CEO seat for ${team.name}?`)) {
                            facilitatorReleaseCeoSlot(cls.id, team.id);
                          }
                        }}
                        className="h-7 px-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs"
                      >
                        Release CEO
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export const FacilitatorHub: React.FC = () => {
  const { 
    classes, 
    currentRole, 
    currentUserEmail, 
    createClass, 
    archiveClass,
    restoreClass,
    deleteClassPermanently,
    deleteClass, 
    logout, 
    currentClassId, 
    currentClassTeams, 
    facilitatorReleaseCeoSlot, 
    facilitatorChangeCeoPin, 
    selectClass, 
    selectTeam 
  } = useSession();

  const visibleClasses = useMemo(() => {
    if (currentRole === 'ADMIN') return classes;

    return classes.filter(cls => {
      // Created by this facilitator (matching email)
      if (currentUserEmail && cls.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase()) {
        return true;
      }
      // Entered via facilitator code / currently selected class
      if (currentClassId && cls.id === currentClassId) {
        return true;
      }
      // Code match fallback
      if (currentUserEmail && cls.facilitatorCode?.toLowerCase().includes(currentUserEmail.toLowerCase())) {
        return true;
      }
      return false;
    });
  }, [classes, currentRole, currentUserEmail, currentClassId]);

  const activeClasses = useMemo(() => {
    return visibleClasses.filter(c => !c.isArchived);
  }, [visibleClasses]);

  const archivedClasses = useMemo(() => {
    return visibleClasses.filter(c => !!c.isArchived);
  }, [visibleClasses]);

  const [className, setClassName] = useState('');
  const [numTeams, setNumTeams] = useState(5);
  const [teamConfigs, setTeamConfigs] = useState<typeof DEFAULT_TEAMS>(DEFAULT_TEAMS);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [isMultiWorldModalOpen, setIsMultiWorldModalOpen] = useState(false);
  const [multiWorldSessions, setMultiWorldSessions] = useState<MultiWorldSession[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'multiworld_sessions'), (snap) => {
      const list: MultiWorldSession[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as MultiWorldSession);
      });
      setMultiWorldSessions(list);
    }, (err) => {
      console.error("Error fetching multiworld sessions:", err);
    });

    return () => unsub();
  }, []);

  const visibleMultiWorldSessions = useMemo(() => {
    if (currentRole === 'ADMIN') return multiWorldSessions;
    return multiWorldSessions.filter(mw => {
      if (currentUserEmail && mw.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase()) return true;
      return false;
    });
  }, [multiWorldSessions, currentRole, currentUserEmail]);

  const activeMultiWorldSessions = useMemo(() => {
    return visibleMultiWorldSessions.filter(mw => !mw.isArchived);
  }, [visibleMultiWorldSessions]);

  const archivedMultiWorldSessions = useMemo(() => {
    return visibleMultiWorldSessions.filter(mw => !!mw.isArchived);
  }, [visibleMultiWorldSessions]);

  const toggleExpandClass = (id: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      toast.error('Please enter a class name.');
      return;
    }

    try {
      // Get the subset of configured teams based on selected count
      const activeConfigs = teamConfigs.slice(0, numTeams);

      // Map to actual Team interface
      const teams: Team[] = activeConfigs.map((t, idx) => {
        const teamObj: Team = {
          id: `team_${idx + 1}`,
          name: t.name,
          color: t.color,
          teamNumber: idx + 1,
          isBot: !!t.isBot,
        };
        if (t.isBot) {
          teamObj.botProfile = t.botProfile || 'BALANCED';
          teamObj.botDifficulty = t.botDifficulty || 'MEDIUM';
        }
        return teamObj;
      });

      await createClass(className, teams);
      toast.success(`Class "${className}" created successfully!`);
      setClassName('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create class.');
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete class "${name}"? All game data will be lost.`)) {
      try {
        await deleteClass(id);
        toast.success(`Class "${name}" deleted.`);
      } catch (err) {
        toast.error('Failed to delete class.');
      }
    }
  };

  const handleArchiveClass = async (id: string, name: string) => {
    if (confirm(`Move class "${name}" to Archive?\n\nIt will be hidden from active classes and can be restored or permanently deleted from the Archive.`)) {
      try {
        await archiveClass(id);
        toast.success(`Class "${name}" moved to archive.`);
      } catch (err) {
        toast.error('Failed to archive class.');
      }
    }
  };

  const handleRestoreClass = async (id: string, name: string) => {
    try {
      await restoreClass(id);
      toast.success(`Class "${name}" restored to active classes.`);
    } catch (err) {
      toast.error('Failed to restore class.');
    }
  };

  const handlePermanentDeleteClass = async (id: string, name: string) => {
    if (confirm(`PERMANENT DELETE: Are you sure you want to permanently delete class "${name}"?\n\nThis will permanently destroy all game data, team submissions, and history. This action CANNOT be undone.`)) {
      try {
        await deleteClassPermanently(id);
        toast.success(`Class "${name}" has been permanently deleted.`);
      } catch (err) {
        toast.error('Failed to permanently delete class.');
      }
    }
  };

  const handleArchiveMultiWorld = async (id: string, name: string) => {
    if (confirm(`Move Multi-World Session "${name}" to Archive?\n\nIt will be hidden from active sessions and can be restored or permanently deleted from the Archive.`)) {
      try {
        await updateDoc(doc(db, 'multiworld_sessions', id), {
          isArchived: true,
          archivedAt: new Date().toISOString()
        });
        toast.success(`Session "${name}" moved to archive.`);
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
    if (confirm(`PERMANENT DELETE: Are you sure you want to permanently delete Multi-World Session "${name}"?\n\nThis cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'multiworld_sessions', id));
        toast.success(`Session "${name}" permanently deleted.`);
      } catch (err) {
        toast.error('Failed to permanently delete session.');
      }
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-border pb-5 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Facilitator Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage game sessions, teams, and view access codes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsMultiWorldModalOpen(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm"
          >
            <Globe className="h-4 w-4" />
            <Sparkles className="h-3.5 w-3.5" />
            Create Multi-World Session (10 Teams)
          </Button>
          <Button variant="destructive" onClick={logout} className="gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Class Card */}
        <Card className="bg-card border-border h-fit">
          <CardHeader>
            <CardTitle className="text-xl text-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Create New Class
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Initialize a session with predefined game teams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClass} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Class Name</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. MBA Class 2026 - Section A"
                  className="bg-background border-border text-foreground"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Number of Teams</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumTeams(num)}
                      className={`flex-1 py-1.5 rounded border text-sm font-bold transition-all ${
                        numTeams === num
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-background border-border text-muted-foreground hover:border-slate-350'
                      }`}
                    >
                      {num} Teams
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Customize Teams
                </label>
                <div className="space-y-3 bg-muted/40 p-3 rounded-lg border border-border font-sans">
                  {teamConfigs.slice(0, numTeams).map((team, idx) => (
                    <div key={idx} className="space-y-2.5 bg-card p-3 rounded border border-border">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground font-bold min-w-[50px]">
                          Team {idx + 1}
                        </span>
                        <Input
                          type="text"
                          required
                          value={team.name}
                          onChange={(e) => {
                            const updated = [...teamConfigs];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setTeamConfigs(updated);
                          }}
                          className="h-8 bg-background border-border text-foreground text-xs flex-1"
                          placeholder={`Team ${idx + 1} Name`}
                        />
                        <div className="relative flex items-center gap-1.5">
                          <input
                            type="color"
                            value={team.color}
                            onChange={(e) => {
                              const updated = [...teamConfigs];
                              updated[idx] = { ...updated[idx], color: e.target.value };
                              setTeamConfigs(updated);
                            }}
                            className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0 animate-none"
                          />
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1 min-w-[50px]">
                          <label className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Bot className="h-3 w-3" /> Bot</label>
                          <Switch
                            checked={!!team.isBot}
                            onCheckedChange={(checked) => {
                              const updated = [...teamConfigs];
                              updated[idx] = { ...updated[idx], isBot: checked };
                              setTeamConfigs(updated);
                            }}
                          />
                        </div>
                      </div>

                      {team.isBot && (
                        <div className="flex gap-2 pt-2 border-t border-border/30 bg-muted/20 p-2 rounded">
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] text-muted-foreground">Bot Behavior Profile</label>
                            <Select
                              value={team.botProfile || 'BALANCED'}
                              onValueChange={(val) => {
                                const updated = [...teamConfigs];
                                updated[idx] = { ...updated[idx], botProfile: val as BotProfile };
                                setTeamConfigs(updated);
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px] py-0 px-2 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="text-xs">
                                <SelectItem value="BALANCED">Balanced</SelectItem>
                                <SelectItem value="RESEARCHER">Researcher</SelectItem>
                                <SelectItem value="EXPANDER">Expander</SelectItem>
                                <SelectItem value="PRICE_FIGHTER">Price Fighter</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] text-muted-foreground">Difficulty Level</label>
                            <Select
                              value={team.botDifficulty || 'MEDIUM'}
                              onValueChange={(val) => {
                                const updated = [...teamConfigs];
                                updated[idx] = { ...updated[idx], botDifficulty: val as BotDifficulty };
                                setTeamConfigs(updated);
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px] py-0 px-2 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="text-xs">
                                <SelectItem value="EASY">Easy</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="HARD">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all shadow-sm"
              >
                Create Class
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Column: Classes and Multi-World Sessions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Multi-World Sessions Section */}
          {activeMultiWorldSessions.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                Multi-World Sessions (10-Team Scaled)
              </h2>
              <Card className="bg-card border-border overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border">
                      <TableHead className="text-foreground font-semibold">Session Name</TableHead>
                      <TableHead className="text-foreground font-semibold">Session Code</TableHead>
                      <TableHead className="text-foreground font-semibold">Mode</TableHead>
                      <TableHead className="text-foreground font-semibold">Created Date</TableHead>
                      <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMultiWorldSessions.map((mw) => (
                      <TableRow key={mw.id} className="border-border hover:bg-muted/10 transition-colors">
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>{mw.name}</span>
                          </div>
                          {(() => {
                            const norm = normaliseSession(mw);
                            const totalTeams = norm.worlds.reduce((sum, w) => sum + (w.teamCount || 5), 0);
                            return (
                              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                                  {norm.worlds.length} {norm.worlds.length === 1 ? 'World' : 'Worlds'} ({totalTeams} Teams)
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground uppercase font-mono">
                                  {norm.worlds.map(w => w.key).join(', ')}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="font-mono text-purple-700 dark:text-purple-400 font-bold text-xs">
                          {mw.sessionCode}
                        </TableCell>
                        <TableCell className="capitalize text-xs font-medium">
                          <span className="px-2 py-0.5 rounded border border-purple-200 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {mw.advanceMode || 'lockstep'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(mw.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => navigate(`/facilitator/multiworld/${mw.id}`)}
                              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-8 text-xs font-semibold"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Multi-World Control
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/viewer/multi/${mw.sessionCode}`)}
                              className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-300 gap-1.5 h-8 text-xs font-semibold"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Combined Viewer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              title="Archive Session"
                              onClick={() => handleArchiveMultiWorld(mw.id, mw.name)}
                              className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 h-8 gap-1 text-xs font-semibold"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Active Single Classes Section */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Active Classes
            </h2>

          {activeClasses.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center text-muted-foreground">
              No active classes found for your account. Create one to get started or enter using a facilitator code.
            </Card>
          ) : (
            <Card className="bg-card border-border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border">
                    <TableHead className="text-foreground font-semibold">Class Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Created Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Teams</TableHead>
                    <TableHead className="text-foreground font-semibold">Access Codes</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeClasses.map((cls) => {
                    const isExpanded = !!expandedClasses[cls.id];
                    return (
                      <React.Fragment key={cls.id}>
                        <TableRow className="border-border hover:bg-muted/10 transition-colors">
                          <TableCell className="font-semibold text-foreground">{cls.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(cls.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-foreground font-medium text-sm">
                            {cls.teamRegistry?.length || cls.gameState?.teams?.length || Object.keys(cls.teamCodes || {}).length || 0} Teams
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpandClass(cls.id)}
                              className="h-8 border-border text-foreground hover:bg-muted font-semibold text-xs"
                            >
                              {isExpanded ? 'Hide Codes' : 'Show Codes'}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                onClick={() => {
                                  selectClass(cls.id);
                                  navigate(`/class/${cls.id}`);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs font-semibold"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Control Panel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Archive Class"
                                onClick={() => handleArchiveClass(cls.id, cls.name)}
                                className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 h-8 gap-1 text-xs font-semibold"
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible Details Panel */}
                        {isExpanded && (
                          <TableRow className="border-border bg-muted/5 hover:bg-muted/5">
                            <TableCell colSpan={5} className="p-4 bg-muted/5">
                              <div className="space-y-4 max-w-4xl mx-auto py-2">
                                {/* Facilitator Code */}
                                <div className="flex items-center gap-4 bg-background p-3 rounded-lg border border-border">
                                  <span className="text-sm font-semibold text-foreground block min-w-[130px]">
                                    Facilitator Code:
                                  </span>
                                  <code className="text-emerald-700 font-mono font-bold tracking-widest bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                                    {cls.facilitatorCode}
                                  </code>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-muted text-muted-foreground"
                                    onClick={() => handleCopy(cls.facilitatorCode)}
                                  >
                                    {copiedCode === cls.facilitatorCode ? (
                                      <Check className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                {/* Team Codes */}
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Team Access Codes</div>
                                  <ClassTeamCodesTable cls={cls} handleCopy={handleCopy} copiedCode={copiedCode} />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
          </div>

          {/* Archived Section (Worlds & Sessions) */}
          {(archivedClasses.length > 0 || archivedMultiWorldSessions.length > 0) && (
            <div className="pt-6 border-t border-border/80">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Archive className="h-5 w-5 text-amber-600" />
                  Archived Worlds & Sessions ({archivedClasses.length + archivedMultiWorldSessions.length})
                </h2>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Archived worlds are safely retained with all gameplay data preserved. You can restore them back to Active anytime or permanently delete them.
                </p>
              </div>

              {/* Archived Multi-World Sessions */}
              {archivedMultiWorldSessions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Archived Multi-World Sessions ({archivedMultiWorldSessions.length})
                  </h3>
                  <Card className="bg-card border-border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border">
                          <TableHead className="text-foreground font-semibold">Session Name</TableHead>
                          <TableHead className="text-foreground font-semibold">Session Code</TableHead>
                          <TableHead className="text-foreground font-semibold">Date Archived</TableHead>
                          <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archivedMultiWorldSessions.map((mw) => (
                          <TableRow key={mw.id} className="border-border hover:bg-muted/10 transition-colors bg-muted/5">
                            <TableCell className="font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                  Archived
                                </span>
                                <span>{mw.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-purple-700 dark:text-purple-400 font-bold text-xs">
                              {mw.sessionCode}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {mw.archivedAt ? new Date(mw.archivedAt).toLocaleDateString() : 'Previously'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestoreMultiWorld(mw.id, mw.name)}
                                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 gap-1.5 h-8 text-xs font-semibold"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handlePermanentDeleteMultiWorld(mw.id, mw.name)}
                                  className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 gap-1.5 text-xs font-semibold"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Permanently
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}

              {/* Archived Classes */}
              {archivedClasses.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Archived Single Worlds / Classes ({archivedClasses.length})
                  </h3>
                  <Card className="bg-card border-border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border">
                          <TableHead className="text-foreground font-semibold">Class Name</TableHead>
                          <TableHead className="text-foreground font-semibold">Date Archived</TableHead>
                          <TableHead className="text-foreground font-semibold">Teams</TableHead>
                          <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archivedClasses.map((cls) => (
                          <TableRow key={cls.id} className="border-border hover:bg-muted/10 transition-colors bg-muted/5">
                            <TableCell className="font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                  Archived
                                </span>
                                <span>{cls.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {cls.archivedAt ? new Date(cls.archivedAt).toLocaleDateString() : 'Previously'}
                            </TableCell>
                            <TableCell className="text-foreground font-medium text-sm">
                              {cls.teamRegistry?.length || cls.gameState?.teams?.length || Object.keys(cls.teamCodes || {}).length || 0} Teams
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestoreClass(cls.id, cls.name)}
                                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 gap-1.5 h-8 text-xs font-semibold"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handlePermanentDeleteClass(cls.id, cls.name)}
                                  className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 gap-1.5 text-xs font-semibold"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Permanently
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <MultiWorldCreationModal
        isOpen={isMultiWorldModalOpen}
        onClose={() => setIsMultiWorldModalOpen(false)}
      />
    </div>
  );
};
