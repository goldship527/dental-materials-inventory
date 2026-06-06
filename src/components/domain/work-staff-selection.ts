"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

type StoredWorkStaffSelection = {
  date: string;
  staffOperatorId: string;
};

type WorkStaffSelectionEventDetail = {
  clinicId: string;
  staffOperatorId: string;
};

export const workStaffSelectionEventName = "dmi-work-staff-selection-change";

function getTodayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function getStorageKey(clinicId: string) {
  return `dmi_work_staff_selection:${clinicId}`;
}

function readStoredStaffOperatorId(clinicId: string, validStaffOperatorIds: Set<string>) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const storedValue = window.localStorage.getItem(getStorageKey(clinicId));

    if (!storedValue) {
      return "";
    }

    const parsed = JSON.parse(storedValue) as Partial<StoredWorkStaffSelection>;
    const staffOperatorId = typeof parsed.staffOperatorId === "string" ? parsed.staffOperatorId : "";

    if (parsed.date !== getTodayKey() || !validStaffOperatorIds.has(staffOperatorId)) {
      window.localStorage.removeItem(getStorageKey(clinicId));
      return "";
    }

    return staffOperatorId;
  } catch {
    window.localStorage.removeItem(getStorageKey(clinicId));
    return "";
  }
}

function writeStoredStaffOperatorId(clinicId: string, staffOperatorId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getStorageKey(clinicId);

  if (!staffOperatorId) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      date: getTodayKey(),
      staffOperatorId,
    } satisfies StoredWorkStaffSelection),
  );
}

function dispatchWorkStaffSelectionChange(clinicId: string, staffOperatorId: string) {
  window.dispatchEvent(
    new CustomEvent<WorkStaffSelectionEventDetail>(workStaffSelectionEventName, {
      detail: {
        clinicId,
        staffOperatorId,
      },
    }),
  );
}

export function useWorkStaffSelection(options: {
  clinicId: string;
  staffOperators: StaffOperatorOption[];
}) {
  const validStaffOperatorIds = useMemo(
    () => new Set(options.staffOperators.map((staffOperator) => staffOperator.id)),
    [options.staffOperators],
  );
  const [selectedStaffOperatorId, setSelectedStaffOperatorId] = useState("");

  useEffect(() => {
    setSelectedStaffOperatorId(readStoredStaffOperatorId(options.clinicId, validStaffOperatorIds));

    function handleStorage(event: StorageEvent) {
      if (event.key === getStorageKey(options.clinicId)) {
        setSelectedStaffOperatorId(readStoredStaffOperatorId(options.clinicId, validStaffOperatorIds));
      }
    }

    function handleSelectionChange(event: Event) {
      const detail = (event as CustomEvent<WorkStaffSelectionEventDetail>).detail;

      if (detail?.clinicId === options.clinicId) {
        setSelectedStaffOperatorId(
          validStaffOperatorIds.has(detail.staffOperatorId) ? detail.staffOperatorId : "",
        );
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(workStaffSelectionEventName, handleSelectionChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(workStaffSelectionEventName, handleSelectionChange);
    };
  }, [options.clinicId, validStaffOperatorIds]);

  const selectStaffOperator = useCallback(
    (staffOperatorId: string) => {
      const nextStaffOperatorId = validStaffOperatorIds.has(staffOperatorId) ? staffOperatorId : "";

      writeStoredStaffOperatorId(options.clinicId, nextStaffOperatorId);
      setSelectedStaffOperatorId(nextStaffOperatorId);
      dispatchWorkStaffSelectionChange(options.clinicId, nextStaffOperatorId);
    },
    [options.clinicId, validStaffOperatorIds],
  );

  return {
    hasStaffOperators: options.staffOperators.length > 0,
    selectedStaffOperatorId,
    selectStaffOperator,
    selectedStaffOperator:
      options.staffOperators.find((staffOperator) => staffOperator.id === selectedStaffOperatorId) ?? null,
  };
}
