import { watchRecords } from "./local-records";
import { previewMember } from "./members";

// The fixed local user is also used by My Profile and the activity log.
// Keep the verifier outside the public member directory and its activity records.
const key = `khp.credentials.v1.${previewMember.id}`;
const iterations = 600_000;

export function watchProfilePassword(receive: (exists: boolean | null) => void) {
  return watchRecords(key, () => {
    try {
      receive(localStorage.getItem(key) !== null);
    } catch {
      receive(null);
    }
  });
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations, salt },
    material,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function saveProfilePassword(
  current: string,
  next: string,
  expectedExisting: boolean,
) {
  if (!next) throw new Error("Enter a new password.");
  async function save() {
    const raw = localStorage.getItem(key);
    if ((raw !== null) !== expectedExisting)
      throw new Error("The password changed in another tab. Reopen the password form.");
    if (raw !== null) {
      const record = JSON.parse(raw);
      const salt = Uint8Array.from(atob(record.salt), (char) => char.charCodeAt(0));
      if (!current || (await derive(current, salt)) !== record.hash)
        throw new Error("The current password is incorrect.");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(next, salt);
    if (localStorage.getItem(key) !== raw)
      throw new Error("The password changed in another tab. Reopen the password form.");
    localStorage.setItem(key, JSON.stringify({ salt: btoa(String.fromCharCode(...salt)), hash }));
  }
  if (navigator.locks) await navigator.locks.request(key, save);
  else await save();
}
