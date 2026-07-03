import { signOut } from "@/lib/auth";

/**
 * signOut() só pode limpar cookies dentro de um Route Handler/Server Action
 * (não durante o render de um Server Component). (app)/layout.tsx redireciona
 * pra cá quando detecta uma sessão JWT com tokenVersion desatualizada
 * (revogada por um logout anterior) em vez de chamar signOut() diretamente.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
