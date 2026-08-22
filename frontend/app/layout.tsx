import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";

const inter = Inter({
 subsets: ["latin"],
 variable: "--font-inter",
 display: "swap",
});

export const metadata: Metadata = {
 title: "AarogyaGrid — Medicine Supply Resilience Network",
 description:
 "AI-powered medicine supply resilience network for PHCs, CHCs, District Hospitals and Warehouses across India.",
 keywords: "medicine supply chain, NHM, stockout prevention, AI healthcare, PHC, CHC",
};

export default function RootLayout({
 children,
}: Readonly<{ children: React.ReactNode }>) {
 return (
 <html lang="en" className={inter.variable}>
 <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased min-h-screen`}>
 <AuthProvider>{children}</AuthProvider>
 </body>
 </html>
 );
}
