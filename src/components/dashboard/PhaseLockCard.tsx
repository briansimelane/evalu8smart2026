import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, ShieldAlert } from 'lucide-react';

interface PhaseLockCardProps {
  phaseName: string;
}

export const PhaseLockCard: React.FC<PhaseLockCardProps> = ({ phaseName }) => {
  const { gameState } = useGame();
  const { currentTeamId, currentClassTeams } = useSession();

  if (!gameState) return null;

  const currentRound = gameState.currentRound;
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const submittedTeamDataMap = currentRoundData?.teamData || {};

  const teamsList = gameState.teams || [];
  const totalTeams = teamsList.length;

  const teamsStatus = teamsList.map(team => {
    const liveTeamDoc = currentClassTeams[team.id];
    const ceoName = liveTeamDoc?.ceoName || team.ceoName || null;
    const hasSubmitted = !!submittedTeamDataMap[team.id];

    return {
      ...team,
      ceoName,
      hasSubmitted
    };
  });

  const submittedCount = teamsStatus.filter(t => t.hasSubmitted).length;
  const myTeam = teamsStatus.find(t => t.id === currentTeamId);

  return (
    <Card className="max-w-2xl mx-auto border-warning/40 bg-card text-center p-8 space-y-4 shadow-xl relative overflow-hidden my-6">
      <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-warning via-orange-500 to-warning" />

      <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center">
        <Lock className="h-8 w-8 text-warning dark:text-warning animate-pulse" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Badge variant="outline" className="bg-warning/10 text-warning dark:text-warning border-warning/30 text-xs font-bold">
            Round {currentRound} Secrecy Lock
          </Badge>
        </div>
        <CardTitle className="text-2xl font-black text-foreground">
          {phaseName} Locked
        </CardTitle>
        <CardDescription className="max-w-md mx-auto text-sm text-muted-foreground">
          Turn order, market pricing, and strategy details for <strong className="text-foreground">{phaseName}</strong> are hidden to prevent competitive spying until all teams submit their Round {currentRound} plans.
        </CardDescription>
      </div>

      {/* Submission Progress Tracker */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 max-w-lg mx-auto space-y-3">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-muted-foreground uppercase tracking-wider">Planning Phase Progress</span>
          <span className="text-warning dark:text-warning font-mono text-sm">{submittedCount} / {totalTeams} Teams Submitted</span>
        </div>

        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border border-border">
          <div 
            className="bg-gradient-to-r from-warning to-orange-500 h-full transition-all duration-500"
            style={{ width: `${totalTeams > 0 ? (submittedCount / totalTeams) * 100 : 0}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
          {teamsStatus.map(t => (
            <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="font-semibold truncate">{t.name}</span>
              </div>
              {t.hasSubmitted ? (
                <Badge className="bg-success/20 text-success dark:text-success border border-success/30 text-[10px] py-0 px-1 font-bold">
                  Submitted
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 text-warning dark:text-warning border-warning/30 text-[10px] py-0 px-1 font-bold">
                  Pending
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {myTeam && !myTeam.hasSubmitted && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg max-w-lg mx-auto text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning flex-shrink-0" />
          <span>Your team ({myTeam.name}) has not submitted your Round {currentRound} plan yet.</span>
        </div>
      )}
    </Card>
  );
};
