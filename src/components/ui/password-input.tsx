"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={isVisible ? "text" : "password"}
        className={className ? `${className} w-full pr-20` : "w-full pr-20"}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded border border-line bg-white px-3 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? "パスワードを隠す" : "パスワードを表示"}
      >
        {isVisible ? "非表示" : "表示"}
      </button>
    </div>
  );
}
