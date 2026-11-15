"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ElementNav {
  href: string;
  libelle: string;
  icone: string;
  compteur?: number;
}

/** Barre de navigation inférieure : cinq cibles au plus, 44 px minimum, pouce d'une main. */
export function NavBas({ elements }: { elements: ElementNav[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav-bas fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur" aria-label="Navigation principale">
      <ul className="mx-auto grid w-full max-w-md" style={{ gridTemplateColumns: `repeat(${elements.length}, minmax(0, 1fr))` }}>
        {elements.map((e) => {
          const actif = pathname === e.href || (e.href !== "/" && pathname.startsWith(e.href + "/")) || (e.href !== "/" && pathname.startsWith(e.href) && e.href.length > 1 && pathname.length === e.href.length);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                className={clsx("relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium", actif ? "text-brand" : "text-muted")}
                aria-current={actif ? "page" : undefined}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {e.icone}
                </span>
                <span className="truncate">{e.libelle}</span>
                {e.compteur !== undefined && e.compteur > 0 && (
                  <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{e.compteur > 99 ? "99+" : e.compteur}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
