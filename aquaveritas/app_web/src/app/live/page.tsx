import Link from "next/link";
import InferenceRunner from "@/components/InferenceRunner";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Live inference — AquaVeritas",
  description:
    "Run the fine-tuned LFM2.5-VL on a Sentinel-2 tile from your browser. WebGPU when available, no server round-trip, no data leaves your device.",
};

export default function LivePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[color:var(--color-ink)]"
          >
            AquaVeritas
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[color:var(--color-ink-muted)]">
            <Link
              href="/"
              className="transition-colors hover:text-[color:var(--color-ink)]"
            >
              Home
            </Link>
            <Link
              href="/globe"
              className="transition-colors hover:text-[color:var(--color-ink)]"
            >
              Globe
            </Link>
            <Link
              href="/methodology"
              className="transition-colors hover:text-[color:var(--color-ink)]"
            >
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Intro strip ─────────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Live inference
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)] md:text-4xl">
            The fine-tuned model, classifying a Sentinel-2 tile, in your
            browser.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-ink-muted)]">
            LFM2.5-VL-450M, fine-tuned on 1,280 expert-annotated freshwater
            observations. When your browser supports WebGPU, the model runs
            client-side: no server round-trip, no upload, no data leaves your
            device.
          </p>
        </div>
      </section>

      {/* ── Runner ──────────────────────────────────────────────────────────── */}
      <InferenceRunner />

      <Footer />
    </main>
  );
}
