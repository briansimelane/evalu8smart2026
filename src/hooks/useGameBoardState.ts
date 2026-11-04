import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GameState,
  SimulationClass,
  ClassControlState,
  ClassWorldState,
  RoundData,
  JoinCodeDoc,
  calculateTeamTotalScore,
  getInitialScore,
} from '@/types/game';
import { toValidDate, removeUndefined } from '@/lib/utils';
import { getTechnologyCostForTeam as getTechnologyCostForTeamRule } from '@/lib/rules';
import { ensureSignedIn } from '@/demo/demoAuth';
import { assembleGameState, updateV2LiveStateCache } from '@/lib/v2State';
import { useReferee } from '@/hooks/useReferee';

export function useGameBoardState(classCode: string) {
  const [classData, setClassData] = useState<SimulationClass | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [viewerUid, setViewerUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If the Viewer is open in the Facilitator's browser (often fullscreen while the
  // dashboard tab is in the background), let the foreground Viewer tab also referee
  // student actions so background-tab throttling never delays board updates.
  const viewerTeams = useMemo(
    () =>
      gameState?.teams?.length
        ? gameState.teams
        : classData?.teams || (classData?.teamRegistry as any) || [],
    [gameState?.teams, classData?.teams, classData?.teamRegistry]
  );
  useReferee({
    classId: classData?.id || null,
    enabled: Boolean(
      classData &&
        viewerUid &&
        classData.schemaVersion === 2 &&
        (classData.ownerUid === viewerUid || (classData as any).facilitatorId === viewerUid)
    ),
    teams: viewerTeams,
    themeId: classData?.themeId,
  });

  useEffect(() => {
    if (!classCode) return;
    setLoading(true);
    setError(null);

    let unsubClass: (() => void) | null = null;
    let unsubGame: (() => void) | null = null;
    let unsubControl: (() => void) | null = null;
    let unsubWorld: (() => void) | null = null;
    let unsubRounds: (() => void) | null = null;

    const findAndSubscribe = async () => {
      try {
        const uid = await ensureSignedIn();
        setViewerUid(uid);
        const trimmedCode = classCode.trim().toUpperCase();
        let classId: string | null = null;

        // 1. Check joinCodes/{trimmedCode} (v2 viewer or team code)
        const joinSnap = await getDoc(doc(db, 'joinCodes', trimmedCode)).catch(() => null);
        if (joinSnap && joinSnap.exists()) {
          const joinData = joinSnap.data() as JoinCodeDoc;
          classId = joinData.classId;
          // Ensure viewer/member record exists so rules authorize reading class state
          const syncKey = `${uid}:${classId}:${joinData.kind}:${joinData.teamId || ''}:${trimmedCode}`;
          if (sessionStorage.getItem('evalu8_member_synced_key') !== syncKey) {
            const memberRef = doc(db, 'classes', classId, 'members', uid);
            await setDoc(
              memberRef,
              removeUndefined({
                uid,
                role: joinData.kind,
                teamId: joinData.kind === 'team' ? joinData.teamId : undefined,
                code: trimmedCode,
                joinedAt: new Date().toISOString(),
              })
            ).catch(() => {});
            sessionStorage.setItem('evalu8_member_synced_key', syncKey);
          }
        }

        // 2. Try treating classCode as a direct class ID (if facilitator/member or v1)
        if (!classId) {
          const directDocRef = doc(db, 'classes', classCode);
          const directSnap = await getDoc(directDocRef).catch(() => null);
          if (directSnap && directSnap.exists()) {
            classId = classCode;
          }
        }

        // 3. Fallback to legacy schemaVersion == 1 classes only (never scan all v2 classes)
        if (!classId) {
          const legacySnap = await getDocs(
            query(collection(db, 'classes'), where('schemaVersion', '==', 1))
          ).catch(() => null);
          if (legacySnap) {
            for (const d of legacySnap.docs) {
              const data = d.data() as SimulationClass;
              if (data.facilitatorCode?.toUpperCase() === trimmedCode) {
                classId = d.id;
                break;
              }
              const codes = Object.values(data.teamCodes || {});
              if (codes.some((c) => c.toUpperCase() === trimmedCode)) {
                classId = d.id;
                break;
              }
            }
          }
        }

        if (!classId) {
          setError('Class not found. Please verify the code.');
          setLoading(false);
          return;
        }

        const classRef = doc(db, 'classes', classId);
        const initialClassSnap = await getDoc(classRef);
        if (!initialClassSnap.exists()) {
          setError('Class not found.');
          setLoading(false);
          return;
        }
        const initialClass = { id: initialClassSnap.id, ...initialClassSnap.data() } as SimulationClass;
        setClassData(initialClass);

        // Subscribe to class doc
        unsubClass = onSnapshot(classRef, (snap) => {
          if (snap.exists()) {
            setClassData({ id: snap.id, ...snap.data() } as SimulationClass);
          } else {
            setError('Class deleted.');
          }
        });

        if (initialClass.schemaVersion === 2) {
          let latestControl: ClassControlState | null = null;
          let latestWorld: ClassWorldState | null = null;
          let latestRounds: Record<number, RoundData> = {};

          const rebuildV2 = () => {
            if (!latestControl && !latestWorld) return;
            const assembled = assembleGameState({
              classId: classId!,
              teams: initialClass.teams || (initialClass.teamRegistry as any) || [],
              themeId: initialClass.themeId,
              control: latestControl,
              world: latestWorld,
              rounds: latestRounds,
            });
            setGameState(assembled);
            setLoading(false);
          };

          unsubControl = onSnapshot(doc(db, 'classes', classId, 'state', 'control'), (snap) => {
            if (snap.exists()) {
              latestControl = snap.data() as ClassControlState;
              updateV2LiveStateCache(classId!, { control: latestControl });
              rebuildV2();
            }
          });

          unsubWorld = onSnapshot(doc(db, 'classes', classId, 'state', 'world'), (snap) => {
            if (snap.exists()) {
              latestWorld = snap.data() as ClassWorldState;
              updateV2LiveStateCache(classId!, { world: latestWorld });
              rebuildV2();
            }
          });

          unsubRounds = onSnapshot(collection(db, 'classes', classId, 'rounds'), (snap) => {
            const map: Record<number, RoundData> = {};
            snap.forEach((d) => {
              const rData = d.data() as RoundData;
              const rNum = rData.roundNumber || Number(d.id);
              if (rNum) map[rNum] = { ...rData, roundNumber: rNum };
            });
            latestRounds = map;
            updateV2LiveStateCache(classId!, { rounds: latestRounds });
            rebuildV2();
          });
          return;
        }

        // Legacy schemaVersion: 1 — subscribe to classes/{classId}/state/game
        const gameRef = doc(db, 'classes', classId, 'state', 'game');
        unsubGame = onSnapshot(gameRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const gState = data?.gameState as GameState;
            if (gState) {
              gState.createdAt = toValidDate(gState.createdAt);
              gState.updatedAt = toValidDate(gState.updatedAt);
              if (!gState.currentPhase) {
                gState.currentPhase = 'planning';
              }
              if (!Array.isArray(gState.rounds)) {
                gState.rounds = [];
              }
              if (!Array.isArray(gState.teams)) {
                gState.teams = [];
              }
              setGameState(gState);
            } else {
              setGameState(null);
            }
            setLoading(false);
          } else {
            // Fallback to legacy field in class doc
            const cSnap = await getDoc(classRef);
            if (cSnap.exists()) {
              const cData = cSnap.data() as SimulationClass;
              if (cData.gameState) {
                setGameState({
                  ...cData.gameState,
                  rounds: Array.isArray(cData.gameState.rounds) ? cData.gameState.rounds : [],
                  teams: Array.isArray(cData.gameState.teams) ? cData.gameState.teams : [],
                });
              } else {
                setGameState(null);
              }
            } else {
              setGameState(null);
            }
            setLoading(false);
          }
        });
      } catch (err: any) {
        console.error("useGameBoardState error:", err);
        setError(err.message || 'Error connecting to Firestore');
        setLoading(false);
      }
    };

    findAndSubscribe();

    return () => {
      if (unsubClass) unsubClass();
      if (unsubGame) unsubGame();
      if (unsubControl) unsubControl();
      if (unsubWorld) unsubWorld();
      if (unsubRounds) unsubRounds();
    };
  }, [classCode]);

  return { classData, gameState, loading, error };
}

export function calculatePlayOrderForState(gameState: GameState, roundNumber: number) {
  if (!gameState) return [];

  const roundData = gameState.rounds.find(r => r.roundNumber === roundNumber);
  if (!roundData) return gameState.teams;

  const teamsWithData = gameState.teams.map(team => {
    const currentData = roundData.teamData[team.id];
    const previousScore = roundNumber > 1
      ? calculateTeamTotalScore(team.id, roundNumber - 1, gameState).totalScore
      : getInitialScore(team);

    return {
      team,
      currentPrice: currentData?.price ?? Infinity,
      previousScore,
    };
  });

  teamsWithData.sort((a, b) => {
    if (a.currentPrice !== b.currentPrice) {
      return a.currentPrice - b.currentPrice;
    }
    return a.previousScore - b.previousScore;
  });

  return teamsWithData.map(item => item.team);
}

export function getTechnologyCostForTeamForState(gameState: GameState, teamId: string, technology: string): number {
  if (!gameState) return 4;
  return getTechnologyCostForTeamRule(gameState, teamId, technology);
}
