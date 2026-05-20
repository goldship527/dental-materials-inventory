import { redirect } from "next/navigation";

export default function UnmatchedBarcodeScansRedirectPage() {
  redirect("/barcode/scans/unresolved");
}
