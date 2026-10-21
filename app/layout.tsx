import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "coDrive — Gestion des ressources",
  description: "Gestion des ressources humaines et matérielles de votre agence de location B2B.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "coDrive", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#2f5bea", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
