import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";

type NavItemId =
  | "home"
  | "setup"
  | "inventory"
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
  | "auditLogs"
  | "account";

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
    id: "inventory",
    label: "在庫",
    href: "/inventory",
  },
  {
    id: "quick",
    label: "カード",
    href: "/quick",
  },
  {
    id: "barcode",
    label: "バーコード",
    href: "/barcode",
  },
  {
    id: "shortage",
    label: "不足",
    href: "/shortage",
  },
  {
    id: "orders",
    label: "発注候補",
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
  {
    id: "products",
    label: "商品",
    href: "/products",
  },
  {
    id: "suppliers",
    label: "発注先",
    href: "/suppliers",
  },
] as const satisfies readonly NavItem[];

const adminNavItems = [
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
    id: "auditLogs",
    label: "監査ログ",
    href: "/admin/audit-logs",
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

function NavLink({ item, current }: { item: NavItem; current: NavItemId }) {
  const isCurrent = item.id === current;

  return (
    <a
      href={item.href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded border border-accent/30 bg-teal-50 px-3 text-sm font-semibold text-accent shadow-sm sm:h-9"
          : "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded border border-transparent px-3 text-sm font-semibold text-muted transition hover:border-line hover:bg-white/80 hover:text-ink sm:h-9"
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
    <div aria-label={ariaLabel} className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:gap-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
      {items.map((item) => (
        <NavLink key={item.id} item={item} current={current} />
      ))}
    </div>
  );
}

export async function AppNav({ current }: AppNavProps) {
  const session = await auth();
  const canUseAdminMode = isAdminRole(session?.user?.role);
  const isAdminMode =
    canUseAdminMode && (current === "setup" || current === "imports" || current === "admin" || current === "auditLogs");
  const modeItems = isAdminMode ? adminNavItems : workNavItems;

  return (
    <nav
      aria-label="アプリ内メニュー"
      className="sticky top-0 z-30 border-b border-line bg-surface/90 px-3 py-2 backdrop-blur print:hidden sm:px-4 lg:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <NavGroup
            ariaLabel={isAdminMode ? "管理モードメニュー" : "通常業務メニュー"}
            current={current}
            items={modeItems}
          />

          <div className="flex min-w-0 shrink-0 gap-2 overflow-x-auto pb-1 sm:gap-1 xl:overflow-visible xl:pb-0">
            {isAdminMode ? (
              <a
                href="/home"
                className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent sm:h-9"
              >
                通常業務へ
              </a>
            ) : canUseAdminMode ? (
              <a
                href="/admin/users"
                className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent sm:h-9"
              >
                管理
              </a>
            ) : null}

            {helpNavItems.map((item) => (
              <NavLink key={item.id} item={item} current={current} />
            ))}

            <form action="/logout" method="post" className="shrink-0">
              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-danger hover:bg-white hover:text-danger sm:h-9"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
