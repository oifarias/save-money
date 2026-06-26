import "dotenv/config";
import { describe, expect, it, vi } from "vitest";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  signIn: signInMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

import { signInWithGoogleAction } from "./actions";

describe("signInWithGoogleAction (mock de next-auth)", () => {
  it("chama signIn com o provider 'google' e redireciona para o dashboard", async () => {
    console.log("[cenário] botão 'Entrar com Google' aciona signIn('google', ...)");

    // Arrange
    signInMock.mockResolvedValueOnce(undefined);

    // Act
    await signInWithGoogleAction();

    // Assert
    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/dashboard" });
  });
});
