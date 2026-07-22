import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Crown, User, Users, ArrowRight } from 'lucide-react';

interface TeamSubmissionStatusProps {
  tabName: string;
  isCompact?: boolean;
}

export const TeamSubmissionStatus: React.FC<TeamSubmissionStatusProps> = ({ tabName, isCompact = false }) => {
  const { gameState } = useGame();
  const { currentRole, currentTeamId, currentClassTeams, selectTeam } = useSession();

  if (!gameState) return null;

  const currentRound = gameState.currentRound;
  const activePhase = gameState.currentPhase || 'planning';
  
  // Find current round data from gameState
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const submittedTeamDataMap = currentRoundData?.teamData || {};

  // Combine teams from gameState
  const teamsList = gameState.teams || [];
  const totalTeams = teamsList.length;

  // Calculate submission status for each team
  const teamsStatus = teamsList.map(team => {
    const liveTeamDoc = currentClassTeams[team.id];
    const ceoName = liveTeamDoc?.ceoName || team.ceoName || null;
    const hasSubmitted = !!submittedTeamDataMap[team.id];

    return {
      ...team,
      ceoName,
      hasSubmitted,
      submissionData: submittedTeamDataMap[team.id]
    };
  });

  const submittedCount = teamsStatus.filter(t => t.hasSubmitted).length;
  const progressPercent = totalTeams > 0 ? Math.round((submittedCount / totalTeams) * 100) : 0;
  const allSubmitted = submittedCount === totalTeams && totalTeams > 0;

  // Once all teams have submitted, hide this submission status box completely
  if (allSubmitted) return null;

  if (isCompact) {
    const prevRound = currentRound - 1;
    return (
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs max-w-5xl mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
          <span>
            {prevRound > 0 ? (
              <>Showing <strong>Round {prevRound}</strong> results while Round {currentRound} decisions are being submitted.</>
            ) : (
              <>Round {currentRound} results will unlock once all teams submit plans.</>
            )}
          </span>
        </div>
        <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px] font-bold">
          Submissions Pending ({submittedCount}/{totalTeams})
        </Badge>
      </div>
    );
  }

  // Find user's current team
  const myTeam = teamsStatus.find(t => t.id === currentTeamId);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header Banner */}
      <Card className="bg-card border-border shadow-md overflow-hidden relative">
        <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${
          allSubmitted ? 'from-emerald-500 to-teal-500' : 'from-amber-500 via-blue-500 to-indigo-500'
        }`} />
        
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold text-xs">
                  Round {currentRound}
                </Badge>
                <Badge variant="secondary" className="text-xs uppercase font-semibold">
                  {activePhase === 'innovation' ? 'Research Phase' : activePhase === 'expansion' ? 'Logistics Phase' : `${activePhase} Phase`}
                </Badge>
                {allSubmitted ? (
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    All Submissions In
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold gap-1 animate-pulse">
                    <Clock className="h-3 w-3" />
                    Submissions Pending ({submittedCount}/{totalTeams})
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Team Decision & Submission Status
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {tabName} report for Round {currentRound} will update once round results are advanced by the facilitator.
              </CardDescription>
            </div>

            {/* Submission Progress Ring / Bar */}
            <div className="bg-muted/40 border border-border p-3 rounded-lg flex items-center gap-3 min-w-[200px]">
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-blue-600">{submittedCount}/{totalTeams} Teams</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* My Team Status Alert for Students */}
        {currentRole === 'STUDENT' && myTeam && (
          <div className="px-6 pb-2">
            <div className={`p-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
              myTeam.hasSubmitted 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {myTeam.hasSubmitted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 animate-spin" />
                )}
                <div>
                  <span className="font-bold">{myTeam.name}: </span>
                  {myTeam.hasSubmitted 
                    ? `Your decisions for Round ${currentRound} have been successfully submitted!` 
                    : `Your team has NOT submitted Round ${currentRound} decisions yet.`}
                </div>
              </div>
            </div>
          </div>
        )}

        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Teams Submission Matrix
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamsStatus.map((team) => (
                <div
                  key={team.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    team.hasSubmitted
                      ? 'bg-card border-emerald-500/40 shadow-sm'
                      : 'bg-card border-border hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-bold text-sm text-foreground">
                        {team.name}
                      </span>
                    </div>

                    {team.hasSubmitted ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {team.ceoName ? (
                        <>
                          <Crown className="h-3.5 w-3.5 text-emerald-600" />
                          <span>CEO: <strong className="text-foreground font-semibold">{team.ceoName}</strong></span>
                        </>
                      ) : (
                        <>
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="italic text-muted-foreground">CEO: Vacant</span>
                        </>
                      )}
                    </div>

                    {currentRole !== 'STUDENT' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => selectTeam(team.id)}
                        className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold gap-1"
                      >
                        Select
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
