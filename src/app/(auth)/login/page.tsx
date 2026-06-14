import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  const params = (await searchParams) ?? {};

  if (session?.user) {
    redirect("/home");
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center gap-8">
        <section>
          <p className="text-sm font-semibold text-accent">dental-materials-inventory</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
            一般歯科材料在庫管理システム
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            在庫確認、補充判断、棚卸をまとめて確認できます。
          </p>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded border border-line bg-white shadow-panel">
            <img
              src="/login-visual-tablet-desk.webp"
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>

          <section className="rounded border border-line bg-white p-6 shadow-panel">
            <h2 className="text-xl font-semibold">ログイン</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              メールアドレスとパスワードを入力してください。
            </p>
            <div className="mt-6">
              <LoginForm
                errorMessage={
                  params.error === "credentials"
                    ? "メールアドレスまたはパスワードが違います。"
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
