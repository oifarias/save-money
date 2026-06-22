import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import { createAdminSessionCookieValue, verifyAdminCredentials, verifyAdminSessionCookieValue } from "./admin-auth";

const TEST_USERNAME = "admin-teste";
const TEST_PASSWORD = "senha-de-teste-123";
const ORIGINAL_ENV = { ...process.env };

beforeEach(async () => {
  process.env.ADMIN_USERNAME = TEST_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 10);
  process.env.ADMIN_SESSION_SECRET = "segredo-de-teste-para-assinatura-hmac";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifyAdminCredentials", () => {
  it("aceita usuário e senha corretos", async () => {
    await expect(verifyAdminCredentials(TEST_USERNAME, TEST_PASSWORD)).resolves.toBe(true);
  });

  it("rejeita senha errada", async () => {
    await expect(verifyAdminCredentials(TEST_USERNAME, "senha-errada")).resolves.toBe(false);
  });

  it("rejeita usuário errado", async () => {
    await expect(verifyAdminCredentials("outro-usuario", TEST_PASSWORD)).resolves.toBe(false);
  });

  it("rejeita quando as variáveis de ambiente não estão configuradas", async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    await expect(verifyAdminCredentials(TEST_USERNAME, TEST_PASSWORD)).resolves.toBe(false);
  });
});

describe("sessão do painel (cookie assinado)", () => {
  it("um cookie recém-criado é válido — é o que libera a entrada no painel após o login", () => {
    expect(verifyAdminSessionCookieValue(createAdminSessionCookieValue())).toBe(true);
  });

  it("rejeita cookie ausente", () => {
    expect(verifyAdminSessionCookieValue(undefined)).toBe(false);
  });

  it("rejeita cookie adulterado", () => {
    const cookie = createAdminSessionCookieValue();
    const tampered = cookie.endsWith("0") ? `${cookie.slice(0, -1)}1` : `${cookie.slice(0, -1)}0`;
    expect(verifyAdminSessionCookieValue(tampered)).toBe(false);
  });

  it("rejeita cookie assinado com outro segredo", () => {
    const cookie = createAdminSessionCookieValue();
    process.env.ADMIN_SESSION_SECRET = "outro-segredo-completamente-diferente";
    expect(verifyAdminSessionCookieValue(cookie)).toBe(false);
  });
});

// Regressão: o .env é carregado pelo próprio Next.js (via @next/env), que expande
// variáveis no formato "$NOME". Um hash bcrypt é cheio de "$" (ex.: $2b$12$...) — sem
// escapar cada "$" como "\$" no .env, o Next interpretava como referência a uma
// variável inexistente e cortava o hash pela metade, fazendo o login do painel nunca
// validar mesmo com a senha certa. Esse teste garante que esse escape continua correto.
describe("regressão: hash bcrypt sobrevive ao carregamento do .env pelo Next", () => {
  const originalHash = "$2b$12$nBFvXqsb95J2IT.LGzXWDeFNcQtTv9WphWYSyozzyWV0IJUgiT4sS";

  function loadTempEnvValue(rawValue: string) {
    const dir = mkdtempSync(join(tmpdir(), "save-money-env-test-"));
    writeFileSync(join(dir, ".env"), `TEST_HASH_VALUE="${rawValue}"\n`);
    loadEnvConfig(dir, true, console, true);
    const loaded = process.env.TEST_HASH_VALUE;
    delete process.env.TEST_HASH_VALUE;
    rmSync(dir, { recursive: true, force: true });
    return loaded;
  }

  it("com o \\$ escapado, o valor chega intacto", () => {
    const escaped = originalHash.replace(/\$/g, "\\$");
    expect(loadTempEnvValue(escaped)).toBe(originalHash);
  });

  it("sem escapar, o Next corta o valor no '$' (documenta o bug que esse escape evita)", () => {
    expect(loadTempEnvValue(originalHash)).not.toBe(originalHash);
  });
});
