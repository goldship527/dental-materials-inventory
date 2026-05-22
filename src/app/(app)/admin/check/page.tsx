import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

type CheckRowProps = {
  label: string;
  value: string;
};

function CheckRow({ label, value }: CheckRowProps) {
  return (
    <div className="grid gap-1 border-b border-line py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="break-all text-sm font-mono text-ink">{value}</dd>
    </div>
  );
}

export default async function AdminCheckPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let dbUser:
    | {
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        organizationId: string;
      }
    | null = null;
  let dbStatus = "ok";

  try {
    dbUser = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });
  } catch {
    dbStatus = "db-error";
  }

  const dbAllowsAdmin = Boolean(dbUser?.isActive && isAdminRole(dbUser.role));
  const sessionAllowsAdmin = isAdminRole(session.user.role);

  return (
    <>
      <AppNav current="admin" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理画面診断</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">管理画面アクセス確認</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            ログイン中ユーザーのセッション情報と、DB上の同じユーザーIDの権限情報を確認します。
          </p>
        </header>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">判定結果</h2>
          <dl className="mt-4">
            <CheckRow label="DB参照状態" value={dbStatus} />
            <CheckRow label="セッション上の管理者判定" value={sessionAllowsAdmin ? "true" : "false"} />
            <CheckRow label="DB上の管理者判定" value={dbAllowsAdmin ? "true" : "false"} />
          </dl>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">セッション</h2>
          <dl className="mt-4">
            <CheckRow label="session.user.id" value={session.user.id ?? "-"} />
            <CheckRow label="session.user.email" value={session.user.email ?? "-"} />
            <CheckRow label="session.user.name" value={session.user.name ?? "-"} />
            <CheckRow label="session.user.role" value={String(session.user.role ?? "-")} />
            <CheckRow label="session.user.organizationId" value={String(session.user.organizationId ?? "-")} />
          </dl>
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">DB上の同一ユーザー</h2>
          {dbUser ? (
            <dl className="mt-4">
              <CheckRow label="User.id" value={dbUser.id} />
              <CheckRow label="User.email" value={dbUser.email} />
              <CheckRow label="User.name" value={dbUser.name} />
              <CheckRow label="User.role" value={dbUser.role} />
              <CheckRow label="User.isActive" value={dbUser.isActive ? "true" : "false"} />
              <CheckRow label="User.organizationId" value={dbUser.organizationId} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-danger">
              セッションのユーザーIDに一致するDBユーザーを取得できませんでした。
            </p>
          )}
        </section>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">移動テスト</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            下のリンクとフォームはどちらも管理画面へ移動します。移動できない場合は、移動後のURLを確認してください。
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-accent bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-dark"
              href="/admin/users"
            >
              リンクで管理画面を開く
            </a>
            <form action="/admin/users" method="get">
              <button
                className="inline-flex h-11 items-center justify-center rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                type="submit"
              >
                フォームで管理画面を開く
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
