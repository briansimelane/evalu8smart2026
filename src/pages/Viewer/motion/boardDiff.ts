import type { GameState } from '@/types/game';
import { REGION_CUSTOMERS } from '@/data/customers';

export type BoardEventKind =
  | 'customer-sold'
  | 'office-established'
  | 'logistics-progress'
  | 'research-progress'
  | 'tech-completed'
  | 'patent-awarded'
  | 'improvement-claimed'
  | 'price-set'
  | 'control-changed'
  | 'money-changed';

export interface BoardEvent {
  /** stable identity of the DOM element that should react, e.g. `customer:EU-3` */
  key: string;
  kind: BoardEventKind;
  tier: 1 | 2;
  teamId?: string;
  teamName?: string;
  teamColor?: string;
  regionName?: string;
  /** short sentence for the ticker, e.g. "Team B took Customer 3 in Europe" */
  label: string;
}

/** True when the delta is structural rather than an in-play event. */
export function isBulkTransition(prev: GameState, next: GameState): boolean {
  if (!prev || !next) return false;
  if (prev.currentRound !== next.currentRound) return true;
  
  // Phase names might have case differences (e.g. 'PLANNING' vs 'planning'), normalize them
  const prevPhase = (prev.currentPhase || '').toLowerCase();
  const nextPhase = (next.currentPhase || '').toLowerCase();
  if (prevPhase !== nextPhase) return true;
  
  if (prev.teams.length !== next.teams.length) return true;
  return false;
}

