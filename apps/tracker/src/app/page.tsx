import { AppLogo, Button } from "@openmatsuri/ui";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-slate-700">
            <AppLogo className="size-6 rotate-90 text-indigo-500" />
            <span className="text-lg">OpenMATSURI</span>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-600">Tracker</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">位置情報発信 PWA</h1>
          <p className="text-sm font-medium text-slate-500">
            QR コードまたはトークン URL からアクセスしてください。
          </p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/t/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">
            <Button block size="lg">
              デモトラッカーを開く
            </Button>
          </Link>
        </section>
      </div>
    </main>
  );
}
