import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell current="account" mainClassName="pt-3 pb-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader title={"通知設定"}>
            <div>
              <p className="text-sm font-semibold text-accent">{user.email}</p>

              <p className="mt-2 text-sm text-muted">朝の在庫ダイジェストの配信条件を設定します。</p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded btn-secondary px-4 text-sm font-semibold transition"
              href="/home"
            >
              ホームへ戻る
            </a>
          </PageHeader>

          <NotificationPreferenceForm preference={preference} />
        </div>
    </PageShell>
  );
}
