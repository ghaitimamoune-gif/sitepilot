import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Easy Burger Ops", template: "%s · Easy Burger Ops" },
  description: "Achats, stocks, préparations et tâches du restaurant.",
  manifest: "/manifest.json",
  applicationName: "Easy Burger Ops",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "EB Ops" },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF3D00" },
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
  ],
};

/** Applique le thème mémorisé avant le premier rendu, pour éviter un flash. */
const scriptTheme = `try{var t=localStorage.getItem('eb_theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
