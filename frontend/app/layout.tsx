import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AarogyaGrid",
  description: "Medicine supply resilience network",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
