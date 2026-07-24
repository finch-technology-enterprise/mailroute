async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function generateResetToken(
  email: string,
  secret: string,
  expiresInSec = 900,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;
  const nonce = crypto.randomUUID();
  const payload = btoa(JSON.stringify({ email, nonce, iat, exp }));
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyResetToken(
  token: string,
  secret: string,
): Promise<{ email: string } | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = await hmacSign(payload, secret);
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: data.email };
  } catch { return null; }
}
