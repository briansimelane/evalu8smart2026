import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { SimulationClass, UserRole, Team, GameState, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress } from '@/types/game';
import { toast } from 'sonner';
import { REGIONS, TECHNOLOGIES, TEAM_COLORS, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';

interface SessionContextType {
  currentRole: UserRole | null;
  currentClassId: string | null;
  currentTeamId: string | null;
  classes: SimulationClass[];
  classesLoaded: boolean;
  activeClass: SimulationClass | null;
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

  // Listen to classes collection in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classList: SimulationClass[] = [];
      snapshot.forEach((doc) => {
        classList.push(doc.data() as SimulationClass);
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
  const activeTeam = activeClass?.gameState?.teams.find(t => t.id === currentTeamId);
  const isCeo = currentRole === 'STUDENT' && !!activeTeam?.ceoPin && localCeoPin === activeTeam.ceoPin;
  const isReadOnly = currentRole === 'STUDENT' && !isCeo;
  const ceoName = activeTeam?.ceoName || null;

  const login = async (code: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
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

    teams.forEach((team, idx) => {
      const teamNum = idx + 1;
      teamCodes[team.id] = `TM${teamNum}-${randAlpha4()}`;
    });

    const initialGameState = buildInitialGameState(teams);

    const newClass: SimulationClass = {
      id: classId,
      name,
      facilitatorCode,
      teamCodes,
      gameState: initialGameState,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'classes', classId), newClass);
    return classId;
  };

  const deleteClass = async (classId: string) => {
    await deleteDoc(doc(db, 'classes', classId));
  };

  const claimCeoSlot = async (name: string, newPin?: string, currentPin?: string): Promise<boolean> => {
    try {
      if (!currentClassId || !currentTeamId || !activeClass) {
        console.warn("claimCeoSlot aborted: missing session variables", { currentClassId, currentTeamId, activeClass });
        return false;
      }

      const classRef = doc(db, 'classes', currentClassId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) {
        console.warn(`claimCeoSlot aborted: class ${currentClassId} snap not found`);
        return false;
      }

      const classData = classSnap.data() as SimulationClass;
      if (!classData.gameState) {
        console.warn("claimCeoSlot aborted: class has no gameState");
        return false;
      }

      const team = classData.gameState.teams.find(t => t.id === currentTeamId);
      if (!team) {
        console.warn(`claimCeoSlot aborted: team ${currentTeamId} not found in class teams`);
        return false;
      }

      // If already claimed, verify the current PIN
      if (team.ceoPin) {
        if (!currentPin || team.ceoPin !== currentPin) {
          toast.error('This CEO seat is already claimed! Incorrect current PIN.');
          return false;
        }
      }

      // Set CEO details
      team.ceoName = name;
      const finalPin = newPin || team.ceoPin || '';
      team.ceoPin = finalPin;

      // Save locally first to prevent race condition during latency compensation
      localStorage.setItem('evalu8_ceo_name', name);
      localStorage.setItem('evalu8_ceo_pin', finalPin);
      setLocalCeoPin(finalPin);

      // Update in Firestore
      await setDoc(classRef, classData);

      toast.success(`You have claimed the CEO seat for team ${team.name}!`);
      return true;
    } catch (error: any) {
      console.error("Error inside claimCeoSlot:", error);
      toast.error(`Failed to claim CEO seat: ${error.message || error}`);
      return false;
    }
  };

  const releaseCeoSlot = async () => {
    try {
      if (!currentClassId || !currentTeamId || !activeClass) return;

      const classRef = doc(db, 'classes', currentClassId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) return;

      const classData = classSnap.data() as SimulationClass;
      if (!classData.gameState) return;

      const team = classData.gameState.teams.find(t => t.id === currentTeamId);
      if (!team) return;

      team.ceoName = '';
      team.ceoPin = '';

      // Clear locally first to prevent race condition during latency compensation
      localStorage.removeItem('evalu8_ceo_name');
      localStorage.removeItem('evalu8_ceo_pin');
      setLocalCeoPin(null);

      await setDoc(classRef, classData);

      toast.success(`CEO seat released for team ${team.name}.`);
    } catch (error: any) {
      console.error("Error inside releaseCeoSlot:", error);
      toast.error(`Failed to release CEO seat: ${error.message || error}`);
    }
  };

  const facilitatorReleaseCeoSlot = async (classId: string, teamId: string): Promise<void> => {
    try {
      const classRef = doc(db, 'classes', classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) return;

      const classData = classSnap.data() as SimulationClass;
      if (!classData.gameState) return;

      const team = classData.gameState.teams.find(t => t.id === teamId);
      if (!team) return;

      team.ceoName = '';
      team.ceoPin = '';

      await setDoc(classRef, classData);
      toast.success(`CEO seat released for ${team.name}.`);
    } catch (error: any) {
      console.error("Facilitator error releasing CEO seat:", error);
      toast.error(`Failed to release CEO seat: ${error.message || error}`);
    }
  };

  const facilitatorChangeCeoPin = async (classId: string, teamId: string, newPin: string): Promise<void> => {
    try {
      const classRef = doc(db, 'classes', classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) return;

      const classData = classSnap.data() as SimulationClass;
      if (!classData.gameState) return;

      const team = classData.gameState.teams.find(t => t.id === teamId);
      if (!team) return;

      team.ceoPin = newPin;

      await setDoc(classRef, classData);
      toast.success(`CEO PIN updated for ${team.name}.`);
    } catch (error: any) {
      console.error("Facilitator error changing CEO PIN:", error);
      toast.error(`Failed to change CEO PIN: ${error.message || error}`);
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
      selectClass,
      selectTeam
    }}>
      {children}
    </SessionContext.Provider>
  );
};
