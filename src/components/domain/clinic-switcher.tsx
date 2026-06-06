"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { switchActiveClinicAction } from "@/lib/actions/active-clinic";
import type { ActiveClinicOption } from "@/lib/db/clinic";

type ClinicSwitcherProps = {
  activeClinicId: string;
  clinics: ActiveClinicOption[];
};

function ClinicSwitchButton({ isSubmitting }: { isSubmitting: boolean }) {
  const { pending } = useFormStatus();
  const isPending = pending || isSubmitting;

  return (
    <button
      type="submit"
      disabled={isPending}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent disabled:cursor-wait disabled:border-accent/40 disabled:bg-teal-50 disabled:text-accent sm:h-9"
    >
      {isPending ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
      ) : null}
      {isPending ? "切替中..." : "切替"}
    </button>
  );
}

export function ClinicSwitcher({ activeClinicId, clinics }: ClinicSwitcherProps) {
  const [returnTo, setReturnTo] = useState("/home");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}`);
  }, []);

  if (clinics.length <= 1) {
    return null;
  }

  return (
    <form
      action={switchActiveClinicAction}
      className="flex min-w-max shrink-0 items-center gap-2"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="active-clinic-id" className="sr-only">
        対象クリニック
      </label>
      <select
        id="active-clinic-id"
        name="clinicId"
        defaultValue={activeClinicId}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="h-11 w-48 max-w-[58vw] rounded border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm disabled:cursor-wait disabled:border-accent/40 disabled:bg-teal-50 disabled:text-accent sm:h-9"
        onChange={(event) => {
          setIsSubmitting(true);
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {clinics.map((clinic) => (
          <option key={clinic.id} value={clinic.id}>
            {clinic.name}
          </option>
        ))}
      </select>
      <ClinicSwitchButton isSubmitting={isSubmitting} />
      <span className="sr-only" aria-live="polite">
        {isSubmitting ? "クリニックを切り替えています" : ""}
      </span>
    </form>
  );
}
