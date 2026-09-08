import type { MessageAdapter, OutgoingMessage, SendResult } from './types'
import { TEMPLATE_NAMES, templateVariables } from './templates'

/**
 * §13 — « remplaçable par WhatsApp Business plus tard sans toucher au code
 * appelant ». C'est ce fichier, et rien d'autre ne change.
 *
 * Deux raisons de préférer WhatsApp au SMS au Maroc : le coût par message
 * est nettement plus bas, et le fil de discussion reste lisible par le
 * client — un ticket de commande retrouvable, plutôt qu'un SMS noyé.
 *
 * MAIS WhatsApp n'est pas un SMS avec un autre transport :
 *
 *   — Un message envoyé à l'initiative du commerce, hors fenêtre de
 *     24 heures ouverte par le client, DOIT utiliser un gabarit approuvé
 *     par Meta. On n'envoie pas du texte libre. D'où `TEMPLATE_NAMES` :
 *     chaque gabarit local a un nom déclaré côté Meta, et on n'envoie que
 *     les variables.
 *   — Le compte doit être vérifié (Meta Business), avec un numéro dédié qui
 *     ne sert plus au SMS.
 *   — Les gabarits sont soumis à validation, comptez quelques jours.
 *
 * Variables d'environnement :
 *   WHATSAPP_PHONE_NUMBER_ID   identifiant du numéro (Meta Cloud API)
 *   WHATSAPP_TOKEN             jeton d'accès permanent
 *   WHATSAPP_LANG              code de langue des gabarits (défaut : fr)
 */
const ENV = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  token: process.env.WHATSAPP_TOKEN,
}

const LANG = process.env.WHATSAPP_LANG ?? 'fr'
const API_VERSION = 'v21.0'

export const WhatsAppAdapter: MessageAdapter = {
  name: 'whatsapp',

  isConfigured() {
    return Boolean(ENV.phoneNumberId && ENV.token)
  },

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp Business non configuré.' }
    }

    const templateName = TEMPLATE_NAMES[message.template]
    if (!templateName) {
      return {
        ok: false,
        error:
          `Aucun gabarit WhatsApp déclaré pour « ${message.template} ». ` +
          `Il doit être créé et approuvé côté Meta avant de pouvoir partir.`,
      }
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${ENV.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ENV.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            // L'API veut le numéro sans le « + ».
            to: message.phone.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: templateName,
              language: { code: LANG },
              components: [
                {
                  type: 'body',
                  parameters: templateVariables(message.template, message.payload).map(
                    (text) => ({ type: 'text', text }),
                  ),
                },
              ],
            },
          }),
        },
      )

      const body = (await response.json()) as {
        messages?: { id: string }[]
        error?: { message?: string }
      }

      if (!response.ok) {
        return {
          ok: false,
          error: body.error?.message ?? `WhatsApp : HTTP ${response.status}`,
        }
      }

      return { ok: true, providerRef: body.messages?.[0]?.id }
    } catch (err) {
      return { ok: false, error: `WhatsApp injoignable : ${String(err)}` }
    }
  },
}
