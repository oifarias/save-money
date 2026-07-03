import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tokenVersion?: number;
    } & DefaultSession["user"];
  }

  interface User {
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tokenVersion?: number;
  }
}
