import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** §4.2 — Archivo capitales 11px, letter-spacing 0.08em. Labels et statuts. */
export function Eyebrow({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode
  className?: string
  as?: 'span' | 'div' | 'p'
}) {
  return <Tag className={cn('eb-eyebrow font-util', className)}>{children}</Tag>
}
