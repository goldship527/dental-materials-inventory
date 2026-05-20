import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "一般歯科材料在庫管理システム",
  description: "一般歯科材料・消耗品・備品の在庫管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
