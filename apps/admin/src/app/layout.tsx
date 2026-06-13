import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenMATSURI — Admin",
  description: "祭り運営ダッシュボード",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-slate-100 text-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
