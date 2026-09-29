import { z } from "zod";

// Variables publiques : lues statiquement pour que Next.js les injecte côté navigateur.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: "NEXT_PUBLIC_SUPABASE_URL est manquante ou invalide.",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY est manquante."),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

export function publicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Configuration incomplète : ${parsed.error.issues.map((i) => i.message).join(" ")} Copiez .env.example vers .env.local.`,
    );
  }
  return parsed.data;
}
