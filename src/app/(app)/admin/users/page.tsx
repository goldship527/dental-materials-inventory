import { AppNav } from "@/components/domain/app-nav";
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
    <>
      <AppNav current="admin" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">ユーザー管理</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            同じ組織のユーザーを追加し、退職者などのアカウントを無効化できます。パスワードリセットはメール送信を行わず、管理者が新しい仮パスワードを設定します。
          </p>
        </header>

        <div className="min-w-0">
          <UserManagement users={users} currentUserId={context.userId} />
        </div>
      </main>
    </>
  );
}
