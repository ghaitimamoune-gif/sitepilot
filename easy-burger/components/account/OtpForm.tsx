'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestOtp, verifyOtp } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * Connexion en deux temps : numéro, puis code à 6 chiffres.
 *
 * §8 — chaque SMS coûte de l'argent et chaque OTP perd des commandes. D'où
 * le compte à rebours avant de pouvoir redemander un code, et la saisie
 * numérique qui ouvre le bon clavier du premier coup.
 */
const RESEND_DELAY = 45

export function OtpForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [pending, startTransition] = useTransition()
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (countdown <= 0) return
    const id = window.setInterval(() => setCountdown((n) => n - 1), 1000)
    return () => window.clearInterval(id)
  }, [countdown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  function send() {
    setError(null)
    startTransition(async () => {
      const result = await requestOtp(phone)
      if (!result.ok) return setError(result.error)
      setStep('code')
      setCountdown(RESEND_DELAY)
    })
  }

  function verify() {
    setError(null)
    startTransition(async () => {
      const result = await verifyOtp(phone, code)
      if (!result.ok) return setError(result.error)
      router.replace(redirectTo)
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (step === 'phone') send()
        else verify()
      }}
      className="flex flex-col gap-5"
    >
      <Field
        label="téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        autoFocus={step === 'phone'}
        placeholder="06 12 34 56 78"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={step === 'code'}
        hint={step === 'phone' ? 'On t’envoie un code à 6 chiffres.' : undefined}
      />

      {step === 'code' && (
        <>
          <Field
            ref={codeRef}
            label="code reçu par SMS"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="eb-price text-center text-display-m tracking-[0.3em]"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
              className="eb-eyebrow font-util text-eb-grey"
            >
              changer de numéro
            </button>

            {countdown > 0 ? (
              <Eyebrow className="text-eb-grey">
                nouveau code dans {countdown}s
              </Eyebrow>
            ) : (
              <button
                type="button"
                onClick={send}
                className="eb-eyebrow font-util text-eb-orange"
              >
                renvoyer le code
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}

      <Button
        type="submit"
        block
        size="lg"
        loading={pending}
        disabled={step === 'code' && code.length < 6}
      >
        {step === 'phone' ? 'Recevoir mon code' : 'Me connecter'}
      </Button>

      <p className="text-body-s text-eb-grey">
        On garde ta session un an : tu ne devrais plus jamais avoir à ressaisir
        de code sur cet appareil.
      </p>
    </form>
  )
}
