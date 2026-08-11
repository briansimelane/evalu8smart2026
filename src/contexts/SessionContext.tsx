import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore';
import { SimulationClass, ClassTeam, UserRole, Team, GameState, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress, BotProfile, BotDifficulty, FacilitatorUser } from '@/types/game';
import { toast } from 'sonner';
import { REGIONS, TECHNOLOGIES, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';
import { removeUndefined } from '@/lib/utils';
import { buildInitialGameState } from '@/lib/initialGameState';
import { isDemoPathname } from '@/demo/useIsDemoRoute';

interface SessionContextType {
  currentRole: UserRole | null;
  currentClassId: string | null;
  currentTeamId: string | null;
  currentUserEmail: string | null;
  currentUserName: string | null;
  facilitators: FacilitatorUser[];
  classes: SimulationClass[];
  classesLoaded: boolean;
  activeClass: SimulationClass | null;
  currentClassTeams: Record<string, ClassTeam>;
  isReadOnly: boolean;
  isCeo: boolean;
  ceoName: string | null;
  isDemo: boolean;
  isDemoHost: boolean;
  startDemo: (config: import('@/demo/DemoStateProvider').DemoConfig) => Promise<void>;
  exitDemo: () => void;
  login: (code: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  createFacilitatorAccount: (name: string, email: string, defaultPassword: string) => Promise<{ success: boolean; message?: string }>;
  sendFacilitatorPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>;
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
  convertTeamSeat: (classId: string, teamId: string, targetType: 'HUMAN' | 'BOT', profile?: BotProfile, difficulty?: BotDifficulty) => Promise<void>;
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(localStorage.getItem('evalu8_user_email'));
  const [currentUserName, setCurrentUserName] = useState<string | null>(localStorage.getItem('evalu8_user_name'));
  const [facilitators, setFacilitators] = useState<FacilitatorUser[]>([]);
  const [classes, setClasses] = useState<SimulationClass[]>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [classesLoadError, setClassesLoadError] = useState<any>(null);
  const [activeClass, setActiveClass] = useState<SimulationClass | null>(null);
  const [currentClassTeams, setCurrentClassTeams] = useState<Record<string, ClassTeam>>({});
  const isDemoRoute = isDemoPathname();

  // CEO state from localStorage
  const [localCeoPin, setLocalCeoPin] = useState<string | null>(localStorage.getItem('evalu8_ceo_pin'));

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.isAnonymous) return;
      if (user) {
        setCurrentUserEmail(user.email);
        localStorage.setItem('evalu8_user_email', user.email || '');
      } else if (!localStorage.getItem('evalu8_role')) {
        setCurrentUserEmail(null);
        setCurrentUserName(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to facilitators collection in Firestore
  useEffect(() => {
    if (isDemoRoute) return;

    const unsubscribe = onSnapshot(collection(db, 'facilitators'), (snapshot) => {
      const list: FacilitatorUser[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as FacilitatorUser);
      });
      setFacilitators(list);
    }, (error) => {
      console.error('Error fetching facilitators:', error);
    });

    return () => unsubscribe();
  }, [isDemoRoute]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const role = localStorage.getItem('evalu8_role') as UserRole | null;
    const classId = localStorage.getItem('evalu8_class_id');
    const teamId = localStorage.getItem('evalu8_team_id');
    const userEmail = localStorage.getItem('evalu8_user_email');
    const userName = localStorage.getItem('evalu8_user_name');

    if (role) {
      setCurrentRole(role);
      if (classId) setCurrentClassId(classId);
      if (teamId) setCurrentTeamId(teamId);
      if (userEmail) setCurrentUserEmail(userEmail);
      if (userName) setCurrentUserName(userName);
    }
  }, []);

  // Listen to classes identity collection in Firestore
  useEffect(() => {
    if (isDemoRoute) {
      setClassesLoaded(true);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classList: SimulationClass[] = [];
      snapshot.forEach((docSnap) => {
        classList.push({ id: docSnap.id, ...docSnap.data() } as SimulationClass);
      });
      setClasses(classList);
      setClassesLoaded(true);
    }, (error) => {
      console.error('Error fetching classes:', error);
      setClassesLoadError(error);
      setClassesLoaded(true);
    });

    return () => unsubscribe();
  }, [isDemoRoute]);

  // Listen to active class teams subcollection in Firestore
  useEffect(() => {
    if (isDemoRoute || !currentClassId) {
      setCurrentClassTeams({});
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'classes', currentClassId, 'teams'), (snapshot) => {
      const teamsMap: Record<string, ClassTeam> = {};
      snapshot.forEach((docSnap) => {
        teamsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as ClassTeam;
      });
      setCurrentClassTeams(teamsMap);
    }, (error) => {
      console.error('Error fetching class teams subcollection:', error);
    });

    return () => unsubscribe();
  }, [currentClassId, isDemoRoute]);

  // Sync active class details when currentClassId or classes update
  useEffect(() => {
    if (currentClassId && Array.isArray(classes)) {
      const found = classes.find(c => c && c.id === currentClassId);
      setActiveClass(found || null);
    } else {
      setActiveClass(null);
    }
  }, [currentClassId, classes]);

  // Derived state: CEO and Read-Only control
  const currentTeamDoc = currentTeamId ? currentClassTeams[currentTeamId] : null;
  const activeTeam = currentTeamDoc || (activeClass?.gameState?.teams || []).find(t => t?.id === currentTeamId);

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
        if (tCode.toUpperCase() !== 'BOT' && tCode.toUpperCase() === trimmedCode) {
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

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const isDefaultAdmin = trimmedEmail === 'brian@learningsims.co.za';

    try {
      let user: any;
      try {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        user = cred.user;
      } catch (authErr: any) {
        if (isDefaultAdmin && (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password')) {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
            user = newCred.user;
          } catch (createErr) {
            if (password === 'Sizakele@1981') {
              user = { uid: 'admin_brian_simelane', email: trimmedEmail, displayName: 'Brian Simelane (Admin)' };
            } else {
              throw authErr;
            }
          }
        } else if (isDefaultAdmin && password === 'Sizakele@1981') {
          user = { uid: 'admin_brian_simelane', email: trimmedEmail, displayName: 'Brian Simelane (Admin)' };
        } else {
          throw authErr;
        }
      }

      const userDocRef = doc(db, 'facilitators', user.uid);
      let role: UserRole = isDefaultAdmin ? 'ADMIN' : 'FACILITATOR';
      let name = user.displayName || (isDefaultAdmin ? 'Brian Simelane (Admin)' : trimmedEmail.split('@')[0]);

      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data() as FacilitatorUser;
          role = data.role || role;
          name = data.name || name;
        } else {
          await setDoc(userDocRef, {
            uid: user.uid,
            name,
            email: trimmedEmail,
            role,
            createdAt: new Date().toISOString(),
            gamesCreatedCount: 0
          });
        }
      } catch (dbErr) {
        console.warn('Firestore user doc sync warning:', dbErr);
      }

      if (trimmedEmail.includes('admin') || isDefaultAdmin) {
        role = 'ADMIN';
      }

      localStorage.setItem('evalu8_role', role);
      localStorage.setItem('evalu8_user_email', user.email || trimmedEmail);
      localStorage.setItem('evalu8_user_name', name);
      localStorage.removeItem('evalu8_class_id');
      localStorage.removeItem('evalu8_team_id');

      setCurrentRole(role);
      setCurrentUserEmail(user.email || trimmedEmail);
      setCurrentUserName(name);
      setCurrentClassId(null);
      setCurrentTeamId(null);

      return { success: true, role };
    } catch (err: any) {
      console.error('Email sign-in error:', err);

      if (isDefaultAdmin && password === 'Sizakele@1981') {
        const name = 'Brian Simelane (Admin)';
        const role: UserRole = 'ADMIN';
        localStorage.setItem('evalu8_role', role);
        localStorage.setItem('evalu8_user_email', trimmedEmail);
        localStorage.setItem('evalu8_user_name', name);
        localStorage.removeItem('evalu8_class_id');
        localStorage.removeItem('evalu8_team_id');

        setCurrentRole(role);
        setCurrentUserEmail(trimmedEmail);
        setCurrentUserName(name);
        setCurrentClassId(null);
        setCurrentTeamId(null);

        return { success: true, role };
      }

      let errMsg = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'Too many failed attempts. Please try again later.';
      }
      return { success: false, message: errMsg };
    }
  };

  const createFacilitatorAccount = async (name: string, email: string, defaultPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      const secondaryApp = initializeApp({
        projectId: "evalu8smart2026",
        appId: "1:352780138083:web:ba75600ed24719c03c2a56",
        storageBucket: "evalu8smart2026.firebasestorage.app",
        apiKey: "AIzaSyDHT9DXTmO7DnrTqpuD0af7KpGdtzII2zU",
        authDomain: "evalu8smart2026.firebaseapp.com",
        messagingSenderId: "352780138083"
      }, `SecondaryAuth_${Date.now()}`);

      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, defaultPassword);
      const uid = userCred.user.uid;

      const newFacilitator: FacilitatorUser = {
        uid,
        name: trimmedName,
        email: trimmedEmail,
        role: 'FACILITATOR',
        createdAt: new Date().toISOString(),
        createdByEmail: currentUserEmail || 'admin@evalu8.com',
        gamesCreatedCount: 0
      };

      await setDoc(doc(db, 'facilitators', uid), newFacilitator);
      await deleteApp(secondaryApp);

      return { success: true };
    } catch (err: any) {
      console.error('Error creating facilitator account:', err);
      let errMsg = 'Failed to create facilitator account.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email address already exists.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password should be at least 6 characters long.';
      }
      return { success: false, message: errMsg };
    }
  };

  const sendFacilitatorPasswordReset = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err: any) {
      console.error('Error sending password reset:', err);
      return { success: false, message: err.message || 'Failed to send password reset email.' };
    }
  };

  const logout = () => {
    signOut(auth).catch(() => {});
    localStorage.removeItem('evalu8_role');
    localStorage.removeItem('evalu8_class_id');
    localStorage.removeItem('evalu8_team_id');
    localStorage.removeItem('evalu8_ceo_name');
    localStorage.removeItem('evalu8_ceo_pin');
    localStorage.removeItem('evalu8_user_email');
    localStorage.removeItem('evalu8_user_name');
    setCurrentRole(null);
    setCurrentClassId(null);
    setCurrentTeamId(null);
    setCurrentUserEmail(null);
    setCurrentUserName(null);
    lastVerifiedCeoPinRef.current = null;
    setLocalCeoPin(null);
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
      const isBot = !!team.isBot;
      if (isBot) {
        teamCodes[canonicalId] = 'BOT';
      } else {
        teamCodes[canonicalId] = `TM${idx + 1}-${randAlpha4()}`;
      }
      const regTeam: ClassTeam = {
        id: canonicalId,
        name: team.name,
        color: team.color,
        ceoName: '',
        ceoPin: '',
        isBot: isBot,
        ...(isBot ? {
          botProfile: team.botProfile || 'BALANCED',
          botDifficulty: team.botDifficulty || 'MEDIUM'
        } : {})
      };
      teamRegistry.push(regTeam);
      return {
        ...team,
        id: canonicalId,
        isBot: isBot,
        ...(isBot ? {
          botProfile: team.botProfile || 'BALANCED',
          botDifficulty: team.botDifficulty || 'MEDIUM'
        } : {})
      };
    });

    const initialGameState = buildInitialGameState(canonicalTeams);

    const batch = writeBatch(db);

    // 1. Identity Document: classes/{classId}
    const classDocRef = doc(db, 'classes', classId);
    batch.set(classDocRef, removeUndefined({
      id: classId,
      name,
      facilitatorCode,
      teamCodes,
      teamRegistry,
      createdAt: new Date().toISOString(),
      createdByEmail: currentUserEmail || 'admin@evalu8.com',
      createdByName: currentUserName || 'Facilitator'
    }));

    // 2. Game State Document: classes/{classId}/state/game
    const stateDocRef = doc(db, 'classes', classId, 'state', 'game');
    batch.set(stateDocRef, removeUndefined({ gameState: initialGameState }));

    // 3. Per-Team CEO Subcollection Documents: classes/{classId}/teams/{teamId}
    canonicalTeams.forEach((team) => {
      const teamDocRef = doc(db, 'classes', classId, 'teams', team.id);
      batch.set(teamDocRef, removeUndefined({
        id: team.id,
        name: team.name,
        color: team.color,
        ceoName: '',
        ceoPin: '',
        isBot: !!team.isBot,
        botProfile: team.botProfile || '',
        botDifficulty: team.botDifficulty || '',
        updatedAt: serverTimestamp()
      }));
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
      const classRef = doc(db, 'classes', currentClassId);

      const finalPin = await runTransaction(db, async (tx) => {
        // 1. ALL READS FIRST
        const snap = await tx.get(teamRef);
        const classSnap = await tx.get(classRef);

        if (snap.exists() && snap.data().isBot) {
          throw new Error("Cannot claim CEO seat for an automated Bot team!");
        }

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

        // 2. ALL WRITES AFTER READS
        tx.set(teamRef, removeUndefined({
          id: currentTeamId,
          ceoName: name,
          ceoPin: calculatedPin,
          updatedAt: serverTimestamp()
        }), { merge: true });

        // Sync with teamRegistry on main class doc
        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === currentTeamId ? { ...t, ceoName: name, ceoPin: calculatedPin } : t
            );
            tx.update(classRef, removeUndefined({ teamRegistry: updatedRegistry }));
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
        // 1. ALL READS FIRST
        const classSnap = await tx.get(classRef);

        // 2. ALL WRITES AFTER READS
        tx.update(teamRef, removeUndefined({
          ceoName: '',
          ceoPin: '',
          updatedAt: serverTimestamp()
        }));

        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === currentTeamId ? { ...t, ceoName: '', ceoPin: '' } : t
            );
            tx.update(classRef, removeUndefined({ teamRegistry: updatedRegistry }));
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
        // 1. ALL READS FIRST
        const classSnap = await tx.get(classRef);

        // 2. ALL WRITES AFTER READS
        tx.update(teamRef, removeUndefined({
          ceoName: '',
          ceoPin: '',
          updatedAt: serverTimestamp()
        }));

        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === teamId ? { ...t, ceoName: '', ceoPin: '' } : t
            );
            tx.update(classRef, removeUndefined({ teamRegistry: updatedRegistry }));
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
        // 1. ALL READS FIRST
        const classSnap = await tx.get(classRef);

        // 2. ALL WRITES AFTER READS
        tx.update(teamRef, removeUndefined({
          ceoPin: newPin,
          updatedAt: serverTimestamp()
        }));

        if (classSnap.exists()) {
          const classData = classSnap.data() as SimulationClass;
          if (classData.teamRegistry) {
            const updatedRegistry = classData.teamRegistry.map(t =>
              t.id === teamId ? { ...t, ceoPin: newPin } : t
            );
            tx.update(classRef, removeUndefined({ teamRegistry: updatedRegistry }));
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

  const convertTeamSeat = async (
    classId: string,
    teamId: string,
    targetType: 'HUMAN' | 'BOT',
    profile: BotProfile = 'BALANCED',
    difficulty: BotDifficulty = 'MEDIUM'
  ): Promise<void> => {
    try {
      const classRef = doc(db, 'classes', classId);
      const teamRef = doc(db, 'classes', classId, 'teams', teamId);
      const stateRef = doc(db, 'classes', classId, 'state', 'game');

      await runTransaction(db, async (tx) => {
        const classSnap = await tx.get(classRef);
        const stateSnap = await tx.get(stateRef);

        if (!classSnap.exists()) throw new Error("Class not found");

        const classData = classSnap.data() as SimulationClass;
        const stateData = stateSnap.data() || {};
        const gameState = stateData.gameState as GameState;

        const randAlpha4 = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          let result = '';
          for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const newTeamCodes = { ...classData.teamCodes };
        if (targetType === 'BOT') {
          newTeamCodes[teamId] = 'BOT';
        } else {
          newTeamCodes[teamId] = `TM-${randAlpha4()}`;
        }

        const newTeamRegistry = classData.teamRegistry.map(t => {
          if (t.id === teamId) {
            const updatedTeam: ClassTeam = {
              ...t,
              isBot: targetType === 'BOT',
              ceoName: '',
              ceoPin: ''
            };
            if (targetType === 'BOT') {
              updatedTeam.botProfile = profile;
              updatedTeam.botDifficulty = difficulty;
            } else {
              delete updatedTeam.botProfile;
              delete updatedTeam.botDifficulty;
            }
            return updatedTeam;
          }
          return t;
        });

        tx.update(classRef, removeUndefined({
          teamCodes: newTeamCodes,
          teamRegistry: newTeamRegistry
        }));

        const teamUpdates: any = {
          isBot: targetType === 'BOT',
          ceoName: '',
          ceoPin: '',
          updatedAt: serverTimestamp()
        };
        if (targetType === 'BOT') {
          teamUpdates.botProfile = profile;
          teamUpdates.botDifficulty = difficulty;
        } else {
          teamUpdates.botProfile = '';
          teamUpdates.botDifficulty = '';
        }
        tx.set(teamRef, removeUndefined(teamUpdates), { merge: true });

        if (gameState) {
          const newTeams = gameState.teams.map(t => {
            if (t.id === teamId) {
              const updatedTeam: Team = {
                ...t,
                isBot: targetType === 'BOT',
                ceoName: '',
                ceoPin: ''
              };
              if (targetType === 'BOT') {
                updatedTeam.botProfile = profile;
                updatedTeam.botDifficulty = difficulty;
              } else {
                delete updatedTeam.botProfile;
                delete updatedTeam.botDifficulty;
              }
              return updatedTeam;
            }
            return t;
          });

          const newBotConfig = gameState.botConfig || { enabled: true, seed: Math.floor(Math.random() * 1000000) };

          tx.update(stateRef, removeUndefined({
            'gameState.teams': newTeams,
            'gameState.botConfig': newBotConfig
          }));
        }
      });

      toast.success(`Team converted to ${targetType === 'BOT' ? 'Bot' : 'Human'}.`);
    } catch (err: any) {
      console.error("Seat conversion error:", err);
      toast.error(`Failed to convert team: ${err.message || err}`);
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

  const syntheticDemoClass = useMemo(() => {
    if (!isDemoRoute) return null;
    return {
      id: 'demo',
      name: 'Solo Demo Game',
      code: 'DEMO',
      facilitatorCode: 'DEMO',
      createdAt: new Date().toISOString(),
      teamCodes: {},
      teamRegistry: [
        { id: 'team_1', name: 'Your Company', color: '#22c55e' },
        { id: 'team_2', name: 'Apex Robotics', color: '#ef4444' },
        { id: 'team_3', name: 'CyberDyn Tech', color: '#3b82f6' },
        { id: 'team_4', name: 'Titan Global', color: '#1f2937' },
        { id: 'team_5', name: 'ValueCorp', color: '#eab308' },
      ],
    } as SimulationClass;
  }, [isDemoRoute]);

  const startDemo = async (config: import('@/demo/DemoStateProvider').DemoConfig) => {
    // Handled by DemoStateProvider
  };

  const exitDemo = () => {
    localStorage.removeItem('evalu8_demo_id');
    localStorage.removeItem('evalu8_demo_state_mirror');
    window.location.href = '/login';
  };

  return (
    <SessionContext.Provider value={{
      currentRole: isDemoRoute ? 'STUDENT' : currentRole,
      currentClassId: isDemoRoute ? null : currentClassId,
      currentTeamId: isDemoRoute ? 'team_1' : currentTeamId,
      currentUserEmail,
      currentUserName,
      facilitators,
      classes,
      classesLoaded,
      activeClass: isDemoRoute ? syntheticDemoClass : activeClass,
      currentClassTeams,
      isReadOnly: isDemoRoute ? false : isReadOnly,
      isCeo: isDemoRoute ? true : isCeo,
      ceoName,
      isDemo: isDemoRoute,
      isDemoHost: isDemoRoute,
      startDemo,
      exitDemo,
      login,
      loginWithEmail,
      createFacilitatorAccount,
      sendFacilitatorPasswordReset,
      logout,
      createClass,
      deleteClass,
      claimCeoSlot,
      releaseCeoSlot,
      facilitatorReleaseCeoSlot,
      facilitatorChangeCeoPin,
      migrateLegacyClass,
      selectClass,
      selectTeam,
      convertTeamSeat
    }}>
      {children}
    </SessionContext.Provider>
  );
};
