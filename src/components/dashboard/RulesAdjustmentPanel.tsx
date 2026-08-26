import React, { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { RuleAdjustment, RuleAdjustmentsState, RuleCategory, Team } from '@/types/game';
import { getDefaultRuleAdjustments } from '@/lib/defaultRules';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Save, RotateCcw, ShieldCheck, ShieldAlert, Sliders, Users, Check, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';

import { SteveControlModal } from './SteveControlModal';
import { DirectivesClaimModal } from './DirectivesClaimModal';
import { FacilitatorWildcardConsole } from './FacilitatorWildcardConsole';

interface RulesAdjustmentPanelProps {
  onClose?: () => void;
}

const CATEGORIES: Array<'All' | RuleCategory> = [
  'All',
  'General',
  'Production & Price',
  'Research & Tech',
  'Logistics',
  'Sales',
];

export const RulesAdjustmentPanel: React.FC<RulesAdjustmentPanelProps> = ({ onClose }) => {
  const { gameState, getRuleAdjustments, updateRuleAdjustments } = useGame();
  const [rulesState, setRulesState] = useState<RuleAdjustmentsState>(() => getRuleAdjustments());
  const [selectedCategory, setSelectedCategory] = useState<'All' | RuleCategory>('All');
  const [selectedTeamTab, setSelectedTeamTab] = useState<string>('global');

  const teams: Team[] = gameState?.teams || [
    { id: 'team_1', name: 'Green Team', color: '#22c55e' },
    { id: 'team_2', name: 'Blue Team', color: '#3b82f6' },
    { id: 'team_3', name: 'Black Team', color: '#1f2937' },
    { id: 'team_4', name: 'Yellow Team', color: '#eab308' },
    { id: 'team_5', name: 'Red Team', color: '#ef4444' },
  ];

  // Sync state when external context changes
  useEffect(() => {
    setRulesState(getRuleAdjustments());
  }, [gameState?.ruleAdjustments]);

  const handleGlobalToggle = (ruleId: string, enabled: boolean) => {
    setRulesState(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [ruleId]: {
          ...prev.rules[ruleId],
          enabled,
        },
      },
    }));
  };

  const handleGlobalValueChange = (ruleId: string, val: string) => {
    const parsedVal = isNaN(Number(val)) || val === '' ? val : Number(val);
    setRulesState(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [ruleId]: {
          ...prev.rules[ruleId],
          globalValue: parsedVal,
        },
      },
    }));
  };

  const handleTeamOverrideToggle = (ruleId: string, teamId: string, enableOverride: boolean) => {
    setRulesState(prev => {
      const currentRule = prev.rules[ruleId];
      const overrides = { ...(currentRule.teamOverrides || {}) };

      if (enableOverride) {
        overrides[teamId] = {
          enabled: currentRule.enabled,
          value: currentRule.globalValue,
        };
      } else {
        delete overrides[teamId];
      }

      return {
        ...prev,
        rules: {
          ...prev.rules,
          [ruleId]: {
            ...currentRule,
            teamOverrides: overrides,
          },
        },
      };
    });
  };

  const handleTeamEnabledToggle = (ruleId: string, teamId: string, enabled: boolean) => {
    setRulesState(prev => {
      const currentRule = prev.rules[ruleId];
      const overrides = { ...(currentRule.teamOverrides || {}) };
      const teamSetting = overrides[teamId] || { value: currentRule.globalValue };

      overrides[teamId] = {
        ...teamSetting,
        enabled,
      };

      return {
        ...prev,
        rules: {
          ...prev.rules,
          [ruleId]: {
            ...currentRule,
            teamOverrides: overrides,
          },
        },
      };
    });
  };

  const handleTeamValueChange = (ruleId: string, teamId: string, val: string) => {
    const parsedVal = isNaN(Number(val)) || val === '' ? val : Number(val);
    setRulesState(prev => {
      const currentRule = prev.rules[ruleId];
      const overrides = { ...(currentRule.teamOverrides || {}) };
      const teamSetting = overrides[teamId] || { enabled: currentRule.enabled };

      overrides[teamId] = {
        ...teamSetting,
        value: parsedVal,
      };

      return {
        ...prev,
        rules: {
          ...prev.rules,
          [ruleId]: {
            ...currentRule,
            teamOverrides: overrides,
          },
        },
      };
    });
  };

  const handleSave = () => {
    updateRuleAdjustments(rulesState);
    toast.success('Rules adjustments saved and synced to all teams real-time!');
    if (onClose) onClose();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all game rules to standard defaults?')) {
      const defaultState = getDefaultRuleAdjustments();
      setRulesState(defaultState);
      updateRuleAdjustments(defaultState);
      toast.info('All rules reset to standard game defaults.');
    }
  };

  const ruleList = Object.values(rulesState.rules || {});
  const filteredRules = selectedCategory === 'All'
    ? ruleList
    : ruleList.filter(r => r.category === selectedCategory);

  const activeCount = ruleList.filter(r => r.enabled).length;
  const overrideCount = ruleList.reduce((acc, r) => acc + Object.keys(r.teamOverrides || {}).length, 0);

  return (
    <div className="space-y-5">
      {/* Header controls & summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Facilitator Rules Engine</h2>
            <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 font-semibold">
              Round {gameState?.currentRound || 1} • Live Trigger
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust requirements, toggle constraints ON/OFF, or customize rules per team at any point in the game.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            className="h-9 text-xs font-bold shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset Defaults
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className="h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save & Sync Rules
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Rules</span>
          <span className="font-extrabold text-slate-900 dark:text-slate-100">{ruleList.length}</span>
        </div>
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 flex items-center justify-between shadow-sm">
          <span className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Active Rules
          </span>
          <span className="font-extrabold">{activeCount} / {ruleList.length}</span>
        </div>
        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-800 dark:text-indigo-400 flex items-center justify-between shadow-sm">
          <span className="font-bold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Team Overrides
          </span>
          <span className="font-extrabold">{overrideCount}</span>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-center justify-between gap-1.5 overflow-hidden shadow-sm">
          <span className="font-bold flex items-center gap-1 text-[11px] sm:text-xs truncate">
            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" /> Directives
          </span>
          <DirectivesClaimModal triggerClassName="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-500 text-white font-bold flex-shrink-0 shadow-sm" />
        </div>
      </div>

      {/* Steve Live Control Console */}
      <SteveControlModal />

      {/* Facilitator Wildcard Allocation Console */}
      <FacilitatorWildcardConsole />

      {/* Category Navigation Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className={`h-8 text-xs font-medium rounded-lg transition-colors ${
                  selectedCategory === cat ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <span className="text-xs text-muted-foreground font-medium px-2">Scope View:</span>
            <Button
              variant={selectedTeamTab === 'global' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTeamTab('global')}
              className="h-7 text-xs px-2.5"
            >
              Global All Teams
            </Button>
            {teams.map(t => (
              <Button
                key={t.id}
                variant={selectedTeamTab === t.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTeamTab(t.id)}
                className="h-7 text-xs px-2 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name.split(' ')[0]}
              </Button>
            ))}
          </div>
        </div>

        {/* Rule Cards Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredRules.map(rule => {
            const hasOverrides = rule.teamOverrides && Object.keys(rule.teamOverrides).length > 0;
            const currentSelectedTeam = teams.find(t => t.id === selectedTeamTab);
            const teamOverride = currentSelectedTeam && rule.teamOverrides?.[currentSelectedTeam.id];
            const isOverriddenForTeam = !!teamOverride;

            const activeForSelectedTeam = isOverriddenForTeam && teamOverride?.enabled !== undefined
              ? teamOverride.enabled
              : rule.enabled;

            const valueForSelectedTeam = isOverriddenForTeam && teamOverride?.value !== undefined
              ? teamOverride.value
              : rule.globalValue;

            return (
              <Card key={rule.id} className={`border transition-all ${
                rule.enabled ? 'border-border bg-card' : 'border-dashed border-muted bg-muted/20 opacity-75'
              }`}>
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-semibold">{rule.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase bg-muted/60">
                          {rule.category}
                        </Badge>
                        {hasOverrides && (
                          <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            {Object.keys(rule.teamOverrides!).length} Team Override(s)
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs text-muted-foreground">
                        {rule.description}
                      </CardDescription>
                      {!rule.enabled && rule.id === 'steve_event_blocker' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                          ⚠️ Rule OFF: Active Steve region is cleared and region blocking is un-gated for all teams.
                        </p>
                      )}
                      {!rule.enabled && rule.id === 'directives_bonus_points' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                          ⚠️ Rule OFF: Directive claims are disabled and claimed directives will award 0 VPs in final scoring.
                        </p>
                      )}
                      {!rule.enabled && rule.id === 'wildcard_tokens_system' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                          ⚠️ Rule OFF: Wildcard token conversions are disabled and leftover tokens will award 0 VPs in final scoring.
                        </p>
                      )}
                    </div>

                    {/* Master Switch / Team Toggle */}
                    <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border">
                      <Label htmlFor={`switch-${rule.id}`} className="text-xs font-semibold cursor-pointer">
                        {rule.enabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" /> Rule ON
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ShieldAlert className="h-3.5 w-3.5" /> Rule OFF
                          </span>
                        )}
                      </Label>
                      <Switch
                        id={`switch-${rule.id}`}
                        checked={rule.enabled}
                        onCheckedChange={(checked) => handleGlobalToggle(rule.id, checked)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-4">
                  {/* Global & Team Requirement Parameter Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-secondary/10 border border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Global Requirement Value:</span>
                        <span className="text-[11px] font-mono text-muted-foreground">Default: {String(rule.defaultValue)}</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type={typeof rule.defaultValue === 'number' ? 'number' : 'text'}
                          value={String(rule.globalValue)}
                          onChange={(e) => handleGlobalValueChange(rule.id, e.target.value)}
                          className="h-8 font-mono text-sm max-w-[200px]"
                          disabled={!rule.enabled}
                        />
                        <span className="text-xs text-muted-foreground font-medium">Applied to all teams without override</span>
                      </div>
                    </div>

                    {/* Scope specific preview */}
                    {selectedTeamTab !== 'global' && currentSelectedTeam && (
                      <div className="space-y-2 p-2.5 rounded-md bg-background border border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold flex items-center gap-1.5" style={{ color: currentSelectedTeam.color }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentSelectedTeam.color }} />
                            {currentSelectedTeam.name} Setting
                          </span>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`override-switch-${rule.id}-${currentSelectedTeam.id}`} className="text-[11px] text-muted-foreground">
                              Custom Override
                            </Label>
                            <Switch
                              id={`override-switch-${rule.id}-${currentSelectedTeam.id}`}
                              checked={isOverriddenForTeam}
                              onCheckedChange={(checked) => handleTeamOverrideToggle(rule.id, currentSelectedTeam.id, checked)}
                            />
                          </div>
                        </div>

                        {isOverriddenForTeam && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Team Rule Status</Label>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={activeForSelectedTeam}
                                  onCheckedChange={(checked) => handleTeamEnabledToggle(rule.id, currentSelectedTeam.id, checked)}
                                />
                                <span className="text-xs font-semibold">
                                  {activeForSelectedTeam ? 'Active' : 'Disabled'}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Team Requirement Value</Label>
                              <Input
                                type={typeof rule.defaultValue === 'number' ? 'number' : 'text'}
                                value={String(valueForSelectedTeam)}
                                onChange={(e) => handleTeamValueChange(rule.id, currentSelectedTeam.id, e.target.value)}
                                className="h-7 text-xs font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accordion for managing all Team Overrides */}
                  <Accordion type="single" collapsible className="w-full text-xs">
                    <AccordionItem value="team-overrides" className="border-border">
                      <AccordionTrigger className="py-2 hover:no-underline text-xs text-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-indigo-500" />
                          Manage Per-Team Custom Overrides ({Object.keys(rule.teamOverrides || {}).length} active)
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {teams.map(t => {
                            const override = rule.teamOverrides?.[t.id];
                            const hasOverride = !!override;
                            const tEnabled = hasOverride && override.enabled !== undefined ? override.enabled : rule.enabled;
                            const tValue = hasOverride && override.value !== undefined ? override.value : rule.globalValue;

                            return (
                              <div
                                key={t.id}
                                className={`p-3 rounded-lg border text-xs space-y-2.5 transition-colors ${
                                  hasOverride
                                    ? 'bg-indigo-500/5 border-indigo-500/30'
                                    : 'bg-card border-border/60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1.5" style={{ color: t.color }}>
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                    {t.name}
                                  </span>
                                  <Button
                                    variant={hasOverride ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => handleTeamOverrideToggle(rule.id, t.id, !hasOverride)}
                                    className="h-6 text-[10px] px-2"
                                  >
                                    {hasOverride ? 'Clear Override' : '+ Add Override'}
                                  </Button>
                                </div>

                                {hasOverride ? (
                                  <div className="space-y-2 pt-1 border-t border-indigo-500/20">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground text-[11px]">Rule Status:</span>
                                      <div className="flex items-center gap-1.5">
                                        <Switch
                                          checked={tEnabled}
                                          onCheckedChange={(c) => handleTeamEnabledToggle(rule.id, t.id, c)}
                                        />
                                        <span className="font-semibold text-[11px]">{tEnabled ? 'ON' : 'OFF'}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-muted-foreground text-[11px]">Requirement:</span>
                                      <Input
                                        type={typeof rule.defaultValue === 'number' ? 'number' : 'text'}
                                        value={String(tValue)}
                                        onChange={(e) => handleTeamValueChange(rule.id, t.id, e.target.value)}
                                        className="h-6 text-xs font-mono w-20 text-center"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground italic flex items-center justify-between">
                                    <span>Using Global Rule</span>
                                    <span className="font-mono font-semibold text-foreground">
                                      {rule.enabled ? `ON (${rule.globalValue})` : 'OFF'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
