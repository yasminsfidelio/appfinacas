import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import {
  useAddDeposit,
  useBudgets,
  useDeleteBudget,
  useDeleteGoal,
  useGoals,
  useSaveBudget,
  useSaveGoal,
  type Budget,
  type Goal,
} from '../lib/api'
import { useApp } from '../lib/ctx'
import { useMonthData } from '../lib/month'
import { category, EXPENSE_CATEGORIES, money, shortDate, today } from '../lib/util'
import { CategoryPicker } from '../components/TxSheet'
import { Button, Card, CategoryIcon, ConfirmButton, Empty, ErrorNote, Field, MoneyInput, Progress, Segmented, Sheet, TextInput } from '../components/ui'

export function Plan() {
  const [view, setView] = useState<'budgets' | 'goals'>('budgets')
  return (
    <div className="space-y-3">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'budgets', label: 'Orçamento' },
          { value: 'goals', label: 'Metas' },
        ]}
      />
      {view === 'budgets' ? <Budgets /> : <Goals />}
    </div>
  )
}

// ---------- Orçamento por categoria ----------

function Budgets() {
  const { scope } = useApp()
  const query = useBudgets()
  const data = useMonthData()
  const [editing, setEditing] = useState<Budget | 'new' | null>(null)
  const budgets = (query.data ?? []).filter((b) => b.scope === scope)
  const used = budgets.map((b) => b.category)

  return (
    <>
      <ErrorNote error={query.error} />
      {budgets.length === 0 && !query.isLoading && (
        <Empty emoji="🎚️" title="Sem limites definidos" hint="Defina quanto querem gastar por mês em cada categoria e acompanhe aqui." />
      )}
      {budgets.map((b) => {
        const cat = category(b.category)
        const spent = data.byCategory.get(b.category) ?? 0
        const ratio = spent / b.amount
        const left = b.amount - spent
        const color = ratio > 1 ? 'var(--bad)' : ratio >= 0.8 ? 'var(--warn)' : 'var(--good)'
        return (
          <Card key={b.id}>
            <button onClick={() => setEditing(b)} className="w-full text-left">
              <div className="mb-3 flex items-center gap-3">
                <CategoryIcon emoji={cat.emoji} color={cat.color} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{cat.label}</span>
                  <span className="tabular block text-xs text-muted">
                    {money(spent)} de {money(b.amount)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold" style={{ color }}>
                  {left >= 0 ? `sobram ${money(left)}` : `passou ${money(-left)}`}
                </span>
              </div>
              <Progress ratio={ratio} color={color} />
            </button>
          </Card>
        )
      })}
      {used.length < EXPENSE_CATEGORIES.length && (
        <Button variant="ghost" onClick={() => setEditing('new')} className="flex items-center justify-center gap-2">
          <Plus size={18} /> Novo limite
        </Button>
      )}
      {editing && <BudgetSheet budget={editing === 'new' ? undefined : editing} used={used} onClose={() => setEditing(null)} />}
    </>
  )
}

function BudgetSheet({ budget, used, onClose }: { budget?: Budget; used: string[]; onClose: () => void }) {
  const { scope } = useApp()
  const save = useSaveBudget()
  const del = useDeleteBudget()
  const [cat, setCat] = useState(budget?.category ?? '')
  const [amount, setAmount] = useState(budget?.amount ?? 0)
  const taken = !budget && used.includes(cat)
  const valid = cat !== '' && amount > 0 && !taken

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await save.mutateAsync({ id: budget?.id, scope, category: cat, amount })
    onClose()
  }

  return (
    <Sheet title={budget ? `Limite de ${category(budget.category).label}` : 'Novo limite mensal'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!budget && <CategoryPicker kind="expense" value={cat} onChange={setCat} />}
        {taken && <p className="text-sm text-warn">Essa categoria já tem um limite. Toque nela na lista para alterar.</p>}
        <Field label="Limite por mês">
          <MoneyInput value={amount} onChange={setAmount} autoFocus={Boolean(budget)} />
        </Field>
        <ErrorNote error={save.error ?? del.error} />
        <Button type="submit" disabled={!valid || save.isPending}>
          Salvar
        </Button>
        {budget && (
          <ConfirmButton
            label="Remover limite"
            confirmLabel="Toque de novo para remover"
            onConfirm={async () => {
              await del.mutateAsync(budget.id)
              onClose()
            }}
          />
        )}
      </form>
    </Sheet>
  )
}

// ---------- Metas ----------

