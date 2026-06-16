import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "新北市 115 學年度國中小學區查詢",
  description: "依據新北市 115 學年度國小與國中學區一覽表建立的查詢雛形。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
