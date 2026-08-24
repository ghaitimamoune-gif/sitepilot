import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * L'échelle typographique d'Easy Burger est nommée (`text-body`,
 * `text-display-m`…) et la palette aussi (`text-eb-white`). Sans cette
 * configuration, tailwind-merge ne sait pas distinguer une taille d'une
 * couleur sur le préfixe `text-` : il considère `text-body` et
 * `text-eb-white` comme conflictuels et en supprime un.
 *
 * Symptôme observé : les boutons orange rendaient leur libellé en noir,
 * parce que la taille écrasait la couleur.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-xl',
            'display-l',
            'display-m',
            'body-l',
            'body',
            'body-s',
            'util',
          ],
        },
      ],
      'text-color': [
        {
          text: [
            'eb-orange',
            'eb-black',
            'eb-white',
            'eb-cream',
            'eb-grey',
            'eb-line',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
