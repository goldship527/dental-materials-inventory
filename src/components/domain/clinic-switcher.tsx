"use client";

import { useEffect, useState } from "react";
import { switchActiveClinicAction } from "@/lib/actions/active-clinic";
import type { ActiveClinicOption } from "@/lib/db/clinic";

type ClinicSwitcherProps = {
  activeClinicId: string;
  clinics: ActiveClinicOption[];
};

export function ClinicSwitcher({ activeClinicId, clinics }: ClinicSwitcherProps) {
  const [returnTo, setReturnTo] = useState("/home");

  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}`);
  }, []);

  if (clinics.length <= 1) {
    return null;
  }

  return (
    <form action={switchActiveClinicAction} className="flex min-w-max shrink-0 items-center gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="active-clinic-id" className="sr-only">
        対象クリニック
      </label>
      <select
        id="active-clinic-id"
        name="clinicId"
        defaultValue={activeClinicId}
        className="h-11 w-48 max-w-[58vw] rounded border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm sm:h-9"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {clinics.map((clinic) => (
          <option key={clinic.id} value={clinic.id}>
            {clinic.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded border border-line bg-white/80 px-3 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent sm:h-9"
      >
        切替
      </button>
    </form>
  );
}
