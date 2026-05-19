"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Globe from "@/components/Globe";
import GlobeInferencePanel from "@/components/GlobeInferencePanel";
import Footer from "@/components/Footer";
import {
  SITES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  type SiteCategory,
} from "@/lib/sites";

const ORDER: SiteCategory[] = ["shrinkage", "flooding", "mixed"];
const SITES_BY_CATEGORY = ORDER.map((cat) => ({
  cat,
  sites: SITES.filter((s) => s.category === cat),
}));

const CATEGORY_BLURB: Record<SiteCategory, string> = {
  shrinkage:
    "Lakes and inland seas losing surface area to irrigation, drought, or upstream damming. Each one a slow-motion crisis with named victims and decades of evidence.",
  flooding:
    "Sites with active or seasonal flooding regimes. Pulse floods, delta inundation, monsoon-driven swells. Tracking these is parametric-insurance territory.",
  mixed:
    "Sites where agricultural pressure, settlement, and water-body dynamics interact. Mostly seasonal, with both flood and stress signals across the year.",
};

export default function GlobeRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapBlockRef = useRef<HTMLDivElement | null>(null);

  const selected = selectedId
    ? SITES.find((s) => s.id === selectedId) ?? null
    : null;

  const selectAndScroll = useCallback((id: string) => {
    setSelectedId(id);
    mapBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[color:var(--color-ink)]"
          >
            AquaVeritas
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[color:var(--color-ink-muted)]">
            <Link href="/" className="transition-colors hover:text-[color:var(--color-ink)]">
              Home
            </Link>
            <Link href="/live" className="transition-colors hover:text-[color:var(--color-ink)]">
              Live inference
            </Link>
            <Link href="/methodology" className="transition-colors hover:text-[color:var(--color-ink)]">
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      {/* Intro strip */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Site globe · 20 monitored bodies · 6 continents
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)] md:text-4xl">
            Twenty freshwater bodies, picked for the stories they tell.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-ink-muted)]">
            Five chronic-shrinkage anchors. Seven flooding regimes. Eight
            mixed-use sites where agriculture, settlement, and water-body
            dynamics interact. Click any dot, or pick from the index below,
            to see the fine-tuned model&rsquo;s assessment of that
            site&rsquo;s Sentinel-2 imagery.
          </p>
        </div>
      </section>

      {/* Globe + inline inference panel */}
      <div
        ref={mapBlockRef}
        className="relative h-[75vh] border-b border-[color:var(--color-rule)]"
      >
        <Globe selectedId={selectedId} onSelectChange={setSelectedId} />
        {selected && (
          <GlobeInferencePanel
            site={selected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Site index */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Site index
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            The full dataset, grouped by regime.
          </h2>

          <div className="mt-12 space-y-12">
            {SITES_BY_CATEGORY.map(({ cat, sites }) => (
              <div key={cat}>
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: CATEGORY_COLOR[cat] }}
                  />
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-[color:var(--color-ink)]">
                    {CATEGORY_LABEL[cat]}
                  </h3>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--color-ink-faint)]">
                    {sites.length} sites
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                  {CATEGORY_BLURB[cat]}
                </p>

                <ul className="mt-6 divide-y divide-[color:var(--color-rule)] border-t border-[color:var(--color-rule)]">
                  {sites.map((s) => (
                    <li
                      key={s.id}
                      className="grid grid-cols-1 gap-x-6 gap-y-1 py-5 md:grid-cols-12"
                    >
                      <div className="md:col-span-3">
                        <p className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[color:var(--color-ink)]">
                          {s.name}
                        </p>
                        <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-faint)]">
                          {s.lat.toFixed(2)}°{s.lat >= 0 ? "N" : "S"} ·{" "}
                          {Math.abs(s.lon).toFixed(2)}°{s.lon >= 0 ? "E" : "W"}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed text-[color:var(--color-ink-muted)] md:col-span-7">
                        {s.blurb}
                      </p>
                      <div className="md:col-span-2 md:text-right">
                        <button
                          type="button"
                          onClick={() => selectAndScroll(s.id)}
                          className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--color-ink)] underline decoration-[color:var(--color-rule)] decoration-2 underline-offset-4 transition-colors hover:decoration-[color:var(--color-ocean)]"
                        >
                          Run inference →
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
