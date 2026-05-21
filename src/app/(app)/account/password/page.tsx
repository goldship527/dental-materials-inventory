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
    <>
      <AppNav current="account" />
      <main className="min-h-screen bg-surface px-4 py-8 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{session.user.email}</p>
            <h1 className="mt-2 text-3xl font-semibold">パスワード変更</h1>
          </div>
          <a className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-accent transition hover:border-accent" href="/home">
            ホームへ戻る
          </a>
        </header>


        <PasswordForm />
        </div>
      </main>
    </>
  );
}
