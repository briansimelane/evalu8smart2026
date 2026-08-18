import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Team, BotProfile, BotDifficulty } from '@/types/game';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession } from '@/types/multiworld';
import { Globe, Users, Bot, Layers, Sparkles } from 'lucide-react';

const STANDARD_5_COLORS = [
  { name: 'Green Team', color: '#22c55e' },
  { name: 'Blue Team', color: '#3b82f6' },
  { name: 'Black Team', color: '#1f2937' },
  { name: 'Yellow Team', color: '#eab308' },
  { name: 'Red Team', color: '#ef4444' }
];

interface MultiWorldCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfiguredTeam {
  name: string;
  color: string;
  isBot: boolean;
  botProfile: BotProfile;
  botDifficulty: BotDifficulty;
}

export const MultiWorldCreationModal: React.FC<MultiWorldCreationModalProps> = ({ isOpen, onClose }) => {
  const { createClass, currentUserEmail, currentUserName } = useSession();
  const navigate = useNavigate();

  const [sessionName, setSessionName] = useState('');
  const [worldALabel, setWorldALabel] = useState('World A');
  const [worldBLabel, setWorldBLabel] = useState('World B');
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize 5 team slots for World A and 5 team slots for World B
  const [worldATeamConfigs, setWorldATeamConfigs] = useState<ConfiguredTeam[]>(
    STANDARD_5_COLORS.map(c => ({
      name: `${c.name} (A)`,
      color: c.color,
      isBot: false,
      botProfile: 'BALANCED',
      botDifficulty: 'MEDIUM'
    }))
  );

  const [worldBTeamConfigs, setWorldBTeamConfigs] = useState<ConfiguredTeam[]>(
    STANDARD_5_COLORS.map(c => ({
      name: `${c.name} (B)`,
      color: c.color,
      isBot: false,
      botProfile: 'BALANCED',
      botDifficulty: 'MEDIUM'
    }))
  );

  // Calculate teams per world based on totalTeamsCount
  // Equal team count per world: e.g. 10 -> 5+5, 8 -> 4+4, 6 -> 3+3
  // If count is odd (e.g. 7 or 9), equalize by treating it as even (e.g. 8 or 10 with 1 bot seat)
  const effectiveTotal = totalTeamsCount % 2 !== 0 ? totalTeamsCount + 1 : totalTeamsCount;
  const teamsPerWorld = Math.min(5, Math.max(3, effectiveTotal / 2));

  const updateWorldATeam = (index: number, updates: Partial<ConfiguredTeam>) => {
    setWorldATeamConfigs(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const updateWorldBTeam = (index: number, updates: Partial<ConfiguredTeam>) => {
    setWorldBTeamConfigs(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const handleCreateMultiWorldSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error('Please enter a session name.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Filter active teams for World A and World B
      const activeConfigsA = worldATeamConfigs.slice(0, teamsPerWorld);
      let activeConfigsB = worldBTeamConfigs.slice(0, teamsPerWorld);

      // If user selected an odd count like 7 or 9, auto-fill the last seat of World B with a Bot if needed
      if (totalTeamsCount % 2 !== 0 && activeConfigsB.length > 0) {
        const lastIdx = activeConfigsB.length - 1;
        activeConfigsB[lastIdx] = {
          ...activeConfigsB[lastIdx],
          isBot: true,
          botProfile: 'BALANCED',
          botDifficulty: 'MEDIUM'
        };
      }

      // Map to Team interface
      const teamsA: Team[] = activeConfigsA.map((t, idx) => ({
        id: `team_${idx + 1}`,
        name: t.name,
        color: t.color,
        isBot: t.isBot,
        ...(t.isBot ? { botProfile: t.botProfile, botDifficulty: t.botDifficulty } : {})
      }));

      const teamsB: Team[] = activeConfigsB.map((t, idx) => ({
        id: `team_${idx + 1}`,
        name: t.name,
        color: t.color,
        isBot: t.isBot,
        ...(t.isBot ? { botProfile: t.botProfile, botDifficulty: t.botDifficulty } : {})
      }));

      // 2. Call existing createClass for World A and World B
      const nameA = `${sessionName.trim()} — ${worldALabel.trim() || 'World A'}`;
      const nameB = `${sessionName.trim()} — ${worldBLabel.trim() || 'World B'}`;

      const worldAClassId = await createClass(nameA, teamsA);
      const worldBClassId = await createClass(nameB, teamsB);

      // 3. Generate sessionCode (e.g. MW-7492)
      const rand4Alpha = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let res = '';
        for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
      };
      const sessionCode = `MW-${rand4Alpha()}`;
      const sessionId = `mw_${Date.now()}`;

      // 4. Save parent session document in multiworld_sessions/{sessionId}
      const sessionDoc: MultiWorldSession = {
        id: sessionId,
        name: sessionName.trim(),
        sessionCode,
        worldAClassId,
        worldBClassId,
        worldALabel: worldALabel.trim() || 'World A',
        worldBLabel: worldBLabel.trim() || 'World B',
        advanceMode: 'lockstep',
        createdAt: new Date().toISOString(),
        createdByEmail: currentUserEmail || 'admin@evalu8.com',
        createdByName: currentUserName || 'Facilitator'
      };

      await setDoc(doc(db, 'multiworld_sessions', sessionId), sessionDoc);

      toast.success(`Multi-World Session "${sessionName}" created successfully!`);
      onClose();
      navigate(`/facilitator/multiworld/${sessionId}`);

    } catch (err: any) {
      console.error("Error creating multi-world session:", err);
      toast.error(err.message || 'Failed to create multi-world session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Globe className="h-6 w-6 text-purple-600" />
            Create Multi-World Session (Up to 10 Teams)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Run two parallel 5-team games ("World A" & "World B") linked together. Advance both in lockstep from one control surface with a combined 10-team viewer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateMultiWorldSession} className="space-y-6 pt-2">
          {/* Basic Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="mw-session-name" className="font-semibold text-foreground">Session Name *</Label>
              <Input
                id="mw-session-name"
                placeholder="e.g. Cohort 12 — Championship"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mw-world-a-label" className="font-semibold text-foreground">World A Label</Label>
              <Input
                id="mw-world-a-label"
                value={worldALabel}
                onChange={(e) => setWorldALabel(e.target.value)}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mw-world-b-label" className="font-semibold text-foreground">World B Label</Label>
              <Input
                id="mw-world-b-label"
                value={worldBLabel}
                onChange={(e) => setWorldBLabel(e.target.value)}
                className="bg-background border-input"
              />
            </div>
          </div>

          {/* Team Scaling Selector */}
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  Total Session Teams: {effectiveTotal} Teams ({teamsPerWorld} per world)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Both worlds run {teamsPerWorld} teams to ensure equal control-point balance.
                  {totalTeamsCount % 2 !== 0 && " (Odd team count auto-balanced with 1 Bot)"}
                </p>
              </div>
              <Select
                value={totalTeamsCount.toString()}
                onValueChange={(val) => setTotalTeamsCount(parseInt(val, 10))}
              >
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Select teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 Teams (5 + 5)</SelectItem>
                  <SelectItem value="8">8 Teams (4 + 4)</SelectItem>
                  <SelectItem value="6">6 Teams (3 + 3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* World A & World B Rosters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* World A Roster */}
            <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-bold text-purple-700 flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> {worldALabel || 'World A'} ({teamsPerWorld} Teams)
                </span>
                <span className="text-xs text-muted-foreground font-mono">Class A</span>
              </div>
              {worldATeamConfigs.slice(0, teamsPerWorld).map((team, idx) => (
                <div key={idx} className="p-3 rounded-md bg-muted/30 border border-border/60 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: team.color }} />
                    <Input
                      value={team.name}
                      onChange={(e) => updateWorldATeam(idx, { name: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      <Switch
                        checked={team.isBot}
                        onCheckedChange={(checked) => updateWorldATeam(idx, { isBot: checked })}
                      />
                      <span className="font-medium text-[11px] min-w-[32px]">{team.isBot ? 'Bot' : 'Human'}</span>
                    </div>
                  </div>

                  {team.isBot && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Select
                        value={team.botProfile}
                        onValueChange={(val: BotProfile) => updateWorldATeam(idx, { botProfile: val })}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue placeholder="Profile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BALANCED">Balanced</SelectItem>
                          <SelectItem value="RESEARCHER">Researcher</SelectItem>
                          <SelectItem value="EXPANDER">Expander</SelectItem>
                          <SelectItem value="PRICE_FIGHTER">Price Fighter</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={team.botDifficulty}
                        onValueChange={(val: BotDifficulty) => updateWorldATeam(idx, { botDifficulty: val })}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue placeholder="Difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EASY">Easy</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* World B Roster */}
            <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-bold text-blue-700 flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> {worldBLabel || 'World B'} ({teamsPerWorld} Teams)
                </span>
                <span className="text-xs text-muted-foreground font-mono">Class B</span>
              </div>
              {worldBTeamConfigs.slice(0, teamsPerWorld).map((team, idx) => (
                <div key={idx} className="p-3 rounded-md bg-muted/30 border border-border/60 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: team.color }} />
                    <Input
                      value={team.name}
                      onChange={(e) => updateWorldBTeam(idx, { name: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      <Switch
                        checked={team.isBot}
                        onCheckedChange={(checked) => updateWorldBTeam(idx, { isBot: checked })}
                      />
                      <span className="font-medium text-[11px] min-w-[32px]">{team.isBot ? 'Bot' : 'Human'}</span>
                    </div>
                  </div>

                  {team.isBot && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Select
                        value={team.botProfile}
                        onValueChange={(val: BotProfile) => updateWorldBTeam(idx, { botProfile: val })}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue placeholder="Profile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BALANCED">Balanced</SelectItem>
                          <SelectItem value="RESEARCHER">Researcher</SelectItem>
                          <SelectItem value="EXPANDER">Expander</SelectItem>
                          <SelectItem value="PRICE_FIGHTER">Price Fighter</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={team.botDifficulty}
                        onValueChange={(val: BotDifficulty) => updateWorldBTeam(idx, { botDifficulty: val })}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue placeholder="Difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EASY">Easy</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-semibold">
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? 'Creating Session...' : 'Create Multi-World Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
