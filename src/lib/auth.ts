import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setupNewUserDefaults } from "@/lib/onboarding";

// Hash dummy fixo (mesmo custo do usado no cadastro) só para o bcrypt.compare
// rodar mesmo quando o e-mail não existe — evita vazar por timing se a conta
// existe, complementando a mensagem de erro que já é genérica.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, passwordHash: true, tokenVersion: true },
        });

        const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !user.passwordHash || !isValid) return null;

        return { id: user.id, name: user.name, email: user.email, tokenVersion: user.tokenVersion };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Decisão de produto: se o e-mail do Google já existir como conta local, vincular
      // automaticamente em vez de bloquear com "OAuthAccountNotLinked" (ver events.linkAccount
      // abaixo para o aviso ao usuário).
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  events: {
    // Disparado pelo adapter sempre que uma conta OAuth é vinculada a um usuário — inclusive
    // no primeiro login Google de uma conta totalmente nova, caso em que não há nada a avisar.
    // Só sinalizamos o aviso quando o usuário já tinha senha local (passwordHash setado), que é
    // o caso real de "vinculação automática a uma conta pré-existente" que o produto quer notificar.
    async linkAccount({ user }) {
      if (!user.id) return;
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
      if (dbUser?.passwordHash) {
        await prisma.user.update({ where: { id: user.id }, data: { pendingLinkNotice: true } });
      }
    },
    // Disparado só quando o adapter cria um usuário novo (primeiro login Google sem conta local prévia).
    async createUser({ user }) {
      if (user.id) {
        await setupNewUserDefaults(prisma, user.id);
      }
    },
    // Estratégia "jwt" não tem revogação nativa: um token roubado continuaria válido até expirar
    // mesmo após logout. Para fechar essa brecha, incrementamos tokenVersion no logout; sessões
    // com a versão antiga são derrubadas na checagem feita em (app)/layout.tsx.
    async signOut(message) {
      const tokenId = "token" in message ? message.token?.id : undefined;
      const userId = typeof tokenId === "string" ? tokenId : undefined;
      if (!userId) return;
      try {
        await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      } catch (error) {
        console.error("[auth] falha ao incrementar tokenVersion no logout:", error);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.tokenVersion = user.tokenVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (session.user && typeof token.tokenVersion === "number") {
        session.user.tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
});
