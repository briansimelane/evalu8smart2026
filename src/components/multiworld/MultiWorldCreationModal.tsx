import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Team, ClassTeam } from '@/types/game';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession, WorldKey, WORLD_KEYS } from '@/types/multiworld';
import { WorldConfigSection, WorldConfig } from './WorldConfigSection';
import { Globe, Sparkles, Plus } from 'lucide-react';
import { STANDARD_5_COLORS, getTeamColorName } from '@/data/combinations';

interface MultiWorldCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function createDefaultWorld(key: WorldKey): WorldConfig {
  return {
    key,
    label: `World ${key}`,
    teamCount: 5,
    teams: STANDARD_5_COLORS.map((c, i) => {
      return {
        name: `${c.name} Team`,
        color: c.value,
        teamNumber: i + 1,
        isBot: false,
        botProfile: 'BALANCED',
        botDifficulty: 'MEDIUM'
      };
    })
  };
}

export const MultiWorldCreationModal: React.FC<MultiWorldCreationModalProps> = ({ isOpen, onClose }) => {
  const { createClass, currentUserEmail, currentUserName } = useSession();
  const navigate = useNavigate();

  const [sessionName, setSessionName] = useState('');
  const [worldCount, setWorldCount] = useState<number>(2);
  const [worlds, setWorlds] = useState<WorldConfig[]>([
    createDefaultWorld('A'),
    createDefaultWorld('B')
  ]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({ A: true, B: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWorldCountChange = (count: number) => {
    setWorldCount(count);
    const newWorlds: WorldConfig[] = [];
    const newExpanded: Record<string, boolean> = { ...expandedKeys };

    for (let i = 0; i < count; i++) {
      const key = WORLD_KEYS[i];
      const existing = worlds.find(w => w.key === key);
      if (existing) {
        newWorlds.push(existing);
      } else {
        newWorlds.push(createDefaultWorld(key));
        newExpanded[key] = true;
      }
    }
    setWorlds(newWorlds);
    setExpandedKeys(newExpanded);
  };

  const handleUpdateWorld = (index: number, updated: WorldConfig) => {
    const updatedWorlds = [...worlds];
    updatedWorlds[index] = updated;
    setWorlds(updatedWorlds);
  };

  const handleCopyWorldAToAll = () => {
    const worldA = worlds[0];
    if (!worldA) return;

    const copiedWorlds = worlds.map(w => {
      if (w.key === 'A') return w;
      return {
        ...w,
        teamCount: worldA.teamCount,
        teams: worldA.teams.map((t, idx) => ({
          ...t,
          teamNumber: idx + 1
        }))
      };
    });
    setWorlds(copiedWorlds);
    toast.success('World A configuration copied to all worlds!');
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateMultiWorldSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error('Please enter a session name.');
      return;
    }

    setIsSubmitting(true);
    const createdClassIds: string[] = [];

    try {
      // 1. Create each class sequentially
      for (const w of worlds) {
        const activeTeamsConfig = w.teams.slice(0, w.teamCount);
        const teams: Team[] = activeTeamsConfig.map((t, idx) => ({
          id: `team_${idx + 1}`,
          name: t.name,
          color: t.color,
          teamNumber: t.teamNumber || (idx + 1),
          isBot: t.isBot,
          ...(t.isBot ? { botProfile: t.botProfile, botDifficulty: t.botDifficulty } : {})
        }));

        const className = `${sessionName.trim()} — ${w.label.trim() || 'World ' + w.key}`;
        const classId = await createClass(className, teams);
        createdClassIds.push(classId);
      }

      // 2. Generate session code (e.g. MW-7492)
      const rand4Alpha = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let res = '';
        for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
      };
      const sessionCode = `MW-${rand4Alpha()}`;
      const sessionId = `mw_${Date.now()}`;

      // 3. Save parent session document
      const sessionDoc: MultiWorldSession = {
        id: sessionId,
        name: sessionName.trim(),
        sessionCode,
        worlds: worlds.map((w, idx) => ({
          key: w.key,
          classId: createdClassIds[idx],
          label: w.label.trim() || `World ${w.key}`,
          teamCount: w.teamCount
        })),
        advanceMode: 'lockstep',
        teamLabelMode: worlds.length > 2 ? 'code' : 'name',
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
      // Clean up partially created classes
      for (const cId of createdClassIds) {
        try {
          await deleteDoc(doc(db, 'classes', cId));
        } catch (_) {}
      }
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
            Create Multi-World Session (1–10 Worlds)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Run up to 10 parallel worlds (each with 1–5 teams) linked together. Control lockstep advances, monitor all teams in the Action Dashboard, and broadcast N-world viewers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateMultiWorldSession} className="space-y-6 pt-2">
          {/* Basic Details & World Count */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-2">
              <Label htmlFor="mw-session-name" className="font-semibold text-foreground">Session Name *</Label>
              <Input
                id="mw-session-name"
                placeholder="e.g. Cohort 12 — Global Championship"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                required
                className="bg-background border-input font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-foreground">Number of Worlds (1–10)</Label>
              <Select
                value={worldCount.toString()}
                onValueChange={(val) => handleWorldCountChange(parseInt(val, 10))}
              >
                <SelectTrigger className="bg-background border-input font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} {n === 1 ? 'World (Solo)' : 'Worlds'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Worlds Configuration List */}
          <div className="space-y-4">
            {worlds.map((w, idx) => (
              <WorldConfigSection
                key={w.key}
                world={w}
                onChangeWorld={(updated) => handleUpdateWorld(idx, updated)}
                onCopySetupToAll={idx === 0 ? handleCopyWorldAToAll : undefined}
                isExpanded={expandedKeys[w.key] !== false}
                onToggleExpand={() => toggleExpand(w.key)}
              />
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-semibold">
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? 'Creating Session...' : `Create Multi-World Session (${worlds.length} Worlds)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
