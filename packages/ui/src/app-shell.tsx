import type { ReactNode } from "react";

type AppShellProps = {
  appLabel: string;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  /** Main area fills the viewport below the header (for map views). */
  fill?: boolean;
};

export function AppLogo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M3.196 12.87l-.825.483a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.758 0l7.25-4.25a.75.75 0 000-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 01-2.276 0L3.196 12.87z" />
      <path d="M3.196 8.87l-.825.483a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.758 0l7.25-4.25a.75.75 0 000-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 01-2.276 0L3.196 8.87z" />
      <path d="M10.38 1.103a.75.75 0 00-.76 0l-7.25 4.25a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.76 0l7.25-4.25a.75.75 0 000-1.294l-7.25-4.25z" />
    </svg>
  );
}

export function PanelCard({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
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

export function AppShell({
  appLabel,
  title,
  description,
  children,
  footer,
  compact = false,
  fill = false,
}: AppShellProps) {
  return (
    <div
      className={`mx-auto flex w-full min-w-[320px] flex-col bg-slate-100 text-slate-900 ${
        fill ? "h-screen" : "min-h-screen"
      }`}
    >
      <header className="z-10 flex flex-none items-center bg-slate-100">
        <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
          <div
            className={`flex flex-col gap-3 border-b-2 border-slate-200/50 sm:flex-row sm:items-center sm:justify-between ${
              compact ? "py-4" : "py-6"
            }`}
          >
            <div className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-slate-700 sm:text-lg">
              <AppLogo className="size-5 rotate-90 text-indigo-500" />
              <span>OpenMATSURI</span>
              <span className="hidden text-slate-300 sm:inline">/</span>
              <span className="text-indigo-600">{appLabel}</span>
            </div>
            {title && (
              <div className="min-w-0 sm:text-end">
                <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
                {description && (
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className={
          fill
            ? "relative min-h-0 flex-1"
            : `container mx-auto flex-auto px-4 lg:px-8 xl:max-w-7xl ${
                compact ? "py-4 lg:py-6" : "py-4 lg:p-8"
              }`
        }
      >
        {children}
      </main>

      {footer !== false && !fill && (
        <footer className="flex grow-0 items-center">
          <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="border-t-2 border-slate-200/50 py-6 text-center text-sm font-medium text-slate-600 md:text-start">
              {footer ?? (
                <>
                  © <span className="font-semibold">OpenMATSURI</span> {appLabel}
                </>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
