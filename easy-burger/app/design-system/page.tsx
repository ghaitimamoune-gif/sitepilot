import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { BurgerTag } from '@/components/brand/BurgerTag'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { Field } from '@/components/ui/Field'
import { RewardSticker } from '@/components/ui/RewardSticker'
import { ProductCard } from '@/components/product/ProductCard'

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
}

/**
 * Livrable de la Phase 0 (§14).
 *
 * Cette page sert à valider que l'identité du §4 est correctement traduite,
 * AVANT qu'une seule ligne de logique métier ne soit écrite. Elle n'est pas
 * référencée par la navigation de l'app et n'est pas indexée.
 */
export default function DesignSystem() {
  return (
    <main className="min-h-dvh bg-eb-white pb-24 text-eb-black">
      <Header />
      <Colors />
      <Typography />
      <Logos />
      <Pattern />
      <Buttons />
      <Rewards />
      <Products />
      <Forms />
      <Prices />
    </main>
  )
}

/* -------------------------------------------------------------------------- */

function Section({
  n,
  title,
  note,
  children,
}: {
  n: string
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-eb-line px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start gap-3">
          <BurgerTag height={44} className="mt-1 shrink-0" />
          <div>
            <Eyebrow className="text-eb-grey">{n}</Eyebrow>
            <h2 className="text-display-l">{title}</h2>
            {note && <p className="mt-2 max-w-xl text-body-s text-eb-grey">{note}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

function Header() {
  return (
    <header className="relative overflow-hidden bg-eb-black px-5 py-14 text-eb-white">
      <EasyPattern ink="blanc" opacity={0.06} scale={280} />
      <div className="relative mx-auto max-w-3xl">
        <Logo variant="blanc-orange" width={200} priority />
        <h1 className="mt-6 text-display-xl">Design system</h1>
        <p className="mt-3 max-w-md text-body-l text-eb-cream">
          Phase 0 — fondations. Chaque bloc renvoie à la section du brief qui
          le définit.
        </p>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------- §4.1 couleurs */

const PALETTE = [
  { token: '--eb-orange', hex: '#FF421D', name: 'orange', use: 'action et récompense, jamais décoration' },
  { token: '--eb-black', hex: '#111111', name: 'black', use: 'blocs forts, typographie' },
  { token: '--eb-white', hex: '#FFFFFF', name: 'white', use: 'fond principal' },
  { token: '--eb-cream', hex: '#F2EDE4', name: 'cream', use: 'fond secondaire, rappel du packaging' },
  { token: '--eb-grey', hex: '#6B6B6B', name: 'grey', use: 'texte secondaire uniquement' },
  { token: '--eb-grey-line', hex: '#E4E0D8', name: 'grey-line', use: 'filets, séparateurs' },
]

function Colors() {
  return (
    <Section
      n="§4.1"
      title="Couleurs"
      note="Une seule couleur d'accent. Un écran a au maximum un aplat orange plein. L'orange sert de fond avec du texte blanc dessus, ou de titre en grande taille — jamais de texte courant sur fond clair."
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {PALETTE.map((c) => (
          <div key={c.token} className="flex flex-col gap-2">
            <div
              className="h-20 w-full border border-eb-line"
              style={{ backgroundColor: c.hex }}
            />
            <div>
              <Eyebrow>{c.name}</Eyebrow>
              <p className="eb-price text-body-s text-eb-grey">{c.hex}</p>
              <p className="mt-1 text-body-s text-eb-grey">{c.use}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 bg-eb-cream p-4">
        <span className="text-display-m text-eb-orange">Aa</span>
        <p className="text-body-s text-eb-grey">
          Contraste : <span className="eb-price">#FF421D</span> sur fond clair ne
          passe pas les seuils d&apos;accessibilité en petit texte. Il n&apos;existe
          donc aucune variante de bouton ou de label « orange sur clair » dans
          l&apos;API des composants.
        </p>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------- §4.2 typographie */

function Typography() {
  return (
    <Section
      n="§4.2"
      title="Typographie"
      note="Anton pour le display en capitales, Inter pour le texte, Archivo en capitales pour l'utilitaire. Échelle fermée : 44 / 32 / 24 / 17 / 15 / 13 / 11."
    >
      <div className="flex flex-col gap-5">
        <Row label="display-xl · 44 · Anton">
          <p className="font-display text-display-xl uppercase">Take it smashy</p>
        </Row>
        <Row label="display-l · 32 · Anton">
          <p className="font-display text-display-l uppercase">Smash burgers</p>
        </Row>
        <Row label="display-m · 24 · Anton">
          <p className="font-display text-display-m uppercase">Double cheeseburger</p>
        </Row>
        <Row label="body-l · 17 · Inter">
          <p className="text-body-l">Deux steaks smashés, cheddar, pickles, sauce maison.</p>
        </Row>
        <Row label="body · 15 · Inter">
          <p className="text-body">Deux steaks smashés, cheddar, pickles, sauce maison.</p>
        </Row>
        <Row label="body-s · 13 · Inter">
          <p className="text-body-s text-eb-grey">Livraison assurée par Glovo. Environ 30 minutes.</p>
        </Row>
        <Row label="util · 11 · Archivo">
          <Eyebrow className="text-eb-grey">en préparation</Eyebrow>
        </Row>
      </div>
    </Section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-6">
      <Eyebrow className="text-eb-grey">{label}</Eyebrow>
      <div>{children}</div>
    </div>
  )
}

/* -------------------------------------------------------------------- §4.0 logo */

function Logos() {
  return (
    <Section
      n="§4.0"
      title="Logo"
      note="Cinq déclinaisons. Ratio fixe 3,13:1 verrouillé par le composant, largeur minimale 88 px, zone de protection d'une hauteur de « e » minuscule. Jamais retypographié, jamais déformé, jamais d'effet."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <LogoTile bg="bg-eb-white" border label="noir — fond clair, défaut">
          <Logo variant="noir" width={200} />
        </LogoTile>
        <LogoTile bg="bg-eb-black" label="blanc — fond noir">
          <Logo variant="blanc" width={200} />
        </LogoTile>
        <LogoTile bg="bg-eb-white" border label="noir-orange — version signature">
          <Logo variant="noir-orange" width={200} />
        </LogoTile>
        <LogoTile bg="bg-eb-black" label="blanc-orange — fond noir ou photo">
          <Logo variant="blanc-orange" width={200} />
        </LogoTile>
        <LogoTile bg="bg-eb-cream" label="orange — fond crème, accent">
          <Logo variant="orange" width={200} />
        </LogoTile>
        <LogoTile bg="bg-eb-cream" label="taille minimale — 88 px">
          <Logo variant="noir" width={88} />
        </LogoTile>
      </div>
    </Section>
  )
}

function LogoTile({
  bg,
  border,
  label,
  children,
}: {
  bg: string
  border?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex h-32 items-center justify-center ${bg} ${
          border ? 'border border-eb-line' : ''
        }`}
      >
        {children}
      </div>
      <Eyebrow className="text-eb-grey">{label}</Eyebrow>
    </div>
  )
}

/* ------------------------------------------------------------------ §4.3 motifs */

function Pattern() {
  return (
    <Section
      n="§4.3"
      title="Éléments signature"
      note="Le pavage « easy » miroité est la signature visuelle de l'app : fond de la carte de fidélité, des écrans vides et du chargement. L'étiquette « burger » pivotée marque les sections."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative h-52 overflow-hidden bg-eb-black">
          <EasyPattern ink="blanc" opacity={0.1} scale={220} />
          <div className="relative flex h-full flex-col justify-end p-5 text-eb-white">
            <Eyebrow className="text-eb-orange">mon solde</Eyebrow>
            <p className="font-display text-display-xl leading-none">840</p>
            <p className="text-body-s text-eb-cream">points · prochaine récompense à 200</p>
          </div>
        </div>

        <div className="relative h-52 overflow-hidden bg-eb-cream">
          <EasyPattern ink="orange" opacity={0.14} scale={220} />
          <div className="relative flex h-full items-center justify-center">
            <Eyebrow className="text-eb-grey">écran vide · aucune commande</Eyebrow>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- §4.3 boutons */

function Buttons() {
  return (
    <Section
      n="§4.3 / §4.4"
      title="Boutons"
      note="Rayon 8 px, réservé aux boutons. Hauteur tactile minimale 44 px. Verbes d'action précis : « commander », « payer », « utiliser ma récompense » — jamais « soumettre »."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Commander</Button>
          <Button variant="dark">Payer</Button>
          <Button variant="outline">Modifier</Button>
          <Button variant="quiet">Annuler</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="primary">Utiliser ma récompense</Button>
          <Button size="sm" variant="outline">Ajouter</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button loading>Commander</Button>
          <Button disabled>Indisponible</Button>
        </div>

        <div className="max-w-sm">
          <Button block size="lg">Ajouter au panier · 75 MAD</Button>
        </div>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------- §4.3 récompenses */

function Rewards() {
  return (
    <Section
      n="§4.3 / §6.2"
      title="Récompenses"
      note="Rayon 14 px — rien d'autre dans l'interface n'a ce rayon. Il est réservé à ce qui a de la valeur. Les récompenses à portée sont en couleur, les autres en gris avec les points manquants."
    >
      <div className="flex flex-wrap items-start gap-6">
        <RewardSticker title="Frites maison" pointsCost={250} state="available" />
        <RewardSticker title="Cheeseburger" pointsCost={600} balance={840} state="available" />
        <RewardSticker title="Double cheese" pointsCost={750} balance={480} state="locked" />
        <RewardSticker title="Soda" pointsCost={200} state="used" />
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 bg-eb-orange py-10 text-eb-white">
        <Eyebrow>code à donner en caisse</Eyebrow>
        <p className="font-display text-[3.5rem] leading-none tracking-tight">408 271</p>
        <p className="text-body-s">expire dans 14:58</p>
      </div>
      <p className="mt-2 text-body-s text-eb-grey">
        §9 — écran plein orange, code à 6 chiffres en display, compte à rebours
        de 15 minutes.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ §9 produits */

const DEMO_PRODUCTS = [
  {
    name: 'Cheeseburger',
    description: 'Steak smashé, cheddar, pickles, sauce maison',
    priceCents: 6000,
    imageUrl: '/photos/cheeseburger.jpg',
  },
  {
    name: 'Double cheeseburger',
    description: 'Deux steaks smashés, double cheddar',
    priceCents: 7500,
    imageUrl: '/photos/double-cheeseburger.jpg',
  },
  {
    name: 'Cheesy bacon frites',
    description: 'Frites maison, sauce fromagère, bacon de bœuf',
    priceCents: 5000,
    imageUrl: '/photos/cheesy-bacon-frites.jpg',
  },
  {
    name: 'Frites de patates douces',
    description: null,
    priceCents: 3000,
    imageUrl: '/photos/frites-patates-douces.jpg',
  },
]

function Products() {
  return (
    <Section
      n="§9 / §4.5"
      title="Carte produit"
      note="La photo fait tout le travail émotionnel ; l'interface autour est silencieuse. Pas de bordure décorative, pas d'ombre, pas de coin arrondi. Prix en Inter tabular-nums."
    >
      <div className="mb-8">
        <ProductCard
          name="Home made burger"
          description="Le burger signature, servi avec frites de patates douces"
          priceCents={8000}
          imageUrl="/photos/home-made-burger.jpg"
          featured
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8">
        {DEMO_PRODUCTS.map((p) => (
          <ProductCard key={p.name} {...p} />
        ))}
        <ProductCard
          name="Milkshake"
          description="Photo à shooter"
          priceCents={4500}
          imageUrl={null}
        />
        <ProductCard
          name="Burger du mois"
          description="Rupture de stock ce soir"
          priceCents={8000}
          imageUrl="/photos/lifestyle-deux-burgers.jpg"
          available={false}
        />
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- formulaires */

function Forms() {
  return (
    <Section
      n="§4.4 / §8"
      title="Formulaires"
      note="Le téléphone est la clé d'identité. Un message d'erreur dit ce qui s'est passé et ce qu'il faut faire — jamais d'excuse."
    >
      <div className="flex max-w-sm flex-col gap-5">
        <Field
          label="téléphone"
          type="tel"
          inputMode="tel"
          placeholder="06 12 34 56 78"
          hint="On envoie un code à 6 chiffres par SMS."
        />
        <Field
          label="montant du ticket"
          type="text"
          inputMode="decimal"
          placeholder="74,50"
          defaultValue="74,5O"
          error="Le montant ne contient que des chiffres. Remplace le O par un zéro."
        />
        <Field label="prénom" placeholder="Yasmine" />
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------------- prix */

const PRICE_ROWS = [
  ['Cheeseburger', 6000],
  ['Double cheeseburger', 7500],
  ['Frites maison', 2500],
  ['Soda', 2000],
  ['Sous-total', 16000],
  ['Récompense · frites maison', -2500],
] as const

function Prices() {
  return (
    <Section
      n="§4.2 / §7"
      title="Prix"
      note="Tous les montants sont des entiers de centimes. Aucun flottant ne touche un montant, ni en base, ni en mémoire. Les chiffres tabulaires alignent les colonnes."
    >
      <div className="max-w-sm">
        {PRICE_ROWS.map(([label, cents]) => (
          <div
            key={label}
            className="flex items-baseline justify-between border-b border-eb-line py-2.5"
          >
            <span className="text-body">{label}</span>
            <Price cents={cents} />
          </div>
        ))}
        <div className="flex items-baseline justify-between py-3">
          <span className="font-display text-display-m uppercase">Total</span>
          <Price cents={13500} className="text-display-m font-semibold" />
        </div>
      </div>
    </Section>
  )
}
