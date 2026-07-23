import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { PhaseLockCard } from './PhaseLockCard';
import { REGIONS } from '@/data/combinations';
import { ICON_EFFECTS } from '@/data/improvements';
import { TeamRoundData } from '@/types/game';
import { toast } from 'sonner';
import { Save, AlertTriangle, Package } from 'lucide-react';
import { GameIcon } from './GameIcon';

export interface RoundInputRef {
  loadTeamData: (roundNumber: number, teamId: string) => void;
}

export const RoundInput = forwardRef<RoundInputRef>((props, ref) => {
  const { gameState, addRoundData, getCurrentRound, markImprovementCardUsed, getCombinations } = useGame();
  const { currentRole } = useSession();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCombination, setSelectedCombination] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [improvementCardUsage, setImprovementCardUsage] = useState<'use' | 'product' | 'none'>('none');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  if (!gameState) return null;

  const currentRound = getCurrentRound();
  const currentCombinations = getCombinations();

  // Load plan from localStorage when component mounts or when teams change
  useEffect(() => {
    if (!selectedTeam) {
      // Try to find a team with a plan for the current round
      const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
      const teamsWithData = new Set(Object.keys(currentRoundData?.teamData || {}));
      const availableTeams = gameState.teams.filter(t => !teamsWithData.has(t.id));
      
      for (const team of availableTeams) {
        const planKey = `team_plan_${team.id}_round_${currentRound}`;
        const savedPlan = localStorage.getItem(planKey);
        if (savedPlan) {
          const plan = JSON.parse(savedPlan);
          setSelectedTeam(plan.teamId);
          setSelectedCombination(plan.combination.toString());
          setSelectedPosition(plan.position.toString());
          setImprovementCardUsage(plan.improvementCardUsage || 'none');
          setSelectedCardId(plan.improvementCardId || null);
          break;
        }
      }
    }
  }, [gameState.teams, currentRound, selectedTeam]);


  const selectedComboData = currentCombinations.find(
    c => c.combination === parseInt(selectedCombination) && c.position === parseInt(selectedPosition)
  );

  // Get improvement cards - show saved card for past rounds, or available cards for current round
  const selectedCard = selectedCardId && selectedTeam
    ? gameState.improvementCards.find(card => card.id === selectedCardId)
    : null;

  // Calculate improvement card effects
  let improvementPriceEffect = 0;
  let improvementProductEffect = 0;
  let improvementResearchEffect = 0;
  let improvementLogisticsEffect = 0;

  if (improvementCardUsage === 'use' && selectedCard) {
    const icon1Effects = ICON_EFFECTS[selectedCard.icon1 as keyof typeof ICON_EFFECTS];
    const icon2Effects = ICON_EFFECTS[selectedCard.icon2 as keyof typeof ICON_EFFECTS];
    improvementPriceEffect = icon1Effects.priceEffect + icon2Effects.priceEffect;
    improvementProductEffect = icon1Effects.productEffect + icon2Effects.productEffect;
    improvementResearchEffect = icon1Effects.researchEffect + icon2Effects.researchEffect;
    improvementLogisticsEffect = icon1Effects.logisticsEffect + icon2Effects.logisticsEffect;
  } else if (improvementCardUsage === 'product') {
    improvementProductEffect = 1;
  }


  // Calculate price (5 + combination price effect + improvement effect)
  const calculatedPrice = selectedComboData ? 5 + selectedComboData.price + improvementPriceEffect : 0;
  
  // Calculate production
  const productsAvailable = (selectedComboData?.products || 0) + improvementProductEffect;
  const canSubmit = selectedTeam && selectedCombination && selectedPosition;

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error('Please fill in all required fields');
      return;
    }

    const data: TeamRoundData = {
      teamId: selectedTeam,
      combination: parseInt(selectedCombination),
      position: parseInt(selectedPosition),
      price: calculatedPrice,
      productsProduced: productsAvailable,
      improvementCards: selectedComboData?.improve || 0,
      researchIcons: (selectedComboData?.research || 0) + improvementResearchEffect,
      logisticsIcons: (selectedComboData?.logistics || 0) + improvementLogisticsEffect,
      revenue: 0,
      technologiesResearched: [],
      expansionLocations: [],
      salesByRegion: {},
      regionControlPoints: {},
      controlValue: 0,
      totalMoney: 0,
      improvementCardUsage,
      improvementCardId: selectedCard?.id
    };

    const roundToSave = editingRound || currentRound;
    addRoundData(roundToSave, selectedTeam, data);
    
    // Mark improvement card as used if it was consumed
    if ((improvementCardUsage === 'use' || improvementCardUsage === 'product') && selectedCard) {
      markImprovementCardUsed(selectedCard.id);
    }
    
    // Clear the plan from localStorage since it's now saved
    const planKey = `team_plan_${selectedTeam}_round_${roundToSave}`;
    localStorage.removeItem(planKey);
    
    toast.success(editingRound ? 'Round data updated successfully' : 'Round data saved successfully');
    
    // Reset form
    setSelectedTeam('');
    setSelectedCombination('');
    setSelectedPosition('');
    setEditingRound(null);
    setImprovementCardUsage('none');
    setSelectedCardId(null);
  };

  const loadTeamData = (roundNumber: number, teamId: string) => {
    const round = gameState.rounds.find(r => r.roundNumber === roundNumber);
    const teamData = round?.teamData[teamId];
    
    if (teamData) {
      setSelectedTeam(teamId);
      setSelectedCombination(teamData.combination.toString());
      setSelectedPosition(teamData.position.toString());
      setEditingRound(roundNumber);
      setImprovementCardUsage(teamData.improvementCardUsage || 'none');
      setSelectedCardId(teamData.improvementCardId || null);
      toast.info(`Editing Round ${roundNumber} data for ${gameState.teams.find(t => t.id === teamId)?.name}`);
    } else {
      // Try to load the plan from localStorage
      const planKey = `team_plan_${teamId}_round_${roundNumber}`;
      const savedPlan = localStorage.getItem(planKey);
      if (savedPlan) {
        const plan = JSON.parse(savedPlan);
        setSelectedTeam(plan.teamId);
        setSelectedCombination(plan.combination.toString());
        setSelectedPosition(plan.position.toString());
        setImprovementCardUsage(plan.improvementCardUsage || 'none');
        setSelectedCardId(plan.improvementCardId || null);
        setEditingRound(roundNumber);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    loadTeamData
  }));

  const teamName = selectedTeam ? gameState.teams.find(t => t.id === selectedTeam)?.name : '';

  // Get teams with submitted plans for the current round
  const activeRound = editingRound || currentRound;
  const roundData = gameState.rounds.find(r => r.roundNumber === activeRound);
  const teamsWithPlans = roundData 
    ? Object.keys(roundData.teamData).map(teamId => {
        const team = gameState.teams.find(t => t.id === teamId);
        const teamData = roundData.teamData[teamId];
        return { team, teamData };
      }).filter(item => item.team)
    : [];

  // Check if all teams have submitted their plans
  const allTeamsHavePlans = gameState.teams.every(team => teamsWithPlans.some(t => t.team?.id === team.id));

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Production Phase" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products Produced This Round</CardTitle>
        {selectedTeam && teamName && (
          <CardDescription>
            Currently viewing: {teamName}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {teamsWithPlans.length > 0 && (
          <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Products Produced This Round</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-center flex-wrap">
                {teamsWithPlans.map(({ team, teamData }) => (
                  <div 
                    key={team!.id}
                    className="flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 min-w-[120px]"
                  >
                    <div
                      className="w-4 h-4 rounded-full mb-2"
                      style={{ backgroundColor: team!.color }}
                    />
                    <div className="text-xs text-muted-foreground mb-2 text-center font-medium">
                      {team!.name}
                    </div>
                    <GameIcon type="production" size="xl" className="mb-2" />
                    <div className="text-3xl font-bold text-foreground">
                      {teamData.productsProduced}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {!allTeamsHavePlans && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Not all teams have submitted their plans yet. All teams must submit plans before production can be completed.
            </AlertDescription>
          </Alert>
        )}

      </CardContent>
    </Card>
  );
});
