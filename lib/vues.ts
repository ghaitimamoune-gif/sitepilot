/** Sérialise des lignes de base (Date → ISO, numeric string → number si demandé) pour les composants client. */
export function serialiser<T>(valeur: T): T {
  return JSON.parse(
    JSON.stringify(valeur, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  ) as T;
}
