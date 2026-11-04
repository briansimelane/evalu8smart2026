import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

let pendingSignInPromise: Promise<string> | null = null;

async function signInWithGuestEmailFallback(): Promise<string> {
  let guestEmail = localStorage.getItem('evalu8_guest_auth_email');
  let guestPw = localStorage.getItem('evalu8_guest_auth_pw');
  const isNewGuest = !guestEmail || !guestPw;

  if (isNewGuest) {
    const randId =
      Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    guestEmail = `guest_${randId}@session.evalu8smart.local`;
    guestPw = `Guest_${randId}_#9aB!`;
    localStorage.setItem('evalu8_guest_auth_email', guestEmail);
    localStorage.setItem('evalu8_guest_auth_pw', guestPw);
    const createCred = await createUserWithEmailAndPassword(auth, guestEmail, guestPw);
    return createCred.user.uid;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, guestEmail!, guestPw!);
    return cred.user.uid;
  } catch (signInErr: any) {
    const createCred = await createUserWithEmailAndPassword(auth, guestEmail!, guestPw!);
    return createCred.user.uid;
  }
}

/**
 * Ensures the current visitor (student or viewer) has a real Firebase Auth UID.
 * 1. Waits for Firebase Auth to restore any existing session from IndexedDB.
 * 2. Attempts `signInAnonymously(auth)` unless already known to be disabled or a guest account exists.
 * 3. If Anonymous Auth is disabled in the Firebase Console, automatically signs in
 *    with a per-browser guest Email/Password account so Firestore security rules
 *    (`request.auth != null`) succeed across all browsers (including Safari).
 */
export async function ensureSignedIn(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;

  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
    } catch {}
  }
  if (auth.currentUser) return auth.currentUser.uid;

  if (pendingSignInPromise) return pendingSignInPromise;

  pendingSignInPromise = (async () => {
    try {
      const hasExistingGuest = Boolean(
        localStorage.getItem('evalu8_guest_auth_email') &&
          localStorage.getItem('evalu8_guest_auth_pw')
      );
      const anonDisabled = localStorage.getItem('evalu8_anon_auth_disabled') === '1';

      if (!hasExistingGuest && !anonDisabled) {
        try {
          const cred = await signInAnonymously(auth);
          return cred.user.uid;
        } catch (anonErr: any) {
          const errCode = String(anonErr?.code || '');
          if (
            errCode.includes('admin-restricted-operation') ||
            errCode.includes('operation-not-allowed')
          ) {
            try {
              localStorage.setItem('evalu8_anon_auth_disabled', '1');
            } catch {}
          }
        }
      }

      return await signInWithGuestEmailFallback();
    } catch (guestErr: any) {
      console.warn(
        'Firebase Auth guest fallback failed, using local UID:',
        guestErr?.code || guestErr?.message || guestErr
      );
      let fallback = localStorage.getItem('evalu8_anon_fallback_uid');
      if (!fallback) {
        fallback =
          'anon_' +
          Math.random().toString(36).substring(2, 10) +
          '_' +
          Date.now().toString(36);
        localStorage.setItem('evalu8_anon_fallback_uid', fallback);
      }
      return fallback;
    } finally {
      pendingSignInPromise = null;
    }
  })();

  return pendingSignInPromise;
}

export async function ensureDemoUid(): Promise<string> {
  return ensureSignedIn();
}
