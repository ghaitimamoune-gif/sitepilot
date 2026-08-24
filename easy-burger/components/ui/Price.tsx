import { formatMAD } from '@/lib/money'
import { cn } from '@/lib/cn'

/**
 * §4.2 — les prix sont en Inter tabular-nums, jamais en display.
 * Le composant prend des CENTIMES, jamais des dirhams (§7).
 */
export function Price({
  cents,
  suffix = true,
  className,
}: {
  cents: number
  suffix?: boolean
  className?: string
}) {
  return (
    <span className={cn('eb-price font-sans', className)}>
      {formatMAD(cents, { suffix })}
    </span>
  )
}
