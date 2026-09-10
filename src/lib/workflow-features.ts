// Temporary UI choice. Keep barcode code/data for a later, explicitly approved restart.
// This controls navigation, not authorization of the existing server actions.
export const barcodeUiEnabled = false;
export const stockOutPath = barcodeUiEnabled ? "/barcode/out" : "/stock-out";
export const receivePath = barcodeUiEnabled ? "/barcode/receive" : "/receive";

export function isWorkflowLinkVisible(href: string) {
  return barcodeUiEnabled || (!href.startsWith("/barcode") && href !== "/imports/medical-devices" && href !== "/quick");
}
