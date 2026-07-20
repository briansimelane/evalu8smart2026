import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, Copy, Check, LogOut, Users, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Team } from '@/types/game';

// Predefined colors for teams
const DEFAULT_TEAMS = [
  { name: 'Green Team', color: '#22c55e' },
  { name: 'Blue Team', color: '#3b82f6' },
  { name: 'Black Team', color: '#1f2937' },
  { name: 'Yellow Team', color: '#eab308' },
  { name: 'Red Team', color: '#ef4444' }
];

export const FacilitatorHub: React.FC = () => {
  const { classes, createClass, deleteClass, logout, currentClassId, facilitatorReleaseCeoSlot, facilitatorChangeCeoPin } = useSession();
  const [className, setClassName] = useState('');
  const [numTeams, setNumTeams] = useState(5);
  const [teamConfigs, setTeamConfigs] = useState<typeof DEFAULT_TEAMS>(DEFAULT_TEAMS);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

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
      const teams: Team[] = activeConfigs.map((t, idx) => ({
        id: `team_${idx + 1}_${Date.now()}`,
        name: t.name,
        color: t.color
      }));

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
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Facilitator Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage game sessions, teams, and view access codes</p>
        </div>
        <Button variant="destructive" onClick={logout} className="gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
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
                    <div key={idx} className="flex items-center gap-3 bg-card p-2 rounded border border-border">
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
                          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0"
                        />
                        <span className="text-[11px] font-mono text-muted-foreground uppercase">
                          {team.color}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-bold py-6 rounded-lg transition-all active:scale-[0.98]"
              >
                Create Class
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Classes List */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Active Classes
          </h2>

          {classes.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center text-muted-foreground">
              No active classes found. Create one to get started.
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
                  {classes.map((cls) => {
                    const isExpanded = !!expandedClasses[cls.id];
                    return (
                      <React.Fragment key={cls.id}>
                        <TableRow className="border-border hover:bg-muted/10 transition-colors">
                          <TableCell className="font-semibold text-foreground">{cls.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(cls.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-foreground font-medium text-sm">
                            {cls.gameState?.teams?.length || 0} Teams
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
                                onClick={() => navigate(`/class/${cls.id}`)}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs font-semibold"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Control Panel
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteClass(cls.id, cls.name)}
                                className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 h-8"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
                                      {cls.gameState?.teams ? (
                                        cls.gameState.teams.map((team) => {
                                          const code = cls.teamCodes[team.id];
                                          const hasCeo = !!team.ceoName;
                                          return (
                                            <TableRow key={team.id} className="border-border hover:bg-muted/10 transition-colors">
                                              <TableCell className="font-semibold text-foreground">{team.name}</TableCell>
                                              <TableCell>
                                                <span
                                                  className="inline-block w-4 h-4 rounded-full border border-border"
                                                  style={{ backgroundColor: team.color }}
                                                />
                                              </TableCell>
                                              <TableCell className="font-mono text-blue-600 font-bold tracking-wider">
                                                <div className="flex items-center gap-1.5">
                                                  <span>{code || 'N/A'}</span>
                                                  {code && (
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
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {hasCeo ? (
                                                  <span className="text-emerald-600 font-semibold">
                                                    {team.ceoName} <span className="text-xs text-muted-foreground">(PIN: {team.ceoPin || 'N/A'})</span>
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground text-xs italic">Vacant</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex gap-1.5 justify-end">
                                                  {hasCeo && (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                          const newPin = prompt(`Enter new CEO PIN code for ${team.name}:`, team.ceoPin || '');
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
                                        })
                                      ) : (
                                        <TableRow className="border-border">
                                          <TableCell colSpan={5} className="text-center text-muted-foreground py-3">
                                            Game state not initialized. Click "Control Panel" to setup and start.
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
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
      </div>
    </div>
  );
};
