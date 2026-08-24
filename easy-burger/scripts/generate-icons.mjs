/**
 * Génère les icônes PWA à partir du wordmark « easy ».
 *
 * Le logo Easy Burger est un pavé horizontal (ratio ~3,13:1) : il ne rentre
 * pas dans un carré. On utilise donc le seul mot « easy » (~2,84:1), qui
 * reste identifiable à 48px, sur les fonds de la marque.
 *
 *   npm run icons
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })

const BLACK = '#111111'
const ORANGE = '#FF421D'

const wordmark = (variant) =>
  readFileSync(join(root, 'public', 'logo', `easy-${variant}.svg`))

/**
 * @param {object} o
 * @param {number} o.size    côté de l'icône en px
 * @param {string} o.bg      couleur de fond
 * @param {string} o.variant fichier wordmark (noir | blanc | orange)
 * @param {number} o.ratio   largeur du wordmark rapportée au côté
 * @param {string} o.name    nom du fichier de sortie
 */
async function icon({ size, bg, variant, ratio, name }) {
  const markWidth = Math.round(size * ratio)
  const mark = await sharp(wordmark(variant), { density: 900 })
    .resize({ width: markWidth })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(join(out, name))

  console.log(`${name}  ${size}×${size}`)
}

// « any » — fond noir, accent orange. Le wordmark occupe 80 % de la largeur.
await icon({ size: 192, bg: BLACK, variant: 'orange', ratio: 0.8, name: 'icon-192.png' })
await icon({ size: 512, bg: BLACK, variant: 'orange', ratio: 0.8, name: 'icon-512.png' })

// « maskable » — Android rogne jusqu'à 20 % de chaque côté. Le wordmark
// reste donc dans le cercle de sécurité central : 56 % de la largeur.
await icon({ size: 512, bg: ORANGE, variant: 'blanc', ratio: 0.56, name: 'icon-maskable-512.png' })
await icon({ size: 192, bg: ORANGE, variant: 'blanc', ratio: 0.56, name: 'icon-maskable-192.png' })

// iOS : pas de transparence, pas de masque, coins arrondis par le système.
await icon({ size: 180, bg: BLACK, variant: 'orange', ratio: 0.8, name: 'apple-touch-icon.png' })

// Favicons
await icon({ size: 32, bg: BLACK, variant: 'orange', ratio: 0.86, name: 'favicon-32.png' })
await icon({ size: 16, bg: BLACK, variant: 'orange', ratio: 0.9, name: 'favicon-16.png' })
