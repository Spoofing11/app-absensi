import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  icons: {
    apple: "/images/pwa/apple-touch-icon.png?v=3",
    icon: { url: "/images/favicon-composite.png?v=1", type: "image/png", sizes: "64x64" },
  },
  appleWebApp: {
    capable: true,
    title: "Absensi - Composite",
    statusBarStyle: "default",
  },
  title: {
    default: "Portal Absensi",
    template: "%s · Portal Absensi",
  },
  description:
    "Portal absensi karyawan dan tukang PT Composite Interior Prima.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9f6f0",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${playfair.variable} ${jakarta.variable}`}>
      <body className="min-h-svh bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
