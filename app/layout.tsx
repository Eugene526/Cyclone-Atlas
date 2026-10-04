import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "颱風觀測室 · Cyclone Atlas",
  description: "向日葵即時衛星、颱風風圈與多模式系集路徑觀測工作台。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
