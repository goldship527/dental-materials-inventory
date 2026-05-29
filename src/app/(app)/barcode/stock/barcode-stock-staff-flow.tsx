"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";
import { BarcodeSearchForm } from "../barcode-search-form";

const staffBarcodeStorageKey = "dentalInventory.barcodeStock.staffBarcode";
export const productBarcodeInputId = "barcode-stock-product-barcode";

type BarcodeStockStaffContextValue = {
  staffBarcode: string;
  clearStaffBarcode: () => void;
};

const BarcodeStockStaffContext = createContext<BarcodeStockStaffContextValue | null>(null);

export function useBarcodeStockStaff() {
  const context = useContext(BarcodeStockStaffContext);

  if (!context) {
    throw new Error("useBarcodeStockStaff must be used inside BarcodeStockStaffFlow.");
  }

  return context;
}

type BarcodeStockStaffFlowProps = {
  barcode: string;
  children: ReactNode;
};

export function BarcodeStockStaffFlow({ barcode, children }: BarcodeStockStaffFlowProps) {
  const staffInputRef = useRef<HTMLInputElement>(null);
  const autoSetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [staffBarcode, setStaffBarcode] = useState("");
  const [draftStaffBarcode, setDraftStaffBarcode] = useState("");

  useEffect(() => {
    const savedStaffBarcode = window.sessionStorage.getItem(staffBarcodeStorageKey) ?? "";

    setStaffBarcode(savedStaffBarcode);
    setDraftStaffBarcode(savedStaffBarcode);
  }, []);

  useEffect(() => {
    if (!staffBarcode) {
      staffInputRef.current?.focus();
      staffInputRef.current?.select();
      return;
    }

    const productBarcodeInput = document.getElementById(productBarcodeInputId);

    if (productBarcodeInput instanceof HTMLInputElement) {
      productBarcodeInput.focus();
      productBarcodeInput.select();
    }
  }, [staffBarcode, barcode]);

  useEffect(() => {
    return () => {
      if (autoSetTimerRef.current) {
        clearTimeout(autoSetTimerRef.current);
      }
    };
  }, []);

  function setFixedStaffBarcode(value: string) {
    const normalizedValue = normalizeBarcodeText(value).toUpperCase();

    if (!normalizedValue) {
      return;
    }

    setStaffBarcode(normalizedValue);
    setDraftStaffBarcode(normalizedValue);
    window.sessionStorage.setItem(staffBarcodeStorageKey, normalizedValue);
  }

  function scheduleStaffBarcodeSet(value: string) {
    const normalizedValue = normalizeBarcodeText(value).toUpperCase();

    setDraftStaffBarcode(normalizedValue);

    if (autoSetTimerRef.current) {
      clearTimeout(autoSetTimerRef.current);
    }

    if (normalizedValue.length < 4) {
      return;
    }

    autoSetTimerRef.current = setTimeout(() => {
      setFixedStaffBarcode(normalizedValue);
    }, 250);
  }

  function clearStaffBarcode() {
    setStaffBarcode("");
    setDraftStaffBarcode("");
    window.sessionStorage.removeItem(staffBarcodeStorageKey);
  }

  if (!staffBarcode) {
    return (
      <section className="rounded border border-blue-100 bg-blue-50 p-5 shadow-panel">
        <p className="text-xs font-semibold text-accent">1. 担当者確認</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">担当者バーコードを読み取ってください</h2>
        <p className="mt-2 text-sm text-blue-900">
          最初に作業する担当者を固定します。固定後は、同じ担当者のまま商品バーコードを続けて読み取れます。
        </p>
        <label className="mt-4 grid gap-2 text-sm font-semibold text-blue-900">
          担当者バーコード
          <input
            ref={staffInputRef}
            autoFocus
            autoComplete="off"
            className="h-12 rounded border border-blue-200 bg-white px-3 font-mono text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            maxLength={64}
            value={draftStaffBarcode}
            onInput={(event) => scheduleStaffBarcodeSet(event.currentTarget.value)}
            onChange={(event) => scheduleStaffBarcodeSet(event.target.value)}
            onCompositionEnd={(event) => setFixedStaffBarcode(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                setFixedStaffBarcode(event.currentTarget.value);
              }
            }}
            placeholder="STAFF-0001"
          />
        </label>
        <button
          type="button"
          onClick={() => setFixedStaffBarcode(draftStaffBarcode)}
          disabled={!draftStaffBarcode}
          className="mt-4 h-11 rounded bg-accent px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          この担当者で開始
        </button>
      </section>
    );
  }

  return (
    <BarcodeStockStaffContext.Provider value={{ staffBarcode, clearStaffBarcode }}>
      <section className="rounded border border-blue-100 bg-blue-50 p-4 shadow-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-accent">1. 担当者確認済み</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">
              担当者バーコード: <span className="font-mono">{staffBarcode}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-blue-800">次に読むもの: 商品バーコード</p>
          </div>
          <button
            type="button"
            onClick={clearStaffBarcode}
            className="self-start rounded border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 transition hover:border-blue-400 sm:self-auto"
          >
            担当者を変更
          </button>
        </div>
      </section>

      <BarcodeSearchForm
        defaultBarcode={barcode}
        actionPath="/barcode/stock"
        autoFocusInput
        autoSubmitOnScan
        clearHref="/barcode/stock"
        inputId={productBarcodeInputId}
        label="2. 商品バーコード"
        placeholder="JAN / GTIN / 商品バーコード"
      />

      {children}
    </BarcodeStockStaffContext.Provider>
  );
}
