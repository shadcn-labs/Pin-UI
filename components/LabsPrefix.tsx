import Link from "next/link";
import { LabsIcon } from "./labs/LabsIcons";
import "./labs-prefix.css";

/**
 * "(S) /" in front of the Pin UI lockup: Pin UI as a part of Shadcn Labs,
 * written the way a path is — the lab, then the project. The lab's mark goes
 * to /shadcn-labs; the slash is only type. It takes its colour from the
 * lockup it sits in, so it follows both themes with it, and its size from the
 * wordmark's (set per lockup in labs-prefix.css).
 */
export default function LabsPrefix({ className }: { className?: string }) {
  return (
    <span className={`labsx ${className ?? ""}`}>
      <Link className="labsx__link" href="/shadcn-labs" aria-label="Shadcn Labs — Pin UI is part of it" title="Part of Shadcn Labs">
        <LabsIcon className="labsx__icon" />
      </Link>
      <span className="labsx__slash" aria-hidden="true">
        /
      </span>
    </span>
  );
}
