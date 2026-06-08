import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo"),
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z
    .string()
    .min(8, "A senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "A senha deve ter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "A senha deve ter ao menos um número"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe sua senha"),
  remember: z.boolean().optional(),
});

export const recoverSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
