"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  buildCullerPostText,
  CULLER_SITE_URL,
  formatCullerAllocation,
  generateCullerShareCard,
  type CullerShareData,
} from "@/lib/culler/share";

type Props = { open: boolean; data: CullerShareData; onClose: () => void };

export function CullerShareModal({ open, data, onClose }: Props) {
  if (!open) return null;
  return <CullerShareModalContent key={`${data.allocation}-${data.walletAddress ?? ""}`} data={data} onClose={onClose} />;
}

function CullerShareModalContent({ data, onClose }: Omit<Props, "open">) {
  const [postText, setPostText] = useState(() => buildCullerPostText(data));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    generateCullerShareCard(data)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setMessage("Card assets could not be loaded. Please try again."));
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data, onClose]);

  async function downloadCard(blob?: Blob) {
    const card = blob ?? (await generateCullerShareCard(data));
    const url = URL.createObjectURL(card);
    const link = document.createElement("a");
    link.href = url;
    link.download = `culler-allocation-${formatCullerAllocation(data.allocation).replace(/,/g, "")}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await generateCullerShareCard(data);
      const file = new File([blob], "culler-allocation.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text: postText, files: [file] });
        return;
      }
      await downloadCard(blob);
      const popup = window.open(`https://x.com/intent/post?text=${encodeURIComponent(postText)}`, "_blank", "noopener,noreferrer");
      if (!popup) setMessage("Card ready. Download it and attach it to your X post.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Card could not be prepared. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-veil culler-share-veil" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="culler-share-modal" role="dialog" aria-modal="true" aria-labelledby="culler-share-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close share dialog">×</button>
        <div className="culler-share-heading">
          <span className="eyebrow">Allocation found</span>
          <h2 id="culler-share-title">Share your allocation</h2>
          <p>Show the timeline what you found.</p>
        </div>
        {previewUrl ? (
          <Image
            className="culler-share-preview"
            src={previewUrl}
            alt="Culler allocation share card preview"
            width={1200}
            height={675}
            unoptimized
          />
        ) : (
          <div className="culler-share-preview culler-share-preview-loading" role="status">
            Preparing card preview…
          </div>
        )}
        <div className="culler-share-allocation">
          <span>Your allocation</span>
          <strong>+{formatCullerAllocation(data.allocation)} $CULLER</strong>
        </div>
        <label className="culler-share-label" htmlFor="culler-share-post">X post</label>
        <textarea id="culler-share-post" className="culler-share-post" value={postText} onChange={(event) => setPostText(event.target.value)} rows={7} />
        {message && <p className="culler-share-message" role="status">{message}</p>}
        <div className="culler-share-actions">
          <button type="button" className="primary-button" onClick={share} disabled={busy}>
            {busy ? "Preparing card…" : "Share on X"}
          </button>
          <button type="button" className="ghost-button" onClick={() => downloadCard()} disabled={busy}>Download card</button>
        </div>
        <small className="culler-share-note">The card contains {CULLER_SITE_URL.replace(/^https?:\/\//, "")} and only a shortened wallet address.</small>
      </section>
    </div>
  );
}
