import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Colletta Alimentare 2026 · Diventa volontario", description: "Iscrizione interna alla Colletta Alimentare 2026. Scegli dove e quando dare una mano.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="it"><body>{children}</body></html>; }
