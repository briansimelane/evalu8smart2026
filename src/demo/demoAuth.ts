import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function ensureDemoUid(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn("Anonymous auth failed, falling back to local demo uid", err);
    let fallback = localStorage.getItem('evalu8_demo_fallback_uid');
    if (!fallback) {
      fallback = 'demo_anon_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('evalu8_demo_fallback_uid', fallback);
    }
    return fallback;
  }
}
