import Link from "next/link";
import Footer from "@/components/Footer";

/**
 * Lake Chad hero — the singular crisis frame.
 *
 * Editorial register. Display serif. No cards, no stat-card icons, no gradient
 * accents. The 20-site dataset is referenced as scale; Lake Chad is the lead.
 */
export default function Home() {
  return (
    <main className="flex-1">
      {/* ── Top rail ────────────────────────────────────────────────────────── */}
      <header className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 font-[family-name:var(--font-display)] text-[color:var(--color-ink)]"
          >
            <span className="text-xl font-medium tracking-tight">
              AquaVeritas
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              orbital
            </span>
          </Link>
          <nav className="flex items-center gap-7 text-sm text-[color:var(--color-ink-muted)]">
            <Link
              href="/live"
              className="transition-colors hover:text-[color:var(--color-ink)]"
            >
              Live inference
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
            <a
              href="https://huggingface.co/Arty1001/aquaveritas-lfm-GGUF"
              className="transition-colors hover:text-[color:var(--color-ink)]"
            >
              Model
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-32">
          <p className="mb-8 text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Lake Chad · 2026
          </p>

          <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.02] tracking-tight text-[color:var(--color-ink)]">
            Thirty million people&nbsp;
            <span className="text-[color:var(--color-ochre-deep)] italic">
              lost their lake.
            </span>
          </h1>

          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-[color:var(--color-ink-muted)]">
            We watched it happen from orbit. AquaVeritas fine-tunes
            LFM2.5-VL-450M on Sentinel-2 imagery to classify the world&rsquo;s
            freshwater bodies — Lake Chad, the Aral Sea, Tonle Sap, sixteen
            more — and produce structured, analyst-ready intelligence at a
            cadence the existing systems cannot match.
          </p>

          {/* Stats line — restrained, no cards */}
          <dl className="mt-16 grid grid-cols-1 gap-10 border-t border-[color:var(--color-rule)] pt-10 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                Surface area lost
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[color:var(--color-ink)]">
                90<span className="text-[color:var(--color-ink-muted)]">%</span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Since 1960. Irrigation, drought, and the basin&rsquo;s collapse.
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                People dependent
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[color:var(--color-ink)]">
                30
                <span className="ml-1 text-3xl text-[color:var(--color-ink-muted)]">
                  million
                </span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Across Chad, Niger, Nigeria, and Cameroon.
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                Fine-tuned accuracy
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[color:var(--color-ink)]">
                85.4
                <span className="text-[color:var(--color-ink-muted)]">%</span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Across 10 structured fields vs 18.0% base model.
              </p>
            </div>
          </dl>

          {/* CTAs */}
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href="/live"
              className="inline-flex h-12 items-center gap-2 bg-[color:var(--color-ink)] px-7 text-sm font-medium text-[color:var(--color-surface)] transition-all duration-300 hover:bg-[color:var(--color-ocean-deep)]"
              style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
            >
              See it live
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/methodology"
              className="text-sm font-medium text-[color:var(--color-ink)] underline decoration-[color:var(--color-rule)] decoration-2 underline-offset-8 transition-colors hover:decoration-[color:var(--color-ocean)]"
            >
              Read the methodology
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why this exists ─────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
              The gap
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
              Satellites already see this. Nobody&rsquo;s reading the imagery.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-relaxed text-[color:var(--color-ink-muted)] md:col-span-7 md:col-start-6">
            <p>
              ESA Copernicus has flown Sentinel-2 over Lake Chad every five days
              since 2015. Eleven years of multispectral imagery at ten-metre
              resolution. The data exists. The interpretation does not.
            </p>
            <p>
              Government water authorities can&rsquo;t hire enough analysts to
              read every tile. Parametric insurers need a structured index, not
              raw rasters. Development finance institutions need to verify
              outcomes years after a project disburses. Today they all rely on
              expensive bespoke contractors, or they don&rsquo;t verify at all.
            </p>
            <p className="font-[family-name:var(--font-display)] text-xl italic leading-snug text-[color:var(--color-ink)]">
              AquaVeritas is the layer that turns the pixels into a verifiable
              water-stress index.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works (terse, no cards) ──────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            How it works
          </p>
          <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            A 450-million-parameter vision-language model, fine-tuned on the
            crisis.
          </h2>

          <ol className="mt-12 space-y-10">
            {[
              {
                n: "01",
                title: "Capture",
                body: "DPhi SimSat fetches Sentinel-2 tiles — RGB, SWIR, dual-zone — across twenty monitored sites on a daily cadence.",
              },
              {
                n: "02",
                title: "Classify",
                body: "Fine-tuned LFM2.5-VL produces a structured eleven-field JSON for each observation. Water extent, flood risk, crop stress, shoreline encroachment, settlement, bare-soil expansion.",
              },
              {
                n: "03",
                title: "Compare",
                body: "Outputs are cross-referenced against JRC Global Surface Water and GRACE-FO mass anomalies. Three independent sources agree before a signal is published.",
              },
              {
                n: "04",
                title: "Trigger",
                body: "Parametric insurance customers receive webhook events the moment a verified stress condition crosses their contract threshold.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-1 gap-x-8 gap-y-2 border-t border-[color:var(--color-rule)] pt-8 md:grid-cols-12"
              >
                <p className="font-[family-name:var(--font-mono)] text-sm tracking-tight text-[color:var(--color-ink-faint)] md:col-span-1">
                  {step.n}
                </p>
                <h3 className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-[color:var(--color-ink)] md:col-span-3">
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed text-[color:var(--color-ink-muted)] md:col-span-8">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer />
    </main>
  );
}
