import { useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { useDeleteRecurring, useDeleteTx, usePayRecurring, useSaveRecurring, type Recurring } from '../lib/api'
import { firstName, useApp } from '../lib/ctx'
import { useMonthData, type FixedItem } from '../lib/month'
import { category, categoriesFor, currentMonth, dateInMonth, money, monthStart, shortDate, today, type Kind, type Scope } from '../lib/util'
import { CategoryPicker, ScopePicker } from '../components/TxSheet'
import { Button, Card, CategoryIcon, ConfirmButton, Empty, ErrorNote, Field, MoneyInput, Progress, Segmented, Sheet, TextInput } from '../components/ui'

export function Fixed() {
  const { month } = useApp()
  const data = useMonthData()
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const [paying, setPaying] = useState<FixedItem | null>(null)

  const bills = data.fixed.filter((f) => f.rec.kind === 'expense')
  const incomes = data.fixed.filter((f) => f.rec.kind === 'income')
  const paidCount = bills.filter((f) => f.paid).length

  const group = (title: string, items: FixedItem[]) =>
    items.length > 0 && (
      <Card className="!py-2">
        <h3 className="pt-1.5 pb-1 text-xs font-semibold text-muted">{title}</h3>
        <div className="divide-y divide-line">
          {items.map((item) => (
            <FixedRow key={item.rec.id} item={item} month={month} onToggle={() => setPaying(item)} onEdit={() => setEditing(item.rec)} />
          ))}
        </div>
      </Card>
    )

  return (
    <div className="space-y-3">
      <ErrorNote error={data.error} />

      {bills.length > 0 && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-semibold">
              {paidCount} de {bills.length} contas pagas
            </span>
            <span className="tabular text-sm text-muted">{data.toPay > 0 ? `faltam ${money(data.toPay)}` : 'tudo em dia 🎉'}</span>
          </div>
          <Progress ratio={paidCount / bills.length} />
        </Card>
      )}

      {data.fixed.length === 0 && !data.loading && (
        <Empty
          emoji="📌"
          title="Nenhuma conta fixa ainda"
          hint="Cadastre aluguel, internet, luz, salário… Elas voltam todo mês e você só marca como paga."
        />
      )}

      {group('Contas do mês', bills)}
      {group('Receitas fixas', incomes)}

      <Button variant="ghost" onClick={() => setEditing('new')} className="flex items-center justify-center gap-2">
        <Plus size={18} /> Nova conta fixa
      </Button>

      {editing && <RecurringSheet rec={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && <PaySheet item={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

function FixedRow({ item, month, onToggle, onEdit }: { item: FixedItem; month: string; onToggle: () => void; onEdit: () => void }) {
  const { rec, paid } = item
  const cat = category(rec.category)
  const income = rec.kind === 'income'
  const late = !paid && !income && dateInMonth(month, rec.due_day) < today()

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={onToggle}
        aria-label={`${paid ? 'Desfazer' : 'Marcar'} ${rec.description} como ${income ? 'recebida' : 'paga'}`}
        aria-pressed={Boolean(paid)}
        className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition ${
          paid ? 'border-accent bg-accent text-on-accent' : 'border-line text-transparent'
        }`}
      >
        <Check size={16} strokeWidth={3} />
      </button>
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoryIcon emoji={cat.emoji} color={cat.color} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${paid ? 'text-muted line-through' : ''}`}>{rec.description}</span>
          <span className={`block truncate text-xs ${late ? 'font-semibold text-bad' : 'text-muted'}`}>
            {paid ? `${income ? 'Recebida' : 'Paga'} em ${shortDate(paid.date)}` : `${late ? 'Venceu' : income ? 'Entra' : 'Vence'} dia ${rec.due_day}`}
          </span>
        </span>
        <span className={`tabular shrink-0 font-semibold ${income ? 'text-good' : ''}`}>{money(paid?.amount ?? rec.amount)}</span>
      </button>
    </div>
  )
}

function PaySheet({ item, onClose }: { item: FixedItem; onClose: () => void }) {
  const { month, members, userId } = useApp()
  const { rec, paid } = item
  const pay = usePayRecurring()
  const undo = useDeleteTx()
  const income = rec.kind === 'income'
  const [amount, setAmount] = useState(rec.amount)
  const [date, setDate] = useState(month === currentMonth() ? today() : dateInMonth(month, rec.due_day))

  if (paid) {
    const who = members.find((m) => m.id === paid.owner_id)
    return (
      <Sheet title={rec.description} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-muted">
            {income ? 'Recebida' : 'Paga'} em {shortDate(paid.date)}
            {who && rec.scope === 'shared' ? ` por ${who.id === userId ? 'você' : firstName(who.name)}` : ''}:{' '}
            <strong className="tabular text-ink">{money(paid.amount)}</strong>
          </p>
          <ErrorNote error={undo.error} />
          <ConfirmButton
            label={income ? 'Desfazer recebimento' : 'Desfazer pagamento'}
            confirmLabel="Toque de novo para desfazer"
            onConfirm={async () => {
              await undo.mutateAsync({ id: paid.id })
              onClose()
            }}
          />
        </div>
      </Sheet>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    await pay.mutateAsync({ rec, month, amount, date })
    onClose()
  }

  return (
    <Sheet title={rec.description} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Se o valor veio diferente neste mês, ajuste aqui.</p>
        <MoneyInput value={amount} onChange={setAmount} large />
        <Field label={income ? 'Recebida em' : 'Paga em'}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <ErrorNote error={pay.error} />
        <Button type="submit" disabled={amount <= 0 || pay.isPending}>
          {income ? 'Marcar como recebida' : 'Marcar como paga'}
        </Button>
      </form>
    </Sheet>
  )
}

function RecurringSheet({ rec, onClose }: { rec?: Recurring; onClose: () => void }) {
  const app = useApp()
  const save = useSaveRecurring()
  const del = useDeleteRecurring()
  const [kind, setKind] = useState<Kind>(rec?.kind ?? 'expense')
  const [description, setDescription] = useState(rec?.description ?? '')
  const [amount, setAmount] = useState(rec?.amount ?? 0)
  const [cat, setCat] = useState(rec?.category ?? '')
  const [dueDay, setDueDay] = useState(String(rec?.due_day ?? 10))
  const [scope, setScope] = useState<Scope>(rec?.scope ?? app.scope)

  const cats = categoriesFor(kind)
  const categoryKey = cats.some((c) => c.key === cat) ? cat : ''
  const day = Number(dueDay)
  const valid = description.trim() !== '' && amount > 0 && categoryKey !== '' && day >= 1 && day <= 31

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await save.mutateAsync({
      id: rec?.id,
      kind,
      scope,
      description: description.trim(),
      amount,
      category: categoryKey,
      due_day: day,
      ...(rec ? {} : { start_month: monthStart(app.month) }),
    })
    onClose()
  }

  return (
    <Sheet title={rec ? 'Editar conta fixa' : 'Nova conta fixa'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Conta a pagar' },
            { value: 'income', label: 'Receita fixa' },
          ]}
        />
        <Field label="Nome">
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={kind === 'income' ? 'Ex.: Salário' : 'Ex.: Aluguel'}
            maxLength={60}
            autoFocus={!rec}
          />
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Valor mensal">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label={kind === 'income' ? 'Dia que entra' : 'Vence dia'}>
            <TextInput inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </Field>
        </div>
        <CategoryPicker kind={kind} value={categoryKey} onChange={setCat} />
        <Field label="De quem é?">
          <ScopePicker value={scope} onChange={setScope} />
        </Field>
        <ErrorNote error={save.error ?? del.error} />
        <Button type="submit" disabled={!valid || save.isPending}>
          Salvar
        </Button>
        {rec && (
          <ConfirmButton
            label="Excluir conta fixa"
            confirmLabel="Toque de novo para excluir"
            onConfirm={async () => {
              await del.mutateAsync(rec.id)
              onClose()
            }}
          />
        )}
        {rec && <p className="text-center text-xs text-muted">Os pagamentos já registrados continuam no extrato.</p>}
      </form>
    </Sheet>
  )
}