const GOAL_EMOJIS = ['🎯', '💍', '✈️', '🏠', '🚗', '👶', '🛟', '🎓', '🎁', '💻', '🏖️', '🐶']

function Goals() {
  const { scope } = useApp()
  const query = useGoals()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [depositing, setDepositing] = useState<Goal | null>(null)
  const goals = (query.data ?? []).filter((g) => g.scope === scope)

  return (
    <>
      <ErrorNote error={query.error} />
      {goals.length === 0 && !query.isLoading && (
        <Empty
          emoji="🎯"
          title="Nenhuma meta ainda"
          hint={scope === 'shared' ? 'Casamento, viagem, reserva de emergência… criem a primeira meta juntos.' : 'Crie uma meta só sua. Ninguém mais vê.'}
        />
      )}
      {goals.map((g) => {
        const saved = g.goal_deposits.reduce((s, d) => s + d.amount, 0)
        const done = saved >= g.target
        return (
          <Card key={g.id}>
            <button onClick={() => setEditing(g)} className="flex w-full items-center gap-3 text-left">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl">{g.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{g.name}</span>
                <span className="block text-xs text-muted">
                  {done ? 'Meta alcançada 🎉' : g.deadline ? `até ${shortDate(g.deadline)}` : 'sem prazo'}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm font-semibold">{Math.round((saved / g.target) * 100)}%</span>
            </button>
            <div className="mt-3">
              <Progress ratio={saved / g.target} />
              <div className="tabular mt-1.5 flex justify-between text-xs text-muted">
                <span>{money(saved)}</span>
                <span>{money(g.target)}</span>
              </div>
            </div>
            <Button variant="ghost" className="mt-3 !py-2.5 text-sm" onClick={() => setDepositing(g)}>
              Guardar dinheiro
            </Button>
          </Card>
        )
      })}
      <Button variant="ghost" onClick={() => setEditing('new')} className="flex items-center justify-center gap-2">
        <Plus size={18} /> Nova meta
      </Button>
      {editing && <GoalSheet goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {depositing && <DepositSheet goal={depositing} onClose={() => setDepositing(null)} />}
    </>
  )
}

function GoalSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { scope } = useApp()
  const save = useSaveGoal()
  const del = useDeleteGoal()
  const [name, setName] = useState(goal?.name ?? '')
  const [emoji, setEmoji] = useState(goal?.emoji ?? GOAL_EMOJIS[0])
  const [target, setTarget] = useState(goal?.target ?? 0)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const valid = name.trim() !== '' && target > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await save.mutateAsync({ id: goal?.id, scope: goal?.scope ?? scope, name: name.trim(), emoji, target, deadline: deadline || null })
    onClose()
  }

  return (
    <Sheet title={goal ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {GOAL_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              onClick={() => setEmoji(e)}
              className={`rounded-2xl border py-2 text-2xl ${emoji === e ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface-2'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <Field label="Nome da meta">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Casamento" maxLength={50} autoFocus={!goal} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quanto precisam">
            <MoneyInput value={target} onChange={setTarget} />
          </Field>
          <Field label="Prazo (opcional)">
            <TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <ErrorNote error={save.error ?? del.error} />
        <Button type="submit" disabled={!valid || save.isPending}>
          Salvar
        </Button>
        {goal && (
          <ConfirmButton
            label="Excluir meta"
            confirmLabel="Toque de novo para excluir"
            onConfirm={async () => {
              await del.mutateAsync(goal.id)
              onClose()
            }}
          />
        )}
      </form>
    </Sheet>
  )
}

function DepositSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const add = useAddDeposit()
  const [mode, setMode] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState(0)
  const saved = goal.goal_deposits.reduce((s, d) => s + d.amount, 0)
  const valid = amount > 0 && (mode === 'in' || amount <= saved)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await add.mutateAsync({ goal_id: goal.id, amount: mode === 'in' ? amount : -amount, date: today() })
    onClose()
  }

  return (
    <Sheet title={`${goal.emoji} ${goal.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'in', label: 'Guardar' },
            { value: 'out', label: 'Retirar' },
          ]}
        />
        <MoneyInput value={amount} onChange={setAmount} autoFocus large />
        <p className="tabular text-center text-sm text-muted">
          Guardado até agora: {money(saved)} de {money(goal.target)}
        </p>
        <ErrorNote error={add.error} />
        <Button type="submit" disabled={!valid || add.isPending}>
          {mode === 'in' ? 'Guardar' : 'Retirar'}
        </Button>
      </form>
    </Sheet>
  )
}
