import { loginAction } from "@/lib/actions/session";

type LoginFormProps = {
  errorMessage?: string;
};

export function LoginForm({ errorMessage }: LoginFormProps) {
  const defaultEmail = process.env.NODE_ENV === "production" ? "" : "test@example.com";
  const defaultPassword = process.env.NODE_ENV === "production" ? "" : "password";

  return (
    <form action={loginAction} className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue={defaultPassword}
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {errorMessage ? (
        <p className="rounded border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        className="h-12 rounded bg-accent px-5 text-base font-semibold text-white transition hover:bg-teal-800"
      >
        ログイン
      </button>
    </form>
  );
}
