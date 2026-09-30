"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

/**
 * Champ de recherche d'une liste : la valeur part dans l'URL (`?q=`) après une courte pause.
 * Quand l'URL est vidée ailleurs (« Effacer les filtres »), le champ se vide aussi.
 */
export function UrlSearch({
  label,
  placeholder,
  name = "q",
  className,
}: {
  label: string;
  placeholder: string;
  name?: string;
  className?: string;
}) {
  const { params, update } = useUrlState();
  const urlValue = params.get(name) ?? "";
  const [value, setValue] = useState(urlValue);
  const pushed = useRef(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (urlValue === "" && pushed.current !== "") {
      clearTimeout(timer.current);
      pushed.current = "";
      setValue("");
    }
  }, [urlValue]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        className="pl-10"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            pushed.current = next.trim();
            update({ [name]: next.trim() || null });
          }, 300);
        }}
      />
    </div>
  );
}
