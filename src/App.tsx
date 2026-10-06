import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { CalendarCheck, ChevronLeft, ChevronRight, House, List as ListIcon, Plus, Settings as SettingsIcon, Target } from 'lucide-react'
import { useMe, type Me, type Tx } from './lib/api'
import { Ctx, firstName, type AppCtx } from './lib/ctx'
import { isConfigured, supabase } from './lib/supabase'
import { addMonths, currentMonth, monthLabel, type Scope } from './lib/util'
import { TxSheet } from './components/TxSheet'
import { Button, ErrorNote } from './components/ui'
import { Auth } from './screens/Auth'
import { Fixed } from './screens/Fixed'
import { Home } from './screens/Home'
import { List } from './screens/List'
import { Onboarding } from './screens/Onboarding'
import { Plan } from './screens/Plan'
import { Settings } from './screens/Settings'

export type Tab = 'home' | 'list' | 'fixed' | 'plan'

const SCOPE_KEY = 'nos-dois:scope'

function readScope(): Scope {
  try {
    return localStorage.getItem(SCOPE_KEY) === 'personal' ? 'personal' : 'shared'
  } catch {
    return 'shared'
  }
}

export default function App() {
  const qc = useQueryClient()
  // undefined = ainda carregando a sessão
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const me = useMe(session?.user.id)

  if (!isConfigured) {
    return (
      <Centered>
        <p className="font-semibold">Falta configurar o Supabase</p>
        <p className="mt-1 text-sm text-muted">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.</p>
      </Centered>
    )
  }
  if (session === undefined || (session && me.isLoading)) return <Centered>Carregando…</Centered>
  if (!session) return <Auth />
  if (me.error || !me.data) {
    return (
      <Centered>
        <ErrorNote error={me.error ?? new Error('Não foi possível carregar seu perfil.')} />
        <Button className="mt-4" onClick={() => me.refetch()}>
          Tentar de novo
        </Button>
        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </Centered>
    )
  }
  if (!me.data.household) return <Onboarding name={firstName(me.data.profile.name)} />
  return <Shell userId={session.user.id} me={me.data} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 text-center text-muted">{children}</div>
}

function Shell({ userId, me }: { userId: string; me: Me }) {
  const [scope, setScopeState] = useState<Scope>(readScope)
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<{ tx?: Tx } | null>(null)
  const [settings, setSettings] = useState(false)

  const ctx = useMemo<AppCtx>(
    () => ({
      userId,
      profile: me.profile,
      household: me.household!,
      members: me.members,
      scope,
      setScope: (s) => {
        setScopeState(s)
        try {
          localStorage.setItem(SCOPE_KEY, s)
        } catch {
          // sem storage (aba privada): a escolha vale só para esta sessão
        }
      },
      month,
      setMonth,
    }),
    [userId, me, scope, month],
  )

  const tabs: { id: Tab; label: string; icon: typeof House }[] = [
    { id: 'home', label: 'Início', icon: House },
    { id: 'list', label: 'Extrato', icon: ListIcon },
    { id: 'fixed', label: 'Fixas', icon: CalendarCheck },
    { id: 'plan', label: 'Planejar', icon: Target },
  ]
  const navButton = ({ id, label, icon: Icon }: (typeof tabs)[number]) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      aria-current={tab === id ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === id ? 'text-accent' : 'text-muted'}`}
    >
      <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} />
      {label}
    </button>
  )

  return (
    <Ctx.Provider value={ctx}>
      <div data-scope={scope} className="mx-auto flex min-h-full max-w-md flex-col">
        <header className="sticky top-0 z-30 bg-bg/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 rounded-2xl bg-surface-2 p-1">
              {(
                [
                  ['shared', '👫 Nosso'],
                  ['personal', '🔒 Meu'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={scope === value}
                  onClick={() => ctx.setScope(value)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    scope === value ? 'bg-accent text-on-accent shadow-sm' : 'text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSettings(true)}
              aria-label="Ajustes"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"
            >
              <SettingsIcon size={19} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior" className="grid size-10 place-items-center text-muted">
              <ChevronLeft size={22} />
            </button>
            <button onClick={() => setMonth(currentMonth())} className="text-base font-semibold">
              {monthLabel(month)}
              {month !== currentMonth() && <span className="ml-2 text-xs font-medium text-accent">voltar para hoje</span>}
            </button>
            <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês" className="grid size-10 place-items-center text-muted">
              <ChevronRight size={22} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-1 pb-28">
          {tab === 'home' && <Home onEdit={(tx) => setSheet({ tx })} goTo={setTab} />}
          {tab === 'list' && <List onEdit={(tx) => setSheet({ tx })} />}
          {tab === 'fixed' && <Fixed />}
          {tab === 'plan' && <Plan />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          {tabs.slice(0, 2).map(navButton)}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => setSheet({})}
              aria-label="Novo lançamento"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg transition active:scale-95"
            >
              <Plus size={28} strokeWidth={2.4} />
            </button>
          </div>
          {tabs.slice(2).map(navButton)}
        </nav>

        {sheet && <TxSheet key={sheet.tx?.id ?? 'new'} tx={sheet.tx} onClose={() => setSheet(null)} />}
        {settings && <Settings onClose={() => setSettings(false)} />}
      </div>
    </Ctx.Provider>
  )
}
