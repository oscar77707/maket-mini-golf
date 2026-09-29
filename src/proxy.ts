import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isWebhookPath } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Les webhooks n8n n'ont pas de session : inutile d'interroger Supabase Auth à chaque appel.
  if (isWebhookPath(request.nextUrl.pathname)) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
