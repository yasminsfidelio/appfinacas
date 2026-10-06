import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, Field, Segmented, TextInput } from '../components/ui'

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Esse e-mail já tem conta. Use "Entrar".',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
}

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice('')
    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
    setBusy(false)
    if (res.error) setError(new Error(MESSAGES[res.error.message] ?? res.error.message))
    else if (!res.data.session) setNotice('Conta criada! Abra o link de confirmação que enviamos para o seu e-mail e depois entre.')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-16 rounded-2xl" />
        <h1 className="mt-4 text-2xl font-bold">Nós Dois</h1>
        <p className="mt-1 text-muted">As finanças do casal, sem planilha.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'in', label: 'Entrar' },
            { value: 'up', label: 'Criar conta' },
          ]}
        />
        {mode === 'up' && (
          <Field label="Seu nome">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={40} />
          </Field>
        )}
        <Field label="E-mail">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Senha">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </Field>
        <ErrorNote error={error} />
        {notice && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">{notice}</p>}
        <Button type="submit" disabled={busy}>
          {mode === 'in' ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>
    </div>
  )
}
