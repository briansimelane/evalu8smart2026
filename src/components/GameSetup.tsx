import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEAM_COLORS } from '@/data/combinations';
import { Team } from '@/types/game';
import { Plus, Trash2, Play } from 'lucide-react';

interface GameSetupProps {
  onStartGame: (teams: Team[]) => void;
}

export const GameSetup = ({ onStartGame }: GameSetupProps) => {
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: 'Team 1', color: TEAM_COLORS[0].value }
  ]);

  const addTeam = () => {
    if (teams.length < 5) {
      const nextColor = TEAM_COLORS[teams.length % TEAM_COLORS.length];
      setTeams([
        ...teams,
        { id: Date.now().toString(), name: `Team ${teams.length + 1}`, color: nextColor.value }
      ]);
    }
  };

  const removeTeam = (id: string) => {
    if (teams.length > 1) {
      setTeams(teams.filter(t => t.id !== id));
    }
  };

  const updateTeam = (id: string, field: 'name' | 'color', value: string) => {
    setTeams(teams.map(t => t.id === id ? { ...t, [field]: value } : t));
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
              <div key={team.id} className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`team-${team.id}-name`}>Team {index + 1} Name</Label>
                  <Input
                    id={`team-${team.id}-name`}
                    value={team.name}
                    onChange={(e) => updateTeam(team.id, 'name', e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
                <div className="w-40 space-y-2">
                  <Label htmlFor={`team-${team.id}-color`}>Color</Label>
                  <Select
                    value={team.color}
                    onValueChange={(value) => updateTeam(team.id, 'color', value)}
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
