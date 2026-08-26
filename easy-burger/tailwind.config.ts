import type { Config } from 'tailwindcss'

/**
 * Tokens Easy Burger — §4 du brief.
 *
 * Les couleurs sont déclarées ici ET en variables CSS dans globals.css.
 * Tailwind lit les variables : une seule source de vérité, modifiable
 * à chaud, et utilisable hors Tailwind (SVG, canvas, meta theme-color).
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // On REMPLACE la palette Tailwind au lieu de l'étendre.
    // Une seule couleur d'accent (§4.1) : si `bg-blue-500` n'existe pas,
    // personne ne peut l'écrire par distraction.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      eb: {
        orange: 'var(--eb-orange)',
        black: 'var(--eb-black)',
        white: 'var(--eb-white)',
        cream: 'var(--eb-cream)',
        grey: 'var(--eb-grey)',
        line: 'var(--eb-grey-line)',
      },
    },
    // Échelle typographique fermée : 44 / 32 / 24 / 17 / 15 / 13 / 11 (§4.2).
    fontSize: {
      'display-xl': ['2.75rem', { lineHeight: '0.92', letterSpacing: '-0.01em' }], // 44
      'display-l': ['2rem', { lineHeight: '0.94', letterSpacing: '-0.01em' }],     // 32
      'display-m': ['1.5rem', { lineHeight: '1.0', letterSpacing: '-0.01em' }],    // 24
      'body-l': ['1.0625rem', { lineHeight: '1.45' }],                             // 17
      'body': ['0.9375rem', { lineHeight: '1.5' }],                                // 15
      'body-s': ['0.8125rem', { lineHeight: '1.45' }],                             // 13
      'util': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.08em' }],       // 11
    },
    borderRadius: {
      // §4.3 : 0 partout, 8px boutons, 14px sticker récompense. Rien d'autre.
      none: '0px',
      DEFAULT: '0px',
      button: '8px',
      sticker: '14px',
      full: '9999px', // réservé aux pastilles de compteur et aux avatars
    },
    fontFamily: {
      display: ['var(--font-display)', 'Impact', 'sans-serif'],
      sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      util: ['var(--font-util)', 'system-ui', 'sans-serif'],
    },
    extend: {
      inset: {
        tabbar: 'calc(60px + env(safe-area-inset-bottom))',
      },
      spacing: {
        // Hauteur de zone tactile minimale (mobile-first strict, §3)
        touch: '44px',
        // Barre d'onglets + safe area iOS
        tabbar: 'calc(60px + env(safe-area-inset-bottom))',
      },
      boxShadow: {
        // §4.5 : pas d'ombre portée molle. Seule une bordure franche existe.
        none: 'none',
      },
      keyframes: {
        'sticker-pop': {
          '0%': { transform: 'scale(0.94) rotate(-2deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(-2deg)', opacity: '1' },
        },
      },
      animation: {
        'sticker-pop': 'sticker-pop 180ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
