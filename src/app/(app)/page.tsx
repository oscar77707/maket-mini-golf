import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";

export default async function HomePage() {
  const { profile } = await requireUser();
  redirect(homePathFor(profile.role));
}
