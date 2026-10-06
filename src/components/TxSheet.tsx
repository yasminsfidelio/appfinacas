import { useState, type FormEvent } from 'react'
import { useAddTx, useDeleteTx, useUpdateTx, type Tx } from '../lib/api'
import { useApp } from '../lib/ctx'
import { categoriesFor, money, splitInstallments, today, type Kind, type Scope } from '../lib/util'
import { Button, ConfirmButton, ErrorNote, Field, MoneyInput, Segmented, Sheet, TextInput } from './ui'

export function CategoryPicker({ kind, value, onChange }: { kind: Kind; value: string; onChange: (k: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categoriesFor(kind).map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={value === c.key}
          onClick={() => onChange(c.key)}
          className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[11px] font-medium transition ${
            value === c.key ? 'border-accent bg-accent-soft text-ink' : 'border-transparent bg-surface-2 text-muted'
          }`}
        >
          <span className="text-xl">{c.emoji}</span>
          <span className="w-full truncate text-center">{c.label}</span>
        </button>
      ))}
    </div>
  )
}

export function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'shared', label: '👫 Nosso' },
        { value: 'personal', label: '🔒 Só meu' },
      ]}
    />
  )
}

export function TxSheet({ tx, onClose }: { tx?: Tx; onClose: () => void }) {
  const app = useApp()
  const add = useAddTx()
  const update = useUpdateTx()
  const del = useDeleteTx()

  const [kind, setKind] = useState<Kind>(tx?.kind ?? 'expense')
  const [amount, setAmount] = useState(tx?.amount ?? 0)
  const [description, setDescription] = useState(tx?.description ?? '')
  const [cat, setCat] = useState(tx?.category ?? '')
  const [date, setDate] = useState(tx?.date ?? (app.month === today().slice(0, 7) ? today() : `${app.month}-01`))
  const [scope, setScope] = useState<Scope>(tx?.scope ?? app.scope)
  const [installments, setInstallments] = useState(1)

  const categories = categoriesFor(kind)
  const category = categories.some((c) => c.key === cat) ? cat : ''
  const valid = amount > 0 && category !== '' && date !== ''
  const busy = add.isPending || update.isPending || del.isPending

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const label = description.trim() || categories.find((c) => c.key === category)!.label
    const base = { scope, kind, description: label, amount, date, category }
    if (tx) await update.mutateAsync({ id: tx.id, ...base })
    else await add.mutateAsync({ ...base, installments: kind === 'expense' ? installments : 1 })
    onClose()
  }

  async function remove(target: Parameters<typeof del.mutateAsync>[0]) {
    await del.mutateAsync(target)
    onClose()
  }

  return (
    <Sheet title={tx ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
          ]}
        />

        <div className={`py-2 ${kind === 'income' ? 'text-good' : 'text-ink'}`}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!tx} large />
        </div>

        <CategoryPicker kind={kind} value={category} onChange={setCat} />

        <Field label="Descrição (opcional)">
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={kind === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado da semana'}
            maxLength={80}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {!tx && kind === 'expense' && (
            <Field label="Parcelas">
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 outline-none focus:border-accent"
              >
                <option value={1}>À vista</option>
                {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {installments > 1 && amount > 0 && (
          <p className="-mt-1 text-sm text-muted">
            {installments}x de {money(splitInstallments(amount, installments)[1])}, uma por mês a partir da data acima.
          </p>
        )}
        {tx?.installment_total && (
          <p className="-mt-1 text-sm text-muted">
            Parcela {tx.installment_no} de {tx.installment_total}.
          </p>
        )}

        <Field label="De quem é?">
          <ScopePicker value={scope} onChange={setScope} />
        </Field>

        <ErrorNote error={add.error ?? update.error ?? del.error} />

        <Button type="submit" disabled={!valid || busy}>
          {tx ? 'Salvar' : 'Adicionar'}
        </Button>

        {tx && (
          <div className="space-y-1">
            <ConfirmButton label="Excluir" confirmLabel="Toque de novo para excluir" onConfirm={() => remove({ id: tx.id })} />
            {tx.installment_group && tx.installment_no !== tx.installment_total && (
              <ConfirmButton
                label="Excluir esta e as próximas parcelas"
                confirmLabel="Toque de novo para excluir as parcelas"
                onConfirm={() => remove({ installment_group: tx.installment_group!, fromDate: tx.date })}
              />
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
