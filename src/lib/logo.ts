/** Adresse publique du logo (bucket « logos » de Supabase Storage, lisible par tous). */
export function logoPublicUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/logos/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const LOGO_MAX_BYTES = 512_000;

/** Type de l'image d'après ses premiers octets (on ne se fie ni à l'extension ni au type annoncé). */
export function detectLogoType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return { mime: "image/webp", ext: "webp" };
  return null;
}
