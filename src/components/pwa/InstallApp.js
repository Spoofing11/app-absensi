"use client";
import { useEffect, useState } from "react";
export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(mode.matches || navigator.standalone === true);
    update();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const available = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    mode.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", complete);
      mode.removeEventListener("change", update);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    const event = prompt;
    setPrompt(null);
    await event.prompt();
    await event.userChoice;
  }
  if (installed) return null;
  return (
    <div className="mt-5 text-center text-xs text-ink-soft">
      {prompt ? (
        <button
          type="button"
          className="rounded-md border border-line px-4 py-2 font-medium text-ink"
          onClick={() => install().catch(() => {})}
        >
          Instal Aplikasi Absensi
        </button>
      ) : (
        <details>
          <summary className="cursor-pointer">
            Pasang aplikasi di perangkat
          </summary>
          <p className="mt-2 leading-relaxed">
            {ios
              ? "Buka melalui Safari, pilih Bagikan, lalu Tambah ke Layar Utama."
              : "Buka menu browser dan pilih Instal aplikasi jika tersedia."}{" "}
            Aplikasi memerlukan internet untuk login dan menyimpan absensi.
          </p>
        </details>
      )}
    </div>
  );
}
