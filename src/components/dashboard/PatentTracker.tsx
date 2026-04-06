import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useGame } from '@/contexts/GameContext';
import { TECHNOLOGIES } from '@/data/combinations';
import { toast } from 'sonner';
import { Award, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const PatentTracker = () => {
  const { gameState, updatePatent } = useGame();
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  if (!gameState) return null;

  const handleRegisterPatent = () => {
    if (!selectedTech || !selectedTeam) {
      toast.error('Please select both technology and team');
      return;
    }

    if (gameState.patents[selectedTech]) {
      toast.error('This technology already has a patent holder');
      return;
    }

    updatePatent(selectedTech, selectedTeam);
    toast.success('Patent registered successfully');
    setSelectedTech('');
    setSelectedTeam('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Register Patent</CardTitle>
          <CardDescription>Award patents to teams who fully research technologies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patent-tech">Technology</Label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger id="patent-tech">
                  <SelectValue placeholder="Select technology" />
                </SelectTrigger>
                <SelectContent>
                  {TECHNOLOGIES.filter(tech => !gameState.patents[tech]).map(tech => (
                    <SelectItem key={tech} value={tech}>
                      {tech}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patent-team">Team</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="patent-team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {gameState.teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleRegisterPatent} className="w-full">
            <Award className="mr-2 h-4 w-4" />
            Register Patent
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patent Registry</CardTitle>
          <CardDescription>All registered patents and their holders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TECHNOLOGIES.map(tech => {
              const holder = gameState.patents[tech];
              const team = holder ? gameState.teams.find(t => t.id === holder) : null;

              return (
                <div
                  key={tech}
                  className={`p-4 rounded-lg border ${
                    holder
                      ? 'bg-accent/10 border-accent'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {holder ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span className="font-semibold">{tech}</span>
                    </div>
                    {team ? (
                      <Badge style={{ backgroundColor: team.color, color: 'white' }}>
                        {team.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Available</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patent Scoreboard</CardTitle>
          <CardDescription>Number of patents held by each team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gameState.teams.map(team => {
              const patentCount = Object.values(gameState.patents).filter(
                holderId => holderId === team.id
              ).length;

              return (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="font-medium">{team.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{patentCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
