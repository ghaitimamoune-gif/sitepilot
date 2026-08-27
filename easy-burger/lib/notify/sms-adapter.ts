import type { MessageAdapter, OutgoingMessage, SendResult } from './types'

/**
 * Adaptateur SMS générique.
 *
 * Volontairement paramétré par variables d'environnement plutôt que codé
 * pour un fournisseur : le choix n'est pas fait (§16), et la plupart des
 * passerelles marocaines exposent la même forme — une URL, un identifiant,
 * un mot de passe, un expéditeur.
 *
 *   SMS_ENDPOINT   URL de l'API d'envoi
 *   SMS_USERNAME   identifiant
 *   SMS_PASSWORD   mot de passe ou clé
 *   SMS_SENDER     nom de l'expéditeur affiché (« EasyBurger »)
 *
 * À vérifier avant de brancher : le format exact attendu, et surtout le coût
 * unitaire vers le Maroc — c'est lui qui décide de la durée de session et de
 * la fréquence des OTP.
 */
const ENV = {
  endpoint: process.env.SMS_ENDPOINT,
  username: process.env.SMS_USERNAME,
  password: process.env.SMS_PASSWORD,
  sender: process.env.SMS_SENDER,
}

export const SmsAdapter: MessageAdapter = {
  name: 'sms',

  isConfigured() {
    return Object.values(ENV).every(Boolean)
  },

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Passerelle SMS non configurée.' }
    }

    try {
      const response = await fetch(ENV.endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: ENV.username,
          password: ENV.password,
          sender: ENV.sender,
          to: message.phone,
          text: message.body,
        }),
      })

      if (!response.ok) {
        return { ok: false, error: `Passerelle SMS : HTTP ${response.status}` }
      }

      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Passerelle SMS injoignable : ${String(err)}` }
    }
  },
}
