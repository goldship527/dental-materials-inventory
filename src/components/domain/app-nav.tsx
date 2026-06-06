import { auth } from "@/auth";
import { ClinicSwitcher } from "@/components/domain/clinic-switcher";
import { WorkStaffSelector } from "@/components/domain/work-staff-selector";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";

type NavItemId =
  | "home"
  | "overview"
  | "setup"
  | "inventory"
  | "dormant"
  | "products"
  | "suppliers"
  | "barcode"
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
    id: "quick",
    label: "出庫",
    href: "/quick",
  },
  {
    id: "barcode",
    label: "バーコード検索",
    href: "/barcode",
  },
  {
    id: "inventory",
    label: "在庫",
    href: "/inventory",
  },
  {
    id: "shortage",
    label: "不足",
    href: "/shortage",
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
    label: "ユーザー管理",
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

function NavLink({ item, current, compact = false }: { item: NavItem; current: NavItemId; compact?: boolean }) {
  const isCurrent = item.id === current;
  const baseClassName = compact
    ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded px-2 text-xs font-semibold"
    : "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded px-3 text-sm font-semibold sm:h-9";

  return (
    <a
      href={item.href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? `${baseClassName} border border-accent/30 bg-teal-50 text-accent`
          : `${baseClassName} border border-transparent text-muted transition hover:border-line hover:bg-white/80 hover:text-ink`
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
  compact = false,
}: {
  ariaLabel: string;
  current: NavItemId;
  items: readonly NavItem[];
  compact?: boolean;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:gap-1 lg:pb-0"
    >
      {items.map((item) => (
        <NavLink key={item.id} item={item} current={current} compact={compact} />
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
  const topRowClassName = isAdminMode
    ? "flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4"
    : "flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4";
  const actionGroupClassName = isAdminMode
    ? "flex min-w-0 gap-2 overflow-x-auto pb-1 sm:gap-1 lg:shrink-0 lg:justify-end lg:overflow-visible lg:pb-0"
    : "flex min-w-0 gap-2 overflow-x-auto pb-1 sm:gap-1 lg:shrink-0 lg:justify-end lg:overflow-visible lg:pb-0";
  const shouldShowContextRow = Boolean(activeClinicContext);
  const shouldShowContextControls =
    shouldShowWorkStaffSelector || clinicSelection?.canSelectClinic;
  const utilityButtonClassName = isAdminMode
    ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded border border-line bg-white/80 px-2 text-xs font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
    : "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent sm:h-9";
  const logoutButtonClassName = isAdminMode
    ? "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded border border-line bg-white/80 px-2 text-xs font-semibold text-muted transition hover:border-danger hover:bg-white hover:text-danger"
    : "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-danger hover:bg-white hover:text-danger sm:h-9";

  return (
    <nav
      aria-label="アプリ内メニュー"
      className="sticky top-0 z-30 border-b border-line bg-surface/90 px-3 py-2 backdrop-blur print:hidden sm:px-4 lg:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
        <div className={topRowClassName}>
          <NavGroup
            ariaLabel={isAdminMode ? "管理モードメニュー" : "通常業務メニュー"}
            current={current}
            items={modeItems}
            compact={isAdminMode}
          />

          <div className={actionGroupClassName}>
            {isAdminMode ? (
              <a
                href="/home"
                className={utilityButtonClassName}
              >
                通常業務へ
              </a>
            ) : canUseAdminMode ? (
              <a
                href="/admin/overview"
                className={utilityButtonClassName}
              >
                管理
              </a>
            ) : null}

            {helpNavItems.map((item) => (
              <NavLink key={item.id} item={item} current={current} compact={isAdminMode} />
            ))}

            <form action="/logout" method="post" className="shrink-0">
              <button
                type="submit"
                className={logoutButtonClassName}
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>

        {shouldShowContextRow && activeClinicContext ? (
          <div className="flex flex-col gap-2 border-t border-line/70 py-2 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="truncate text-xl font-semibold text-accent">{activeClinicContext.clinicName}</p>
              {session?.user?.name ? (
                <p className="truncate text-sm text-muted">{session.user.name} としてログイン中</p>
              ) : null}
            </div>

            {shouldShowContextControls ? (
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:gap-2 md:justify-end md:overflow-visible md:pb-0">
                {shouldShowWorkStaffSelector ? (
                  <WorkStaffSelector clinicId={activeClinicContext.clinicId} staffOperators={staffOperators} />
                ) : null}

                {clinicSelection?.canSelectClinic ? (
                  <ClinicSwitcher activeClinicId={clinicSelection.activeClinicId} clinics={clinicSelection.clinics} />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
