import { PageShell } from "@/components/ui/page-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { UserManagement } from "./user-management";

export default async function AdminUsersPage() {
  const context = await requireAdminUser();
  const users = await prisma.user.findMany({
    where: {
      organizationId: context.organizationId,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
      {
        email: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <PageShell current="admin" mainClassName="mx-auto grid w-full max-w-7xl gap-3 px-3 pt-3 pb-6 lg:px-6">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-xl font-bold tracking-tight text-ink">ログインアカウント管理</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            クリニック共通アカウントと管理者個人アカウントを管理します。共通アカウントは一般ユーザーとして作成し、ADMINは本部・事務などの個人アカウントに限定します。
            パスワードリセットはメール送信を行わず、管理者が新しい仮パスワードを設定します。
          </p>
        </header>

        <div className="min-w-0">
          <UserManagement users={users} currentUserId={context.userId} />
        </div>
    </PageShell>
  );
}
