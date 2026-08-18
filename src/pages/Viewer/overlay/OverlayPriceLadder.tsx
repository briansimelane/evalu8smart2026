import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { WorldMarker, WorldTag } from './WorldMarker';
import { useOptionalMotion } from '../motion/MotionContext';
import { getMotionClass, getMotionStyles } from '../motion/motionClass';
import { cn } from '@/lib/utils';

interface OverlayPriceLadderProps {
  gameStateA: GameState;
  gameStateB: GameState;
}

export const OverlayPriceLadder: React.FC<OverlayPriceLadderProps> = ({ gameStateA, gameStateB }) => {
  const m = useOptionalMotion();
  const prices = [8, 7, 6, 5, 4, 3, 2];

  const roundDataA = gameStateA.rounds.find(r => r.roundNumber === gameStateA.currentRound);
  const roundDataB = gameStateB.rounds.find(r => r.roundNumber === gameStateB.currentRound);

  const isPlanningA = gameStateA.currentPhase === 'planning';
  const isPlanningB = gameStateB.currentPhase === 'planning';

  // Map prices to team objects per world
  const teamsByPrice = useMemo(() => {
    const mapping: Record<number, { teamsA: Team[]; teamsB: Team[] }> = {};
    prices.forEach(p => {
      mapping[p] = { teamsA: [], teamsB: [] };
    });

    if (!isPlanningA && roundDataA?.teamData) {
      gameStateA.teams.forEach(team => {
        const p = roundDataA.teamData[team.id]?.price;
        if (p && mapping[p]) {
          mapping[p].teamsA.push(team);
        }
      });
    }

    if (!isPlanningB && roundDataB?.teamData) {
      gameStateB.teams.forEach(team => {
        const p = roundDataB.teamData[team.id]?.price;
        if (p && mapping[p]) {
          mapping[p].teamsB.push(team);
        }
      });
    }

    return mapping;
  }, [gameStateA.teams, gameStateB.teams, roundDataA, roundDataB, isPlanningA, isPlanningB, prices]);

  return (
    <div className="absolute top-0 bottom-0 left-0 w-[150px] bg-white/95 border-r border-slate-300 p-2 flex flex-col justify-between z-10 backdrop-blur-md shadow-lg select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-400 pb-1 w-full px-1">
        <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
          Price Ladder
        </span>
        <span className="text-[10px] font-bold text-slate-500">A / B</span>
      </div>

      {/* Ladder Rows */}
      <div className="relative flex flex-col justify-between w-full flex-1 py-1 gap-1">
        {prices.map(price => {
          const { teamsA, teamsB } = teamsByPrice[price];
          return (
            <div
              key={price}
              className="relative flex items-center justify-between h-[105px] border-b border-slate-200 last:border-b-0 px-1 py-1 gap-1 bg-slate-50/50 rounded-lg"
            >
              {/* Big Price Badge */}
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-600 text-white font-mono text-sm font-black shadow-md shrink-0 z-10">
                ${price}
              </div>

              {/* Sub-lanes Container */}
              <div className="flex flex-col justify-center flex-1 min-w-0 gap-1 pl-1">
                {/* World A Sub-lane (top) */}
                <div className="flex items-center gap-1 min-h-[20px] px-0.5">
                  <WorldTag world="A" label="A" className="text-[7px] px-1 py-0 h-3.5" />
                  <div className="flex items-center gap-1 flex-wrap flex-1 overflow-hidden">
                    {isPlanningA ? (
                      <span className="text-[9px] font-bold text-purple-400 italic">Hidden</span>
                    ) : teamsA.length === 0 ? (
                      <span className="text-[9px] font-medium text-slate-300">—</span>
                    ) : (
                      teamsA.map(team => {
                        const tData = roundDataA?.teamData[team.id];
                        const produced = tData?.productsProduced || 0;
                        const sold = tData?.customersSold?.length || 0;
                        const unsold = Math.max(0, produced - sold);
                        const priceKey = `price:${team.id}`;
                        const isNewPrice = m ? m.tierFor(priceKey) === 1 : false;
                        const priceClass = m ? getMotionClass(m, priceKey, 'sm') : '';
                        const priceStyles = m ? getMotionStyles(m, priceKey, team.color) : {};

                        return (
                          <WorldMarker
                            key={`A-${team.id}`}
                            world="A"
                            teamColor={team.color}
                            size="xs"
                            className={cn(priceClass, isNewPrice && 'mo-arrive')}
                            style={{ ...priceStyles }}
                            title={`World A · ${team.name}: $${price} (${produced} units produced${produced > 0 ? `, ${unsold} unsold` : ''})`}
                          >
                            {team.name.charAt(0).toUpperCase()}
                          </WorldMarker>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* World B Sub-lane (bottom) */}
                <div className="flex items-center gap-1 min-h-[20px] px-0.5">
                  <WorldTag world="B" label="B" className="text-[7px] px-1 py-0 h-3.5" />
                  <div className="flex items-center gap-1 flex-wrap flex-1 overflow-hidden">
                    {isPlanningB ? (
                      <span className="text-[9px] font-bold text-slate-400 italic">Hidden</span>
                    ) : teamsB.length === 0 ? (
                      <span className="text-[9px] font-medium text-slate-300">—</span>
                    ) : (
                      teamsB.map(team => {
                        const tData = roundDataB?.teamData[team.id];
                        const produced = tData?.productsProduced || 0;
                        const sold = tData?.customersSold?.length || 0;
                        const unsold = Math.max(0, produced - sold);
                        const priceKey = `price:${team.id}`;
                        const isNewPrice = m ? m.tierFor(priceKey) === 1 : false;
                        const priceClass = m ? getMotionClass(m, priceKey, 'sm') : '';
                        const priceStyles = m ? getMotionStyles(m, priceKey, team.color) : {};

                        return (
                          <WorldMarker
                            key={`B-${team.id}`}
                            world="B"
                            teamColor={team.color}
                            size="xs"
                            className={cn(priceClass, isNewPrice && 'mo-arrive')}
                            style={{ ...priceStyles }}
                            title={`World B · ${team.name}: $${price} (${produced} units produced${produced > 0 ? `, ${unsold} unsold` : ''})`}
                          >
                            {team.name.charAt(0).toUpperCase()}
                          </WorldMarker>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
