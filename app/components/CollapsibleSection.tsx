"use client";

import { type ReactNode, useId, useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  openLabel?: string;
  closeLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
};

/** A consistent, accessible page-within-page workspace. */
export default function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  openLabel = "Open",
  closeLabel = "Close",
  className = "db-card",
  style,
  id,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section id={id} className={className} style={{ padding: 20, ...style }}>
      <div className="db-collapsible-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p className="db-helper">{description}</p> : null}
        </div>
        <button
          type="button"
          className="db-collapse-action db-section-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? closeLabel : openLabel}
        </button>
      </div>
      {open ? <div id={contentId} className="db-collapsible-content">{children}</div> : null}
    </section>
  );
}
