import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getOrganizationSettings } from "@/lib/db/organization-settings";
import { OrganizationSettingsForm } from "./organization-settings-form";

export default async function AdminSettingsPage() {
  const context = await requireAdminUser();
  const settings = await getOrganizationSettings(context.organizationId);

  return (
    <>
      <AppNav current="settings" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">組織設定</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            組織全体で使う判定しきい値を管理します。ここでの変更は表示・警告の条件だけに使い、在庫数や履歴は変更しません。
          </p>
        </header>

        <OrganizationSettingsForm anomalyOutThreshold={settings.anomalyOutThreshold} />
      </main>
    </>
  );
}