/** Deterministic: same pair of snapshots always yields the same event list. */
export function diffGameState(prev: GameState, next: GameState): BoardEvent[] {
  if (!prev || !next) return [];

  const events: BoardEvent[] = [];
  const currentRound = next.currentRound;

  const prevRoundData = prev.rounds.find(r => r.roundNumber === currentRound);
  const nextRoundData = next.rounds.find(r => r.roundNumber === currentRound);

  // Helper to get team info
  const getTeamInfo = (teamId: string) => {
    const team = next.teams.find(t => t.id === teamId) || prev.teams.find(t => t.id === teamId);
    return {
      name: team?.name || teamId,
      color: team?.color || '#f59e0b'
    };
  };

  // 1. customer-sold (tier 1)
  if (nextRoundData) {
    next.teams.forEach(team => {
      const nextTeamData = nextRoundData.teamData[team.id];
      const prevTeamData = prevRoundData?.teamData[team.id];

      const nextSold = nextTeamData?.customersSold || [];
      const prevSold = prevTeamData?.customersSold || [];

      nextSold.forEach(cid => {
        if (!prevSold.includes(cid)) {
          const regionName = REGION_CUSTOMERS.find(rc => rc.customers.some(c => c.id === cid))?.region || '';
          const teamInfo = getTeamInfo(team.id);
          events.push({
            key: `customer:${regionName}:${cid}`,
            kind: 'customer-sold',
            tier: 1,
            teamId: team.id,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            regionName,
            label: `${teamInfo.name} sold to Customer ${cid.toUpperCase()} in ${regionName}`
          });
        }
      });
    });
  }

  // 2. office-established (tier 1) & logistics-progress (tier 2)
  Object.keys(next.regionLogistics || {}).forEach(regionName => {
    const nextRegion = next.regionLogistics[regionName];
    const prevRegion = prev.regionLogistics?.[regionName];

    if (nextRegion) {
      // office-established
      nextRegion.teamsPresent.forEach(teamId => {
        if (!prevRegion || !prevRegion.teamsPresent.includes(teamId)) {
          const teamInfo = getTeamInfo(teamId);
          events.push({
            key: `office:${regionName}:${teamId}`,
            kind: 'office-established',
            tier: 1,
            teamId,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            regionName,
            label: `${teamInfo.name} established presence in ${regionName}`
          });
        }
      });

      // logistics-progress (tier 2)
      Object.keys(nextRegion.teamProgress || {}).forEach(teamId => {
        const nextProg = nextRegion.teamProgress[teamId] || 0;
        const prevProg = prevRegion?.teamProgress?.[teamId] || 0;

        if (nextProg > prevProg) {
          // Only progress if office was NOT newly established in the same tick
          const officeNewlyEstablished = !prevRegion || (!prevRegion.teamsPresent.includes(teamId) && nextRegion.teamsPresent.includes(teamId));
          if (!officeNewlyEstablished) {
            const teamInfo = getTeamInfo(teamId);
            events.push({
              key: `logistics:${regionName}:${teamId}`,
              kind: 'logistics-progress',
              tier: 2,
              teamId,
              teamName: teamInfo.name,
              teamColor: teamInfo.color,
              regionName,
              label: `${teamInfo.name} invested in logistics in ${regionName}`
            });
          }
        }
      });
    }
  });

  // 3. tech-completed (tier 1) & research-progress (tier 2)
  next.teams.forEach(team => {
    const nextResearch = next.teamResearchProgress[team.id];
    const prevResearch = prev.teamResearchProgress[team.id];

    if (nextResearch) {
      // tech-completed
      nextResearch.completedTechnologies.forEach(techName => {
        if (!prevResearch || !prevResearch.completedTechnologies.includes(techName)) {
          const teamInfo = getTeamInfo(team.id);
          events.push({
            key: `tech:${techName}`,
            kind: 'tech-completed',
            tier: 1,
            teamId: team.id,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            label: `${teamInfo.name} completed ${techName} research`
          });
        }
      });

      // research-progress
      Object.keys(nextResearch.technologyInvestments || {}).forEach(techName => {
        const nextInv = nextResearch.technologyInvestments[techName] || 0;
        const prevInv = prevResearch?.technologyInvestments?.[techName] || 0;

        if (nextInv > prevInv) {
          const newlyCompleted = !prevResearch || (!prevResearch.completedTechnologies.includes(techName) && nextResearch.completedTechnologies.includes(techName));
          if (!newlyCompleted) {
            const teamInfo = getTeamInfo(team.id);
            events.push({
              key: `research:${techName}:${team.id}`,
              kind: 'research-progress',
              tier: 2,
              teamId: team.id,
              teamName: teamInfo.name,
              teamColor: teamInfo.color,
              label: `${teamInfo.name} invested in ${techName} research`
            });
          }
        }
      });
    }
  });

  // 4. patent-awarded (tier 1)
  Object.keys(next.patents || {}).forEach(techName => {
    const nextHolder = next.patents[techName];
    const prevHolder = prev.patents?.[techName];

    if (nextHolder && nextHolder !== prevHolder) {
      const teamInfo = getTeamInfo(nextHolder);
      events.push({
        key: `patent:${techName}`,
        kind: 'patent-awarded',
        tier: 1,
        teamId: nextHolder,
        teamName: teamInfo.name,
        teamColor: teamInfo.color,
        label: `${teamInfo.name} was awarded the patent for ${techName}`
      });
    }
  });

  // 5. improvement-claimed (tier 1)
  next.improvementCards.forEach(nextCard => {
    const prevCard = prev.improvementCards.find(c => c.id === nextCard.id);

    if (nextCard.availableForTeam && (!prevCard || prevCard.availableForTeam !== nextCard.availableForTeam)) {
      const teamInfo = getTeamInfo(nextCard.availableForTeam);
      events.push({
        key: `improvement:${nextCard.id}`,
        kind: 'improvement-claimed',
        tier: 1,
        teamId: nextCard.availableForTeam,
        teamName: teamInfo.name,
        teamColor: teamInfo.color,
        label: `${teamInfo.name} claimed an improvement card`
      });
    }
  });

  // 6. price-set (tier 2)
  if (nextRoundData) {
    next.teams.forEach(team => {
      const nextTeamData = nextRoundData.teamData[team.id];
      const prevTeamData = prevRoundData?.teamData[team.id];

      if (nextTeamData && nextTeamData.price !== undefined) {
        if (!prevTeamData || prevTeamData.price !== nextTeamData.price) {
          const teamInfo = getTeamInfo(team.id);
          events.push({
            key: `price:${team.id}`,
            kind: 'price-set',
            tier: 2,
            teamId: team.id,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            label: `${teamInfo.name} set their price to $${nextTeamData.price}`
          });
        }
      }
    });
  }

  // 7. control-changed (tier 2)
  if (nextRoundData) {
    next.teams.forEach(team => {
      const nextTeamData = nextRoundData.teamData[team.id];
      const prevTeamData = prevRoundData?.teamData[team.id];

      const nextControl = nextTeamData?.regionControlPoints || {};
      const prevControl = prevTeamData?.regionControlPoints || {};

      Object.keys(nextControl).forEach(regionName => {
        if (nextControl[regionName] !== prevControl[regionName]) {
          const teamInfo = getTeamInfo(team.id);
          events.push({
            key: `control:${regionName}`,
            kind: 'control-changed',
            tier: 2,
            teamId: team.id,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            regionName,
            label: `Control points adjusted in ${regionName}`
          });
        }
      });
    });
  }

  // 8. money-changed (tier 2)
  if (nextRoundData) {
    next.teams.forEach(team => {
      const nextTeamData = nextRoundData.teamData[team.id];
      const prevTeamData = prevRoundData?.teamData[team.id];

      if (nextTeamData && nextTeamData.totalMoney !== undefined) {
        if (!prevTeamData || prevTeamData.totalMoney !== nextTeamData.totalMoney) {
          const teamInfo = getTeamInfo(team.id);
          events.push({
            key: `money:${team.id}`,
            kind: 'money-changed',
            tier: 2,
            teamId: team.id,
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            label: `${teamInfo.name} total value updated`
          });
        }
      }
    });
  }

  return events;
}
