import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, children, className = "" }: PageHeaderProps) {
  return (
    <header className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <h1 className="text-xl font-semibold text-ink print:text-2xl">{title}</h1>
      {description ? <p className="min-w-0 truncate text-sm text-muted">{description}</p> : null}
      {children ? <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">{children}</div> : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
