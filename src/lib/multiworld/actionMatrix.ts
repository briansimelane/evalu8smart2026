import { GameState, GamePhase } from '@/types/game';

export type ActionStatusType = 'done' | 'partial' | 'pending' | 'na' | 'bot';

export interface TeamPhaseStatus {
  status: ActionStatusType;
  label: string;
  detail?: string;
  spent?: number;
  total?: number;
}

export function deriveTeamPhaseStatus(state: GameState, teamId: string, phase: GamePhase): TeamPhaseStatus {
  const team = state.teams?.find(t => t.id === teamId);
  const round = state.currentRound || 1;
  const roundData = state.rounds?.find(r => r.roundNumber === round);
  const tData = roundData?.teamData?.[teamId];
  const isBot = !!(team?.isBot || (team as any)?.accessCode === 'BOT' || (team as any)?.code === 'BOT');

  const normalizedPhase = (phase || 'planning').toLowerCase();
  const phaseKey = normalizedPhase === 'research' ? 'innovation' : (normalizedPhase === 'logistics' ? 'expansion' : normalizedPhase);

  switch (phaseKey) {
    case 'planning': {
      if (!tData || tData.price === undefined || tData.price === null || tData.price === 0) {
        return { status: isBot ? 'bot' : 'pending', label: 'Pending Price' };
      }
      if (tData.facilitatorDefault) {
        return { status: 'done', label: '⚑ $5 Default', detail: 'Facilitator Default Plan' };
      }
      return { status: 'done', label: `✓ $${tData.price}`, detail: `Submitted $${tData.price}` };
    }

    case 'production': {
      if (!tData || tData.price === undefined || tData.price === null || tData.price === 0) {
        return { status: 'pending', label: 'Pending Plan' };
      }
      return { status: 'done', label: `✓ ${tData.productsProduced} Units`, detail: `Produced ${tData.productsProduced} products` };
    }

    case 'improvement': {
      if (round >= 5) {
        return { status: 'na', label: 'Skipped (R5)' };
      }
      const count = tData?.improvementCards || 0;
      if (count === 0) {
        return { status: 'na', label: 'n/a (0 Cards)' };
      }
      const card = (state.improvementCards || []).find(c =>
        (c.availableForTeam === teamId || c.usedBy === teamId) && c.allocatedInRound === round
      );
      if (!card) {
        return { status: isBot ? 'bot' : 'pending', label: 'Pending Claim' };
      }
      if (card.used || tData?.improvementCardUsage === 'use' || (tData?.cardUsages && tData.cardUsages[card.id] === 'use')) {
        return { status: 'done', label: '✓ Used Effect', detail: 'Used improvement effect' };
      }
      return { status: 'done', label: '✓ Product', detail: 'Selected default product' };
    }

    case 'innovation': {
      const icons = tData?.researchIcons || 0;
      if (icons === 0) {
        return { status: 'na', label: 'n/a (0 Icons)' };
      }
      const spent = (state.researchAllocatedByRound || {})[round]?.[teamId] || 0;
      if (spent >= icons) {
        return { status: 'done', label: `✓ ${spent}/${icons}`, spent, total: icons };
      }
      if (spent > 0) {
        return { status: 'partial', label: `◐ ${spent}/${icons}`, spent, total: icons };
      }
      return { status: isBot ? 'bot' : 'pending', label: `○ 0/${icons}`, spent: 0, total: icons };
    }

    case 'expansion': {
      const icons = tData?.logisticsIcons || 0;
      if (icons === 0) {
        return { status: 'na', label: 'n/a (0 Icons)' };
      }
      const spent = (state.logisticsAllocatedByRound || {})[round]?.[teamId] || 0;
      if (spent >= icons) {
        return { status: 'done', label: `✓ ${spent}/${icons}`, spent, total: icons };
      }
      if (spent > 0) {
        return { status: 'partial', label: `◐ ${spent}/${icons}`, spent, total: icons };
      }
      return { status: isBot ? 'bot' : 'pending', label: `○ 0/${icons}`, spent: 0, total: icons };
    }

    case 'sales': {
      const produced = tData?.productsProduced || 0;
      if (produced === 0) {
        return { status: 'na', label: 'n/a (0 Prod)' };
      }
      if (tData?.customersSold) {
        const soldCount = tData.customersSold.length;
        return { status: 'done', label: `✓ ${soldCount} Sold`, detail: `Sold to ${soldCount} customers` };
      }
      return { status: isBot ? 'bot' : 'pending', label: 'Pending Sales' };
    }

    case 'control': {
      const ctrlPoints = tData?.regionControlPoints || {};
      const totalCtrl = Object.values(ctrlPoints).reduce((sum, v) => sum + (v || 0), 0);
      if (totalCtrl > 0) {
        return { status: 'done', label: `✓ ${totalCtrl} Pts` };
      }
      return { status: 'pending', label: '○ Pending' };
    }

    case 'scoring': {
      const score = tData ? (tData.revenue || 0) + (tData.controlValue || 0) : 0;
      return { status: 'done', label: `✓ ${score} Pts` };
    }

    default:
      return { status: 'pending', label: '○ Pending' };
  }
}
