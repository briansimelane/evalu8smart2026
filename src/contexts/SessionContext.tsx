import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore';
import { SimulationClass, ClassTeam, UserRole, Team, GameState, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress } from '@/types/game';
import { toast } from 'sonner';
import { REGIONS, TECHNOLOGIES, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';

interface SessionContextType {
  currentRole: UserRole | null;
  currentClassId: string | null;
  currentTeamId: string | null;
  classes: SimulationClass[];
  classesLoaded: boolean;
  activeClass: SimulationClass | null;
  currentClassTeams: Record<string, ClassTeam>;
  isReadOnly: boolean;
  isCeo: boolean;
  ceoName: string | null;
  login: (code: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  logout: () => void;
  createClass: (name: string, teams: Team[]) => Promise<string>;
  deleteClass: (classId: string) => Promise<void>;
  claimCeoSlot: (name: string, newPin?: string, currentPin?: string) => Promise<boolean>;
  releaseCeoSlot: () => Promise<void>;
  facilitatorReleaseCeoSlot: (classId: string, teamId: string) => Promise<void>;
  facilitatorChangeCeoPin: (classId: string, teamId: string, newPin: string) => Promise<void>;
  migrateLegacyClass: (classId: string) => Promise<boolean>;
  selectClass: (classId: string | null) => void;
  selectTeam: (teamId: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [classes, setClasses] = useState<SimulationClass[]>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [classesLoadError, setClassesLoadError] = useState<any>(null);
  const [activeClass, setActiveClass] = useState<SimulationClass | null>(null);
  const [currentClassTeams, setCurrentClassTeams] = useState<Record<string, ClassTeam>>({});

  // CEO state from localStorage
  const [localCeoPin, setLocalCeoPin] = useState<string | null>(localStorage.getItem('evalu8_ceo_pin'));

  // Load auth state from localStorage on mount
  useEffect(() => {
    const role = localStorage.getItem('evalu8_role') as UserRole | null;
    const classId = localStorage.getItem('evalu8_class_id');
    const teamId = localStorage.getItem('evalu8_team_id');

    if (role) {
      setCurrentRole(role);
      if (classId) setCurrentClassId(classId);
      if (teamId) setCurrentTeamId(teamId);
    }
  }, []);

  // Listen to classes identity collection in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classList: SimulationClass[] = [];
      snapshot.forEach((docSnap) => {
        classList.push(docSnap.data() as SimulationClass);
      });
      setClasses(classList);
      setClassesLoaded(true);
    }, (error) => {
      console.error('Error fetching classes:', error);
      setClassesLoadError(error);
      setClassesLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to active class teams subcollection in Firestore
  useEffect(() => {
    if (!currentClassId) {
      setCurrentClassTeams({});
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'classes', currentClassId, 'teams'), (snapshot) => {
      const teamsMap: Record<string, ClassTeam> = {};
      snapshot.forEach((docSnap) => {
        teamsMap[docSnap.id] = docSnap.data() as ClassTeam;
      });
      setCurrentClassTeams(teamsMap);
    }, (error) => {
      console.error('Error fetching class teams subcollection:', error);
    });

    return () => unsubscribe();
  }, [currentClassId]);

  // Sync active class details when currentClassId or classes update
  useEffect(() => {
    if (currentClassId) {
      const found = classes.find(c => c.id === currentClassId);
      setActiveClass(found || null);
    } else {
      setActiveClass(null);
    }
  }, [currentClassId, classes]);

  // Derived state: CEO and Read-Only control
  const currentTeamDoc = currentTeamId ? currentClassTeams[currentTeamId] : null;
  const activeTeam = currentTeamDoc || activeClass?.gameState?.teams.find(t => t.id === currentTeamId);

  const isCeo = currentRole === 'STUDENT' && !!activeTeam?.ceoPin && localCeoPin === activeTeam.ceoPin;
  const isReadOnly = currentRole === 'STUDENT' && !isCeo;
  const ceoName = activeTeam?.ceoName || null;

  // Track the CEO PIN that was successfully verified against DB
  const lastVerifiedCeoPinRef = useRef<string | null>(null);

  // Keep lastVerifiedCeoPinRef in sync when activeTeam matches localCeoPin
  useEffect(() => {
    if (currentRole === 'STUDENT' && localCeoPin && activeTeam?.ceoPin === localCeoPin) {
      lastVerifiedCeoPinRef.current = localCeoPin;
    }
  }, [currentRole, localCeoPin, activeTeam?.ceoPin]);

  // Real-time CEO revocation alert for sitting CEO
  useEffect(() => {
    if (currentRole === 'STUDENT' && localCeoPin) {
      // Only revoke if this PIN was previously verified against DB, but now DB CEO PIN changed/cleared
      if (lastVerifiedCeoPinRef.current === localCeoPin && currentTeamDoc && currentTeamDoc.ceoPin !== localCeoPin) {
        toast.info("Your CEO access was changed by the facilitator.");
        localStorage.removeItem('evalu8_ceo_pin');
        localStorage.removeItem('evalu8_ceo_name');
        lastVerifiedCeoPinRef.current = null;
        setLocalCeoPin(null);
      }
    }
  }, [currentRole, localCeoPin, currentTeamDoc]);

  const login = async (code: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
    if (!classesLoaded) {
      return { success: false, message: 'Still connecting — please try again in a moment.' };
    }

    const trimmedCode = code.trim().toUpperCase();

    if (trimmedCode === 'ADMIN-MASTER') {
      localStorage.setItem('evalu8_role', 'ADMIN');
      localStorage.removeItem('evalu8_class_id');
      localStorage.removeItem('evalu8_team_id');
      setCurrentRole('ADMIN');
      setCurrentClassId(null);
      setCurrentTeamId(null);
      return { success: true, role: 'ADMIN' };
    }

    if (trimmedCode === 'FACILITATOR') {
      localStorage.setItem('evalu8_role', 'FACILITATOR');
      localStorage.removeItem('evalu8_class_id');
      localStorage.removeItem('evalu8_team_id');
      setCurrentRole('FACILITATOR');
      setCurrentClassId(null);
      setCurrentTeamId(null);
      return { success: true, role: 'FACILITATOR' };
    }

    // Find class facilitator by code
    const classFac = classes.find(c => c.facilitatorCode.toUpperCase() === trimmedCode);
    if (classFac) {
      localStorage.setItem('evalu8_role', 'FACILITATOR');
      localStorage.setItem('evalu8_class_id', classFac.id);
      localStorage.removeItem('evalu8_team_id');
      setCurrentRole('FACILITATOR');
      setCurrentClassId(classFac.id);
      setCurrentTeamId(null);
      return { success: true, role: 'FACILITATOR' };
    }

    // Find student team by code
    for (const cls of classes) {
      for (const [teamId, tCode] of Object.entries(cls.teamCodes || {})) {
        if (tCode.toUpperCase() === trimmedCode) {
          localStorage.setItem('evalu8_role', 'STUDENT');
          localStorage.setItem('evalu8_class_id', cls.id);
          localStorage.setItem('evalu8_team_id', teamId);
          setCurrentRole('STUDENT');
          setCurrentClassId(cls.id);
          setCurrentTeamId(teamId);
          return { success: true, role: 'STUDENT' };
        }
      }
    }

    return { success: false, message: 'Invalid Access Code. Please try again.' };
  };

  const logout = () => {
    localStorage.removeItem('evalu8_role');
    localStorage.removeItem('evalu8_class_id');
    localStorage.removeItem('evalu8_team_id');
    localStorage.removeItem('evalu8_ceo_name');
    localStorage.removeItem('evalu8_ceo_pin');
    setCurrentRole(null);
    setCurrentClassId(null);
    setCurrentTeamId(null);
    lastVerifiedCeoPinRef.current = null;
    setLocalCeoPin(null);
  };

  const buildInitialGameState = (teams: Team[]): GameState => {
    const baseId = Date.now();
    const initialCards = teams.map((team, idx) => {
      const colorName = getTeamColorName(team.color, team.name);
      const cardData = INITIAL_IMPROVEMENT_CARDS[colorName];
      
      return {
        id: baseId + idx + 1,
        icon1: cardData.icon1,
        icon2: cardData.icon2,
        availableForTeam: team.id,
        used: false,
        isInitial: true,
      };
    });

    const techCosts: Record<string, number> = {
      'GPS': 3,
      'Wifi': 3,
      'Gaming': 4,
      'Battery': 4,
      'NFC': 5,
      '4G': 6,
    };

    const teamResearchProgress: Record<string, TeamResearchProgress> = {};
    teams.forEach(team => {
      teamResearchProgress[team.id] = {
        teamId: team.id,
        technologyInvestments: {},
        completedTechnologies: [],
      };
    });

    const regionLogistics: Record<string, RegionLogistics> = {};
    REGION_CONFIGS.forEach(config => {
      regionLogistics[config.name] = {
        name: config.name,
        logisticsCost: config.logisticsCost,
        maxTeams: config.maxTeams,
        connectedRegions: config.connectedRegions,
        teamsPresent: [],
        teamProgress: {}
      };
    });

    const teamLogisticsProgress: Record<string, TeamLogisticsProgress> = {};
    teams.forEach(team => {
      const colorName = getTeamColorName(team.color, team.name);
      const startingRegion = INITIAL_TEAM_REGIONS[colorName];
      
      if (startingRegion) {
        regionLogistics[startingRegion].teamsPresent.push(team.id);
        
        teamLogisticsProgress[team.id] = {
          teamId: team.id,
          regionsWithPresence: [startingRegion],
          regionInvestments: {}
        };
      } else {
        teamLogisticsProgress[team.id] = {
          teamId: team.id,
          regionsWithPresence: [],
          regionInvestments: {}
        };
      }
    });

    return {
      gameId: Date.now().toString(),
      teams,
      currentRound: 1,
      rounds: [],
      technologies: TECHNOLOGIES.reduce((acc, tech) => ({
        ...acc,
        [tech]: { 
          name: tech, 
          researchPoints: 0, 
          maxPoints: 6,
          researchCost: techCosts[tech] || 4,
          teamProgress: {}
        }
      }), {}),
      regions: REGIONS.map(region => ({
        name: region,
        sales: {},
        controlPoints: {}
      })),
      patents: {},
      improvementCards: initialCards,
      improvementPoolByRound: {},
      teamResearchProgress,
      researchAllocatedByRound: {},
      regionLogistics,
      teamLogisticsProgress,
      logisticsAllocatedByRound: {},
      createdAt: new Date().toISOString() as any,
      updatedAt: new Date().toISOString() as any
    };
  };

  const createClass = async (name: string, teams: Team[]): Promise<string> => {
    const classId = `cls_${Date.now()}`;
    const rand4 = () => Math.floor(1000 + Math.random() * 9000).toString();
    const randAlpha4 = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const facilitatorCode = `FAC-${rand4()}`;
    const teamCodes: Record<string, string> = {};
    const teamRegistry: ClassTeam[] = [];

    // Ensure teams have canonical team_1 ... team_N IDs
    const canonicalTeams: Team[] = teams.map((team, idx) => {
      const canonicalId = `team_${idx + 1}`;
      teamCodes[canonicalId] = `TM${idx + 1}-${randAlpha4()}`;
      const regTeam: ClassTeam = {
        id: canonicalId,
        name: team.name,
        color: team.color,
        ceoName: '',
        ceoPin: ''
      };
      teamRegistry.push(regTeam);
      return {
        ...team,
        id: canonicalId
      };
    });

    const initialGameState = buildInitialGameState(canonicalTeams);

    const batch = writeBatch(db);

    // 1. Identity Document: classes/{classId}
    const classDocRef = doc(db, 'classes', classId);
    batch.set(classDocRef, {
      id: classId,
      name,
      facilitatorCode,
      teamCodes,
      teamRegistry,
      createdAt: new Date().toISOString()
    });

    // 2. Game State Document: classes/{classId}/state/game
    const stateDocRef = doc(db, 'classes', classId, 'state', 'game');
    batch.set(stateDocRef, { gameState: initialGameState });

    // 3. Per-Team CEO Subcollection Documents: classes/{classId}/teams/{teamId}
    canonicalTeams.forEach((team) => {
      const teamDocRef = doc(db, 'classes', classId, 'teams', team.id);
      batch.set(teamDocRef, {
        id: team.id,
        name: team.name,
        color: team.color,
        ceoName: '',
        ceoPin: '',
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return classId;
  };

  const deleteClass = async (classId: string) => {
    await deleteDoc(doc(db, 'classes', classId));
  };

  const claimCeoSlot = async (name: string, newPin?: string, currentPin?: string): Promise<boolean> => {
    try {
      if (!currentClassId || !currentTeamId) {
        console.warn("claimCeoSlot aborted: missing session variables", { currentClassId, currentTeamId });
        return false;
      }

      const teamRef = doc(db, 'classes', currentClassId, 'teams', currentTeamId);

      const finalPin = await runTransaction(db, async (tx) => {
        const snap = await tx.get(teamRef);
        let currentPinInDb = '';
        if (snap.exists()) {
          currentPinInDb = snap.data().ceoPin || '';
        }

        // If seat already has a PIN in DB, verify the attempted PIN (either currentPin or newPin)
        if (currentPinInDb) {
          const pinAttempt = currentPin || newPin;
          if (!pinAttempt || pinAttempt.trim() !== currentPinInDb.trim()) {
            return null; // Invalid PIN
          }
        }

        const calculatedPin = newPin || currentPinInDb;
        if (!calculatedPin) return null;

        tx.set(teamRef, {
          id: currentTeamId,
          ceoName: name,
          ceoPin: calculatedPin,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Sync with teamRegistry on main class doc
        const classRef = doc(db, 'classes', currentClassId);
        const classSnap = await tx.get(classRef);
        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === currentTeamId ? { ...t, ceoName: name, ceoPin: calculatedPin } : t
            );
            tx.update(classRef, { teamRegistry: updatedRegistry });
          }
        }

        return calculatedPin;
      });

      if (!finalPin) {
        toast.error('This CEO seat is already claimed or PIN is invalid!');
        return false;
      }

      // Save locally after successful transaction
      localStorage.setItem('evalu8_ceo_name', name);
      localStorage.setItem('evalu8_ceo_pin', finalPin);
      setLocalCeoPin(finalPin);

      const tName = currentTeamDoc?.name || currentTeamId;
      toast.success(`You have claimed the CEO seat for team ${tName}!`);
      return true;
    } catch (error: any) {
      console.error("Error inside claimCeoSlot:", error);
      toast.error(`Failed to claim CEO seat: ${error.message || error}`);
      return false;
    }
  };

  const releaseCeoSlot = async () => {
    try {
      if (!currentClassId || !currentTeamId) return;

      const teamRef = doc(db, 'classes', currentClassId, 'teams', currentTeamId);
      const classRef = doc(db, 'classes', currentClassId);

      await runTransaction(db, async (tx) => {
        tx.update(teamRef, {
          ceoName: '',
          ceoPin: '',
          updatedAt: serverTimestamp()
        });

        const classSnap = await tx.get(classRef);
        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === currentTeamId ? { ...t, ceoName: '', ceoPin: '' } : t
            );
            tx.update(classRef, { teamRegistry: updatedRegistry });
          }
        }
      });

      localStorage.removeItem('evalu8_ceo_name');
      localStorage.removeItem('evalu8_ceo_pin');
      lastVerifiedCeoPinRef.current = null;
      setLocalCeoPin(null);

      toast.success(`CEO seat released.`);
    } catch (error: any) {
      console.error("Error inside releaseCeoSlot:", error);
      toast.error(`Failed to release CEO seat: ${error.message || error}`);
    }
  };

  const facilitatorReleaseCeoSlot = async (classId: string, teamId: string): Promise<void> => {
    try {
      const teamRef = doc(db, 'classes', classId, 'teams', teamId);
      const classRef = doc(db, 'classes', classId);

      await runTransaction(db, async (tx) => {
        tx.update(teamRef, {
          ceoName: '',
          ceoPin: '',
          updatedAt: serverTimestamp()
        });

        const classSnap = await tx.get(classRef);
        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === teamId ? { ...t, ceoName: '', ceoPin: '' } : t
            );
            tx.update(classRef, { teamRegistry: updatedRegistry });
          }
        }
      });
      toast.success(`CEO seat released.`);
    } catch (error: any) {
      console.error("Facilitator error releasing CEO seat:", error);
      toast.error(`Failed to release CEO seat: ${error.message || error}`);
    }
  };

  const facilitatorChangeCeoPin = async (classId: string, teamId: string, newPin: string): Promise<void> => {
    try {
      const teamRef = doc(db, 'classes', classId, 'teams', teamId);
      const classRef = doc(db, 'classes', classId);

      await runTransaction(db, async (tx) => {
        tx.update(teamRef, {
          ceoPin: newPin,
          updatedAt: serverTimestamp()
        });

        const classSnap = await tx.get(classRef);
        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === teamId ? { ...t, ceoPin: newPin } : t
            );
            tx.update(classRef, { teamRegistry: updatedRegistry });
          }
        }
      });
      toast.success(`CEO PIN updated.`);
    } catch (error: any) {
      console.error("Facilitator error changing CEO PIN:", error);
      toast.error(`Failed to change CEO PIN: ${error.message || error}`);
    }
  };

  const migrateLegacyClass = async (classId: string): Promise<boolean> => {
    try {
      const classRef = doc(db, 'classes', classId);
      const snap = await getDoc(classRef);
      if (!snap.exists()) return false;

      const data = snap.data() as SimulationClass;
      if (!data.gameState) {
        toast.info(`Class ${data.name || classId} is already migrated.`);
        return true;
      }

      const legacyState = data.gameState;
      const teamRegistry: ClassTeam[] = data.teamRegistry || legacyState.teams.map((t, idx) => ({
        id: t.id || `team_${idx + 1}`,
        name: t.name,
        color: t.color,
        ceoName: t.ceoName || '',
        ceoPin: t.ceoPin || ''
      }));

      const batch = writeBatch(db);

      // 1. Write state doc
      const stateRef = doc(db, 'classes', classId, 'state', 'game');
      batch.set(stateRef, { gameState: legacyState });

      // 2. Write team subcollection docs
      teamRegistry.forEach((t) => {
        const teamRef = doc(db, 'classes', classId, 'teams', t.id);
        batch.set(teamRef, {
          id: t.id,
          name: t.name,
          color: t.color,
          ceoName: t.ceoName || '',
          ceoPin: t.ceoPin || '',
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      // 3. Update root identity doc: set teamRegistry, delete gameState field
      batch.update(classRef, {
        teamRegistry,
        gameState: deleteField()
      });

      await batch.commit();
      toast.success(`Class ${data.name || classId} successfully migrated!`);
      return true;
    } catch (err: any) {
      console.error("Failed to migrate class:", err);
      toast.error(`Migration error: ${err.message || err}`);
      return false;
    }
  };

  const selectClass = (classId: string | null) => {
    setCurrentClassId(classId);
    if (classId) {
      localStorage.setItem('evalu8_class_id', classId);
    } else {
      localStorage.removeItem('evalu8_class_id');
    }
  };

  const selectTeam = (teamId: string | null) => {
    setCurrentTeamId(teamId);
    lastVerifiedCeoPinRef.current = null;
    if (teamId) {
      localStorage.setItem('evalu8_team_id', teamId);
    } else {
      localStorage.removeItem('evalu8_team_id');
    }
  };

  // Validate class existence once loaded
  useEffect(() => {
    if (classesLoaded && currentClassId && !classesLoadError) {
      const classExists = classes.some(c => c.id === currentClassId);
      if (!classExists) {
        console.warn(`Class ${currentClassId} not found in classes list. Clearing selection.`);
        if (currentRole === 'STUDENT') {
          logout();
        } else {
          selectClass(null);
          selectTeam(null);
        }
      }
    }
  }, [classesLoaded, classes, currentClassId, currentRole, classesLoadError]);

  return (
    <SessionContext.Provider value={{
      currentRole,
      currentClassId,
      currentTeamId,
      classes,
      classesLoaded,
      activeClass,
      currentClassTeams,
      isReadOnly,
      isCeo,
      ceoName,
      login,
      logout,
      createClass,
      deleteClass,
      claimCeoSlot,
      releaseCeoSlot,
      facilitatorReleaseCeoSlot,
      facilitatorChangeCeoPin,
      migrateLegacyClass,
      selectClass,
      selectTeam
    }}>
      {children}
    </SessionContext.Provider>
  );
};
