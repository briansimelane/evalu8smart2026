/**
 * One-off idempotent script to stamp existing `classes/*` and `multiworld_sessions/*`
 * documents with `schemaVersion: 1` before deploying strict v2 Firestore rules.
 *
 * Usage:
 *   Dry run (default):  npx tsx scripts/stamp-legacy.ts
 *   Apply changes:      npx tsx scripts/stamp-legacy.ts --apply
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
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

const shouldApply = process.argv.includes('--apply');

async function stampCollection(collectionName: string) {
  const snap = await getDocs(collection(db, collectionName));
  let stampedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (typeof data.schemaVersion === 'number') {
      skippedCount++;
      console.log(
        `[SKIP] ${collectionName}/${docSnap.id} already has schemaVersion=${data.schemaVersion}`
      );
      continue;
    }

    if (shouldApply) {
      await updateDoc(doc(db, collectionName, docSnap.id), {
        schemaVersion: 1,
      });
      console.log(`[STAMPED] ${collectionName}/${docSnap.id} -> schemaVersion: 1`);
    } else {
      console.log(`[DRY-RUN] Would stamp ${collectionName}/${docSnap.id} -> schemaVersion: 1`);
    }
    stampedCount++;
  }

  return { total: snap.size, stampedCount, skippedCount };
}

async function main() {
  console.log(
    `Starting stamp-legacy (${shouldApply ? 'APPLY MODE' : 'DRY-RUN MODE - pass --apply to write'})...`
  );
  const classesSummary = await stampCollection('classes');
  const mwSummary = await stampCollection('multiworld_sessions');

  console.log('\nSummary:');
  console.log(
    `  classes:             total=${classesSummary.total}, ${shouldApply ? 'stamped' : 'wouldStamp'}=${classesSummary.stampedCount}, skipped=${classesSummary.skippedCount}`
  );
  console.log(
    `  multiworld_sessions: total=${mwSummary.total}, ${shouldApply ? 'stamped' : 'wouldStamp'}=${mwSummary.stampedCount}, skipped=${mwSummary.skippedCount}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('stamp-legacy failed:', err);
  process.exit(1);
});
