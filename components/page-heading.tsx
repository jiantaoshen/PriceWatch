import type { ReactNode } from "react";
import { ui } from "../lib/ui";

type PageHeadingProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
};

/** Consistent heading across Products, Runs, and Scheduler. */
export function PageHeading({
  title,
  description,
  eyebrow,
  action,
}: PageHeadingProps) {
  return (
    <div className={ui.pageHeading}>
      <div>
        {eyebrow && <p className={ui.eyebrow}>{eyebrow}</p>}
        <h1 className={ui.pageTitle}>{title}</h1>
        {description && <p className={ui.subtitle}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
