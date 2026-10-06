import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { money } from '../lib/util'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="animate-sheet relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

/** Campo de valor estilo app de banco: os dígitos entram pela direita, em centavos. */
export function MoneyInput({
  value,
  onChange,
  autoFocus,
  large,
}: {
  value: number
  onChange: (v: number) => void
  autoFocus?: boolean
  large?: boolean
}) {
  return (
    <input
      inputMode="numeric"
      autoFocus={autoFocus}
      aria-label="Valor"
      value={money(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
        onChange(Number(digits || '0') / 100)
      }}
      className={
        large
          ? 'tabular w-full bg-transparent text-center text-4xl font-bold outline-none'
          : 'tabular w-full rounded-xl border border-line bg-bg px-3.5 py-3 outline-none focus:border-accent'
      }
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-bg px-3.5 py-3 outline-none focus:border-accent ${props.className ?? ''}`}
    />
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-on-accent',
    ghost: 'bg-surface-2 text-ink',
    danger: 'bg-transparent text-bad',
  }[variant]
  return (
    <button
      {...props}
      className={`w-full rounded-2xl px-4 py-3.5 font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

/** Botão destrutivo com confirmação em dois toques (sem diálogo do navegador). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      type="button"
      variant="danger"
      className={armed ? '!bg-bad !text-white' : ''}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </Button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ ratio, color }: { ratio: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-4 ${className}`}>{children}</section>
}

export function Empty({ emoji, title, hint }: { emoji: string; title: string; hint: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  )
}

export function CategoryIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-2xl text-lg"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
    >
      {emoji}
    </span>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
      {error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.'}
    </p>
  )
}
