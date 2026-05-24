"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";

export const barcodeStockStaffScanEvent = "barcode-stock-staff-scan";

type BarcodeStockStaffScanDetail = {
  barcode: string;
};

type BarcodeStockScanCaptureProps = {
  currentBarcode: string;
  hasSelectedProduct: boolean;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  return target.isContentEditable;
}

function dispatchStaffScan(barcode: string) {
  window.dispatchEvent(
    new CustomEvent<BarcodeStockStaffScanDetail>(barcodeStockStaffScanEvent, {
      detail: {
        barcode,
      },
    }),
  );
}

export function BarcodeStockScanCapture({ currentBarcode, hasSelectedProduct }: BarcodeStockScanCaptureProps) {
  const router = useRouter();
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearFlushTimer() {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    }

    function resetBuffer() {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
      clearFlushTimer();
    }

    function flushBuffer() {
      const scannedText = normalizeBarcodeText(bufferRef.current);
      resetBuffer();

      if (scannedText.length < 4) {
        return;
      }

      if (hasSelectedProduct) {
        dispatchStaffScan(scannedText);
        return;
      }

      if (scannedText === normalizeBarcodeText(currentBarcode)) {
        return;
      }

      router.push(`/barcode/stock?barcode=${encodeURIComponent(scannedText)}`);
    }

    function scheduleFlush() {
      clearFlushTimer();
      flushTimerRef.current = setTimeout(flushBuffer, 220);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (bufferRef.current) {
          event.preventDefault();
          flushBuffer();
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = Date.now();

      if (lastKeyAtRef.current && now - lastKeyAtRef.current > 150) {
        bufferRef.current = "";
      }

      lastKeyAtRef.current = now;
      bufferRef.current += event.key;
      scheduleFlush();
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearFlushTimer();
    };
  }, [currentBarcode, hasSelectedProduct, router]);

  return null;
}
