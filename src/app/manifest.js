export default function manifest() {
  return {
    id: "/",
    name: "Absensi Composite",
    short_name: "Absensi",
    lang: "id",
    description: "Portal absensi PT Composite Interior Prima",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9f6f0",
    theme_color: "#f9f6f0",
    icons: [
      {
        src: "/images/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/images/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
