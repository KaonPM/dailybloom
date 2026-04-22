import "./globals.css";
import AppChrome from "./components/AppChrome";

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
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}