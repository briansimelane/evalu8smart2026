import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-evalu8smart2026';
const MASTER_EMAIL = 'brian@learningsims.co.za';

let testEnv: RulesTestEnvironment;

function parseHostPort(envVar: string | undefined, defaultHost: string, defaultPort: number) {
  if (!envVar) return { host: defaultHost, port: defaultPort };
  const [host, portStr] = envVar.split(':');
  return { host: host || defaultHost, port: Number(portStr) || defaultPort };
}

beforeAll(async () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');
  const { host, port } = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1', 8080);

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules,
    },
  });
}, 30000);

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedV2Class(classId = 'cls_v2') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'classes', classId), {
      id: classId,
      name: 'V2 Test Class',
      ownerUid: 'fac_owner',
      ownerEmail: 'owner@school.edu',
      schemaVersion: 2,
      createdAt: '2026-11-04T00:00:00.000Z',
      createdByName: 'Facilitator A',
      isArchived: false,
      teamLabelMode: 'name',
      teams: [
        { id: 'team_1', name: 'Red Team', color: '#ef4444', isBot: false, teamNumber: 1 },
        { id: 'team_2', name: 'Blue Team', color: '#3b82f6', isBot: false, teamNumber: 2 },
      ],
    });

    await setDoc(doc(db, 'classes', classId, 'secrets', 'codes'), {
      viewerCode: 'VIEW2345',
      teamCodes: {
        team_1: 'RED23456',
        team_2: 'BLU23456',
      },
    });

    await setDoc(doc(db, 'joinCodes', 'VIEW2345'), {
      classId,
      kind: 'viewer',
    });
    await setDoc(doc(db, 'joinCodes', 'RED23456'), {
      classId,
      kind: 'team',
      teamId: 'team_1',
    });
    await setDoc(doc(db, 'joinCodes', 'BLU23456'), {
      classId,
      kind: 'team',
      teamId: 'team_2',
    });

    // Seed members for student_1 (team_1), student_2 (team_2), and viewer_1
    await setDoc(doc(db, 'classes', classId, 'members', 'student_1'), {
      uid: 'student_1',
      role: 'team',
      teamId: 'team_1',
      code: 'RED23456',
      joinedAt: '2026-11-04T00:00:00.000Z',
    });
    await setDoc(doc(db, 'classes', classId, 'members', 'student_2'), {
      uid: 'student_2',
      role: 'team',
      teamId: 'team_2',
      code: 'BLU23456',
      joinedAt: '2026-11-04T00:00:00.000Z',
    });
    await setDoc(doc(db, 'classes', classId, 'members', 'viewer_1'), {
      uid: 'viewer_1',
      role: 'viewer',
      code: 'VIEW2345',
      joinedAt: '2026-11-04T00:00:00.000Z',
    });

    // Seed CEO seats for team_1 and team_2
    await setDoc(doc(db, 'classes', classId, 'seats', 'team_1'), {
      ceoUid: 'student_1',
      ceoName: 'Alice CEO',
      pinHash: 'hash_pin_1234',
      updatedAt: '2026-11-04T00:00:00.000Z',
    });
    await setDoc(doc(db, 'classes', classId, 'seats', 'team_2'), {
      ceoUid: 'student_2',
      ceoName: 'Bob CEO',
      pinHash: 'hash_pin_5678',
      updatedAt: '2026-11-04T00:00:00.000Z',
    });

    // Seed state/control and state/world
    await setDoc(doc(db, 'classes', classId, 'state', 'control'), {
      currentRound: 1,
      currentPhase: 'planning',
      gameEnded: false,
      stateVersion: 1,
      turn: {
        round: 1,
        phase: 'planning',
        order: ['team_1', 'team_2'],
        index: 0,
      },
      updatedAt: '2026-11-04T00:00:00.000Z',
    });

    await setDoc(doc(db, 'classes', classId, 'state', 'world'), {
      technologies: {},
      patents: {},
      regionLogistics: {},
      teamResearchProgress: {},
      teamLogisticsProgress: {},
      improvementCards: [],
      improvementPoolByRound: {},
      researchAllocatedByRound: {},
      logisticsAllocatedByRound: {},
    });

    await setDoc(doc(db, 'classes', classId, 'rounds', '1'), {
      roundNumber: 1,
      teamData: {
        team_1: {
          teamId: 'team_1',
          combination: 1,
          position: 1,
          price: 6,
          productsProduced: 4,
          improvementCards: 1,
          researchIcons: 2,
          logisticsIcons: 2,
          revenue: 0,
          technologiesResearched: [],
          expansionLocations: [],
          salesByRegion: {},
          regionControlPoints: {},
          controlValue: 0,
          totalMoney: 0,
        },
        team_2: {
          teamId: 'team_2',
          combination: 2,
          position: 1,
          price: 5,
          productsProduced: 3,
          improvementCards: 1,
          researchIcons: 1,
          logisticsIcons: 3,
          revenue: 0,
          technologiesResearched: [],
          expansionLocations: [],
          salesByRegion: {},
          regionControlPoints: {},
          controlValue: 0,
          totalMoney: 0,
        },
      },
    });
  });
}

