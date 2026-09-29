import { StocksNav } from "@/features/stocks/components/stocks-nav";
import { requireUser } from "@/lib/auth/session";

export default async function StocksLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Stocks</h1>
      <StocksNav canManage={profile.role !== "salarie"} />
      {children}
    </div>
  );
}
