import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alter",
  description: "조용히 나를 배우고, 필요할 때 먼저 돕고, 나를 닮아 가요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
