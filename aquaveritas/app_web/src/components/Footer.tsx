import Link from "next/link";

/**
 * Shared site footer. Carries the navigation, the licence line, and the
 * browser-support note (one place to update if support widens).
 */
export default function Footer() {
  return (
    <footer className="mt-auto bg-[color:var(--color-ink)] text-[color:var(--color-surface)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            AquaVeritas
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[color:var(--color-ink-faint)]">
            Orbital freshwater intelligence. Built on LFM2.5-VL, Sentinel-2
            imagery, and the DPhi SimSat platform.
          </p>
        </div>

        <div className="md:col-span-3 md:col-start-7">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
            Product
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/live" className="hover:text-white">
                Live inference
              </Link>
            </li>
            <li>
              <Link href="/globe" className="hover:text-white">
                Site globe
              </Link>
            </li>
            <li>
              <Link href="/methodology" className="hover:text-white">
                Methodology
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
            Source
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a
                href="https://github.com/devleks/AquaVeritas"
                className="hover:text-white"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://huggingface.co/Arty1001/aquaveritas-lfm-GGUF"
                className="hover:text-white"
              >
                HuggingFace
              </a>
            </li>
            <li>
              <a
                href="https://huggingface.co/datasets/devleks/aquaveritas-water-stress"
                className="hover:text-white"
              >
                Dataset
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Browser support note — kept above the licence line so it isn't missed */}
      <div className="border-t border-[color:var(--color-ink-muted)]">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs leading-relaxed text-[color:var(--color-ink-faint)]">
          <span className="text-[color:var(--color-surface)]">
            Browser support:
          </span>{" "}
          Live inference is best on the latest <strong>Chrome</strong>,{" "}
          <strong>Chromium</strong>, <strong>Brave</strong>, or{" "}
          <strong>Edge</strong> — WebGPU runs the model client-side. Safari
          and Firefox fall back automatically to WebAssembly (slower but
          functional). The static pages render on any modern browser.
        </div>
      </div>

      <div className="border-t border-[color:var(--color-ink-muted)]">
        <p className="mx-auto max-w-6xl px-6 py-6 text-xs text-[color:var(--color-ink-faint)]">
          AGPL-3.0 inherited from SimSat upstream. Model weights under LFM
          Open License v1.0.
        </p>
      </div>
    </footer>
  );
}
