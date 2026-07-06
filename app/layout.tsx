import "./globals.css";
import AppChrome from "./components/AppChrome";
import RegisterServiceWorker from "./components/RegisterServiceWorker";
import { Suspense } from "react";

export const metadata = {
  title: "DailyBloom",
  description: "Preschool Management App",
  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DailyBloom",
  },

  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },

  openGraph: {
    title: "DailyBloom",
    description:
      "Preschool management platform for schools, teachers and parents.",
    url: "https://dailybloom.co.za",
    siteName: "DailyBloom",
    images: [
      {
        url: "https://dailybloom.co.za/thumbnail.png",
        width: 1200,
        height: 630,
        alt: "DailyBloom",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "DailyBloom",
    description:
      "Preschool management platform for schools, teachers and parents.",
    images: ["https://dailybloom.co.za/thumbnail.png"],
  },
};

export const viewport = {
  themeColor: "#6B4EFF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#FFF8F2",
        }}
      >
        <RegisterServiceWorker />

        <Suspense
          fallback={
            <div
              style={{
                padding: "24px",
              }}
            >
              Loading...
            </div>
          }
        >
          <AppChrome>
            {children}
          </AppChrome>
        </Suspense>
      </body>
    </html>
  );
}