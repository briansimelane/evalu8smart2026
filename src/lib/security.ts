/**
 * Unambiguous uppercase alphanumeric alphabet (excludes 0, O, 1, I, L).
 */
export const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an 8-character uppercase join code using CSPRNG (`crypto.getRandomValues`).
 */
export function generateJoinCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += UNAMBIGUOUS_ALPHABET[bytes[i] % UNAMBIGUOUS_ALPHABET.length];
  }
  return out;
}

/**
 * Hashes a CEO PIN client-side using SHA-256 with `classId:teamId` as salt.
 *
 * NOTE: Client-side PIN hashing is a convenience lock against casual seat takeover
 * by teammates, NOT strong security (since a short PIN can be brute-forced if a
 * hash is known, and hashing happens in the browser). Firestore rules prevent
 * non-CEO students from reading `seats/{teamId}` directly and verify `pinHashProof`
 * on takeover.
 */
export async function hashCeoPin(classId: string, teamId: string, pin: string): Promise<string> {
  const normalized = `${classId}:${teamId}:${pin.trim()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
