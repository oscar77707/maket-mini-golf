"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/feedback/notify";
import { removeLogo, uploadLogo } from "../actions-complexe";

export function LogoUpload({ logoUrl, nom }: { logoUrl: string | null; nom: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const envoyer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choisissez d'abord une image.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await uploadLogo(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (input.current) input.current.value = "";
      notify(result);
      router.refresh();
    });
  };

  const retirer = () => {
    if (!window.confirm("Supprimer le logo ? Le pictogramme palmier sera affiché à la place."))
      return;
    startTransition(async () => {
      const result = await removeLogo();
      notify(result);
      if (result.ok) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          Affiché en haut du menu à la place du palmier. PNG, JPEG ou WebP, 500 Ko au maximum.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-lg border bg-muted">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase Storage variable
              <img
                src={logoUrl}
                alt={`Logo de ${nom}`}
                className="max-h-16 max-w-16 object-contain"
              />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">Aucun logo</span>
            )}
          </div>
          {logoUrl && (
            <Button type="button" variant="outline" onClick={retirer} disabled={pending}>
              <Trash2 aria-hidden />
              Supprimer le logo
            </Button>
          )}
        </div>
        <form onSubmit={envoyer} className="space-y-3">
          <Label htmlFor="logo">Nouvelle image</Label>
          <input
            ref={input}
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-base file:mr-4 file:h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:font-medium"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
            Enregistrer le logo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
