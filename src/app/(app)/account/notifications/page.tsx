import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { prisma } from "@/lib/db/prisma";
import { getNotificationPreferenceForUser } from "@/lib/notifications/preferences";
import { NotificationPreferenceForm } from "./notification-preference-form";

export default async function AccountNotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      isActive: true,
    },
  });

  if (!user?.isActive) {
    redirect("/logout");
  }

  const preference = await getNotificationPreferenceForUser(user.organizationId, user.id);

  return (
    <>
      <AppNav current="account" />
      <main className="min-h-screen bg-surface px-4 py-8 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">{user.email}</p>
              <h1 className="mt-2 text-3xl font-semibold">通知設定</h1>
              <p className="mt-2 text-sm text-muted">朝の在庫ダイジェストの配信条件を設定します。</p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-accent transition hover:border-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </header>

          <NotificationPreferenceForm preference={preference} />
        </div>
      </main>
    </>
  );
}
