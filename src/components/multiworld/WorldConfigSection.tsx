import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { WorldKey } from '@/types/multiworld';
import { BotProfile, BotDifficulty } from '@/types/game';
import { Bot, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { STANDARD_5_COLORS, getTeamColorName } from '@/data/combinations';

export interface WorldTeamConfig {
  name: string;
  color: string;
  teamNumber: number;
  isBot: boolean;
  botProfile: BotProfile;
  botDifficulty: BotDifficulty;
}

export interface WorldConfig {
  key: WorldKey;
  label: string;
  teamCount: number;
  teams: WorldTeamConfig[];
}

interface WorldConfigSectionProps {
  world: WorldConfig;
  onChangeWorld: (updated: WorldConfig) => void;
  onCopySetupToAll?: () => void;
  onRemoveWorld?: () => void;
  canRemove?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function WorldConfigSection({
  world,
  onChangeWorld,
  onCopySetupToAll,
  onRemoveWorld,
  canRemove = false,
  isExpanded = true,
  onToggleExpand
}: WorldConfigSectionProps) {

  const handleLabelChange = (label: string) => {
    onChangeWorld({ ...world, label });
  };

  const handleTeamCountChange = (count: number) => {
    const newTeams: WorldTeamConfig[] = [];
    for (let i = 0; i < count; i++) {
      if (world.teams[i]) {
        newTeams.push({ ...world.teams[i], teamNumber: i + 1 });
      } else {
        const colorObj = STANDARD_5_COLORS[i % STANDARD_5_COLORS.length];
        newTeams.push({
          name: `${colorObj.name} Team`,
          color: colorObj.value,
          teamNumber: i + 1,
          isBot: false,
          botProfile: 'BALANCED',
          botDifficulty: 'MEDIUM'
        });
      }
    }
    onChangeWorld({ ...world, teamCount: count, teams: newTeams });
  };

  const handleTeamChange = (index: number, patch: Partial<WorldTeamConfig>) => {
    const updatedTeams = [...world.teams];
    updatedTeams[index] = { ...updatedTeams[index], ...patch };
    onChangeWorld({ ...world, teams: updatedTeams });
  };

  return (
    <Card className="border shadow-xs">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 bg-slate-900 text-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <Badge className="bg-purple-600 font-black font-mono text-xs px-2 py-0.5">
            {world.key}
          </Badge>
          <input
            type="text"
            value={world.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="bg-transparent border-b border-white/30 text-white font-extrabold text-sm focus:outline-none focus:border-purple-400 px-1 py-0.5 w-[160px] sm:w-[220px]"
            placeholder="World Name"
          />
          <Badge variant="outline" className="text-slate-300 border-slate-700 text-xs">
            {world.teamCount} Teams
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {world.key === 'A' && onCopySetupToAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopySetupToAll}
              className="text-xs text-white border-white/30 hover:bg-white/10 gap-1.5 h-7"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy World A to All
            </Button>
          )}

          {canRemove && onRemoveWorld && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveWorld}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-slate-400 hover:text-white p-1"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              Team Count:
            </Label>
            <Select
              value={world.teamCount.toString()}
              onValueChange={(val) => handleTeamCountChange(parseInt(val))}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? 'Team' : 'Teams'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            {world.teams.map((t, idx) => (
              <div
                key={idx}
                className="p-3 bg-muted/40 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <div className="w-12 font-mono font-bold text-muted-foreground">
                    T{t.teamNumber}W{world.key}
                  </div>
                  <Input
                    value={t.name}
                    onChange={(e) => handleTeamChange(idx, { name: e.target.value })}
                    className="h-8 text-xs font-bold"
                    placeholder="Team Name"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-[11px]">Bot:</span>
                    <Switch
                      checked={t.isBot}
                      onCheckedChange={(checked) => handleTeamChange(idx, { isBot: checked })}
                    />
                  </div>

                  {t.isBot && (
                    <>
                      <Select
                        value={t.botProfile}
                        onValueChange={(val: BotProfile) => handleTeamChange(idx, { botProfile: val })}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BALANCED">Balanced</SelectItem>
                          <SelectItem value="RESEARCHER">Researcher</SelectItem>
                          <SelectItem value="EXPANDER">Expander</SelectItem>
                          <SelectItem value="PRICE_FIGHTER">Price Fighter</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={t.botDifficulty}
                        onValueChange={(val: BotDifficulty) => handleTeamChange(idx, { botDifficulty: val })}
                      >
                        <SelectTrigger className="w-[90px] h-8 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EASY">Easy</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
