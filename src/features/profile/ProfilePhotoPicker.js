"use client";

import { useEffect, useRef, useState } from "react";

export default function ProfilePhotoPicker({
  photo,
  name,
  disabled,
  onChange,
}) {
  const editor = useRef(null);
  const viewer = useRef(null);
  const canvas = useRef(null);
  const drag = useRef(null);
  const [source, setSource] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    setFailed(false);
  }, [photo, preview]);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const next = new window.Image();
    next.onload = () => {
      if (cancelled) return;
      if (next.naturalWidth * next.naturalHeight > 25000000) {
        setError(
          "Resolusi foto terlalu besar. Gunakan foto maksimal 25 megapiksel.",
        );
        return;
      }
      setImage(next);
    };
    next.onerror = () => {
      if (!cancelled) setError("Foto tidak dapat dibuka. Coba gambar lain.");
    };
    next.src = source;
    return () => {
      cancelled = true;
    };
  }, [source]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const context = canvas.current.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 512, 512);
    context.drawImage(
      image,
      (image.naturalWidth - side) * position.x,
      (image.naturalHeight - side) * position.y,
      side,
      side,
      0,
      0,
      512,
      512,
    );
  }, [image, zoom, position]);

  function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Gunakan foto JPG, PNG, atau WebP maksimal 5 MB.");
      return;
    }
    setImage(null);
    setSource(URL.createObjectURL(file));
    setZoom(1);
    setPosition({ x: 0.5, y: 0.5 });
    editor.current.showModal();
  }
  function move(event) {
    if (!drag.current || !image || saving) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const width = canvas.current.getBoundingClientRect().width;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    const clamp = (value) => Math.max(0, Math.min(1, value));
    setPosition((old) => ({
      x:
        image.naturalWidth > side
          ? clamp(old.x - (dx * side) / width / (image.naturalWidth - side))
          : old.x,
      y:
        image.naturalHeight > side
          ? clamp(old.y - (dy * side) / width / (image.naturalHeight - side))
          : old.y,
    }));
  }
  async function apply() {
    if (!image || saving) return;
    setSaving(true);
    try {
      const blob = await new Promise((resolve) =>
        canvas.current.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("encode");
      onChange(new File([blob], "foto-profil.jpg", { type: "image/jpeg" }));
      setPreview(URL.createObjectURL(blob));
      editor.current.close();
    } catch {
      setError("Foto belum dapat diproses. Silakan coba kembali.");
    } finally {
      setSaving(false);
    }
  }
  const displayed = preview || photo;
  return (
    <>
      <button
        type="button"
        className="profile-photo-preview"
        disabled={!displayed || failed}
        aria-label="Lihat foto profil lebih besar"
        onClick={() => viewer.current.showModal()}
        style={{ padding: 0, cursor: displayed ? "zoom-in" : "default" }}
      >
        {displayed && !failed ? (
          // Blob previews and authenticated photo URLs are already sized by this feature.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayed}
            width={112}
            height={112}
            alt="Foto profil Anda"
            onError={() => setFailed(true)}
          />
        ) : (
          <span>{name.slice(0, 1)}</span>
        )}
      </button>
      <label>
        Foto profil
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={choose}
        />
        <small>
          JPG, PNG, WebP, maksimal 5 MB. Klik foto untuk memperbesar.
        </small>
      </label>
      {preview && (
        <small>
          Foto sudah disesuaikan. Klik Simpan Profil untuk menyimpan.
        </small>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={viewer}
        className="admin-dialog"
        aria-labelledby="profile-view-title"
      >
        <div className="dialog-body">
          <h2 id="profile-view-title">Foto Profil</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {displayed && (
            <img
              src={displayed}
              alt={`Foto profil ${name}`}
              style={{
                width: "100%",
                maxHeight: "65dvh",
                objectFit: "contain",
                marginTop: 16,
              }}
            />
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="admin-button secondary"
            onClick={() => viewer.current.close()}
          >
            Tutup
          </button>
        </div>
      </dialog>
      <dialog
        ref={editor}
        className="admin-dialog"
        aria-labelledby="profile-crop-title"
        onClose={() => {
          setSource("");
          setImage(null);
          drag.current = null;
        }}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <div className="dialog-body">
          <h2 id="profile-crop-title">Sesuaikan Foto</h2>
          <p className="worker-help">
            Geser foto dan atur zoom. Hasilnya akan dipotong persegi.
          </p>
          <canvas
            ref={canvas}
            width={512}
            height={512}
            aria-label="Pratinjau potongan foto"
            style={{
              width: "100%",
              maxWidth: 320,
              aspectRatio: "1",
              display: "block",
              margin: "16px auto",
              background: "#eee",
              touchAction: "none",
              cursor: "grab",
            }}
            onPointerDown={(event) => {
              if (saving) return;
              drag.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
          <fieldset
            disabled={!image || saving}
            style={{ border: 0, padding: 0, display: "grid", gap: 12 }}
          >
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <label>
              Posisi horizontal
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={position.x}
                onChange={(e) =>
                  setPosition((old) => ({ ...old, x: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Posisi vertikal
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={position.y}
                onChange={(e) =>
                  setPosition((old) => ({ ...old, y: Number(e.target.value) }))
                }
              />
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="admin-button secondary"
            disabled={saving}
            onClick={() => editor.current.close()}
          >
            Batal
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={!image || saving}
            onClick={apply}
          >
            {saving ? "Memproses…" : "Gunakan Foto"}
          </button>
        </div>
      </dialog>
    </>
  );
}
