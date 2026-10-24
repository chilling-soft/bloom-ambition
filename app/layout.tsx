import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alter",
  description: "It quietly learns you, helps when it matters, and grows into a version of you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
