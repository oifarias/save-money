import { headers } from "next/headers";

/**
 * Rate limiter em memória (sliding window). Protege contra brute force nas
 * rotas de autenticação enquanto o app roda numa única instância "quente".
 *
 * Limitação conhecida: em deploy serverless (Vercel/Neon) cada instância tem
 * seu próprio Map, então o limite é por-instância, não global — reduz o
 * brute force mas não o elimina sob múltiplas instâncias frias. Se isso virar
 * um problema real, trocar por um store compartilhado (ex.: Upstash Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Evita crescimento ilimitado do Map em processos de vida longa.
const MAX_BUCKETS = 50_000;

function prune(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Verifica e consome uma tentativa para `key` dentro da janela `windowMs`,
 * permitindo no máximo `limit` tentativas por janela.
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** IP do cliente a partir dos headers de proxy padrão (Vercel/geral). */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}

/**
 * Limita por IP e por conta ao mesmo tempo (o mais restritivo vence), como
 * recomendado para brute force de login: só bloquear por conta permite
 * distributed brute force; só bloquear por IP permite alvo único por trás
 * de NAT/proxy escapar.
 */
export async function checkLoginRateLimit(
  accountKey: string,
  options?: { limit?: number; windowMs?: number }
): Promise<RateLimitResult> {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 60_000;

  const ip = await getClientIp();
  const byIp = consumeRateLimit(`ip:${ip}`, limit, windowMs);
  const byAccount = consumeRateLimit(`account:${accountKey.toLowerCase()}`, limit, windowMs);

  if (!byIp.allowed || !byAccount.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
