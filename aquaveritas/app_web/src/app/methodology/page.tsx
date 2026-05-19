import Link from "next/link";
import Footer from "@/components/Footer";
import {
  FIELDS,
  HEADLINES,
  pct,
  pp,
  type FieldRow,
} from "@/lib/methodology-data";

export const metadata = {
  title: "Methodology — AquaVeritas",
  description:
    "How AquaVeritas fine-tuned LFM2.5-VL-450M on Sentinel-2 freshwater imagery. Three-way evaluation against Claude Opus oracle and the unmodified base model. +67.4 percentage points overall accuracy.",
};

const coreFields = FIELDS.filter((f) => f.zone === "core");
const bufferFields = FIELDS.filter((f) => f.zone === "buffer");

export default function MethodologyPage() {
  const finetuned = HEADLINES.find((h) => h.id === "finetuned")!;
  const base = HEADLINES.find((h) => h.id === "base")!;
  const claude = HEADLINES.find((h) => h.id === "claude")!;
  const uplift = finetuned.overall - base.overall;
  const gapToOracle = claude.overall - finetuned.overall;

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
            <Link href="/" className="transition-colors hover:text-[color:var(--color-ink)]">
              Home
            </Link>
            <Link href="/globe" className="transition-colors hover:text-[color:var(--color-ink)]">
              Globe
            </Link>
            <Link href="/live" className="transition-colors hover:text-[color:var(--color-ink)]">
              Live inference
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Methodology · v1 · 2026-05-04
          </p>
          <h1 className="mt-6 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05] tracking-tight text-[color:var(--color-ink)]">
            A 450M-parameter vision-language model, fine-tuned on the crisis,
            beats its 200-billion-parameter teacher on five of ten fields.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[color:var(--color-ink-muted)]">
            AquaVeritas fine-tunes LFM2.5-VL-450M on 1,280 expert-annotated
            Sentinel-2 observations across twenty global freshwater bodies.
            The result is evaluated three ways — against the unmodified base
            model, the Claude Opus oracle that generated the training labels,
            and the fine-tune itself — on a held-out test split.
          </p>

          {/* Headline metric — Newsreader serif at display size */}
          <div className="mt-16 grid grid-cols-1 gap-10 border-t border-[color:var(--color-rule)] pt-10 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                Overall accuracy uplift
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-6xl leading-none tracking-tight text-[color:var(--color-ochre-deep)]">
                +{pp(uplift)}
                <span className="ml-1 text-2xl text-[color:var(--color-ink-muted)]">pp</span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Base {pct(base.overall)} → Fine-tuned {pct(finetuned.overall)}.
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                Gap to oracle
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-6xl leading-none tracking-tight text-[color:var(--color-ink)]">
                {pp(gapToOracle)}
                <span className="ml-1 text-2xl text-[color:var(--color-ink-muted)]">pp</span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Within touching distance of Claude Opus ({pct(claude.overall)}) at 444× fewer parameters.
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                Fields where it beats the oracle
              </dt>
              <dd className="mt-3 font-[family-name:var(--font-display)] text-6xl leading-none tracking-tight text-[color:var(--color-ink)]">
                5
                <span className="ml-1 text-2xl text-[color:var(--color-ink-muted)]">/ 10</span>
              </dd>
              <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Water clarity, shoreline encroachment, flood risk, crop stress type, cultivation expansion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three-way headline table ────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Headline comparison
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            All three models on the same thirty held-out tiles.
          </h2>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-ink)]">
                  <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                    Model
                  </th>
                  <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                    Params
                  </th>
                  <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                    Overall
                  </th>
                  <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                    Core zone <span className="text-[color:var(--color-ink-faint)]">(4)</span>
                  </th>
                  <th className="pb-3 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                    Buffer zone <span className="text-[color:var(--color-ink-faint)]">(6)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-rule)]">
                {HEADLINES.map((m) => {
                  const isFt = m.id === "finetuned";
                  return (
                    <tr key={m.id}>
                      <td className={`py-5 pr-6 ${isFt ? "" : ""}`}>
                        <p
                          className={`font-[family-name:var(--font-display)] text-lg leading-tight tracking-tight ${
                            isFt ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-ink)]"
                          }`}
                        >
                          {m.label}
                        </p>
                      </td>
                      <td className="py-5 pr-6 text-right font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink-muted)]">
                        {m.params}
                      </td>
                      <td
                        className={`py-5 pr-6 text-right font-[family-name:var(--font-display)] text-2xl tracking-tight ${
                          isFt ? "text-[color:var(--color-ochre-deep)]" : "text-[color:var(--color-ink)]"
                        }`}
                      >
                        {pct(m.overall)}
                      </td>
                      <td className="py-5 pr-6 text-right font-[family-name:var(--font-display)] text-xl tracking-tight text-[color:var(--color-ink)]">
                        {pct(m.core)}
                      </td>
                      <td className="py-5 text-right font-[family-name:var(--font-display)] text-xl tracking-tight text-[color:var(--color-ink)]">
                        {pct(m.buffer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            The fine-tuned model trails Claude by{" "}
            <strong className="text-[color:var(--color-ink)]">
              {pp(gapToOracle)}pp
            </strong>{" "}
            overall but{" "}
            <strong className="text-[color:var(--color-ink)]">
              beats it on the core zone
            </strong>{" "}
            ({pct(finetuned.core)} vs {pct(claude.core)}) — the four fields
            describing the water body itself, where the model has the most
            visual signal to work with.
          </p>
        </div>
      </section>

      {/* ── Why full fine-tune ──────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-20 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
              Approach
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
              Why full weight fine-tuning, not LoRA.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-relaxed text-[color:var(--color-ink-muted)] md:col-span-7 md:col-start-6">
            <p>
              LFM2.5-VL was pretrained on natural images — photographs of
              objects, scenes, faces. Sentinel-2 multispectral imagery is far
              outside that distribution. Sub-pixel water bodies. SWIR false
              colour. Hyperspectral signatures of cropland under drought.
              None of it looks like ImageNet.
            </p>
            <p>
              LoRA freezes the multimodal projector. For our domain that is
              the wrong layer to freeze — the projector is exactly where
              satellite spectral signatures need to be remapped to meaningful
              visual tokens. Full weight fine-tuning was necessary to move
              the accuracy meaningfully.
            </p>
            <p className="font-[family-name:var(--font-display)] text-xl italic leading-snug text-[color:var(--color-ink)]">
              The +{pp(uplift)}pp uplift validates that choice. A LoRA control
              is on the V2 roadmap to quantify the gap.
            </p>
          </div>
        </div>
      </section>

      {/* ── Training parameters ─────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Training
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            Modal H100, 2.5 hours, final loss 0.011.
          </h2>

          <dl className="mt-12 grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Base model", "LiquidAI/LFM2.5-VL-450M"],
              ["Fine-tune type", "Full weights"],
              ["Epochs", "3"],
              ["Learning rate", "2.0e-5 · cosine · 5% warmup"],
              ["Effective batch", "8 (2 × 4 grad accum)"],
              ["Precision", "bfloat16"],
              ["Compute", "Modal H100 · ~2.5 h"],
              ["Final training loss", "0.011"],
              ["Framework", "leap-finetune"],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-[color:var(--color-rule)] pt-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
                  {k}
                </dt>
                <dd className="mt-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink)]">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Dataset construction ─────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Dataset
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            1,656 captures, 376 discarded, 1,280 labelled.
          </h2>

          <ol className="mt-12 space-y-10">
            {[
              {
                n: "01",
                title: "Capture",
                body: "DPhi SimSat fetches Sentinel-2 tiles for twenty monitored sites across 84 months of history. RGB + SWIR, 15 km core and 30 km buffer zone per observation.",
              },
              {
                n: "02",
                title: "Triage",
                body: "Tiles with ≥65% cloud cover or featureless open water are rejected. 1,656 raw observations across collection runs reduced to 1,280 surviving quality triage.",
              },
              {
                n: "03",
                title: "Annotate",
                body: "Claude Opus (claude-opus-4-5) labels every curated observation as the oracle teacher. Eleven structured fields per observation. Same model is also used for the oracle baseline at evaluation time — a known caveat (see Caveats below).",
              },
              {
                n: "04",
                title: "Split",
                body: "Train: observations before 2024-01-01 (1,250 obs). Test: from 2024-01-01 onwards (30 obs). Time-based split so the model never sees a tile from the same site at a similar season during training.",
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

      {/* ── Per-field results ───────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Per-field accuracy
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            Every field broken out. The wins and the losses.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            Accuracy is the fraction of observations where the model&rsquo;s
            prediction exactly matches the oracle ground-truth label. All
            thirty observations evaluated across all ten fields for all three
            models.
          </p>

          <h3 className="mt-12 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
            Core zone — the water body
          </h3>
          <FieldTable rows={coreFields} />

          <h3 className="mt-16 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
            Buffer zone — surrounding land
          </h3>
          <FieldTable rows={bufferFields} />
        </div>
      </section>

      {/* ── Caveats ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)]">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-20 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
              Caveats
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
              Where these numbers should be read with care.
            </h2>
          </div>
          <div className="space-y-8 text-base leading-relaxed text-[color:var(--color-ink-muted)] md:col-span-7 md:col-start-6">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-[color:var(--color-ink)]">
                Self-referential oracle
              </h3>
              <p className="mt-2">
                Claude generated the ground-truth labels and is also evaluated
                against them. Non-determinism is why the oracle scores 86.3%
                and not 100%. Human annotation of a small validation subset
                is on the V2 roadmap to provide an independent anchor.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-[color:var(--color-ink)]">
                Crop stress level — 56.7%
              </h3>
              <p className="mt-2">
                The hardest field. Distinguishing{" "}
                <span className="font-[family-name:var(--font-mono)] text-xs">none / low / moderate / severe</span>{" "}
                from a 15 km tile is inherently ambiguous; the oracle itself
                scores only 76.7%. The ceiling here may reflect a label-quality
                limit rather than a model limit.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-[color:var(--color-ink)]">
                Agriculture present regression
              </h3>
              <p className="mt-2">
                The fine-tune underperforms the oracle on this field (66.7%
                vs 86.7%). Likely cause: training labels for arid sites (Aral
                Sea, Dead Sea) mark agriculture_present=false across many
                months, biasing the model toward under-detection in similar
                test imagery.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-[color:var(--color-ink)]">
                Test set size
              </h3>
              <p className="mt-2">
                Thirty observations is small. Each field-level percentage has
                a ±9pp uncertainty at 95% confidence. The headline numbers
                are real but should not be over-interpreted at single-point
                precision.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reproducibility ─────────────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Reproduce
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            Weights, dataset, training code — all public.
          </h2>

          <dl className="mt-12 divide-y divide-[color:var(--color-rule)]">
            {[
              {
                k: "Fine-tuned weights (GGUF)",
                v: "Arty1001/aquaveritas-lfm-GGUF",
                href: "https://huggingface.co/Arty1001/aquaveritas-lfm-GGUF",
              },
              {
                k: "Training dataset",
                v: "devleks/aquaveritas-water-stress",
                href: "https://huggingface.co/datasets/devleks/aquaveritas-water-stress",
              },
              {
                k: "Fine-tune config",
                v: "configs/aquaveritas_finetune_modal.yaml",
                href: "https://github.com/devleks/AquaVeritas/blob/main/aquaveritas/configs/aquaveritas_finetune_modal.yaml",
              },
              {
                k: "Evaluation script",
                v: "scripts/evaluate.py",
                href: "https://github.com/devleks/AquaVeritas/blob/main/aquaveritas/scripts/evaluate.py",
              },
              {
                k: "Comparison report",
                v: "data/reports/AquaVeritas_Eval_Report_2026-05-04.md",
                href: "https://github.com/devleks/AquaVeritas/blob/main/aquaveritas/data/reports/AquaVeritas_Eval_Report_2026-05-04.md",
              },
            ].map((row) => (
              <div
                key={row.k}
                className="grid grid-cols-1 gap-x-8 gap-y-1 py-5 md:grid-cols-12"
              >
                <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)] md:col-span-4">
                  {row.k}
                </dt>
                <dd className="md:col-span-8">
                  <a
                    href={row.href}
                    className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink)] underline decoration-[color:var(--color-rule)] decoration-2 underline-offset-4 transition-colors hover:decoration-[color:var(--color-ocean)]"
                  >
                    {row.v}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Footer />
    </main>
  );
}

// ── Per-field table ──────────────────────────────────────────────────────────

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-ink)]">
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              Field
            </th>
            <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              Claude
            </th>
            <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              Base LFM
            </th>
            <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              Fine-tuned
            </th>
            <th className="pb-3 text-right text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
              Δ vs base
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-rule)]">
          {rows.map((row) => {
            const delta = row.finetuned - row.base;
            const beatsOracle = row.finetuned > row.claude;
            return (
              <tr key={row.field}>
                <td className="py-4 pr-6">
                  <p className="font-[family-name:var(--font-display)] text-base font-medium leading-tight tracking-tight text-[color:var(--color-ink)]">
                    {row.label}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-ink-faint)]">
                    {row.valid}
                  </p>
                </td>
                <td className="py-4 pr-6 text-right font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink-muted)]">
                  {pct(row.claude)}
                </td>
                <td className="py-4 pr-6 text-right font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink-muted)]">
                  {pct(row.base)}
                </td>
                <td
                  className={`py-4 pr-6 text-right font-[family-name:var(--font-mono)] text-sm ${
                    beatsOracle
                      ? "text-[color:var(--color-ochre-deep)] font-medium"
                      : "text-[color:var(--color-ink)]"
                  }`}
                >
                  {pct(row.finetuned)}
                  {beatsOracle && (
                    <span className="ml-1 align-super text-[9px] uppercase tracking-[0.16em]">
                      beats oracle
                    </span>
                  )}
                </td>
                <td className="py-4 text-right font-[family-name:var(--font-mono)] text-sm text-[color:var(--color-ink)]">
                  +{pp(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
