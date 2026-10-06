import { useState } from 'react'
import { Copy } from 'lucide-react'
import { useRename } from '../lib/api'
import { firstName, useApp } from '../lib/ctx'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, Field, Sheet, TextInput } from '../components/ui'

export function Settings({ onClose }: { onClose: () => void }) {
  const { profile, household, members, userId } = useApp()
  const rename = useRename()
  const [name, setName] = useState(profile.name)
  const [home, setHome] = useState(household.name)
  const [copied, setCopied] = useState(false)
  const partner = members.find((m) => m.id !== userId)
  const dirty = name.trim() !== profile.name || home.trim() !== household.name

  async function save() {
    if (name.trim() && name.trim() !== profile.name) await rename.mutateAsync({ table: 'profiles', id: profile.id, name: name.trim() })
    if (home.trim() && home.trim() !== household.name) await rename.mutateAsync({ table: 'households', id: household.id, name: home.trim() })
  }

  async function copy() {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Seu nome">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Nome da casa">
          <TextInput value={home} onChange={(e) => setHome(e.target.value)} maxLength={40} />
        </Field>
        {dirty && (
          <Button onClick={save} disabled={rename.isPending}>
            Salvar
          </Button>
        )}
        <ErrorNote error={rename.error} />

        <div className="rounded-2xl bg-surface-2 p-4">
          {partner ? (
            <p>
              Você divide esta casa com <strong>{firstName(partner.name)}</strong>. O que está em <strong>Nosso</strong> os dois veem; o que está em{' '}
              <strong>Meu</strong> só você vê.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">Envie este código para o seu par entrar na casa:</p>
              <button onClick={copy} className="mt-2 flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3">
                <span className="tabular text-xl font-bold tracking-widest">{household.invite_code}</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-accent">
                  <Copy size={16} /> {copied ? 'Copiado!' : 'Copiar'}
                </span>
              </button>
            </>
          )}
        </div>

        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Sair da conta
        </Button>
      </div>
    </Sheet>
  )
}
