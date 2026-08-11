import React, { useState } from 'react';
import { useDemoState, DemoConfig, DemoBotSetup } from './DemoStateProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEAM_COLORS, getTeamColorName } from '@/data/combinations';
import { BotProfile, BotDifficulty } from '@/types/game';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { Play, Bot, User, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_BOTS: DemoBotSetup[] = [
  { name: 'Apex Robotics', color: '#ef4444', botProfile: 'BALANCED', botDifficulty: 'MEDIUM' },
  { name: 'CyberDyn Tech', color: '#3b82f6', botProfile: 'RESEARCHER', botDifficulty: 'MEDIUM' },
  { name: 'Titan Global', color: '#1f2937', botProfile: 'EXPANDER', botDifficulty: 'MEDIUM' },
  { name: 'ValueCorp', color: '#eab308', botProfile: 'PRICE_FIGHTER', botDifficulty: 'EASY' },
];

export function DemoSetup() {
  const { startDemo } = useDemoState();
  const [humanName, setHumanName] = useState('Your Company');
  const [humanColor, setHumanColor] = useState('#22c55e'); // Green
  const [bots, setBots] = useState<DemoBotSetup[]>(DEFAULT_BOTS);
  const [isStarting, setIsStarting] = useState(false);

  const updateBot = (index: number, updates: Partial<DemoBotSetup>) => {
    setBots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleStart = async () => {
    if (!humanName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    // Check color uniqueness
    const allColors = [humanColor, ...bots.map(b => b.color)];
    const uniqueColors = new Set(allColors.map(c => c.toLowerCase()));
    if (uniqueColors.size < allColors.length) {
      toast.error('Each team must have a distinct color');
      return;
    }

    setIsStarting(true);
    try {
      await startDemo({
        humanTeamName: humanName,
        humanTeamColor: humanColor,
        bots,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to start demo');
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 md:p-6">
      <div className="max-w-3xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smartphone Inc. Solo Demo Sandbox</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            Play the Demo: 1 Human vs 4 AI Bots
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Test your smartphone strategy against autonomous AI opponents. Runs directly in your browser and automatically saves your game for up to 7 days. No sign-up required.
          </p>
        </div>

        {/* Form Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Human Team Card */}
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <User className="w-5 h-5" />
                <span>Your Human Seat</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                You will control this company across all 5 rounds.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Company Name</Label>
                <Input
                  value={humanName}
                  onChange={e => setHumanName(e.target.value)}
                  placeholder="e.g. NextGen Mobile"
                  className="bg-background border-border text-foreground font-bold h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Brand Color & Starting Market</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TEAM_COLORS.map(c => {
                    const isSelected = humanColor.toLowerCase() === c.value.toLowerCase();
                    const isUsedByBot = bots.some(b => b.color.toLowerCase() === c.value.toLowerCase());
                    return (
                      <button
                        key={c.value}
                        type="button"
                        disabled={isUsedByBot}
                        onClick={() => setHumanColor(c.value)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50 scale-105'
                            : isUsedByBot
                            ? 'border-border bg-muted/40 opacity-40 cursor-not-allowed'
                            : 'border-border bg-card hover:border-primary/50'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: c.value }}
                        />
                        <span className="text-[10px] font-black text-foreground">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Opponents Card */}
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
                <Bot className="w-5 h-5" />
                <span>4 AI Bot Opponents</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Each bot acts autonomously with unique pricing & expansion strategies.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {bots.map((bot, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: bot.color }}
                      />
                      <Input
                        value={bot.name}
                        onChange={e => updateBot(idx, { name: e.target.value })}
                        className="bg-background border-border text-foreground font-bold h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-bold uppercase">Strategy</Label>
                      <Select
                        value={bot.botProfile}
                        onValueChange={v => updateBot(idx, { botProfile: v as BotProfile })}
                      >
                        <SelectTrigger className="h-7 bg-background border-border text-foreground text-[11px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          <SelectItem value="BALANCED">Balanced</SelectItem>
                          <SelectItem value="RESEARCHER">Tech Researcher</SelectItem>
                          <SelectItem value="EXPANDER">Logistics Expander</SelectItem>
                          <SelectItem value="PRICE_FIGHTER">Price Fighter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground font-bold uppercase">Difficulty</Label>
                      <Select
                        value={bot.botDifficulty}
                        onValueChange={v => updateBot(idx, { botDifficulty: v as BotDifficulty })}
                      >
                        <SelectTrigger className="h-7 bg-background border-border text-foreground text-[11px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          <SelectItem value="EASY">Easy</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Footer & Action */}
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Auto-saved for 7 days
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Private & self-expiring
            </span>
          </div>

          <Button
            size="lg"
            onClick={handleStart}
            disabled={isStarting}
            className="w-full sm:w-80 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base uppercase tracking-wider shadow-lg shadow-emerald-500/20"
          >
            {isStarting ? (
              <span>Initializing Demo Game...</span>
            ) : (
              <span className="flex items-center gap-2">
                Start Solo Demo Game
                <Play className="w-5 h-5 fill-white" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
