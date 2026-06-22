import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não configurado");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !passwordHash) return false;

  // Roda o bcrypt.compare mesmo quando o usuário já está errado, pra não dar uma resposta
  // visivelmente mais rápida nesse caso (evita um sinal de timing sobre o usuário válido).
  const isPasswordValid = await bcrypt.compare(password, passwordHash);
  return username === expectedUsername && isPasswordValid;
}

export function createAdminSessionCookieValue(): string {
  const exp = Date.now() + SESSION_DURATION_MS;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return false;
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}
