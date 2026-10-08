import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
import { PasswordForm } from "./password-form";

export default async function AccountPasswordPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <PageShell current="account" mainClassName="px-3 pt-3 pb-6 lg:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader title={"パスワード変更"}>
            <div>
              <p className="text-sm font-semibold text-accent">{session.user.email}</p>

            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-11 items-center rounded btn-secondary px-4 text-sm font-semibold transition"
                href="/account/notifications"
              >
                通知設定
              </a>
              <a
                className="inline-flex min-h-11 items-center rounded btn-secondary px-4 text-sm font-semibold transition"
                href="/home"
              >
                ホームへ戻る
              </a>
            </div>
          </PageHeader>

          <PasswordForm />
        </div>
    </PageShell>
  );
}
