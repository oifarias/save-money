import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setupNewUserDefaults } from "@/lib/onboarding";

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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email };
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
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
