"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChampNombre } from "./ChampNombre";

type Etat = "vide" | "enregistre" | "en_cours" | "attente" | "erreur";

const RETRY_MS = 8000;

/**
 * Saisie d'une quantité enregistrée dès la frappe. En cas de coupure, la valeur est gardée
 * sur le téléphone (localStorage) et renvoyée ; l'écran dit clairement ce qui n'est pas encore enregistré.
 */
export function SaisieLigne({
  cle,
  valeurInitiale,
  enregistrer,
  placeholder,
  disabled,
  className,
  autoFocus,
  initialEnregistre,
}: {
  /** Clé unique de la ligne (par exemple comptage-12-article-5). */
  cle: string;
  valeurInitiale: number | null;
  enregistrer: (valeur: number | null) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  /** Faux pour une valeur affichée mais pas encore enregistrée (estimation, par exemple). */
  initialEnregistre?: boolean;
}) {
  const [etat, setEtat] = useState<Etat>(valeurInitiale === null || initialEnregistre === false ? "vide" : "enregistre");
  const [pendingValeur, setPendingValeur] = useState<number | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Valeur connue du serveur ; « undefined » pour une valeur seulement affichée (une estimation à confirmer).
  const derniere = useRef<number | null | undefined>(initialEnregistre === false ? undefined : valeurInitiale);
  const stockageCle = `eb_pending_${cle}`;

  const envoyer = useCallback(
    async (v: number | null) => {
      setEtat("en_cours");
      try {
        await enregistrer(v);
        derniere.current = v;
        try {
          localStorage.removeItem(stockageCle);
        } catch {
          /* ignore */
        }
        setPendingValeur(undefined);
        setEtat(v === null ? "vide" : "enregistre");
      } catch {
        try {
          localStorage.setItem(stockageCle, JSON.stringify(v));
        } catch {
          /* ignore */
        }
        setPendingValeur(v);
        setEtat("attente");
      }
    },
    [enregistrer, stockageCle],
  );

  // Au chargement : une valeur non transmise est reprise et renvoyée.
  useEffect(() => {
    try {
      const brut = localStorage.getItem(stockageCle);
      if (brut !== null) {
        const v = JSON.parse(brut) as number | null;
        setPendingValeur(v);
        setEtat("attente");
        void envoyer(v);
      }
    } catch {
      /* ignore */
    }
  }, [stockageCle, envoyer]);

  // Nouvelle tentative périodique et au retour du réseau.
  useEffect(() => {
    if (etat !== "attente" || pendingValeur === undefined) return;
    const id = setInterval(() => void envoyer(pendingValeur), RETRY_MS);
    const onLine = () => void envoyer(pendingValeur);
    window.addEventListener("online", onLine);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onLine);
    };
  }, [etat, pendingValeur, envoyer]);

  const libelle: Record<Etat, string> = {
    vide: "",
    enregistre: "Enregistré",
    en_cours: "Envoi…",
    attente: "Non enregistré — nouvel essai…",
    erreur: "Erreur",
  };
  const couleur: Record<Etat, string> = {
    vide: "text-muted",
    enregistre: "text-emerald-600",
    en_cours: "text-muted",
    attente: "text-amber-600",
    erreur: "text-red-600",
  };

  return (
    <div className={className}>
      <ChampNombre
        defaultValue={pendingValeur !== undefined ? pendingValeur : valeurInitiale}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onValeur={(v) => {
          if (timer.current) clearTimeout(timer.current);
          setEtat("en_cours");
          timer.current = setTimeout(() => {
            if (v === derniere.current && etat !== "attente") {
              setEtat(v === null ? "vide" : "enregistre");
              return;
            }
            void envoyer(v);
          }, 600);
        }}
      />
      <span className={`mt-0.5 block min-h-[16px] text-right text-[11px] ${couleur[etat]}`} aria-live="polite">
        {libelle[etat]}
      </span>
    </div>
  );
}
