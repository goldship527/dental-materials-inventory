"use client";

import { useEffect, useRef } from "react";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";

type BarcodeSearchFormProps = {
  defaultBarcode: string;
  actionPath?: string;
  autoFocusInput?: boolean;
  autoSubmitOnScan?: boolean;
  autoSubmitDelayMs?: number;
  clearHref?: string;
};

export function BarcodeSearchForm({
  defaultBarcode,
  actionPath = "/barcode",
  autoFocusInput = true,
  autoSubmitOnScan = false,
  autoSubmitDelayMs = 350,
  clearHref = "/barcode",
}: BarcodeSearchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoFocusInput) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocusInput, defaultBarcode]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoSubmitOnScan) {
      return;
    }

    let bufferedText = "";
    let lastKeyAt = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
    }

    function clearFlushTimer() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    }

    function resetBuffer() {
      bufferedText = "";
      lastKeyAt = 0;
      clearFlushTimer();
    }

    function submitBufferedScan() {
      const scannedText = normalizeBarcodeText(bufferedText);
      resetBuffer();

      if (scannedText.length < 4 || scannedText === normalizeBarcodeText(defaultBarcode)) {
        return;
      }

      if (inputRef.current) {
        inputRef.current.value = scannedText;
      }

      formRef.current?.requestSubmit();
    }

    function scheduleFlush() {
      clearFlushTimer();
      flushTimer = setTimeout(submitBufferedScan, 220);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (bufferedText) {
          event.preventDefault();
          submitBufferedScan();
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = Date.now();

      if (lastKeyAt && now - lastKeyAt > 150) {
        bufferedText = "";
      }

      lastKeyAt = now;
      bufferedText += event.key;
      scheduleFlush();
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearFlushTimer();
    };
  }, [autoSubmitOnScan, defaultBarcode]);

  function scheduleAutoSubmit(value: string) {
    if (!autoSubmitOnScan) {
      return;
    }

    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
    }

    const normalizedValue = normalizeBarcodeText(value);

    if (!normalizedValue || normalizedValue === normalizeBarcodeText(defaultBarcode)) {
      return;
    }

    submitTimerRef.current = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, autoSubmitDelayMs);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={actionPath}
      className="rounded border border-line bg-white p-5 shadow-panel"
    >
      <label className="grid gap-2 text-sm font-semibold text-muted">
        バーコード
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            ref={inputRef}
            type="search"
            name="barcode"
            defaultValue={defaultBarcode}
            placeholder="JAN / GTIN / バーコード"
            autoFocus={autoFocusInput}
            autoComplete="off"
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => scheduleAutoSubmit(event.target.value)}
            className="h-12 rounded border border-line px-4 font-mono text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="h-12 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            検索
          </button>
          <a
            className="flex h-12 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={clearHref}
          >
            クリア
          </a>
        </div>
      </label>
    </form>
  );
}
