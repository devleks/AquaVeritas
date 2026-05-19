import Link from "next/link";
import Globe from "@/components/Globe";

export const metadata = {
  title: "Site globe — AquaVeritas",
  description:
    "Twenty freshwater bodies under continuous monitoring. Lake Chad, the Aral Sea, Tonle Sap, sixteen more.",
};

export default function GlobePage() {
  return (
    <main className="flex h-screen flex-1 flex-col">
      {/* ── Header (sticky, terse) ──────────────────────────────────────────── */}
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface)] px-6 py-3">
        <div className="flex items-baseline gap-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[color:var(--color-ink)]"
          >
            AquaVeritas
          </Link>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)] sm:inline">
            Site globe · 20 monitored bodies
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-[color:var(--color-ink-muted)]">
          <Link
            href="/"
            className="transition-colors hover:text-[color:var(--color-ink)]"
          >
            Home
          </Link>
          <Link
            href="/live"
            className="transition-colors hover:text-[color:var(--color-ink)]"
          >
            Live inference
          </Link>
          <Link
            href="/methodology"
            className="transition-colors hover:text-[color:var(--color-ink)]"
          >
            Methodology
          </Link>
        </nav>
      </header>

      {/* ── Globe ───────────────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        <Globe />
      </div>
    </main>
  );
}
