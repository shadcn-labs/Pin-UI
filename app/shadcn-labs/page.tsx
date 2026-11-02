import type { Metadata } from "next";
import ShadcnLabs from "@/components/labs/ShadcnLabs";
import NoFlashScript from "@/components/NoFlashScript";
import { INTRO_SCRIPT } from "@/components/labs/intro";

export const metadata: Metadata = {
  title: "Pin UI × Shadcn Labs",
  description: "Pin UI is now part of Shadcn Labs — open-source technologies that push the limits of the shadcn/ui ecosystem.",
  alternates: { canonical: "/shadcn-labs" },
};

/** Pin UI × Shadcn Labs — the announcement page (Figma 596:131). */
export default function ShadcnLabsPage() {
  return (
    <>
      <ShadcnLabs />
      {/*
        After the page's markup, so it can measure it: open at the foot before
        the first paint. Live only in the server HTML — arriving by an in-app
        link, React renders it inert (no warning) and LabsIntro does the work.
      */}
      <NoFlashScript id="labs-intro" code={INTRO_SCRIPT} />
    </>
  );
}
