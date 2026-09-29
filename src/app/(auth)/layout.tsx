import { Palmtree } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex items-center gap-3 text-primary">
        <Palmtree aria-hidden className="size-10" />
        <span className="text-3xl font-bold tracking-tight">La Palmeraie</span>
      </div>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
