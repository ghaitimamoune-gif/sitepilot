'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Navigation de catégories collante (§9).
 *
 * La catégorie active suit le défilement via un IntersectionObserver plutôt
 * qu'un écouteur de scroll : pas de calcul à chaque pixel, donc pas de
 * saccade sur un téléphone d'entrée de gamme.
 */
export function CategoryNav({
  categories,
}: {
  categories: { slug: string; name: string }[]
}) {
  const [active, setActive] = useState(categories[0]?.slug)

  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(c.slug))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      // La bande de détection est calée juste sous l'entête collante.
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [categories])

  return (
    <nav
      aria-label="Catégories"
      className="sticky top-14 z-20 border-b border-eb-line bg-eb-white"
    >
      <ul className="no-scrollbar mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 py-2">
        {categories.map((c) => (
          <li key={c.slug}>
            <a
              href={`#${c.slug}`}
              className={cn(
                'eb-eyebrow inline-flex h-9 items-center whitespace-nowrap px-3 font-util',
                active === c.slug
                  ? 'bg-eb-black text-eb-white'
                  : 'text-eb-grey',
              )}
            >
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
