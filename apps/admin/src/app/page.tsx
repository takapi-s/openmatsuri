import { LoginForm } from "@/components/LoginForm";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-slate-900">
          OpenMATSURI — Admin
        </h1>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-slate-500">
          デモ: seed 後に任意のメール/パスワードで登録
        </p>
      </div>
    </main>
  );
}
