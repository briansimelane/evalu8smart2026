import { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGame } from '@/contexts/GameContext';
import { ICON_EFFECTS } from '@/data/improvements';
import { toast } from 'sonner';
import { Save, TrendingUp, TrendingDown, Package, FlaskConical, Truck, Box, Wrench, Microscope, CirclePlus, CircleMinus } from 'lucide-react';

export interface PlanningPhaseRef {
  loadTeamPlan: (roundNumber: number, teamId: string) => void;
}

export const PlanningPhase = forwardRef<PlanningPhaseRef>((props, ref) => {
  const { gameState, getCurrentRound, addRoundData, getCombinations } = useGame();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCombination, setSelectedCombination] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [cardUsages, setCardUsages] = useState<Record<number, 'use' | 'product' | 'none'>>({});
  const [animatingValues, setAnimatingValues] = useState<Record<string, boolean>>({});
  const previousValues = useRef<Record<string, number>>({});

  if (!gameState) return null;

  const getIconElement = (iconType: string) => {
    if (iconType === 'Price and Product') {
      return (
        <>
          <div className="relative inline-block">
            <span className="font-bold text-red-500 text-3xl leading-none">$</span>
            <CircleMinus className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
          </div>
          <Package className="h-8 w-8 text-black dark:text-white" />
        </>
      );
    }
    
    const iconMap: Record<string, JSX.Element> = {
      'Research': <Microscope className="h-8 w-8 inline text-purple-500" />,
      'Price Plus': (
        <div className="relative inline-block">
          <span className="font-bold text-red-500 text-3xl leading-none">$</span>
          <CirclePlus className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
        </div>
      ),
      'Price Minus': (
        <div className="relative inline-block">
          <span className="font-bold text-red-500 text-3xl leading-none">$</span>
          <CircleMinus className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
        </div>
      ),
      'Product': <Package className="h-8 w-8 inline text-black dark:text-white" />,
      'Logistic': <Truck className="h-8 w-8 inline text-blue-500" />,
    };
    return iconMap[iconType] || <span className="text-xs">{iconType}</span>;
  };

  // Helper to normalize allocation round (treat initial/undefined as round 0)
  const getAllocatedRound = (card: typeof gameState.improvementCards[0]) => {
    return card.isInitial || card.allocatedInRound == null ? 0 : Number(card.allocatedInRound);
  };

  const currentRound = getCurrentRound();
  const currentCombinations = getCombinations();
  const combos = [...new Set(currentCombinations.map(c => c.combination))];
  const positions = selectedCombination
    ? currentCombinations.filter(c => c.combination === parseInt(selectedCombination)).map(c => c.position)
    : [];

  const selectedComboData = currentCombinations.find(
    c => c.combination === parseInt(selectedCombination) && c.position === parseInt(selectedPosition)
  );

  const existingRoundData = gameState.rounds
    .find(r => r.roundNumber === (editingRound || currentRound))
    ?.teamData[selectedTeam];
  
  const allTeamCards = selectedTeam 
    ? (editingRound !== null && existingRoundData?.improvementCardId !== undefined
        ? gameState.improvementCards.filter(card => card.id === existingRoundData.improvementCardId)
        : gameState.improvementCards.filter(card => card.availableForTeam === selectedTeam))
    : [];

  const activeRound = editingRound || currentRound;
  
  // Normalize and sort cards by allocation round
  const normalizedCards = allTeamCards.map(card => ({
    ...card,
    __allocatedRound: getAllocatedRound(card)
  }));
  
  const usableCards = normalizedCards
    .filter(card => card.__allocatedRound < activeRound)
    .sort((a, b) => a.__allocatedRound - b.__allocatedRound || a.id - b.id);
    
  const futureCards = normalizedCards
    .filter(card => card.__allocatedRound >= activeRound)
    .sort((a, b) => a.__allocatedRound - b.__allocatedRound || a.id - b.id);
  
  const availableCards = usableCards;

  // Calculate total effects from all cards based on their individual usage
  let improvementPriceEffect = 0;
  let improvementProductEffect = 0;
  let improvementResearchEffect = 0;
  let improvementLogisticsEffect = 0;

  availableCards.forEach(card => {
    const usage = cardUsages[card.id] || 'none';
    
    if (usage === 'use') {
      const icon1Effects = ICON_EFFECTS[card.icon1 as keyof typeof ICON_EFFECTS];
      const icon2Effects = ICON_EFFECTS[card.icon2 as keyof typeof ICON_EFFECTS];
      improvementPriceEffect += icon1Effects.priceEffect + icon2Effects.priceEffect;
      
      // Special case: Product+Product cards should only grant 1 product total
      if (card.icon1 === 'Product' && card.icon2 === 'Product') {
        improvementProductEffect += 1;
      } else {
        improvementProductEffect += icon1Effects.productEffect + icon2Effects.productEffect;
      }
      
      improvementResearchEffect += icon1Effects.researchEffect + icon2Effects.researchEffect;
      improvementLogisticsEffect += icon1Effects.logisticsEffect + icon2Effects.logisticsEffect;
    } else if (usage === 'product') {
      improvementProductEffect += 1; // Using card as product grants +1 product
    }
  });

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const teamsWithData = new Set(Object.keys(currentRoundData?.teamData || {}));
  const selectableTeams = editingRound ? gameState.teams : gameState.teams.filter(t => !teamsWithData.has(t.id));

  const calculatedPrice = selectedComboData ? 5 + selectedComboData.price + improvementPriceEffect : 0;
  const productsAvailable = (selectedComboData?.products || 0) + improvementProductEffect;
  const improvementPoints = selectedComboData?.improve || 0;
  const researchPoints = (selectedComboData?.research || 0) + improvementResearchEffect;
  const logisticsPoints = (selectedComboData?.logistics || 0) + improvementLogisticsEffect;
  const canSubmit = selectedTeam && selectedCombination && selectedPosition;

  // Trigger animation when values change with staggered delays
  useEffect(() => {
    const values = {
      price: { value: calculatedPrice, delay: 0 },
      products: { value: productsAvailable, delay: 100 },
      improvement: { value: improvementPoints, delay: 200 },
      research: { value: researchPoints, delay: 300 },
      logistics: { value: logisticsPoints, delay: 400 }
    };

    Object.entries(values).forEach(([key, { value, delay }]) => {
      if (previousValues.current[key] !== undefined && previousValues.current[key] !== value) {
        setTimeout(() => {
          setAnimatingValues(prev => ({ ...prev, [key]: true }));
          setTimeout(() => {
            setAnimatingValues(prev => ({ ...prev, [key]: false }));
          }, 800);
        }, delay);
      }
      previousValues.current[key] = value;
    });
  }, [calculatedPrice, productsAvailable, improvementPoints, researchPoints, logisticsPoints]);

  const handleSubmitPlan = () => {
    if (!canSubmit) {
      toast.error('Please fill in all required fields');
      return;
    }

    const roundNumber = editingRound || currentRound;
    
    // Create team round data with plan values
    const teamRoundData = {
      teamId: selectedTeam,
      combination: parseInt(selectedCombination),
      position: parseInt(selectedPosition),
      price: calculatedPrice,
      productsProduced: productsAvailable,
      improvementCards: improvementPoints,
      researchIcons: researchPoints,
      logisticsIcons: logisticsPoints,
      cardUsages: cardUsages,
      // Placeholder values for fields filled in Production phase
      revenue: 0,
      technologiesResearched: [],
      expansionLocations: [],
      salesByRegion: {},
      regionControlPoints: {},
      controlValue: 0,
      totalMoney: 0,
    };
    
    // Save to game state
    addRoundData(roundNumber, selectedTeam, teamRoundData);
    
    // Store the plan in localStorage for the production phase to use
    const plan = {
      teamId: selectedTeam,
      combination: parseInt(selectedCombination),
      position: parseInt(selectedPosition),
      cardUsages: cardUsages,
      roundNumber
    };
    localStorage.setItem(`team_plan_${selectedTeam}_round_${roundNumber}`, JSON.stringify(plan));
    
    toast.success('Plan submitted successfully! Now proceed to Production phase to enter sales data.');
    
    // Reset form
    setSelectedTeam('');
    setSelectedCombination('');
    setSelectedPosition('');
    setEditingRound(null);
    setCardUsages({});
  };

  const loadTeamPlan = (roundNumber: number, teamId: string) => {
    const round = gameState.rounds.find(r => r.roundNumber === roundNumber);
    const teamData = round?.teamData[teamId];
    
    if (teamData) {
      setSelectedTeam(teamId);
      setSelectedCombination(teamData.combination.toString());
      setSelectedPosition(teamData.position.toString());
      setEditingRound(roundNumber);
      setCardUsages(teamData.cardUsages || {});
      toast.info(`Editing Round ${roundNumber} plan for ${gameState.teams.find(t => t.id === teamId)?.name}`);
    }
  };

  useImperativeHandle(ref, () => ({
    loadTeamPlan
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {editingRound ? `Edit Round ${editingRound}` : `Round ${currentRound}`} Planning
        </CardTitle>
        <CardDescription>
          Select your strategy: team, combination, position, and improvement cards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="team">Select Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team">
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                {selectableTeams.map(team => (
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

          <div className="space-y-2">
            <Label htmlFor="combination">Combination</Label>
            <Select value={selectedCombination} onValueChange={setSelectedCombination}>
              <SelectTrigger id="combination">
                <SelectValue placeholder="Select combination" />
              </SelectTrigger>
              <SelectContent>
                {combos.map(combo => (
                  <SelectItem key={combo} value={combo.toString()}>
                    Combination {combo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select
              value={selectedPosition}
              onValueChange={setSelectedPosition}
              disabled={!selectedCombination}
            >
              <SelectTrigger id="position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map(pos => (
                  <SelectItem key={pos} value={pos.toString()}>
                    Position {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedComboData && (
          <>
            <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-5 gap-4">
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-700 ${animatingValues.price ? 'scale-110 shadow-lg shadow-green-500/50 bg-green-500/10 border-green-500/50' : ''}`}>
                    <span className="font-bold text-red-500 text-4xl leading-none">$</span>
                    <div className="text-sm text-muted-foreground mb-1">Price</div>
                    <div className={`text-2xl font-bold text-foreground transition-all duration-700 ${animatingValues.price ? 'scale-150 text-green-500' : ''}`}>
                      ${calculatedPrice}
                    </div>
                  </div>
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-700 ${animatingValues.products ? 'scale-110 shadow-lg shadow-black/30 dark:shadow-white/30 bg-black/10 dark:bg-white/10 border-black/50 dark:border-white/50' : ''}`}>
                    <Box className="h-10 w-10 mb-2" style={{ color: '#000000' }} />
                    <div className="text-sm text-muted-foreground mb-1">Products</div>
                    <div className={`text-2xl font-bold text-foreground transition-all duration-700 ${animatingValues.products ? 'scale-150 text-black dark:text-white' : ''}`}>
                      {productsAvailable}
                    </div>
                  </div>
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-700 ${animatingValues.improvement ? 'scale-110 shadow-lg shadow-orange-500/50 bg-orange-500/10 border-orange-500/50' : ''}`}>
                    <Wrench className="h-10 w-10 mb-2 text-orange-500" />
                    <div className="text-sm text-muted-foreground mb-1">Improvement</div>
                    <div className={`text-2xl font-bold text-foreground transition-all duration-700 ${animatingValues.improvement ? 'scale-150 text-orange-500' : ''}`}>
                      {improvementPoints}
                    </div>
                  </div>
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-700 ${animatingValues.research ? 'scale-110 shadow-lg shadow-purple-500/50 bg-purple-500/10 border-purple-500/50' : ''}`}>
                    <Microscope className="h-10 w-10 mb-2 text-purple-500" />
                    <div className="text-sm text-muted-foreground mb-1">Research</div>
                    <div className={`text-2xl font-bold text-foreground transition-all duration-700 ${animatingValues.research ? 'scale-150 text-purple-500' : ''}`}>
                      {researchPoints}
                    </div>
                  </div>
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-700 ${animatingValues.logistics ? 'scale-110 shadow-lg shadow-cyan-500/50 bg-cyan-500/10 border-cyan-500/50' : ''}`}>
                    <Truck className="h-10 w-10 mb-2 text-cyan-500" />
                    <div className="text-sm text-muted-foreground mb-1">Logistics</div>
                    <div className={`text-2xl font-bold text-foreground transition-all duration-700 ${animatingValues.logistics ? 'scale-150 text-cyan-500' : ''}`}>
                      {logisticsPoints}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {(availableCards.length > 0 || futureCards.length > 0) && (
          <div className="space-y-3">
            {availableCards.length > 0 && (
              <>
                <Label>Available Improvement Cards ({availableCards.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {availableCards.map((card, index) => {
                    const currentUsage = cardUsages[card.id] || 'none';
                    return (
                      <Card 
                        key={card.id}
                        className="transition-all"
                      >
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs flex items-center justify-end gap-2 mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                              R{card.__allocatedRound}
                            </span>
                          </CardTitle>
                           <div className="flex gap-2 justify-center mb-3">
                              <div className="flex items-center justify-center p-2 rounded-lg bg-white border-2 border-gray-300">
                               {getIconElement(card.icon1)}
                             </div>
                             {!(card.id < 0) && (
                                <div className="flex items-center justify-center p-2 rounded-lg bg-white border-2 border-gray-300">
                                 {getIconElement(card.icon2)}
                               </div>
                             )}
                           </div>
                           <RadioGroup 
                             value={currentUsage} 
                             onValueChange={(v) => setCardUsages(prev => ({ ...prev, [card.id]: v as any }))}
                             className="gap-1"
                           >
                             <div className="flex items-center space-x-1 p-1 border rounded hover:bg-accent/50 cursor-pointer">
                               <RadioGroupItem value="use" id={`use-${card.id}`} className="h-3 w-3" />
                               <Label htmlFor={`use-${card.id}`} className="cursor-pointer text-[10px] leading-tight">
                                 Use Effects
                               </Label>
                             </div>
                             <div className="flex items-center space-x-1 p-1 border rounded hover:bg-accent/50 cursor-pointer">
                               <RadioGroupItem value="product" id={`product-${card.id}`} className="h-3 w-3" />
                               <Label htmlFor={`product-${card.id}`} className="cursor-pointer text-[10px] leading-tight">
                                 As Product
                               </Label>
                             </div>
                             <div className="flex items-center space-x-1 p-1 border rounded hover:bg-accent/50 cursor-pointer">
                               <RadioGroupItem value="none" id={`none-${card.id}`} className="h-3 w-3" />
                               <Label htmlFor={`none-${card.id}`} className="cursor-pointer text-[10px] leading-tight">
                                 Don't use
                               </Label>
                             </div>
                           </RadioGroup>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
            
            {futureCards.length > 0 && (
              <>
                <Label className="flex items-center gap-2">
                  <span>Newly Allocated Cards - Usable Next Round</span>
                  <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">Not Usable Yet</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {futureCards.map((card, index) => (
                    <Card 
                      key={card.id}
                      className="opacity-60 border-amber-300/50 bg-amber-500/5"
                    >
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center justify-end gap-2 mb-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded">
                            R{card.__allocatedRound}
                          </span>
                        </CardTitle>
                         <div className="flex gap-2 justify-center">
                            <div className="flex items-center justify-center p-2 rounded-lg bg-white border-2 border-gray-300">
                             {getIconElement(card.icon1)}
                           </div>
                           {!(card.id < 0) && (
                             <div className="flex items-center justify-center p-2 rounded-lg bg-white border-2 border-gray-300">
                               {getIconElement(card.icon2)}
                             </div>
                           )}
                         </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSubmitPlan} disabled={!canSubmit} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            {editingRound ? 'Update Plan' : 'Submit Plan'}
          </Button>
          {editingRound && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTeam('');
                setSelectedCombination('');
                setSelectedPosition('');
                setEditingRound(null);
                setCardUsages({});
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

PlanningPhase.displayName = 'PlanningPhase';
