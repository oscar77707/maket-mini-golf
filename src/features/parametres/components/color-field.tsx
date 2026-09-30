"use client";

import { Input } from "@/components/ui/input";

/** Choix d'une couleur : pastille du navigateur + code #RRGGBB modifiable. */
export function ColorField({
  id,
  value,
  onChange,
  invalid,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  label: string;
}) {
  const valid = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} (pastille)`}
        value={valid ? value.toLowerCase() : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        className="font-mono uppercase"
      />
    </div>
  );
}
