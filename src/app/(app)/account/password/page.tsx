import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { PasswordForm } from "./password-form";

export default async function AccountPasswordPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{session.user.email}</p>
            <h1 className="mt-2 text-3xl font-semibold">パスワード変更</h1>
            <p className="mt-2 text-sm text-muted">
              現在のパスワードを確認してから、新しいパスワードを保存します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/home">
            ホームへ戻る
          </a>
        </header>

        <AppNav current="account" />

        <section className="rounded border border-warning/30 bg-yellow-50 px-4 py-3 text-sm text-warning">
          複数人で同じ開発用アカウントを共有している場合は、変更後のパスワードを関係者に共有し、必要に応じてログアウトして再ログインしてください。
        </section>

        <PasswordForm />
      </div>
    </main>
  );
}
