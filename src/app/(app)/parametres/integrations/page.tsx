import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { WebhookCarte } from "@/features/parametres/components/webhook-carte";
import { getWebhooks, getWebhooksRecus } from "@/features/parametres/queries";
import { requireRole } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Intégrations" };

/** Variables attendues par les échanges avec n8n : seul leur état s'affiche, jamais leur valeur. */
const VARIABLES = [
  { nom: "N8N_OUTBOUND_SECRET", role: "Signature des messages envoyés à n8n", requise: true },
  { nom: "N8N_INBOUND_TOKEN", role: "Jeton que n8n présente à l'application", requise: true },
  { nom: "N8N_INBOUND_SECRET", role: "Signature des messages reçus de n8n", requise: true },
  {
    nom: "SUPABASE_SERVICE_ROLE_KEY",
    role: "Écriture des messages reçus dans la base",
    requise: true,
  },
  { nom: "PHONE_HASH_SECRET", role: "Empreinte des numéros d'appel (recommandée)", requise: false },
] as const;

const ENDPOINTS = [
  { chemin: "/api/webhooks/n8n/orders", role: "Brouillons de commande et changements de statut" },
  { chemin: "/api/webhooks/n8n/calls", role: "Appels terminés du standard IA" },
] as const;

const SOURCES: Record<string, string> = { n8n_orders: "Commandes", n8n_calls: "Appels IA" };

export default async function IntegrationsPage() {
  await requireRole("gerant");
  const [webhooks, recus] = await Promise.all([getWebhooks(), getWebhooksRecus()]);
  const base = publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const defini = (nom: string) => Boolean(process.env[nom]?.trim());

  return (
    <div className="max-w-4xl space-y-8">
      <section aria-label="Messages envoyés à n8n" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Envoyés à n8n</h2>
          <p className="text-sm text-muted-foreground">
            L&apos;application appelle ces adresses, par exemple quand vous validez une commande.
          </p>
        </div>
        {webhooks.map((w) => (
          <WebhookCarte
            key={w.cle}
            webhook={w}
            variableEnv={
              w.cle === "order_send"
                ? { nom: "N8N_WEBHOOK_ORDER_SEND", definie: defini("N8N_WEBHOOK_ORDER_SEND") }
                : null
            }
          />
        ))}
      </section>

      <section aria-label="Messages reçus de n8n" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Reçus de n8n</h2>
          <p className="text-sm text-muted-foreground">
            À indiquer dans vos workflows n8n. Chaque message porte un jeton et une signature (voir
            docs/n8n.md).
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Adresses de l&apos;application</CardTitle>
            <CardDescription>Méthode POST, corps JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y" aria-label="Adresses des webhooks entrants">
              {ENDPOINTS.map((e) => (
                <li key={e.chemin} className="py-3">
                  <code className="break-all rounded bg-muted px-1.5 py-0.5 text-sm">
                    {base}
                    {e.chemin}
                  </code>
                  <p className="mt-1 text-sm text-muted-foreground">{e.role}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration du serveur</CardTitle>
            <CardDescription>
              Ces valeurs secrètes se règlent dans les variables d&apos;environnement, jamais ici.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y" aria-label="Variables d'environnement">
              {VARIABLES.map((v) => {
                const ok = defini(v.nom);
                return (
                  <li
                    key={v.nom}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <code className="text-sm">{v.nom}</code>
                      <p className="text-sm text-muted-foreground">{v.role}</p>
                    </div>
                    {ok ? (
                      <Badge variant="vert">Définie</Badge>
                    ) : (
                      <Badge variant={v.requise ? "rouge" : "orange"}>
                        {v.requise ? "Manquante" : "Non définie"}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Derniers messages reçus</h3>
          {recus.length === 0 ? (
            <EmptyState
              title="Aucun message reçu"
              description="Les messages de n8n apparaîtront ici avec leur résultat."
            />
          ) : (
            <Table aria-label="Derniers messages reçus de n8n">
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Source</TH>
                  <TH>Événement</TH>
                  <TH>Résultat</TH>
                </TR>
              </THead>
              <TBody>
                {recus.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{formatDateTime(r.recu_le)}</TD>
                    <TD>{SOURCES[r.source] ?? r.source}</TD>
                    <TD>{r.evenement ?? "—"}</TD>
                    <TD>
                      {r.statut_http >= 200 && r.statut_http < 300 ? (
                        <Badge variant="vert">{r.statut_http}</Badge>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="rouge">{r.statut_http}</Badge>
                          {r.erreur && (
                            <span className="text-xs text-muted-foreground">{r.erreur}</span>
                          )}
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
