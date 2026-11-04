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
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, runTransaction, serverTimestamp, deleteField, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { SimulationClass, ClassTeam, UserRole, Team, GameState, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress, BotProfile, BotDifficulty, FacilitatorUser, SyndicateMarksConfig, ClassSeatDoc, ClassSecretsDoc, JoinCodeDoc } from '@/types/game';
import { toast } from 'sonner';
import { REGIONS, TECHNOLOGIES, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';
import { removeUndefined } from '@/lib/utils';
import { buildInitialGameState } from '@/lib/initialGameState';
import { DEFAULT_GAME_THEME_ID, GameThemeId } from '@/lib/gameTheme';
import { isDemoPathname } from '@/demo/useIsDemoRoute';
import { ensureSignedIn } from '@/demo/demoAuth';
import { generateJoinCode, hashCeoPin } from '@/lib/security';
import { splitGameState } from '@/lib/v2State';

export const MASTER_FACILITATOR_EMAIL = 'brian@learningsims.co.za';

interface SessionContextType {
  currentRole: UserRole | null;
  currentClassId: string | null;
  currentTeamId: string | null;
  currentUserEmail: string | null;
  currentUserName: string | null;
  authUid: string | null;
  isAuthReady: boolean;
  isMasterFacilitator: boolean;
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
  pauseFacilitatorAccount: (uid: string, email: string) => Promise<{ success: boolean; message?: string }>;
  resumeFacilitatorAccount: (uid: string, email: string) => Promise<{ success: boolean; message?: string }>;
  deleteFacilitatorAccount: (uid: string, email: string) => Promise<{ success: boolean; message?: string }>;
  sendFacilitatorPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  createClass: (name: string, teams: Team[], themeId?: GameThemeId) => Promise<string>;
  archiveClass: (classId: string) => Promise<void>;
  restoreClass: (classId: string) => Promise<void>;
  deleteClassPermanently: (classId: string) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  claimCeoSlot: (name: string, newPin?: string, currentPin?: string) => Promise<boolean>;
  releaseCeoSlot: () => Promise<void>;
  facilitatorReleaseCeoSlot: (classId: string, teamId: string) => Promise<void>;
  facilitatorChangeCeoPin: (classId: string, teamId: string, newPin: string) => Promise<void>;
  migrateLegacyClass: (classId: string) => Promise<boolean>;
  selectClass: (classId: string | null) => void;
  selectTeam: (teamId: string | null) => void;
  convertTeamSeat: (classId: string, teamId: string, targetType: 'HUMAN' | 'BOT', profile?: BotProfile, difficulty?: BotDifficulty) => Promise<void>;
  updateClassMarksConfig: (classId: string, config: SyndicateMarksConfig) => Promise<void>;
}

const SessionContext: React.Context<SessionContextType | undefined> =
  (globalThis as any).__EVALU8_SESSION_CONTEXT__ ||
  ((globalThis as any).__EVALU8_SESSION_CONTEXT__ = createContext<SessionContextType | undefined>(undefined));

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(() => {
    const savedEmail = localStorage.getItem('evalu8_user_email');
    if (savedEmail && savedEmail.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      return 'ADMIN';
    }
    return (localStorage.getItem('evalu8_role') as UserRole | null) || null;
  });
  const [currentClassId, setCurrentClassId] = useState<string | null>(
    () => localStorage.getItem('evalu8_class_id') || null
  );
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(
    () => localStorage.getItem('evalu8_team_id') || null
  );
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(localStorage.getItem('evalu8_user_email'));
  const [currentUserName, setCurrentUserName] = useState<string | null>(localStorage.getItem('evalu8_user_name'));
  const [authUid, setAuthUid] = useState<string | null>(
    auth.currentUser?.uid || localStorage.getItem('evalu8_anon_fallback_uid') || null
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [facilitators, setFacilitators] = useState<FacilitatorUser[]>([]);
  const [rawClasses, setRawClasses] = useState<SimulationClass[]>([]);
  const [classSecretsMap, setClassSecretsMap] = useState<Record<string, ClassSecretsDoc>>({});
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [classesLoadError, setClassesLoadError] = useState<any>(null);
  const [activeClass, setActiveClass] = useState<SimulationClass | null>(() => {
    try {
      const cached = localStorage.getItem('evalu8_active_class_cache');
      const savedClassId = localStorage.getItem('evalu8_class_id');
      if (cached && savedClassId) {
        const parsed = JSON.parse(cached) as SimulationClass;
        if (parsed && parsed.id === savedClassId) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [currentClassTeams, setCurrentClassTeams] = useState<Record<string, ClassTeam>>({});
  const [currentClassSeats, setCurrentClassSeats] = useState<Record<string, ClassSeatDoc>>({});
  const isDemoRoute = isDemoPathname();

  const isMasterFacilitator = useMemo(() => {
    return (currentUserEmail || '').trim().toLowerCase() === MASTER_FACILITATOR_EMAIL || currentRole === 'ADMIN';
  }, [currentUserEmail, currentRole]);

  // Enrich v2 classes in memory with their secrets/codes for facilitator/admin views
  const classes = useMemo(() => {
    return rawClasses.map((cls) => {
      if (cls.schemaVersion === 2 && classSecretsMap[cls.id]) {
        const secrets = classSecretsMap[cls.id];
        return {
          ...cls,
          viewerCode: secrets.viewerCode,
          facilitatorCode: secrets.viewerCode || cls.facilitatorCode || '',
          teamCodes: secrets.teamCodes || cls.teamCodes || {},
        };
      }
      return cls;
    });
  }, [rawClasses, classSecretsMap]);

  // CEO state from localStorage (used for legacy schemaVersion: 1 classes only)
  const [localCeoPin, setLocalCeoPin] = useState<string | null>(localStorage.getItem('evalu8_ceo_pin'));

  // Listen to Firebase Auth state
  useEffect(() => {
    const ensureMemberDocIfNeeded = async (
      uid: string,
      classId: string | null,
      role: UserRole | null,
      teamId: string | null,
      joinCode: string | null
    ) => {
      if (!uid || !classId || !joinCode || (role !== 'STUDENT' && role !== 'VIEWER')) return;
      const targetRole = role === 'STUDENT' ? 'team' : 'viewer';
      const syncKey = `${uid}:${classId}:${targetRole}:${teamId || ''}:${joinCode}`;
      if (sessionStorage.getItem('evalu8_member_synced_key') === syncKey) {
        return;
      }
      try {
        const memberRef = doc(db, 'classes', classId, 'members', uid);
        await setDoc(
          memberRef,
          removeUndefined({
            uid,
            role: targetRole,
            teamId: targetRole === 'team' ? teamId || undefined : undefined,
            code: joinCode,
            joinedAt: new Date().toISOString(),
          })
        );
        sessionStorage.setItem('evalu8_member_synced_key', syncKey);
      } catch {}
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const savedRole = localStorage.getItem('evalu8_role') as UserRole | null;
      const savedClassId = localStorage.getItem('evalu8_class_id');
      const savedTeamId = localStorage.getItem('evalu8_team_id');
      const savedJoinCode = localStorage.getItem('evalu8_join_code');
      const isGuestEmail = Boolean(user?.email?.endsWith('@session.evalu8smart.local'));

      if (!user && (savedRole === 'STUDENT' || savedRole === 'VIEWER')) {
        try {
          const uid = await ensureSignedIn();
          setAuthUid(uid);
          await ensureMemberDocIfNeeded(uid, savedClassId, savedRole, savedTeamId, savedJoinCode);
        } catch {}
        setIsAuthReady(true);
        return;
      }

      const resolvedUid = user?.uid || localStorage.getItem('evalu8_anon_fallback_uid') || null;
      setAuthUid(resolvedUid);

      if (user?.isAnonymous || isGuestEmail) {
        await ensureMemberDocIfNeeded(user!.uid, savedClassId, savedRole, savedTeamId, savedJoinCode);
        setIsAuthReady(true);
        return;
      }

      if (user) {
        const emailLower = (user.email || '').trim().toLowerCase();
        if (savedRole !== 'STUDENT' && savedRole !== 'VIEWER') {
          setCurrentUserEmail(user.email);
          localStorage.setItem('evalu8_user_email', user.email || '');
          if (emailLower === MASTER_FACILITATOR_EMAIL) {
            setCurrentRole('ADMIN');
            localStorage.setItem('evalu8_role', 'ADMIN');
            if (!localStorage.getItem('evalu8_user_name')) {
              setCurrentUserName('Brian Simelane (Master Facilitator)');
              localStorage.setItem('evalu8_user_name', 'Brian Simelane (Master Facilitator)');
            }
          }
        }
      } else if (!localStorage.getItem('evalu8_role')) {
        setCurrentUserEmail(null);
        setCurrentUserName(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to facilitators collection in Firestore when signed in as staff
  useEffect(() => {
    if (isDemoRoute || !authUid || (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN')) return;

    const unsubscribe = onSnapshot(collection(db, 'facilitators'), (snapshot) => {
      const list: FacilitatorUser[] = [];
      let hasMaster = false;
      snapshot.forEach((docSnap) => {
        const data = { uid: docSnap.id, ...docSnap.data() } as FacilitatorUser;
        if (data.email?.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
          hasMaster = true;
          list.push({
            ...data,
            name: data.name || 'Brian Simelane',
            role: 'ADMIN',
            status: 'ACTIVE',
            isMaster: true
          });
        } else {
          list.push({
            ...data,
            status: data.status || 'ACTIVE'
          });
        }
      });

      if (!hasMaster) {
        list.unshift({
          uid: 'admin_brian_simelane',
          name: 'Brian Simelane',
          email: MASTER_FACILITATOR_EMAIL,
          role: 'ADMIN',
          status: 'ACTIVE',
          isMaster: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          gamesCreatedCount: 0
        });
      } else {
        // Keep Master Facilitator at top of list
        list.sort((a, b) => {
          if (a.email?.toLowerCase() === MASTER_FACILITATOR_EMAIL) return -1;
          if (b.email?.toLowerCase() === MASTER_FACILITATOR_EMAIL) return 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
      }

      setFacilitators(list);
    }, (error) => {
      console.error('Error fetching facilitators:', error);
    });

    return () => unsubscribe();
  }, [isDemoRoute, authUid, currentRole]);

  // Real-time check: if a logged-in facilitator is paused or deleted by Master Facilitator, log them out
  useEffect(() => {
    if (isDemoRoute || !currentUserEmail || currentRole !== 'FACILITATOR') return;
    const emailLower = currentUserEmail.trim().toLowerCase();
    if (emailLower === MASTER_FACILITATOR_EMAIL) return;

    const match = facilitators.find(f => f.email?.trim().toLowerCase() === emailLower);
    if (match && match.status === 'PAUSED') {
      toast.error('Your facilitator account has been paused by the Master Facilitator.');
      logout();
    }
  }, [facilitators, currentUserEmail, currentRole, isDemoRoute]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const role = localStorage.getItem('evalu8_role') as UserRole | null;
    const classId = localStorage.getItem('evalu8_class_id');
    const teamId = localStorage.getItem('evalu8_team_id');
    const userEmail = localStorage.getItem('evalu8_user_email');
    const userName = localStorage.getItem('evalu8_user_name');

    if (userEmail && userEmail.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      setCurrentRole('ADMIN');
      localStorage.setItem('evalu8_role', 'ADMIN');
      if (classId) setCurrentClassId(classId);
      if (teamId) setCurrentTeamId(teamId);
      setCurrentUserEmail(userEmail);
      setCurrentUserName(userName || 'Brian Simelane (Master Facilitator)');
      return;
    }

    if (role) {
      setCurrentRole(role);
      if (classId) setCurrentClassId(classId);
      if (teamId) setCurrentTeamId(teamId);
      if (userEmail) setCurrentUserEmail(userEmail);
      if (userName) setCurrentUserName(userName);
      if (role === 'STUDENT' || role === 'VIEWER') {
        ensureSignedIn()
          .then((uid) => setAuthUid(uid))
          .catch(() => {});
      }
    }
  }, []);

  // Listen to classes identity collection in Firestore ONLY for facilitators/admin
  useEffect(() => {
    if (isDemoRoute) {
      setClassesLoaded(true);
      return;
    }

    if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') {
      setClassesLoaded(true);
      return;
    }

    if (!authUid) {
      return;
    }

    if (isMasterFacilitator) {
      const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
        const classList: SimulationClass[] = [];
        snapshot.forEach((docSnap) => {
          classList.push({ id: docSnap.id, ...docSnap.data() } as SimulationClass);
        });
        setRawClasses(classList);
        setClassesLoaded(true);
      }, (error) => {
        console.error('Error fetching classes:', error);
        setClassesLoadError(error);
        setClassesLoaded(true);
      });
      return () => unsubscribe();
    }

    // Standard facilitator: subscribe to owned v2 classes + legacy v1 classes
    let ownedMap: Record<string, SimulationClass> = {};
    let legacyMap: Record<string, SimulationClass> = {};

    const syncMerged = () => {
      const merged = { ...legacyMap, ...ownedMap };
      setRawClasses(Object.values(merged));
      setClassesLoaded(true);
    };

    const unsubOwned = onSnapshot(
      query(collection(db, 'classes'), where('ownerUid', '==', authUid)),
      (snapshot) => {
        ownedMap = {};
        snapshot.forEach((docSnap) => {
          ownedMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as SimulationClass;
        });
        syncMerged();
      },
      (error) => {
        console.error('Error fetching owned classes:', error);
        setClassesLoadError(error);
        setClassesLoaded(true);
      }
    );

    const unsubLegacy = onSnapshot(
      query(collection(db, 'classes'), where('schemaVersion', '==', 1)),
      (snapshot) => {
        legacyMap = {};
        snapshot.forEach((docSnap) => {
          legacyMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as SimulationClass;
        });
        syncMerged();
      },
      (error) => {
        console.warn('Error fetching legacy classes:', error);
        syncMerged();
      }
    );

    return () => {
      unsubOwned();
      unsubLegacy();
    };
  }, [isDemoRoute, currentRole, authUid, isMasterFacilitator]);

  // Subscribe to secrets/codes for v2 classes when logged in as facilitator/admin
  useEffect(() => {
    if (isDemoRoute || (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') || !authUid) {
      setClassSecretsMap({});
      return;
    }

    const v2ClassIds = rawClasses.filter(c => c.schemaVersion === 2).map(c => c.id);
    if (v2ClassIds.length === 0) return;

    const unsubs = v2ClassIds.map((clsId) =>
      onSnapshot(
        doc(db, 'classes', clsId, 'secrets', 'codes'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ClassSecretsDoc;
            setClassSecretsMap(prev => ({ ...prev, [clsId]: data }));
          }
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach(u => u());
    };
  }, [isDemoRoute, currentRole, authUid, rawClasses.map(c => `${c.id}:${c.schemaVersion}`).join(',')]);

  // Listen to active class seats (v2) or teams (v1) subcollection in Firestore
  useEffect(() => {
    if (isDemoRoute || !currentClassId || !isAuthReady) {
      if (!currentClassId || isDemoRoute) {
        setCurrentClassTeams({});
        setCurrentClassSeats({});
      }
      return;
    }

    if (activeClass?.schemaVersion === 2) {
      if (currentRole === 'VIEWER') {
        const teamsMap: Record<string, ClassTeam> = {};
        (activeClass.teamRegistry || []).forEach((regTeam) => {
          teamsMap[regTeam.id] = { ...regTeam, ceoName: '', ceoPin: '' };
        });
        setCurrentClassTeams(teamsMap);
        return;
      }

      if (currentRole === 'STUDENT') {
        if (!currentTeamId) return;
        const unsubscribeMySeat = onSnapshot(
          doc(db, 'classes', currentClassId, 'seats', currentTeamId),
          (docSnap) => {
            const seat = docSnap.exists() ? (docSnap.data() as ClassSeatDoc) : undefined;
            setCurrentClassSeats((prev) => {
              const next = { ...prev };
              if (seat) {
                next[currentTeamId] = seat;
              } else {
                delete next[currentTeamId];
              }
              return next;
            });
            const teamsMap: Record<string, ClassTeam> = {};
            (activeClass.teamRegistry || []).forEach((regTeam) => {
              const s = regTeam.id === currentTeamId ? seat : undefined;
              teamsMap[regTeam.id] = {
                ...regTeam,
                ceoName: s?.ceoName || '',
                ceoPin: s ? 'HASHED' : '',
              };
            });
            setCurrentClassTeams(teamsMap);
          },
          (error) => {
            console.warn('Error fetching student team seat doc:', error);
          }
        );
        return () => unsubscribeMySeat();
      }

      const unsubscribeSeats = onSnapshot(collection(db, 'classes', currentClassId, 'seats'), (snapshot) => {
        const seatsMap: Record<string, ClassSeatDoc> = {};
        snapshot.forEach((docSnap) => {
          seatsMap[docSnap.id] = docSnap.data() as ClassSeatDoc;
        });
        setCurrentClassSeats(seatsMap);

        const teamsMap: Record<string, ClassTeam> = {};
        (activeClass.teamRegistry || []).forEach((regTeam) => {
          const seat = seatsMap[regTeam.id];
          teamsMap[regTeam.id] = {
            ...regTeam,
            ceoName: seat?.ceoName || '',
            ceoPin: seat ? 'HASHED' : '',
          };
        });
        setCurrentClassTeams(teamsMap);
      }, (error) => {
        console.error('Error fetching class seats subcollection:', error);
      });

      return () => unsubscribeSeats();
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
  }, [
    currentClassId,
    currentRole,
    currentTeamId,
    isDemoRoute,
    isAuthReady,
    authUid,
    activeClass?.schemaVersion,
    (activeClass?.teamRegistry || []).map((t) => `${t.id}:${t.name}`).join(','),
  ]);

  // Sync active class details directly from document listener + classes array when currentClassId is set
  useEffect(() => {
    if (isDemoRoute || !currentClassId) {
      if (!isDemoRoute) {
        setActiveClass(null);
        localStorage.removeItem('evalu8_active_class_cache');
      }
      return;
    }

    const foundInList = classes.find(c => c && c.id === currentClassId);
    if (foundInList) {
      setActiveClass(foundInList);
      try {
        localStorage.setItem('evalu8_active_class_cache', JSON.stringify(foundInList));
      } catch {}
    }

    if (!isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'classes', currentClassId), (docSnap) => {
      if (docSnap.exists()) {
        const clsData = { ...docSnap.data(), id: docSnap.id } as SimulationClass;
        const secrets = classSecretsMap[currentClassId];
        if (clsData.schemaVersion === 2 && secrets) {
          clsData.viewerCode = secrets.viewerCode;
          clsData.facilitatorCode = secrets.viewerCode || clsData.facilitatorCode || '';
          clsData.teamCodes = secrets.teamCodes || clsData.teamCodes || {};
        }
        setActiveClass(clsData);
        try {
          localStorage.setItem('evalu8_active_class_cache', JSON.stringify(clsData));
        } catch {}
      }
    }, (err) => {
      console.warn("Direct active class listener warning:", err);
    });

    return () => unsubscribe();
  }, [currentClassId, classes, classSecretsMap, isDemoRoute, isAuthReady, authUid]);

  // Derived state: CEO and Read-Only control
  const isV2Active = activeClass?.schemaVersion === 2;
  const currentSeatDoc = currentTeamId ? currentClassSeats[currentTeamId] : null;
  const currentTeamDoc = currentTeamId ? currentClassTeams[currentTeamId] : null;
  const activeTeam = currentTeamDoc || (activeClass?.gameState?.teams || []).find(t => t?.id === currentTeamId);

  const isCeo = isV2Active
    ? (currentRole === 'STUDENT' && !!currentSeatDoc && !!authUid && currentSeatDoc.ceoUid === authUid)
    : (currentRole === 'STUDENT' && !!activeTeam?.ceoPin && localCeoPin === activeTeam.ceoPin);
  const isReadOnly = (currentRole === 'STUDENT' && !isCeo) || currentRole === 'VIEWER';
  const ceoName = isV2Active
    ? (currentSeatDoc?.ceoName || null)
    : (activeTeam?.ceoName || null);

  // Track the CEO PIN that was successfully verified against DB (v1 only) or CEO UID (v2)
  const lastVerifiedCeoPinRef = useRef<string | null>(null);
  const wasV2CeoRef = useRef<boolean>(false);

  useEffect(() => {
    if (isV2Active) {
      if (isCeo) {
        wasV2CeoRef.current = true;
      } else if (wasV2CeoRef.current && currentRole === 'STUDENT') {
        wasV2CeoRef.current = false;
        toast.info("Your CEO seat was released or transferred.");
      }
      return;
    }
    if (currentRole === 'STUDENT' && localCeoPin && activeTeam?.ceoPin === localCeoPin) {
      lastVerifiedCeoPinRef.current = localCeoPin;
    }
  }, [isV2Active, isCeo, currentRole, localCeoPin, activeTeam?.ceoPin]);

  // Real-time CEO revocation alert for sitting CEO (v1 classes)
  useEffect(() => {
    if (!isV2Active && currentRole === 'STUDENT' && localCeoPin) {
      if (lastVerifiedCeoPinRef.current === localCeoPin && currentTeamDoc && currentTeamDoc.ceoPin !== localCeoPin) {
        toast.info("Your CEO access was changed by the facilitator.");
        localStorage.removeItem('evalu8_ceo_pin');
        localStorage.removeItem('evalu8_ceo_name');
        lastVerifiedCeoPinRef.current = null;
        setLocalCeoPin(null);
      }
    }
  }, [isV2Active, currentRole, localCeoPin, currentTeamDoc]);

  const login = async (code: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      return { success: false, message: 'Please enter an access code.' };
    }

    try {
      const uid = await ensureSignedIn();
      setAuthUid(uid);

      // 1. Check joinCodes/{trimmedCode} (schemaVersion: 2 classes)
      const joinSnap = await getDoc(doc(db, 'joinCodes', trimmedCode));
      if (joinSnap.exists()) {
        const joinData = joinSnap.data() as JoinCodeDoc;
        const { classId, kind, teamId } = joinData;

        // Create/update membership document first (authorized by joinCodes proof in firestore.rules)
        const syncKey = `${uid}:${classId}:${kind}:${teamId || ''}:${trimmedCode}`;
        if (sessionStorage.getItem('evalu8_member_synced_key') !== syncKey) {
          try {
            const memberRef = doc(db, 'classes', classId, 'members', uid);
            await setDoc(
              memberRef,
              removeUndefined({
                uid,
                role: kind,
                teamId: kind === 'team' ? teamId : undefined,
                code: trimmedCode,
                joinedAt: new Date().toISOString(),
              })
            );
            sessionStorage.setItem('evalu8_member_synced_key', syncKey);
          } catch (memberErr) {
            console.warn('Could not write class membership doc (continuing login):', memberErr);
          }
        }

        const classSnap = await getDoc(doc(db, 'classes', classId));
        if (!classSnap.exists() || classSnap.data()?.isArchived) {
          return { success: false, message: 'This class session is no longer active.' };
        }
        const loadedClass = { ...classSnap.data(), id: classSnap.id } as SimulationClass;
        try {
          localStorage.setItem('evalu8_active_class_cache', JSON.stringify(loadedClass));
        } catch {}

        if (kind === 'team' && teamId) {
          localStorage.setItem('evalu8_role', 'STUDENT');
          localStorage.setItem('evalu8_class_id', classId);
          localStorage.setItem('evalu8_team_id', teamId);
          localStorage.setItem('evalu8_join_code', trimmedCode);
          setActiveClass(loadedClass);
          setCurrentRole('STUDENT');
          setCurrentClassId(classId);
          setCurrentTeamId(teamId);
          setIsAuthReady(true);
          return { success: true, role: 'STUDENT' };
        }

        if (kind === 'viewer') {
          localStorage.setItem('evalu8_role', 'VIEWER');
          localStorage.setItem('evalu8_class_id', classId);
          localStorage.setItem('evalu8_viewer_code', trimmedCode);
          localStorage.setItem('evalu8_join_code', trimmedCode);
          localStorage.removeItem('evalu8_team_id');
          setActiveClass(loadedClass);
          setCurrentRole('VIEWER');
          setCurrentClassId(classId);
          setCurrentTeamId(null);
          setIsAuthReady(true);
          return { success: true, role: 'VIEWER' };
        }
      }

      // 2. Fallback for legacy schemaVersion: 1 classes (or unindexed classes)
      const legacySnap = await getDocs(collection(db, 'classes')).catch(() =>
        getDocs(query(collection(db, 'classes'), where('schemaVersion', '==', 1)))
      );
      const legacyClasses: SimulationClass[] = [];
      legacySnap.forEach((d) => {
        legacyClasses.push({ id: d.id, ...d.data() } as SimulationClass);
      });

      // Check legacy viewer / facilitatorCode (grants read-only VIEWER role on code entry)
      const classViewer = legacyClasses.find(
        c => !c.isArchived && (c.facilitatorCode?.toUpperCase() === trimmedCode || c.viewerCode?.toUpperCase() === trimmedCode)
      );
      if (classViewer) {
        localStorage.setItem('evalu8_role', 'VIEWER');
        localStorage.setItem('evalu8_class_id', classViewer.id);
        localStorage.setItem('evalu8_viewer_code', trimmedCode);
        localStorage.removeItem('evalu8_team_id');
        setActiveClass(classViewer);
        setCurrentRole('VIEWER');
        setCurrentClassId(classViewer.id);
        setCurrentTeamId(null);
        return { success: true, role: 'VIEWER' };
      }

      // Check legacy student team code
      for (const cls of legacyClasses) {
        if (cls.isArchived) continue;
        for (const [teamId, tCode] of Object.entries(cls.teamCodes || {})) {
          if (tCode.toUpperCase() !== 'BOT' && tCode.toUpperCase() === trimmedCode) {
            localStorage.setItem('evalu8_role', 'STUDENT');
            localStorage.setItem('evalu8_class_id', cls.id);
            localStorage.setItem('evalu8_team_id', teamId);
            setActiveClass(cls);
            setCurrentRole('STUDENT');
            setCurrentClassId(cls.id);
            setCurrentTeamId(teamId);
            return { success: true, role: 'STUDENT' };
          }
        }
      }
    } catch (err: any) {
      console.error('Error during code login:', err);
      if (err?.code === 'permission-denied') {
        return {
          success: false,
          message: 'Permission denied by Firestore rules. Ensure Anonymous Auth is enabled in Firebase Console.',
        };
      }
    }

    return { success: false, message: 'Invalid Access Code. Please try again.' };
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const isDefaultAdmin = trimmedEmail === MASTER_FACILITATOR_EMAIL;

    // Check if non-master facilitator is paused or deleted in our loaded facilitators list
    if (!isDefaultAdmin) {
      const existingFac = facilitators.find(f => f.email?.trim().toLowerCase() === trimmedEmail);
      if (existingFac && existingFac.status === 'PAUSED') {
        return {
          success: false,
          message: 'This facilitator account is currently paused (archived). Please contact the Master Facilitator (brian@learningsims.co.za).'
        };
      }
    }

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
              user = { uid: 'admin_brian_simelane', email: trimmedEmail, displayName: 'Brian Simelane (Master Facilitator)' };
            } else {
              throw authErr;
            }
          }
        } else if (isDefaultAdmin && password === 'Sizakele@1981') {
          user = { uid: 'admin_brian_simelane', email: trimmedEmail, displayName: 'Brian Simelane (Master Facilitator)' };
        } else {
          throw authErr;
        }
      }

      const userDocRef = doc(db, 'facilitators', user.uid);
      let role: UserRole = isDefaultAdmin ? 'ADMIN' : 'FACILITATOR';
      let name = user.displayName || (isDefaultAdmin ? 'Brian Simelane' : trimmedEmail.split('@')[0]);

      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data() as FacilitatorUser;
          if (!isDefaultAdmin && data.status === 'PAUSED') {
            await signOut(auth).catch(() => {});
            return {
              success: false,
              message: 'This facilitator account is currently paused (archived). Please contact the Master Facilitator (brian@learningsims.co.za).'
            };
          }
          role = isDefaultAdmin ? 'ADMIN' : (data.role || role);
          name = data.name || name;
          if (isDefaultAdmin && (data.role !== 'ADMIN' || !data.isMaster)) {
            await updateDoc(userDocRef, { role: 'ADMIN', isMaster: true, status: 'ACTIVE' }).catch(() => {});
          }
        } else if (isDefaultAdmin) {
          await setDoc(userDocRef, {
            uid: user.uid,
            name: 'Brian Simelane',
            email: trimmedEmail,
            role: 'ADMIN',
            status: 'ACTIVE',
            isMaster: true,
            createdAt: new Date().toISOString(),
            gamesCreatedCount: 0
          });
        } else {
          // Check if there is any facilitator doc by email (or if the account was deleted from Firestore)
          const matchingByEmail = facilitators.find(f => f.email?.trim().toLowerCase() === trimmedEmail);
          if (facilitators.length > 0 && !matchingByEmail) {
            await signOut(auth).catch(() => {});
            return {
              success: false,
              message: 'This facilitator account is not registered or has been removed. Please contact the Master Facilitator.'
            };
          }
          await setDoc(userDocRef, {
            uid: user.uid,
            name,
            email: trimmedEmail,
            role,
            status: 'ACTIVE',
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
        const name = 'Brian Simelane';
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
      let uid = '';
      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, defaultPassword);
        uid = userCred.user.uid;
      } catch (authErr: any) {
        // If user was previously created in Firebase Auth and then deleted from Firestore, allow re-activating/re-adding if password matches
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            const signInCred = await signInWithEmailAndPassword(secondaryAuth, trimmedEmail, defaultPassword);
            uid = signInCred.user.uid;
          } catch {
            await deleteApp(secondaryApp).catch(() => {});
            return {
              success: false,
              message: 'An account with this email already exists in Firebase Auth (or was previously registered with a different password). Use Reset Password or enter their previous password to re-register.'
            };
          }
        } else {
          await deleteApp(secondaryApp).catch(() => {});
          throw authErr;
        }
      }

      const isMaster = trimmedEmail === MASTER_FACILITATOR_EMAIL;
      const newFacilitator: FacilitatorUser = {
        uid,
        name: trimmedName,
        email: trimmedEmail,
        role: isMaster ? 'ADMIN' : 'FACILITATOR',
        status: 'ACTIVE',
        ...(isMaster ? { isMaster: true } : {}),
        createdAt: new Date().toISOString(),
        createdByEmail: currentUserEmail || MASTER_FACILITATOR_EMAIL,
        gamesCreatedCount: 0
      };

      await setDoc(doc(db, 'facilitators', uid), newFacilitator);
      await deleteApp(secondaryApp).catch(() => {});

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

  const pauseFacilitatorAccount = async (uid: string, email: string): Promise<{ success: boolean; message?: string }> => {
    if (email.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      return { success: false, message: 'The Master Facilitator account cannot be paused.' };
    }
    try {
      await updateDoc(doc(db, 'facilitators', uid), {
        status: 'PAUSED',
        pausedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (err: any) {
      console.error('Error pausing facilitator account:', err);
      return { success: false, message: err.message || 'Failed to pause facilitator account.' };
    }
  };

  const resumeFacilitatorAccount = async (uid: string, email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await updateDoc(doc(db, 'facilitators', uid), {
        status: 'ACTIVE',
        pausedAt: deleteField()
      });
      return { success: true };
    } catch (err: any) {
      console.error('Error resuming facilitator account:', err);
      return { success: false, message: err.message || 'Failed to restore facilitator account.' };
    }
  };

  const deleteFacilitatorAccount = async (uid: string, email: string): Promise<{ success: boolean; message?: string }> => {
    if (email.trim().toLowerCase() === MASTER_FACILITATOR_EMAIL) {
      return { success: false, message: 'The Master Facilitator account cannot be deleted.' };
    }
    try {
      await deleteDoc(doc(db, 'facilitators', uid));
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting facilitator account:', err);
      return { success: false, message: err.message || 'Failed to delete facilitator account.' };
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
    localStorage.removeItem('evalu8_join_code');
    localStorage.removeItem('evalu8_active_class_cache');
    localStorage.removeItem('evalu8_ceo_name');
    localStorage.removeItem('evalu8_ceo_pin');
    localStorage.removeItem('evalu8_user_email');
    localStorage.removeItem('evalu8_user_name');
    setCurrentRole(null);
    setCurrentClassId(null);
    setCurrentTeamId(null);
    setActiveClass(null);
    setCurrentUserEmail(null);
    setCurrentUserName(null);
    lastVerifiedCeoPinRef.current = null;
    setLocalCeoPin(null);
  };

  const createClass = async (name: string, teams: Team[], themeId: GameThemeId = DEFAULT_GAME_THEME_ID): Promise<string> => {
    const classId = `cls_${Date.now()}`;
    const ownerUid = auth.currentUser?.uid || authUid || '';
    const ownerEmail = (auth.currentUser?.email || currentUserEmail || MASTER_FACILITATOR_EMAIL).trim();
    const viewerCode = generateJoinCode(8);
    const teamCodes: Record<string, string> = {};
    const teamRegistry: ClassTeam[] = [];

    // Ensure teams have canonical team_1 ... team_N IDs
    const canonicalTeams: Team[] = teams.map((team, idx) => {
      const canonicalId = `team_${idx + 1}`;
      const isBot = !!team.isBot;
      if (isBot) {
        teamCodes[canonicalId] = 'BOT';
      } else {
        teamCodes[canonicalId] = generateJoinCode(8);
      }
      const regTeam: ClassTeam = {
        id: canonicalId,
        name: team.name,
        color: team.color,
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

    const initialGameState = buildInitialGameState(canonicalTeams, themeId);
    const { control, world, rounds } = splitGameState(initialGameState);

    const batch = writeBatch(db);

    // 1. Identity Document: classes/{classId} (NO teamCodes, facilitatorCode, or ceoPin on v2 class doc)
    const classDocRef = doc(db, 'classes', classId);
    batch.set(classDocRef, removeUndefined({
      id: classId,
      name,
      themeId,
      schemaVersion: 2,
      ownerUid,
      ownerEmail,
      teamRegistry,
      createdAt: new Date().toISOString(),
      createdByEmail: ownerEmail,
      createdByName: currentUserName || 'Facilitator'
    }));

    // 2. Facilitator-only Secrets Document: classes/{classId}/secrets/codes
    const secretsDocRef = doc(db, 'classes', classId, 'secrets', 'codes');
    batch.set(secretsDocRef, removeUndefined({
      viewerCode,
      teamCodes,
    }));

    // 3. Join Code Lookup Documents: joinCodes/{code}
    batch.set(doc(db, 'joinCodes', viewerCode), {
      classId,
      kind: 'viewer',
    });
    for (const [tId, tCode] of Object.entries(teamCodes)) {
      if (tCode && tCode !== 'BOT') {
        batch.set(doc(db, 'joinCodes', tCode), {
          classId,
          kind: 'team',
          teamId: tId,
        });
      }
    }

    // 4. Split Game State Documents: classes/{classId}/state/control & state/world & rounds/*
    batch.set(doc(db, 'classes', classId, 'state', 'control'), removeUndefined(control));
    batch.set(doc(db, 'classes', classId, 'state', 'world'), removeUndefined(world));
    for (const [rKey, rData] of Object.entries(rounds)) {
      batch.set(doc(db, 'classes', classId, 'rounds', String(rKey)), removeUndefined(rData));
    }

    await batch.commit();
    return classId;
  };

  const archiveClass = async (classId: string) => {
    await updateDoc(doc(db, 'classes', classId), {
      isArchived: true,
      archivedAt: new Date().toISOString()
    });
  };

  const restoreClass = async (classId: string) => {
    await updateDoc(doc(db, 'classes', classId), {
      isArchived: false,
      archivedAt: deleteField()
    });
  };

  const deleteClassPermanently = async (classId: string) => {
    try {
      const secretsSnap = await getDoc(doc(db, 'classes', classId, 'secrets', 'codes')).catch(() => null);
      const batch = writeBatch(db);
      if (secretsSnap && secretsSnap.exists()) {
        const secrets = secretsSnap.data() as ClassSecretsDoc;
        if (secrets.viewerCode) {
          batch.delete(doc(db, 'joinCodes', secrets.viewerCode));
        }
        for (const tCode of Object.values(secrets.teamCodes || {})) {
          if (tCode && tCode !== 'BOT') {
            batch.delete(doc(db, 'joinCodes', tCode));
          }
        }
        batch.delete(secretsSnap.ref);
      }
      batch.delete(doc(db, 'classes', classId, 'state', 'game'));
      batch.delete(doc(db, 'classes', classId, 'state', 'control'));
      batch.delete(doc(db, 'classes', classId, 'state', 'world'));

      for (const subcol of ['teams', 'seats', 'members', 'rounds', 'plans', 'actions']) {
        const snap = await getDocs(collection(db, 'classes', classId, subcol)).catch(() => null);
        snap?.forEach((d) => batch.delete(d.ref));
      }
      await batch.commit();
    } catch (err) {
      console.warn('Permanent delete subcollection cleanup warning:', err);
    }
    await deleteDoc(doc(db, 'classes', classId));
  };

  const deleteClass = async (classId: string) => {
    // Default to archive for safety
    await archiveClass(classId);
  };

  const claimCeoSlot = async (name: string, newPin?: string, currentPin?: string): Promise<boolean> => {
    try {
      if (!currentClassId || !currentTeamId) {
        console.warn("claimCeoSlot aborted: missing session variables", { currentClassId, currentTeamId });
        return false;
      }

      if (activeClass?.schemaVersion === 2) {
        const uid = await ensureSignedIn();
        setAuthUid(uid);
        const regTeam = (activeClass.teamRegistry || []).find(t => t.id === currentTeamId);
        if (regTeam?.isBot) {
          toast.error("Cannot claim CEO seat for an automated Bot team!");
          return false;
        }

        const seatRef = doc(db, 'classes', currentClassId, 'seats', currentTeamId);
        const seatSnap = await getDoc(seatRef);
        const trimmedName = name.trim();
        let nextPinHash = '';

        if (!seatSnap.exists()) {
          const pinToSet = (newPin || currentPin || '').trim();
          if (!pinToSet) {
            toast.error('Please enter a CEO PIN.');
            return false;
          }
          nextPinHash = await hashCeoPin(currentClassId, currentTeamId, pinToSet);
          await setDoc(seatRef, {
            ceoUid: uid,
            ceoName: trimmedName,
            pinHash: nextPinHash,
            updatedAt: new Date().toISOString(),
          });
        } else {
          const existingSeat = seatSnap.data() as ClassSeatDoc;
          const proofAttempt = (currentPin || newPin || '').trim();
          const pinHashProof = proofAttempt
            ? await hashCeoPin(currentClassId, currentTeamId, proofAttempt)
            : '';

          if (existingSeat.ceoUid !== uid && pinHashProof !== existingSeat.pinHash) {
            toast.error('This CEO seat is already claimed or PIN is invalid!');
            return false;
          }

          const nextPinRaw = (newPin || currentPin || '').trim();
          nextPinHash = nextPinRaw
            ? await hashCeoPin(currentClassId, currentTeamId, nextPinRaw)
            : existingSeat.pinHash;

          await updateDoc(seatRef, {
            ceoUid: uid,
            ceoName: trimmedName,
            pinHash: nextPinHash,
            pinHashProof,
            updatedAt: new Date().toISOString(),
          });
        }

        const updatedSeatDoc: ClassSeatDoc = {
          ceoUid: uid,
          ceoName: trimmedName,
          pinHash: nextPinHash,
          updatedAt: new Date().toISOString(),
        };
        setCurrentClassSeats((prev) => ({
          ...prev,
          [currentTeamId]: updatedSeatDoc,
        }));
        setCurrentClassTeams((prev) => {
          const baseTeam = prev[currentTeamId] || regTeam;
          if (!baseTeam) return prev;
          return {
            ...prev,
            [currentTeamId]: {
              ...baseTeam,
              ceoName: trimmedName,
              ceoPin: 'HASHED',
            },
          };
        });

        const tName = currentTeamDoc?.name || regTeam?.name || currentTeamId;
        toast.success(`You have claimed the CEO seat for team ${tName}!`);
        return true;
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

      // Save locally after successful transaction (legacy v1 only)
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

      if (activeClass?.schemaVersion === 2) {
        wasV2CeoRef.current = false;
        await deleteDoc(doc(db, 'classes', currentClassId, 'seats', currentTeamId));
        setCurrentClassSeats((prev) => {
          const next = { ...prev };
          delete next[currentTeamId];
          return next;
        });
        setCurrentClassTeams((prev) => {
          if (!prev[currentTeamId]) return prev;
          return {
            ...prev,
            [currentTeamId]: {
              ...prev[currentTeamId],
              ceoName: '',
              ceoPin: '',
            },
          };
        });
        toast.success(`CEO seat released.`);
        return;
      }

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
      const targetCls = classes.find(c => c.id === classId) || (activeClass?.id === classId ? activeClass : null);
      if (targetCls?.schemaVersion === 2) {
        await deleteDoc(doc(db, 'classes', classId, 'seats', teamId));
        toast.success(`CEO seat released.`);
        return;
      }

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
      const targetCls = classes.find(c => c.id === classId) || (activeClass?.id === classId ? activeClass : null);
      if (targetCls?.schemaVersion === 2) {
        const pinHash = await hashCeoPin(classId, teamId, newPin.trim());
        await updateDoc(doc(db, 'classes', classId, 'seats', teamId), {
          pinHash,
          updatedAt: new Date().toISOString(),
        });
        toast.success(`CEO PIN updated.`);
        return;
      }

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
      const classCheckSnap = await getDoc(classRef);
      if (!classCheckSnap.exists()) throw new Error("Class not found");
      const classCheckData = classCheckSnap.data() as SimulationClass;

      if (classCheckData.schemaVersion === 2) {
        const secretsRef = doc(db, 'classes', classId, 'secrets', 'codes');
        const worldRef = doc(db, 'classes', classId, 'state', 'world');
        const seatRef = doc(db, 'classes', classId, 'seats', teamId);

        await runTransaction(db, async (tx) => {
          const clsSnap = await tx.get(classRef);
          const secretsSnap = await tx.get(secretsRef);
          const worldSnap = await tx.get(worldRef);

          if (!clsSnap.exists()) throw new Error("Class not found");
          const clsData = clsSnap.data() as SimulationClass;
          const secretsData = (secretsSnap.exists() ? secretsSnap.data() : { viewerCode: '', teamCodes: {} }) as ClassSecretsDoc;
          const oldCode = secretsData.teamCodes?.[teamId];

          const newTeamCodes = { ...(secretsData.teamCodes || {}) };
          if (targetType === 'BOT') {
            newTeamCodes[teamId] = 'BOT';
            if (oldCode && oldCode !== 'BOT') {
              tx.delete(doc(db, 'joinCodes', oldCode));
            }
          } else {
            const newCode = generateJoinCode(8);
            newTeamCodes[teamId] = newCode;
            if (oldCode && oldCode !== 'BOT') {
              tx.delete(doc(db, 'joinCodes', oldCode));
            }
            tx.set(doc(db, 'joinCodes', newCode), {
              classId,
              kind: 'team',
              teamId,
            });
          }

          const newTeamRegistry = (clsData.teamRegistry || []).map(t => {
            if (t.id === teamId) {
              const updatedTeam: ClassTeam = {
                ...t,
                isBot: targetType === 'BOT',
              };
              delete updatedTeam.ceoName;
              delete updatedTeam.ceoPin;
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
            teamRegistry: newTeamRegistry,
          }));
          tx.set(secretsRef, removeUndefined({
            ...secretsData,
            teamCodes: newTeamCodes,
          }));
          tx.delete(seatRef);

          if (worldSnap.exists()) {
            const worldData = worldSnap.data() as any;
            const newTeams = (worldData.teams || []).map((t: Team) => {
              if (t.id === teamId) {
                const updatedTeam: Team = {
                  ...t,
                  isBot: targetType === 'BOT',
                };
                delete updatedTeam.ceoName;
                delete updatedTeam.ceoPin;
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
            const newBotConfig = worldData.botConfig || { enabled: true, seed: Math.floor(Math.random() * 1000000) };
            tx.update(worldRef, removeUndefined({
              teams: newTeams,
              botConfig: newBotConfig,
            }));
          }
        });

        toast.success(`Team converted to ${targetType === 'BOT' ? 'Bot' : 'Human'}.`);
        return;
      }

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

  const updateClassMarksConfig = async (classId: string, config: SyndicateMarksConfig) => {
    // Sanitize config to strip undefined properties before sending to Firestore
    const cleanConfig = JSON.parse(JSON.stringify(config));

    if (classId && !classId.startsWith('demo-')) {
      try {
        await updateDoc(doc(db, 'classes', classId), {
          syndicateMarksConfig: { ...cleanConfig, updatedAt: new Date().toISOString() },
        });
      } catch (err: any) {
        console.error("Failed to update class marks config in Firestore:", err);
        throw err;
      }
    }

    if (activeClass && activeClass.id === classId) {
      setActiveClass(prev => prev ? { ...prev, syndicateMarksConfig: cleanConfig } : null);
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
      const classExistsInList = classes.some(c => c.id === currentClassId);
      if (classes.length > 0 && !classExistsInList && !activeClass) {
        console.warn(`Class ${currentClassId} not found in classes list or activeClass. Clearing selection.`);
        if (currentRole === 'STUDENT') {
          logout();
        } else {
          selectClass(null);
          selectTeam(null);
        }
      }
    }
  }, [classesLoaded, classes, currentClassId, currentRole, classesLoadError, activeClass]);

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
      authUid,
      isAuthReady,
      isMasterFacilitator: isDemoRoute ? false : isMasterFacilitator,
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
      pauseFacilitatorAccount,
      resumeFacilitatorAccount,
      deleteFacilitatorAccount,
      sendFacilitatorPasswordReset,
      logout,
      createClass,
      archiveClass,
      restoreClass,
      deleteClassPermanently,
      deleteClass,
      claimCeoSlot,
      releaseCeoSlot,
      facilitatorReleaseCeoSlot,
      facilitatorChangeCeoPin,
      migrateLegacyClass,
      selectClass,
      selectTeam,
      convertTeamSeat,
      updateClassMarksConfig
    }}>
      {children}
    </SessionContext.Provider>
  );
};
