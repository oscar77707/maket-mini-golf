import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Button asChild size="lg">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
