import "./globals.css";
import AppChrome from "./components/AppChrome";
import { Suspense } from "react";

export const metadata = {
  title: "DailyBloom",
  description: "Preschool Management App",
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
        <Suspense fallback={<div style={{ padding: "24px" }}>Loading...</div>}>
          <AppChrome>{children}</AppChrome>
        </Suspense>
      </body>
    </html>
  );
}