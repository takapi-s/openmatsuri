import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AdminCard({ title, description, children, className = "" }: Props) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-6 text-slate-900 ${className}`}
    >
      {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
      {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}
