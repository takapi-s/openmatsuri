import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./styles.css";

export { AppLogo, AppShell, PanelCard } from "./app-shell";

export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "lg";
  block?: boolean;
}) {
  const classes = [
    "om-btn",
    `om-btn--${variant}`,
    `om-btn--${size}`,
    block ? "om-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={classes} suppressHydrationWarning>
      {children}
    </button>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: "#fff",
        color: "#0f172a",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
      }}
    >
      {title && (
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = "#64748b",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}20`,
        color,
      }}
    >
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        fontSize: 14,
        boxSizing: "border-box",
        color: "#0f172a",
        background: "#fff",
        ...props.style,
      }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        fontSize: 14,
        boxSizing: "border-box",
        color: "#0f172a",
        background: "#fff",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        fontSize: 14,
        boxSizing: "border-box",
        color: "#0f172a",
        background: "#fff",
        ...props.style,
      }}
    />
  );
}
