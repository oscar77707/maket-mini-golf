"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Recharge les données de la page dès qu'une ligne des tables suivies change (Supabase Realtime).
 * Les droits de lecture (RLS) s'appliquent aux évènements : chacun ne reçoit que ce qu'il peut voir.
 * Sans connexion temps réel, la page reste simplement telle quelle jusqu'au prochain rechargement.
 */
export function RealtimeRefresh({ tables, name }: { tables: string[]; name: string }) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // plusieurs évènements rapprochés (import, réappro) ne déclenchent qu'un seul rechargement
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 700);
    };
    let channel = supabase.channel(`refresh-${name}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [key, name, router]);

  return null;
}
