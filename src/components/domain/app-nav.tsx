import { auth } from "@/auth";
import { ClinicSwitcher } from "@/components/domain/clinic-switcher";
import { AppNavMoreMenu } from "@/components/domain/app-nav-more-menu";
import { WorkStaffSelector } from "@/components/domain/work-staff-selector";
import { SubmitButton } from "@/components/ui/submit-button";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { isWorkflowLinkVisible, receivePath, stockOutPath } from "@/lib/workflow-features";

type NavItemId =
  | "home"
  | "overview"
  | "setup"
  | "inventory"
  | "dormant"
  | "products"
  | "suppliers"
  | "barcode"
  | "barcodeOut"
  | "barcodeReceive"
  | "barcodeBatch"
  | "imports"
  | "quick"
  | "shortage"
  | "orders"
  | "movements"
  | "manual"
  | "stocktake"
  | "admin"
  | "staffOperators"
  | "auditLogs"
  | "storage"
  | "settings"
  | "account"
  | "notifications";

type AppNavProps = {
  current: NavItemId;
};

type NavItem = {
  id: NavItemId;
  label: string;
  href: string;
};

const workNavItems = [
  {
    id: "home",
    label: "ホーム",
    href: "/home",
  },
  {
    id: "barcodeOut",
    label: "出庫",
    href: stockOutPath,
  },
  {
    id: "barcodeReceive",
    label: "納品",
    href: receivePath,
  },
  {
    id: "inventory",
    label: "在庫",
    href: "/inventory",
  },
  {
    id: "orders",
    label: "発注",
    href: "/orders",
  },
  {
    id: "movements",
    label: "履歴",
    href: "/movements",
  },
  {
    id: "stocktake",
    label: "棚卸",
    href: "/stocktake/sessions",
  },
] as const satisfies readonly NavItem[];

const adminNavItems = [
  {
    id: "overview",
    label: "本部ダッシュボード",
    href: "/admin/overview",
  },
  {
    id: "setup",
    label: "初期設定",
    href: "/setup",
  },
  {
    id: "imports",
    label: "取込確認",
    href: "/imports/medical-devices",
  },
  {
    id: "admin",
    label: "ログインアカウント",
    href: "/admin/users",
  },
  {
    id: "staffOperators",
    label: "担当者",
    href: "/admin/staff-operators",
  },
  {
    id: "auditLogs",
    label: "監査ログ",
    href: "/admin/audit-logs",
  },
  {
    id: "storage",
    label: "ストレージ診断",
    href: "/admin/storage",
  },
  {
    id: "settings",
    label: "組織設定",
    href: "/admin/settings",
  },
] as const satisfies readonly NavItem[];

const helpNavItems = [
  {
    id: "manual",
    label: "マニュアル",
    href: "/manual",
  },
  {
    id: "account",
    label: "アカウント",
    href: "/account/password",
  },
] as const satisfies readonly NavItem[];

function NavLink({
  item,
  current,
}: {
  item: NavItem;
  current: NavItemId;
}) {
  const isCurrent = item.id === current;
  const baseClassName = "inline-flex h-14 shrink-0 items-center whitespace-nowrap rounded-t px-3 text-base";

  return (
    <a
      href={item.href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? `${baseClassName} bg-surface font-semibold text-accent`
          : `${baseClassName} font-medium text-white/[.82] transition hover:bg-white/10 hover:text-white`
      }
    >
      {item.label}
    </a>
  );
}

function NavGroup({
  ariaLabel,
  current,
  items,
}: {
  ariaLabel: string;
  current: NavItemId;
  items: readonly NavItem[];
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
    >
      {items.filter(item => isWorkflowLinkVisible(item.href)).map((item) => (
        <NavLink key={item.id} item={item} current={current} />
      ))}
    </div>
  );
}

export async function AppNav({ current }: AppNavProps) {
  const session = await auth();
  const canUseAdminMode = isAdminRole(session?.user?.role);
  const activeClinicContext = session?.user?.id
    ? await requireActiveClinic({ sessionUser: session.user })
    : null;
  const clinicSelection =
    activeClinicContext?.canSelectClinic && activeClinicContext.availableClinics
      ? {
          activeClinicId: activeClinicContext.clinicId,
          canSelectClinic: true,
          clinics: activeClinicContext.availableClinics,
        }
      : null;
  const isAdminMode =
    canUseAdminMode &&
    (current === "overview" ||
      current === "setup" ||
      current === "imports" ||
      current === "admin" ||
      current === "staffOperators" ||
      current === "auditLogs" ||
      current === "storage" ||
      current === "settings");
  const shouldShowWorkStaffSelector =
    Boolean(activeClinicContext) && !isAdminMode && current !== "stocktake";
  const staffOperators =
    shouldShowWorkStaffSelector && activeClinicContext
      ? await getActiveStaffOperatorOptionsForClinic({
          organizationId: activeClinicContext.organizationId,
          clinicId: activeClinicContext.clinicId,
        })
      : [];
  const modeItems = isAdminMode ? adminNavItems : workNavItems;
  const menuItemClassName = "flex min-h-11 w-full items-center rounded px-3 text-sm font-semibold text-ink hover:bg-tint hover:text-accent";

  return (
    <nav
      aria-label="アプリ内メニュー"
      className="sticky top-0 z-30 -mx-3 -mt-3 bg-accent px-3 print:hidden lg:-mx-6 lg:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col sm:h-14 sm:flex-row sm:items-center">
        {activeClinicContext ? (
          <p className="order-1 truncate pt-2 text-sm font-semibold text-white sm:order-2 sm:max-w-40 sm:pt-0 lg:max-w-52">
            {activeClinicContext.clinicName}
          </p>
        ) : null}
        <div className="order-3 min-w-0 sm:order-1 sm:flex sm:min-w-0 sm:flex-1">
          <NavGroup
            ariaLabel={isAdminMode ? "管理モードメニュー" : "通常業務メニュー"}
            current={current}
            items={modeItems}
          />
        </div>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3">
          {shouldShowWorkStaffSelector && activeClinicContext ? (
            <WorkStaffSelector clinicId={activeClinicContext.clinicId} staffOperators={staffOperators} />
          ) : null}
          <AppNavMoreMenu>
            {isAdminMode ? (
              <a href="/home" className={menuItemClassName}>通常業務へ</a>
            ) : canUseAdminMode ? (
              <a href="/admin/overview" className={menuItemClassName}>管理</a>
            ) : null}
            {helpNavItems.map((item) => (
              <a key={item.id} href={item.href} aria-current={item.id === current ? "page" : undefined} className={menuItemClassName}>
                {item.label}
              </a>
            ))}
            {clinicSelection?.canSelectClinic ? (
              <div className="border-t border-line p-2">
                <ClinicSwitcher activeClinicId={clinicSelection.activeClinicId} clinics={clinicSelection.clinics} />
              </div>
            ) : null}
            <div role="separator" className="my-1 border-t border-line" />
            <form action="/logout" method="post">
              <SubmitButton pendingLabel="ログアウト中" className={`${menuItemClassName} text-danger`}>
                ログアウト
              </SubmitButton>
            </form>
          </AppNavMoreMenu>
        </div>
      </div>
    </nav>
  );
}