describe('Firestore Security Rules Matrix (Section 9)', () => {
  describe('Phase 1: Identity, Secrets, and Legacy Isolation', () => {
    it('denies unauthenticated read or write of any v2 document', async () => {
      await seedV2Class('cls_v2');
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(getDoc(doc(unauthDb, 'classes', 'cls_v2')));
      await assertFails(getDoc(doc(unauthDb, 'classes', 'cls_v2', 'state', 'control')));
      await assertFails(getDoc(doc(unauthDb, 'classes', 'cls_v2', 'secrets', 'codes')));
      await assertFails(getDoc(doc(unauthDb, 'joinCodes', 'RED23456')));
      await assertFails(
        setDoc(doc(unauthDb, 'classes', 'cls_v2'), { name: 'Hacked' }, { merge: true })
      );
    });

    it('denies signed-in user listing classes unconstrained, allows owner-constrained list', async () => {
      await seedV2Class('cls_v2');
      const studentDb = testEnv.authenticatedContext('student_1').firestore();
      const ownerDb = testEnv.authenticatedContext('fac_owner', { email: 'owner@school.edu' }).firestore();

      // Unconstrained collection scan must fail
      await assertFails(getDocs(collection(studentDb, 'classes')));
      await assertFails(getDocs(collection(ownerDb, 'classes')));

      // Constrained query for owner succeeds
      const ownerQuery = query(collection(ownerDb, 'classes'), where('ownerUid', '==', 'fac_owner'));
      await assertSucceeds(getDocs(ownerQuery));
    });

    it('allows signed-in user to get joinCodes/{code} but denies listing joinCodes', async () => {
      await seedV2Class('cls_v2');
      const anonDb = testEnv.authenticatedContext('anon_user').firestore();

      await assertSucceeds(getDoc(doc(anonDb, 'joinCodes', 'RED23456')));
      await assertFails(getDocs(collection(anonDb, 'joinCodes')));
    });

    it('denies joining with a wrong team code and allows joining with a valid team code', async () => {
      await seedV2Class('cls_v2');
      const joinerDb = testEnv.authenticatedContext('new_student').firestore();

      // Wrong code
      await assertFails(
        setDoc(doc(joinerDb, 'classes', 'cls_v2', 'members', 'new_student'), {
          uid: 'new_student',
          role: 'team',
          teamId: 'team_1',
          code: 'WRONGCOD',
          joinedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Right code for team_2 claimed as team_1 -> denied
      await assertFails(
        setDoc(doc(joinerDb, 'classes', 'cls_v2', 'members', 'new_student'), {
          uid: 'new_student',
          role: 'team',
          teamId: 'team_1',
          code: 'BLU23456',
          joinedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Valid team_1 code -> allowed
      await assertSucceeds(
        setDoc(doc(joinerDb, 'classes', 'cls_v2', 'members', 'new_student'), {
          uid: 'new_student',
          role: 'team',
          teamId: 'team_1',
          code: 'RED23456',
          joinedAt: '2026-11-04T00:00:00.000Z',
        })
      );
    });

    it('denies student reading secrets/codes', async () => {
      await seedV2Class('cls_v2');
      const studentDb = testEnv.authenticatedContext('student_1').firestore();
      const ownerDb = testEnv.authenticatedContext('fac_owner').firestore();

      await assertFails(getDoc(doc(studentDb, 'classes', 'cls_v2', 'secrets', 'codes')));
      await assertSucceeds(getDoc(doc(ownerDb, 'classes', 'cls_v2', 'secrets', 'codes')));
    });

    it('denies student writing state/control, state/world, rounds/*, or classes/{c}', async () => {
      await seedV2Class('cls_v2');
      const studentDb = testEnv.authenticatedContext('student_1').firestore();

      await assertFails(
        updateDoc(doc(studentDb, 'classes', 'cls_v2', 'state', 'control'), { currentPhase: 'sales' })
      );
      await assertFails(
        updateDoc(doc(studentDb, 'classes', 'cls_v2', 'state', 'world'), { patents: { GPS: 'team_1' } })
      );
      await assertFails(
        updateDoc(doc(studentDb, 'classes', 'cls_v2', 'rounds', '1'), { roundNumber: 1 })
      );
      await assertFails(
        updateDoc(doc(studentDb, 'classes', 'cls_v2'), { name: 'Student Renamed' })
      );
    });

    it('denies Facilitator B writing Facilitator A class', async () => {
      await seedV2Class('cls_v2');
      const facBDb = testEnv.authenticatedContext('fac_other', { email: 'other@school.edu' }).firestore();

      await assertFails(updateDoc(doc(facBDb, 'classes', 'cls_v2'), { name: 'Hijacked' }));
      await assertFails(
        updateDoc(doc(facBDb, 'classes', 'cls_v2', 'state', 'control'), { currentPhase: 'sales' })
      );
      await assertFails(getDoc(doc(facBDb, 'classes', 'cls_v2', 'secrets', 'codes')));
    });

    it('enforces CEO seat takeover pinHashProof check', async () => {
      await seedV2Class('cls_v2');
      // Another student on team_1 tries to take over the seat
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'members', 'student_1b'), {
          uid: 'student_1b',
          role: 'team',
          teamId: 'team_1',
          code: 'RED23456',
          joinedAt: '2026-11-04T00:00:00.000Z',
        });
      });

      const student1bDb = testEnv.authenticatedContext('student_1b').firestore();

      // Takeover with wrong pinHashProof -> denied
      await assertFails(
        setDoc(doc(student1bDb, 'classes', 'cls_v2', 'seats', 'team_1'), {
          ceoUid: 'student_1b',
          ceoName: 'Eve Takeover',
          pinHash: 'hash_pin_9999',
          pinHashProof: 'wrong_hash',
          updatedAt: '2026-11-04T00:01:00.000Z',
        })
      );

      // Takeover with matching pinHashProof -> allowed
      await assertSucceeds(
        setDoc(doc(student1bDb, 'classes', 'cls_v2', 'seats', 'team_1'), {
          ceoUid: 'student_1b',
          ceoName: 'Valid Takeover',
          pinHash: 'hash_pin_1234',
          pinHashProof: 'hash_pin_1234',
          updatedAt: '2026-11-04T00:01:00.000Z',
        })
      );
    });

    it('denies user writing their own facilitators/{uid} with role ADMIN', async () => {
      const regularFacDb = testEnv
        .authenticatedContext('fac_regular', { email: 'teacher@school.edu', email_verified: true })
        .firestore();

      await assertFails(
        setDoc(doc(regularFacDb, 'facilitators', 'fac_regular'), {
          uid: 'fac_regular',
          name: 'Teacher',
          email: 'teacher@school.edu',
          role: 'ADMIN',
          status: 'ACTIVE',
          createdAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Self-registration as FACILITATOR is allowed
      await assertSucceeds(
        setDoc(doc(regularFacDb, 'facilitators', 'fac_regular'), {
          uid: 'fac_regular',
          name: 'Teacher',
          email: 'teacher@school.edu',
          role: 'FACILITATOR',
          status: 'ACTIVE',
          createdAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Master admin with verified email can write ADMIN
      const masterDb = testEnv
        .authenticatedContext('master_uid', { email: MASTER_EMAIL, email_verified: true })
        .firestore();
      await assertSucceeds(
        setDoc(doc(masterDb, 'facilitators', 'master_uid'), {
          uid: 'master_uid',
          name: 'Brian Simelane',
          email: MASTER_EMAIL,
          role: 'ADMIN',
          status: 'ACTIVE',
          isMaster: true,
          createdAt: '2026-11-04T00:00:00.000Z',
        })
      );
    });

    it('denies viewer writing anything while allowing reads of class, control, world, and rounds', async () => {
      await seedV2Class('cls_v2');
      const viewerDb = testEnv.authenticatedContext('viewer_1').firestore();

      await assertSucceeds(getDoc(doc(viewerDb, 'classes', 'cls_v2')));
      await assertSucceeds(getDoc(doc(viewerDb, 'classes', 'cls_v2', 'state', 'control')));
      await assertSucceeds(getDoc(doc(viewerDb, 'classes', 'cls_v2', 'state', 'world')));
      await assertSucceeds(getDoc(doc(viewerDb, 'classes', 'cls_v2', 'rounds', '1')));

      await assertFails(
        updateDoc(doc(viewerDb, 'classes', 'cls_v2', 'state', 'control'), { currentPhase: 'sales' })
      );
      await assertFails(
        setDoc(doc(viewerDb, 'classes', 'cls_v2', 'plans', '1_team_1'), {
          round: 1,
          teamId: 'team_1',
          combination: 1,
          position: 1,
          price: 5,
          productsProduced: 3,
          improvementCards: 1,
          researchIcons: 1,
          logisticsIcons: 3,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );
    });

    it('keeps legacy (schemaVersion: 1) classes readable and writable as before', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'classes', 'cls_legacy'), {
          id: 'cls_legacy',
          name: 'Legacy Class',
          schemaVersion: 1,
          facilitatorCode: 'FAC-1234',
          teamCodes: { team_1: 'TM1-ABCD' },
          teamRegistry: [],
          createdAt: '2026-10-01T00:00:00.000Z',
        });
        await setDoc(doc(db, 'classes', 'cls_legacy', 'state', 'game'), {
          gameState: { currentRound: 1, currentPhase: 'planning' },
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(unauthDb, 'classes', 'cls_legacy')));
      await assertSucceeds(getDoc(doc(unauthDb, 'classes', 'cls_legacy', 'state', 'game')));
      await assertSucceeds(
        updateDoc(doc(unauthDb, 'classes', 'cls_legacy', 'state', 'game'), {
          'gameState.currentPhase': 'innovation',
        })
      );
      const legacyQuery = query(collection(unauthDb, 'classes'), where('schemaVersion', '==', 1));
      await assertSucceeds(getDocs(legacyQuery));
    });
  });

  describe('Phase 3: Plans, Turn Order, and Actions Enforcement', () => {
    it('hides team B plan from team A before reveal, and allows reading after reveal', async () => {
      await seedV2Class('cls_v2');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'plans', '1_team_2'), {
          round: 1,
          teamId: 'team_2',
          combination: 2,
          position: 1,
          price: 5,
          productsProduced: 3,
          improvementCards: 1,
          researchIcons: 1,
          logisticsIcons: 3,
          submittedAt: '2026-11-04T00:00:00.000Z',
        });
      });

      const team1Db = testEnv.authenticatedContext('student_1').firestore();
      const team2Db = testEnv.authenticatedContext('student_2').firestore();
      const ownerDb = testEnv.authenticatedContext('fac_owner').firestore();

      // During round 1 planning: team 2 and owner can read 1_team_2, team 1 cannot
      await assertSucceeds(getDoc(doc(team2Db, 'classes', 'cls_v2', 'plans', '1_team_2')));
      await assertSucceeds(getDoc(doc(ownerDb, 'classes', 'cls_v2', 'plans', '1_team_2')));
      await assertFails(getDoc(doc(team1Db, 'classes', 'cls_v2', 'plans', '1_team_2')));

      // Advance phase past planning -> reveal!
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'state', 'control'), {
          currentPhase: 'improvement',
        });
      });

      await assertSucceeds(getDoc(doc(team1Db, 'classes', 'cls_v2', 'plans', '1_team_2')));
      await assertSucceeds(getDoc(doc(team1Db, 'classes', 'cls_v2', 'rounds', '1')));
    });

    it('denies team A writing team B plan or action, and denies plan write outside planning phase', async () => {
      await seedV2Class('cls_v2');
      const team1Db = testEnv.authenticatedContext('student_1').firestore();

      // Team 1 CEO writing own plan during planning -> allowed
      await assertSucceeds(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'plans', '1_team_1'), {
          round: 1,
          teamId: 'team_1',
          combination: 1,
          position: 1,
          price: 6,
          productsProduced: 4,
          improvementCards: 1,
          researchIcons: 2,
          logisticsIcons: 2,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Team 1 writing Team 2's plan -> denied
      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'plans', '1_team_2'), {
          round: 1,
          teamId: 'team_2',
          combination: 1,
          position: 1,
          price: 6,
          productsProduced: 4,
          improvementCards: 1,
          researchIcons: 2,
          logisticsIcons: 2,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Move phase to innovation -> plan write denied
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'state', 'control'), {
          currentPhase: 'innovation',
          turn: { round: 1, phase: 'innovation', order: ['team_1', 'team_2'], index: 0 },
        });
      });

      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'plans', '1_team_1'), {
          round: 1,
          teamId: 'team_1',
          combination: 2,
          position: 2,
          price: 5,
          productsProduced: 3,
          improvementCards: 1,
          researchIcons: 1,
          logisticsIcons: 3,
          submittedAt: '2026-11-04T00:01:00.000Z',
        })
      );
    });

    it('enforces turn order, single submission, key whitelist, allowance bounds, and no student update/delete on actions', async () => {
      await seedV2Class('cls_v2');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'state', 'control'), {
          currentRound: 1,
          currentPhase: 'innovation',
          turn: { round: 1, phase: 'innovation', order: ['team_1', 'team_2'], index: 0 },
        });
      });

      const team1Db = testEnv.authenticatedContext('student_1').firestore();
      const team2Db = testEnv.authenticatedContext('student_2').firestore();

      // Out of turn (team_2 tries when index == 0 is team_1) -> denied
      await assertFails(
        setDoc(doc(team2Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_2'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_2',
          payload: { allocations: { GPS: 1 } },
          total: 1,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Over allowance (team_1 has researchIcons == 2, tries total: 3) -> denied
      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { GPS: 3 } },
          total: 3,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Extra keys or pre-setting status -> denied
      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { GPS: 2 } },
          total: 2,
          status: 'applied',
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Mismatched document ID -> denied
      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_sales_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { GPS: 2 } },
          total: 2,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Valid in-turn, within-allowance action -> allowed
      await assertSucceeds(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { GPS: 2 } },
          total: 2,
          submittedAt: '2026-11-04T00:00:00.000Z',
        })
      );

      // Second action for same team, phase, round -> denied (create-only)
      await assertFails(
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { Wifi: 2 } },
          total: 2,
          submittedAt: '2026-11-04T00:01:00.000Z',
        })
      );

      // Student update or delete of action -> denied
      await assertFails(
        updateDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          total: 1,
        })
      );
      await assertFails(deleteDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1')));

      // Owner can update status (referee resolution)
      const ownerDb = testEnv.authenticatedContext('fac_owner').firestore();
      await assertSucceeds(
        updateDoc(doc(ownerDb, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          status: 'applied',
          resolvedAt: '2026-11-04T00:02:00.000Z',
        })
      );
    });

    it('allows only one team when two teams submit simultaneously and only one has the turn', async () => {
      await seedV2Class('cls_v2');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'classes', 'cls_v2', 'state', 'control'), {
          currentRound: 1,
          currentPhase: 'sales',
          turn: { round: 1, phase: 'sales', order: ['team_1', 'team_2'], index: 0 },
        });
      });

      const team1Db = testEnv.authenticatedContext('student_1').firestore();
      const team2Db = testEnv.authenticatedContext('student_2').firestore();

      const results = await Promise.allSettled([
        setDoc(doc(team1Db, 'classes', 'cls_v2', 'actions', '1_sales_team_1'), {
          round: 1,
          phase: 'sales',
          teamId: 'team_1',
          payload: { customersSold: ['usa-p1'], nfcSalesUnits: 0 },
          total: 1,
          submittedAt: '2026-11-04T00:00:00.000Z',
        }),
        setDoc(doc(team2Db, 'classes', 'cls_v2', 'actions', '1_sales_team_2'), {
          round: 1,
          phase: 'sales',
          teamId: 'team_2',
          payload: { customersSold: ['usa-p1'], nfcSalesUnits: 0 },
          total: 1,
          submittedAt: '2026-11-04T00:00:00.000Z',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });

    it('resolves an action exactly once when two facilitator tabs run referee transactions concurrently', async () => {
      await seedV2Class('cls_v2');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await updateDoc(doc(db, 'classes', 'cls_v2', 'state', 'control'), {
          currentRound: 1,
          currentPhase: 'innovation',
          stateVersion: 1,
          turn: { round: 1, phase: 'innovation', order: ['team_1', 'team_2'], index: 0 },
        });
        await setDoc(doc(db, 'classes', 'cls_v2', 'actions', '1_innovation_team_1'), {
          round: 1,
          phase: 'innovation',
          teamId: 'team_1',
          payload: { allocations: { GPS: 2 } },
          total: 2,
          submittedAt: '2026-11-04T00:00:00.000Z',
        });
      });

      const ownerTab1Db = testEnv.authenticatedContext('fac_owner').firestore();
      const ownerTab2Db = testEnv.authenticatedContext('fac_owner').firestore();

      const runRefereeTx = (dbInstance: ReturnType<typeof testEnv.authenticatedContext>['firestore'] extends () => infer R ? R : never) =>
        runTransaction(dbInstance, async (tx) => {
          const actionRef = doc(dbInstance, 'classes', 'cls_v2', 'actions', '1_innovation_team_1');
          const controlRef = doc(dbInstance, 'classes', 'cls_v2', 'state', 'control');
          const [actionSnap, controlSnap] = await Promise.all([tx.get(actionRef), tx.get(controlRef)]);
          if (!actionSnap.exists() || !controlSnap.exists()) return 'missing';

          const actionData = actionSnap.data();
          if (actionData.status === 'applied' || actionData.status === 'rejected') {
            return 'already-resolved';
          }

          const controlData = controlSnap.data();
          tx.update(controlRef, {
            stateVersion: (controlData.stateVersion || 1) + 1,
            'turn.index': (controlData.turn?.index || 0) + 1,
          });
          tx.update(actionRef, {
            status: 'applied',
            resolvedAt: new Date().toISOString(),
          });
          return 'applied';
        });

      const [res1, res2] = await Promise.all([
        runRefereeTx(ownerTab1Db),
        runRefereeTx(ownerTab2Db),
      ]);

      expect([res1, res2].sort()).toEqual(['already-resolved', 'applied']);

      const finalControlSnap = await getDoc(doc(ownerTab1Db, 'classes', 'cls_v2', 'state', 'control'));
      const finalControl = finalControlSnap.data()!;
      expect(finalControl.turn.index).toBe(1);
      expect(finalControl.stateVersion).toBe(2);
    });
  });
});
