import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function EnTete({ titre, sousTitre, retour, action }: { titre: string; sousTitre?: ReactNode; retour?: string; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {retour && (
          <Link href={retour} className="lien mb-1 text-sm text-muted hover:text-brand">
            ← Retour
          </Link>
        )}
        <h1 className="break-words">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-muted">{sousTitre}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Carte({ children, className, titre, action }: { children: ReactNode; className?: string; titre?: ReactNode; action?: ReactNode }) {
  return (
    <section className={clsx("card", className)}>
      {(titre || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titre && <h2 className="text-lg">{titre}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type Teinte = "neutre" | "brand" | "vert" | "rouge" | "orange" | "bleu";

const TEINTES: Record<Teinte, string> = {
  neutre: "bg-zinc-200/70 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  brand: "bg-brand/15 text-brand-dark dark:text-orange-300",
  vert: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  rouge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  orange: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
  bleu: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-200",
};

export function Badge({ children, teinte = "neutre", className }: { children: ReactNode; teinte?: Teinte; className?: string }) {
  return <span className={clsx("badge", TEINTES[teinte], className)}>{children}</span>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Message({ children, type = "info" }: { children: ReactNode; type?: "info" | "erreur" | "succes" | "attention" }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    erreur: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    succes: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    attention: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  }[type];
  return (
    <div role={type === "erreur" ? "alert" : "status"} className={clsx("rounded-xl border px-3 py-2.5 text-sm", cls)}>
      {children}
    </div>
  );
}

export function Ligne({ gauche, droite, href, className }: { gauche: ReactNode; droite?: ReactNode; href?: string; className?: string }) {
  const contenu = (
    <>
      <div className="min-w-0 flex-1">{gauche}</div>
      {droite !== undefined && <div className="shrink-0 text-right">{droite}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={clsx("row tap -mx-1 rounded-lg px-1 hover:bg-bg", className)}>
        {contenu}
      </Link>
    );
  }
  return <div className={clsx("row", className)}>{contenu}</div>;
}

export function Chiffre({ libelle, valeur, detail, teinte }: { libelle: string; valeur: ReactNode; detail?: ReactNode; teinte?: "rouge" | "vert" | "orange" }) {
  return (
    <div className="card flex flex-col gap-0.5 p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{libelle}</span>
      <span className={clsx("display text-2xl font-bold leading-none", teinte === "rouge" && "text-red-600", teinte === "vert" && "text-emerald-600", teinte === "orange" && "text-amber-600")}>
        {valeur}
      </span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </div>
  );
}

export function Champ({ label, children, aide, erreur }: { label: string; children: ReactNode; aide?: ReactNode; erreur?: string | null }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {aide && !erreur && <span className="mt-1 block text-xs text-muted">{aide}</span>}
      {erreur && <span className="mt-1 block text-xs text-red-600">{erreur}</span>}
    </label>
  );
}
