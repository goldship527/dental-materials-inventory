"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
  showSpinner?: boolean;
};

export function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "処理中",
  showSpinner = true,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={pending}
      className={className}
    >
      {pending && showSpinner ? (
        <span
          className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current align-[-2px]"
          aria-hidden="true"
        />
      ) : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
