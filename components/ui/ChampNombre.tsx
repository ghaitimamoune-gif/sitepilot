"use client";

import clsx from "clsx";
import { useState, type InputHTMLAttributes } from "react";

/** Saisie d'une quantité au clavier numérique ; la virgule est acceptée comme séparateur décimal. */
export function ChampNombre({
  name,
  defaultValue,
  decimales = true,
  className,
  onValeur,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type"> & {
  name?: string;
  defaultValue?: number | string | null;
  decimales?: boolean;
  onValeur?: (v: number | null, brut: string) => void;
}) {
  const [texte, setTexte] = useState(defaultValue === null || defaultValue === undefined ? "" : String(defaultValue).replace(".", ","));
  return (
    <input
      {...rest}
      type="text"
      name={name}
      inputMode={decimales ? "decimal" : "numeric"}
      pattern={decimales ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      autoComplete="off"
      value={texte}
      onChange={(e) => {
        const brut = e.target.value.replace(/[^\d.,-]/g, "");
        setTexte(brut);
        const t = brut.replace(",", ".");
        const v = t === "" || t === "-" || t === "." ? null : Number(t);
        onValeur?.(v !== null && Number.isFinite(v) ? v : null, brut);
      }}
      className={clsx("input text-right text-lg tabular-nums", className)}
    />
  );
}
