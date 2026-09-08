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

/**
 * Correspondance entre nos gabarits et ceux déclarés côté Meta.
 *
 * WhatsApp refuse le texte libre pour un message à l'initiative du commerce :
 * il faut un gabarit approuvé, et on n'envoie que les variables. Les noms
 * ci-dessous sont ceux à créer dans Meta Business Manager → WhatsApp
 * Manager → Modèles de message, catégorie « Utilitaire ».
 *
 * L'OTP de connexion n'est pas dans cette table : il ne passe pas par cette
 * couche mais par Supabase Auth.
 */
export const TEMPLATE_NAMES: Record<string, string> = {
  order_received: 'eb_commande_recue',
  order_ready: 'eb_commande_prete',
  order_delivering: 'eb_commande_partie',
  points_credited: 'eb_points_credites',
  points_credited_glovo: 'eb_points_glovo',
  reward_unlocked: 'eb_recompense',
  gift_granted: 'eb_cadeau',
  points_expiring: 'eb_points_expirent',
}

/**
 * Les variables de chaque gabarit, dans l'ordre des {{1}}, {{2}}… du modèle
 * approuvé. Cet ordre est un contrat avec Meta : le changer sans mettre le
 * modèle à jour envoie les bonnes valeurs aux mauvais endroits.
 */
const VARIABLES: Record<string, (p: Payload) => string[]> = {
  order_received: (p) => [String(p.order_number), String(dirhams(p.total_cents))],
  order_ready: (p) => [String(p.order_number)],
  order_delivering: (p) => [String(p.order_number)],
  points_credited: (p) => [String(p.points), String(p.ticket_ref)],
  points_credited_glovo: (p) => [String(p.points)],
  reward_unlocked: (p) => [String(p.title), String(p.code)],
  gift_granted: (p) => [String(p.title), String(p.code)],
  points_expiring: (p) => [String(p.points), formatDate(p.expires_on)],
}

export function templateVariables(template: string, payload: Payload): string[] {
  const fn = VARIABLES[template]
  return fn ? fn(payload) : []
}
