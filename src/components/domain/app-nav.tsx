import { logoutAction } from "@/lib/actions/session";

type AppNavProps = {
  current:
    | "home"
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
    | "account";
};

const navItems = [
  {
    id: "home",
    label: "ホーム",
    href: "/home",
  },
  {
    id: "inventory",
    label: "在庫一覧",
    href: "/inventory",
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
  {
    id: "barcode",
    label: "バーコード",
    href: "/barcode",
  },
  {
    id: "imports",
    label: "取込確認",
    href: "/imports/medical-devices",
  },
  {
    id: "quick",
    label: "カード",
    href: "/quick",
  },
  {
    id: "shortage",
    label: "不足一覧",
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
    id: "manual",
    label: "マニュアル",
    href: "/manual",
  },
  {
    id: "account",
    label: "アカウント",
    href: "/account/password",
  },
  {
    id: "stocktake",
    label: "棚卸",
    href: "/stocktake/sessions",
  },
] as const;

export function AppNav({ current }: AppNavProps) {
  return (
    <nav aria-label="アプリ内メニュー" className="print:hidden">
      <div className="flex flex-col gap-2 rounded border border-line bg-white p-2 shadow-panel md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isCurrent = item.id === current;

            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "rounded bg-accent px-4 py-2 text-sm font-semibold text-white"
                    : "rounded px-4 py-2 text-sm font-semibold text-muted transition hover:bg-gray-50 hover:text-ink"
                }
              >
                {item.label}
              </a>
            );
          })}
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-danger hover:text-danger"
          >
            ログアウト
          </button>
        </form>
      </div>
    </nav>
  );
}
