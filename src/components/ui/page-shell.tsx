import type { ReactNode } from "react";
import { AppNav, type NavItemId } from "@/components/domain/app-nav";

type PageShellProps = {
  current: NavItemId;
  mainClassName: string;
  shellClassName?: string;
  children: ReactNode;
};

export function PageShell({ current, mainClassName, shellClassName, children }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-surface text-ink${shellClassName ? ` ${shellClassName}` : ""}`}>
      <AppNav current={current} />
      <main className={`px-3 lg:px-6 ${mainClassName}`}>{children}</main>
    </div>
  );
}
