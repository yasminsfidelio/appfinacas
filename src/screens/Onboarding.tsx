import { useState, type FormEvent } from 'react'
import { useCreateHousehold, useJoinHousehold } from '../lib/api'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, Field, Segmented, TextInput } from '../components/ui'

export function Onboarding({ name }: { name: string }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [value, setValue] = useState('')
  const create = useCreateHousehold()
  const join = useJoinHousehold()
  const active = mode === 'create' ? create : join

  function submit(e: FormEvent) {
    e.preventDefault()
    if (value.trim()) active.mutate(value.trim())
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold">Oi{name ? `, ${name}` : ''}! 👋</h1>
      <p className="mt-1 mb-6 text-muted">
        Quem chegar primeiro cria a casa e manda o código de convite. Quem chegar depois entra com o código.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setValue('')
          }}
          options={[
            { value: 'create', label: 'Criar nossa casa' },
            { value: 'join', label: 'Tenho um código' },
          ]}
        />
        {mode === 'create' ? (
          <Field label="Nome da casa">
            <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Casa da Ana e do João" maxLength={40} required />
          </Field>
        ) : (
          <Field label="Código de convite">
            <TextInput
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              placeholder="8 caracteres"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              className="tabular tracking-widest"
              required
            />
          </Field>
        )}
        <ErrorNote error={active.error} />
        <Button type="submit" disabled={active.isPending}>
          {mode === 'create' ? 'Criar' : 'Entrar na casa'}
        </Button>
        <Button type="button" variant="danger" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </form>
    </div>
  )
}
