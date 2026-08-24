import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Eyebrow } from './Eyebrow'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** §4.4 — on dit ce qui s'est passé et ce qu'il faut faire. Pas d'excuse. */
  error?: string
  hint?: string
}

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow as="span" className="text-eb-grey">
        <label htmlFor={inputId}>{label}</label>
      </Eyebrow>

      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-touch w-full border bg-eb-white px-3 text-body-l text-eb-black',
          'placeholder:text-eb-grey',
          error ? 'border-eb-orange' : 'border-eb-line',
          className,
        )}
        {...rest}
      />

      {error ? (
        <p id={`${inputId}-err`} className="text-body-s text-eb-orange">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-body-s text-eb-grey">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
