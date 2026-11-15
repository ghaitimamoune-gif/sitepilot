"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface PhotoVue {
  id: number;
  priseLe: string;
  prenom?: string | null;
}

interface EnAttente {
  cle: number;
  blob: Blob;
  apercu: string;
  etat: "envoi" | "echec";
}

/** Compression sur le téléphone avant envoi : grand côté limité, JPEG. */
async function compresser(fichier: File, grandCote: number): Promise<Blob> {
  const bitmap = await createImageBitmap(fichier).catch(() => null);
  if (!bitmap) return fichier;
  const ratio = Math.min(1, grandCote / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fichier;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? fichier), "image/jpeg", 0.85));
}

/**
 * Prise de photo depuis l'appareil du téléphone, plusieurs par objet, envoi avec reprise
 * en cas d'échec. Jamais d'URL publique : les photos sont servies par /api/photos/[id].
 */
export function Photos({
  objetType,
  objetId,
  initiales,
  minimum = 0,
  maximum = 6,
  grandCote = 1600,
  lectureSeule = false,
  libelle = "Prendre une photo",
}: {
  objetType: "tache" | "reception" | "perte" | "facture";
  objetId: number;
  initiales: PhotoVue[];
  minimum?: number;
  maximum?: number;
  grandCote?: number;
  lectureSeule?: boolean;
  libelle?: string;
}) {
  const [attente, setAttente] = useState<EnAttente[]>([]);
  const [grande, setGrande] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const compteur = useRef(0);

  const envoyer = async (item: EnAttente) => {
    setAttente((l) => l.map((x) => (x.cle === item.cle ? { ...x, etat: "envoi" } : x)));
    const fd = new FormData();
    fd.append("objetType", objetType);
    fd.append("objetId", String(objetId));
    fd.append("fichier", item.blob, "photo.jpg");
    try {
      const r = await fetch("/api/photos", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      setAttente((l) => l.filter((x) => x.cle !== item.cle));
      URL.revokeObjectURL(item.apercu);
      router.refresh();
    } catch {
      setAttente((l) => l.map((x) => (x.cle === item.cle ? { ...x, etat: "echec" } : x)));
    }
  };

  const onFichiers = async (fichiers: FileList | null) => {
    if (!fichiers) return;
    const restant = maximum - initiales.length - attente.length;
    for (const f of Array.from(fichiers).slice(0, Math.max(0, restant))) {
      const blob = await compresser(f, grandCote);
      const item: EnAttente = { cle: ++compteur.current, blob, apercu: URL.createObjectURL(blob), etat: "envoi" };
      setAttente((l) => [...l, item]);
      void envoyer(item);
    }
    if (input.current) input.current.value = "";
  };

  const total = initiales.length;
  const manque = Math.max(0, minimum - total);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {initiales.map((p) => (
          <button key={p.id} type="button" onClick={() => setGrande(p.id)} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${p.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {attente.map((a) => (
          <div key={a.cle} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.apercu} alt="" className={`h-full w-full object-cover ${a.etat === "envoi" ? "opacity-50 pulse" : "opacity-60"}`} />
            {a.etat === "echec" && (
              <button type="button" onClick={() => void envoyer(a)} className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-xs font-semibold text-white">
                Non envoyée
                <br />
                Réessayer
              </button>
            )}
          </div>
        ))}
        {!lectureSeule && total + attente.length < maximum && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand/60 text-center text-xs font-semibold text-brand">
            <span className="text-2xl leading-none">+</span>
            {libelle}
            <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void onFichiers(e.target.files)} />
          </label>
        )}
      </div>
      {minimum > 0 && (
        <p className={`text-xs ${manque > 0 ? "text-amber-600" : "text-emerald-600"}`}>
          {manque > 0 ? `${manque} photo${manque > 1 ? "s" : ""} encore demandée${manque > 1 ? "s" : ""} (minimum ${minimum})` : `${total} photo${total > 1 ? "s" : ""} — minimum atteint`}
        </p>
      )}
      {grande !== null && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setGrande(null)} aria-label="Fermer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${grande}`} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </button>
      )}
    </div>
  );
}
