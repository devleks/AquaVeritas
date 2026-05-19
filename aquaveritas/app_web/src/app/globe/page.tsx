import GlobeRoute from "./GlobeRoute";

export const metadata = {
  title: "Site globe — AquaVeritas",
  description:
    "Twenty freshwater bodies under continuous monitoring. Click any site to run the fine-tuned model on its Sentinel-2 imagery inline.",
};

export default function GlobePage() {
  return <GlobeRoute />;
}
