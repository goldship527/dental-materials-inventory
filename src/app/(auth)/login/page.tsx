import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/home");
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-ink">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <section>
          <p className="text-sm font-semibold text-accent">dental-materials-inventory</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            一般歯科材料在庫管理システム
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            在庫確認、補充判断、棚卸をまとめて確認できます。
          </p>
        </section>

        <section className="rounded border border-line bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold">ログイン</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            メールアドレスとパスワードを入力してください。
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
