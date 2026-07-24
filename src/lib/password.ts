async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ hash: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key, 256,
  );
  return { hash: new Uint8Array(bits), salt };
}

function toBase64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const { hash } = await pbkdf2(password, salt, ITERATIONS);
  return `${ITERATIONS}:${toBase64url(salt)}:${toBase64url(hash)}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 3) return false;
  const [iters, saltB64, hashB64] = parts;
  const salt = fromBase64url(saltB64);
  const { hash } = await pbkdf2(password, salt, parseInt(iters, 10));
  return toBase64url(hash) === hashB64;
}

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "mr_" + toBase64url(bytes);
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  return toBase64url(new Uint8Array(hash));
}
