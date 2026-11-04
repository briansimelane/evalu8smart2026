/**
 * Pre-deploy Firestore backup script.
 * Dumps `classes/**`, `multiworld_sessions/**`, `facilitators/**` and `demo_games/**` to JSON.
 *
 * Usage:
 *   npx tsx scripts/backup-firestore.ts [output-path]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'evalu8smart2026',
  appId: '1:352780138083:web:ba75600ed24719c03c2a56',
  storageBucket: 'evalu8smart2026.firebasestorage.app',
  apiKey: 'AIzaSyDHT9DXTmO7DnrTqpuD0af7KpGdtzII2zU',
  authDomain: 'evalu8smart2026.firebaseapp.com',
  messagingSenderId: '352780138083',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (process.env.FIRESTORE_EMULATOR_HOST) {
  const [host, portStr] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host || '127.0.0.1', Number(portStr) || 8080);
}

const CLASS_SUBCOLLECTIONS = [
  'state',
  'teams',
  'secrets',
  'members',
  'seats',
  'rounds',
  'plans',
  'actions',
] as const;

async function dumpCollection(colPath: string): Promise<Record<string, unknown>> {
  const snap = await getDocs(collection(db, colPath));
  const out: Record<string, unknown> = {};
  for (const d of snap.docs) {
    out[d.id] = d.data();
  }
  return out;
}

async function dumpClasses(): Promise<Record<string, unknown>> {
  const classesSnap = await getDocs(collection(db, 'classes'));
  const out: Record<string, unknown> = {};

  for (const classDoc of classesSnap.docs) {
    const classId = classDoc.id;
    const subcollections: Record<string, Record<string, unknown>> = {};

    for (const sub of CLASS_SUBCOLLECTIONS) {
      const subSnap = await getDocs(collection(db, 'classes', classId, sub));
      if (!subSnap.empty) {
        const subDocs: Record<string, unknown> = {};
        for (const sDoc of subSnap.docs) {
          subDocs[sDoc.id] = sDoc.data();
        }
        subcollections[sub] = subDocs;
      }
    }

    out[classId] = {
      data: classDoc.data(),
      subcollections,
    };
  }

  return out;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOut = resolve(process.cwd(), 'backups', `firestore-backup-${timestamp}.json`);
  const outPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : defaultOut;

  console.log('Backing up Firestore collections...');
  const [classes, multiworld_sessions, facilitators, demo_games, defaultSessionSnap] =
    await Promise.all([
      dumpClasses(),
      dumpCollection('multiworld_sessions'),
      dumpCollection('facilitators'),
      dumpCollection('demo_games'),
      getDoc(doc(db, 'evalu8smart_sessions', 'default_game')),
    ]);

  const backupPayload = {
    exportedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    collections: {
      classes,
      multiworld_sessions,
      facilitators,
      demo_games,
      evalu8smart_sessions: defaultSessionSnap.exists()
        ? { default_game: defaultSessionSnap.data() }
        : {},
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(backupPayload, null, 2), 'utf8');

  console.log(`Backup written to: ${outPath}`);
  console.log(
    `Counts: classes=${Object.keys(classes).length}, multiworld_sessions=${Object.keys(multiworld_sessions).length}, facilitators=${Object.keys(facilitators).length}, demo_games=${Object.keys(demo_games).length}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
