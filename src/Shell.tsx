import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Search, Star, Menu, X, History, Trash2, ArrowUpRight, Wrench, ShieldCheck } from 'lucide-react'
import { clearHistory, getFavorites, getHistory, setFavorites } from './storage'
import type { HistoryEntry } from './storage'

export type NavTool = { id: string; name: string; category: string }
export function IconButton({ label, onClick, children, disabled = false }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" className="icon-button" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>
}
export function Shell({ title, subtitle, tools, active, onSelect, children }: { title: string; subtitle: string; tools: NavTool[]; active: string; onSelect: (id: string) => void; children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [favorites, updateFavorites] = useState<string[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [menu, setMenu] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [storageError, setStorageError] = useState('')
  useEffect(() => { getFavorites().then(updateFavorites).catch(() => setStorageError('Browser storage unavailable. Preferences will not persist.')).finally(() => setStorageReady(true)) }, [])
  const selected = tools.find(tool => tool.id === active) ?? tools[0]
  const filtered = tools.filter(tool => `${tool.name} ${tool.category}`.toLowerCase().includes(query.toLowerCase()) && (!favoriteOnly || favorites.includes(tool.id)))
  const categories = [...new Set(filtered.map(tool => tool.category))]
  function select(id: string) { onSelect(id); setMenu(false); window.location.hash = id }
  function toggleFavorite() {
    const next = favorites.includes(active) ? favorites.filter(id => id !== active) : [...favorites, active]
    setStorageReady(false)
    setFavorites(next).then(() => updateFavorites(next)).catch(() => setStorageError('Could not save favorites.')).finally(() => setStorageReady(true))
  }
  async function showHistory() { try { setHistory(await getHistory()) } catch { setStorageError('Could not open local history.') } }
  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Tool navigation">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); select(tools[0].id) }}><span className="brand-mark"><Wrench size={20} /></span><span>LOCAL<span className="brand-sub">{subtitle}</span></span></a>
      <div className="nav-search"><Search size={16} /><input aria-label="Search tools" placeholder="Search tools..." value={query} onChange={event => setQuery(event.target.value)} /><IconButton label={favoriteOnly ? 'Show all tools' : 'Show favorites'} onClick={() => setFavoriteOnly(!favoriteOnly)}><Star size={16} fill={favoriteOnly ? 'currentColor' : 'none'} /></IconButton></div>
      <nav>{categories.map(category => <section className="nav-group" key={category}><h2>{category}</h2>{filtered.filter(tool => tool.category === category).map(tool => <button type="button" className={`nav-item ${active === tool.id ? 'active' : ''}`} onClick={() => select(tool.id)} key={tool.id}><span>{tool.name}</span>{favorites.includes(tool.id) ? <Star size={12} /> : active === tool.id ? <ArrowUpRight size={14} /> : null}</button>)}</section>)}{!filtered.length && <p className="empty">No matching tools</p>}</nav>
      <div className="nav-footer"><ShieldCheck size={15} /><span>Local session</span><span className="tool-count">{tools.length} tools</span></div>
    </aside>
    {menu && <button className="menu-overlay" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <div className="main-shell"><header className="topbar"><div className="mobile-menu"><IconButton label={menu ? 'Close navigation' : 'Open navigation'} onClick={() => setMenu(!menu)}>{menu ? <X size={20} /> : <Menu size={20} />}</IconButton></div><h1>{title}</h1><span className="topbar-category">{selected.category}</span><div className="topbar-actions"><IconButton label="Open history" onClick={() => { void showHistory() }}><History size={19} /></IconButton><IconButton disabled={!storageReady} label={favorites.includes(active) ? 'Remove favorite' : 'Add favorite'} onClick={toggleFavorite}><Star size={19} fill={favorites.includes(active) ? 'currentColor' : 'none'} /></IconButton></div></header>
      <main><div className="tool-heading"><span className="eyebrow">{selected.category}</span><h2>{selected.name}</h2></div>{storageError && <div role="status" className="notice">{storageError}</div>}{children}</main>
      <footer className="page-footer"><span>LOCAL / {subtitle.toUpperCase()}</span><span>v1.0</span></footer>
    </div>
    {history !== null && <div className="dialog-backdrop" onClick={() => setHistory(null)}><section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setHistory(null); if (event.key === 'Tab') { const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]; const first = buttons[0]; const last = buttons[buttons.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } } }}><div className="section-toolbar"><h2 id="history-title">Recent activity</h2><div className="actions"><IconButton label="Clear history" onClick={() => { clearHistory().then(() => setHistory([])).catch(() => setStorageError('Could not clear history.')) }}><Trash2 size={18} /></IconButton><button autoFocus className="icon-button" title="Close history" aria-label="Close history" onClick={() => setHistory(null)}><X size={18} /></button></div></div>{!history.length && <p className="empty">No recent activity</p>}{history.map(entry => <button key={entry.id} className="history-row" onClick={() => { select(entry.tool); setHistory(null) }}><span>{entry.name}</span><time>{new Date(entry.time).toLocaleString()}</time></button>)}</section></div>}
  </div>
}