import type { ComponentPropsWithoutRef } from "react";

type SectionHeadingProps = ComponentPropsWithoutRef<"h2">;

export function SectionHeading({ children, className = "", ...props }: SectionHeadingProps) {
  return (
    <h2 {...props} className={`border-t-2 border-accent bg-tint px-2.5 py-1.5 text-lg font-semibold text-accent ${className}`}>
      {children}
    </h2>
  );
}
