/**
 * §13 — les gabarits de la V1, uniquement transactionnels.
 *
 * §4.4 : ton direct, verbes précis, aucune excuse. Et court : un SMS au-delà
 * de 160 caractères en coûte deux, et le Maroc n'est pas un marché où on
 * gaspille des SMS.
 */
export type TemplateKey =
  | 'otp'
  | 'order_received'
  | 'order_ready'
  | 'order_delivering'
  | 'points_credited'
  | 'points_credited_glovo'
  | 'reward_unlocked'
  | 'gift_granted'
  | 'points_expiring'

type Payload = Record<string, unknown>

const dirhams = (cents: unknown) => Math.round(Number(cents ?? 0) / 100)

const TEMPLATES: Record<TemplateKey, (p: Payload) => string> = {
  otp: (p) => `Easy Burger : ton code est ${p.code}. Il expire dans 5 minutes.`,

  order_received: (p) =>
    `Easy Burger : commande ${p.order_number} reçue, ${dirhams(p.total_cents)} MAD. On s'y met.`,

  order_ready: (p) => `Easy Burger : ta commande ${p.order_number} est prête au comptoir.`,

  order_delivering: (p) =>
    `Easy Burger : ta commande ${p.order_number} est partie. Le livreur arrive.`,

  points_credited: (p) =>
    `Easy Burger : +${p.points} points sur ton compte. Ticket ${p.ticket_ref}.`,

  points_credited_glovo: (p) =>
    `Easy Burger : +${p.points} points pour ta commande Glovo. La prochaine, commande en direct : c'est moins cher pour nous et mieux pour toi.`,

  reward_unlocked: (p) =>
    `Easy Burger : ${p.title}. Code ${p.code}, valable 15 minutes au comptoir.`,

  gift_granted: (p) => `Easy Burger : ${p.title} ! Code ${p.code} à donner au comptoir.`,

  points_expiring: (p) =>
    `Easy Burger : ${p.points} points expirent le ${formatDate(p.expires_on)}. Passe les utiliser.`,
}

export function renderTemplate(template: string, payload: Payload): string | null {
  const fn = TEMPLATES[template as TemplateKey]
  return fn ? fn(payload) : null
}

function formatDate(value: unknown): string {
  const d = new Date(String(value))
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
