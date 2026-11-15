import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET manquant ou trop court (32 caractères minimum).");
    }
    return "secret-de-developpement-uniquement";
  }
  return s;
}

/** Jeton aléatoire (hex) pour les cookies de session et d'enrôlement. */
export function jetonAleatoire(octets = 32): string {
  return randomBytes(octets).toString("hex");
}

/** Code d'enrôlement lisible : groupes de 4 caractères sans ambiguïté. */
export function codeEnrolementAleatoire(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) s += "-";
    s += alphabet[bytes[i] % alphabet.length];
  }
  return s;
}

/** Empreinte d'un jeton : on ne stocke jamais le jeton en clair. */
export function empreinte(jeton: string): string {
  return createHmac("sha256", secret()).update(jeton).digest("hex");
}

export function comparerEmpreintes(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Valeur d'un poste dont le code PIN n'a pas encore été choisi : aucune connexion par PIN
 * n'est possible tant que le poste n'a pas reçu un code (installation, invitation, ou code fixé).
 */
export const PIN_NON_DEFINI = "!";

export function pinDefini(hash: string): boolean {
  return hash !== PIN_NON_DEFINI && hash.length > 10;
}

export async function hacherPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Comparaison en temps constant de deux secrets de longueurs quelconques. */
export function secretsEgaux(a: string, b: string): boolean {
  const ha = createHmac("sha256", "comparaison").update(a).digest();
  const hb = createHmac("sha256", "comparaison").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function verifierPinHash(pin: string, hash: string): Promise<boolean> {
  if (!pinDefini(hash)) return false;
  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}

/** Valeur signée courte (poste autorisé après PIN, avant le prénom). */
export function signer(valeur: string, expireDansSecondes: number): string {
  const exp = Math.floor(Date.now() / 1000) + expireDansSecondes;
  const payload = `${valeur}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifierSignature(signee: string | undefined | null): string | null {
  if (!signee) return null;
  const parts = signee.split(".");
  if (parts.length !== 3) return null;
  const [valeur, expStr, sig] = parts;
  const attendu = createHmac("sha256", secret()).update(`${valeur}.${expStr}`).digest("hex");
  if (!comparerEmpreintes(sig, attendu)) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return valeur;
}

export function normaliserCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
