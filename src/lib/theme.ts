export type Theme = 'rosa' | 'azul'

export const THEMES: { id: Theme; label: string; color: string; bg: string }[] = [
  { id: 'rosa', label: 'Rosa e branco', color: '#d6336c', bg: '#fdf6f9' },
  { id: 'azul', label: 'Azul e branco', color: '#2563eb', bg: '#f5f9ff' },
]

const KEY = 'nos-dois:theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'azul' ? 'azul' : 'rosa'
  } catch {
    return 'rosa'
  }
}

/** Aplica o tema na página e guarda a escolha neste aparelho. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const bg = THEMES.find((t) => t.id === theme)!.bg
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // sem storage (aba privada): o tema vale só para esta sessão
  }
}
