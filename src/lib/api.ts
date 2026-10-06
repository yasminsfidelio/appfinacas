import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { addMonths, dateInMonth, monthEnd, monthStart, splitInstallments, type Kind, type Scope } from './util'

export interface Profile {
  id: string
  name: string
  household_id: string | null
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface Tx {
  id: string
  owner_id: string
  scope: Scope
  kind: Kind
  description: string
  amount: number
  date: string
  category: string
  recurring_id: string | null
  ref_month: string | null
  installment_group: string | null
  installment_no: number | null
  installment_total: number | null
  created_at: string
}

export interface Recurring {
  id: string
  owner_id: string
  scope: Scope
  kind: Kind
  description: string
  amount: number
  category: string
  due_day: number
  start_month: string
}

export interface Budget {
  id: string
  owner_id: string
  scope: Scope
  category: string
  amount: number
}

export interface GoalDeposit {
  id: string
  goal_id: string
  user_id: string
  amount: number
  date: string
}

export interface Goal {
  id: string
  owner_id: string
  scope: Scope
  name: string
  emoji: string
  target: number
  deadline: string | null
  goal_deposits: GoalDeposit[]
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ---------- Perfil e casa ----------

export interface Me {
  profile: Profile
  household: Household | null
  members: Profile[]
}

export function useMe(userId: string | undefined) {
  return useQuery({
    queryKey: ['me', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Me> => {
      const profile = unwrap(
        await supabase.from('profiles').select('id, name, household_id').eq('id', userId!).single(),
      ) as Profile
      if (!profile.household_id) return { profile, household: null, members: [profile] }
      const [household, members] = await Promise.all([
        supabase.from('households').select('id, name, invite_code').eq('id', profile.household_id).single(),
        supabase.from('profiles').select('id, name, household_id').eq('household_id', profile.household_id),
      ])
      return { profile, household: unwrap(household) as Household, members: unwrap(members) as Profile[] }
    },
  })
}

// ---------- Leituras ----------

/** Lançamentos do mês + pagamentos de contas fixas referentes a ele. */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: ['tx', month],
    queryFn: async () => {
      const start = monthStart(month)
      const rows = unwrap(
        await supabase
          .from('transactions')
          .select('*')
          .or(`and(date.gte.${start},date.lte.${monthEnd(month)}),ref_month.eq.${start}`)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as Tx[]
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('recurring').select('*').order('due_day')) as Recurring[]
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('budgets').select('*')) as Budget[]
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('goals').select('*, goal_deposits(*)').order('created_at'),
      ) as Goal[]
      return rows.map((g) => ({
        ...g,
        target: Number(g.target),
        goal_deposits: g.goal_deposits.map((d) => ({ ...d, amount: Number(d.amount) })),
      }))
    },
  })
}

// ---------- Escritas ----------

/** Mutation que invalida as queries indicadas ao terminar. */
function useWrite<V>(keys: string[], fn: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export interface TxInput {
  scope: Scope
  kind: Kind
  description: string
  amount: number
  date: string
  category: string
  /** > 1 cria uma compra parcelada: `amount` é o total */
  installments?: number
}

export const useAddTx = () =>
  useWrite(['tx'], async (input: TxInput) => {
    const { installments = 1, ...tx } = input
    if (installments <= 1) return unwrap(await supabase.from('transactions').insert(tx))
    const group = crypto.randomUUID()
    const month = tx.date.slice(0, 7)
    const day = Number(tx.date.slice(8))
    const rows = splitInstallments(tx.amount, installments).map((amount, i) => ({
      ...tx,
      amount,
      date: dateInMonth(addMonths(month, i), day),
      installment_group: group,
      installment_no: i + 1,
      installment_total: installments,
    }))
    return unwrap(await supabase.from('transactions').insert(rows))
  })

export const useUpdateTx = () =>
  useWrite(['tx'], async ({ id, ...patch }: { id: string } & Partial<Omit<TxInput, 'installments'>>) =>
    unwrap(await supabase.from('transactions').update(patch).eq('id', id)),
  )

export const useDeleteTx = () =>
  useWrite(['tx'], async (target: { id: string } | { installment_group: string; fromDate: string }) => {
    const q = supabase.from('transactions').delete()
    return unwrap(
      'id' in target
        ? await q.eq('id', target.id)
        : await q.eq('installment_group', target.installment_group).gte('date', target.fromDate),
    )
  })

export type RecurringInput = Omit<Recurring, 'id' | 'owner_id'>

export const useSaveRecurring = () =>
  useWrite(['recurring'], async ({ id, ...row }: Partial<RecurringInput> & { id?: string }) =>
    unwrap(
      id
        ? await supabase.from('recurring').update(row).eq('id', id)
        : await supabase.from('recurring').insert(row),
    ),
  )

export const useDeleteRecurring = () =>
  useWrite(['recurring', 'tx'], async (id: string) =>
    unwrap(await supabase.from('recurring').delete().eq('id', id)),
  )

/** Marca a conta fixa como paga/recebida no mês, criando o lançamento correspondente. */
export const usePayRecurring = () =>
  useWrite(['tx'], async ({ rec, month, amount, date }: { rec: Recurring; month: string; amount: number; date: string }) =>
    unwrap(
      await supabase.from('transactions').insert({
        scope: rec.scope,
        kind: rec.kind,
        description: rec.description,
        category: rec.category,
        amount,
        date,
        recurring_id: rec.id,
        ref_month: monthStart(month),
      }),
    ),
  )

export const useSaveBudget = () =>
  useWrite(['budgets'], async ({ id, scope, category, amount }: { id?: string; scope: Scope; category: string; amount: number }) =>
    unwrap(
      id
        ? await supabase.from('budgets').update({ amount }).eq('id', id)
        : await supabase.from('budgets').insert({ scope, category, amount }),
    ),
  )

export const useDeleteBudget = () =>
  useWrite(['budgets'], async (id: string) => unwrap(await supabase.from('budgets').delete().eq('id', id)))

export interface GoalInput {
  id?: string
  scope: Scope
  name: string
  emoji: string
  target: number
  deadline: string | null
}

export const useSaveGoal = () =>
  useWrite(['goals'], async ({ id, ...row }: GoalInput) =>
    unwrap(id ? await supabase.from('goals').update(row).eq('id', id) : await supabase.from('goals').insert(row)),
  )

export const useDeleteGoal = () =>
  useWrite(['goals'], async (id: string) => unwrap(await supabase.from('goals').delete().eq('id', id)))

export const useAddDeposit = () =>
  useWrite(['goals'], async (row: { goal_id: string; amount: number; date: string }) =>
    unwrap(await supabase.from('goal_deposits').insert(row)),
  )

export const useCreateHousehold = () =>
  useWrite(['me'], async (name: string) => unwrap(await supabase.rpc('create_household', { p_name: name })))

export const useJoinHousehold = () =>
  useWrite(['me'], async (code: string) => unwrap(await supabase.rpc('join_household', { p_code: code })))

export const useRename = () =>
  useWrite(['me'], async ({ table, id, name }: { table: 'profiles' | 'households'; id: string; name: string }) =>
    unwrap(await supabase.from(table).update({ name }).eq('id', id)),
  )
