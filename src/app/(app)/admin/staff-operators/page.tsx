import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getStaffOperatorClinicOptions, getStaffOperatorRows } from "@/lib/db/staff-operators";
import { StaffOperatorManagement } from "./staff-operator-management";

export default async function AdminStaffOperatorsPage() {
  const context = await requireAdminUser();
  const [operators, clinics] = await Promise.all([
    getStaffOperatorRows(context.organizationId),
    getStaffOperatorClinicOptions(context.organizationId),
  ]);

  return (
    <>
      <AppNav current="staffOperators" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">スタッフ担当者</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            バーコード出入庫で実際に作業した担当者を記録するためのスタッフバーコードを管理します。
            ログインアカウントとは分けて扱い、応援作業用のヘルプ担当者も登録できます。
          </p>
        </header>

        <StaffOperatorManagement operators={operators} clinics={clinics} />
      </main>
    </>
  );
}
