import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TEAM_COLORS } from '@/data/combinations';
import { Team } from '@/types/game';
import { Plus, Trash2, Play, Bot } from 'lucide-react';

interface GameSetupProps {
  onStartGame: (teams: Team[]) => void;
}

export const GameSetup = ({ onStartGame }: GameSetupProps) => {
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: 'Team 1', color: TEAM_COLORS[0].value, isBot: false }
  ]);

  const addTeam = () => {
    if (teams.length < 5) {
      const nextColor = TEAM_COLORS[teams.length % TEAM_COLORS.length];
      setTeams([
        ...teams,
        { 
          id: Date.now().toString(), 
          name: `Team ${teams.length + 1}`, 
          color: nextColor.value,
          isBot: false
        }
      ]);
    }
  };

  const removeTeam = (id: string) => {
    if (teams.length > 1) {
      setTeams(teams.filter(t => t.id !== id));
    }
  };

  const updateTeamField = (id: string, field: string, value: any) => {
    setTeams(teams.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        if (field === 'isBot' && value) {
          updated.botProfile = updated.botProfile || 'BALANCED';
          updated.botDifficulty = updated.botDifficulty || 'MEDIUM';
        }
        return updated;
      }
      return t;
    }));
  };

  const handleStartGame = () => {
    if (teams.every(t => t.name.trim())) {
      onStartGame(teams);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Smartphone Inc Tracker</CardTitle>
          <CardDescription className="text-center text-base">
            Configure your teams to begin tracking the simulation game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {teams.map((team, index) => (
              <div key={team.id} className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`team-${team.id}-name`}>Team {index + 1} Name</Label>
                    <Input
                      id={`team-${team.id}-name`}
                      value={team.name}
                      onChange={(e) => updateTeamField(team.id, 'name', e.target.value)}
                      placeholder="Enter team name"
                    />
                  </div>
                  <div className="w-36 space-y-2">
                    <Label htmlFor={`team-${team.id}-color`}>Color</Label>
                    <Select
                      value={team.color}
                      onValueChange={(value) => updateTeamField(team.id, 'color', value)}
                    >
                      <SelectTrigger id={`team-${team.id}-color`}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: team.color }}
                          />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_COLORS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: color.value }}
                              />
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col items-center justify-end pb-2 gap-1.5 min-w-[70px]">
                    <Label htmlFor={`team-${team.id}-bot`} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5" /> Bot
                    </Label>
                    <Switch
                      id={`team-${team.id}-bot`}
                      checked={!!team.isBot}
                      onCheckedChange={(checked) => updateTeamField(team.id, 'isBot', checked)}
                    />
                  </div>
                  {teams.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeTeam(team.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {team.isBot && (
                  <div className="flex gap-4 pt-1 bg-card/40 p-3 rounded-lg border border-border/40">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bot Behavior Profile</Label>
                      <Select
                        value={team.botProfile || 'BALANCED'}
                        onValueChange={(val) => updateTeamField(team.id, 'botProfile', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BALANCED">Balanced (Standard)</SelectItem>
                          <SelectItem value="RESEARCHER">Researcher (Tech heavy)</SelectItem>
                          <SelectItem value="EXPANDER">Expander (Logistics heavy)</SelectItem>
                          <SelectItem value="PRICE_FIGHTER">Price Fighter (Discount seller)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Difficulty Level</Label>
                      <Select
                        value={team.botDifficulty || 'MEDIUM'}
                        onValueChange={(val) => updateTeamField(team.id, 'botDifficulty', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EASY">Easy (Sub-optimal, random)</SelectItem>
                          <SelectItem value="MEDIUM">Medium (Competent)</SelectItem>
                          <SelectItem value="HARD">Hard (Maximizing values)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            {teams.length < 5 && (
              <Button
                variant="outline"
                onClick={addTeam}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            )}
            <Button
              onClick={handleStartGame}
              disabled={!teams.every(t => t.name.trim())}
              className="flex-1"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Game
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
