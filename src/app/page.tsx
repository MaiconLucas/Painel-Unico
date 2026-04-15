'use client'

import { useEffect, useState, useCallback } from 'react'

const TASK_ORDER = ['Site', 'Portfólio', 'Implantação', 'Consultoria', 'URA', 'Importação de contatos', 'Migração']

type Task = { summary: string; status: string }
type Issue = {
  key: string
  name: string
  assignee: string | null
  status: string
  dueDate: string | null
  score: number | null
  services: string | null
  tasks: Task[]
  overdue: boolean
  nearDeadline: boolean
  waiting: boolean
  project: string
}
type Summary = { total: number; totalSA: number; atrasados: number; aguardando: number; ok: number }

function taskClass(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'done'
  if (s.includes('andamento')) return 'active'
  if (s.includes('aguardando')) return 'waiting'
  return 'blocked'
}

function Pipeline({ tasks }: { tasks: Task[] }) {
  const ordered = TASK_ORDER.map(t => tasks.find(tk => tk.summary?.includes(t))).filter(Boolean) as Task[]
  const free = tasks.filter(tk => !TASK_ORDER.some(t => tk.summary?.includes(t)))
  const all = [...ordered, ...free]
  let foundActive = false
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 10 }}>
      {all.map((tk, i) => {
        const s = tk.status.toLowerCase()
        const isDone = s.includes('conclu')
        const isActive = s.includes('andamento')
        if (isActive) foundActive = true
        const isNext = !foundActive && !isDone
        if (isNext) foundActive = true
        const cls = isDone ? 'done' : isActive ? 'active' : s.includes('aguardando') ? 'waiting' : isNext ? 'active' : 'blocked'
        const label = tk.summary.replace(/.*?[-–]\s*/, '').trim().split(' ').slice(0, 3).join(' ')
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: '#999', fontSize: 11 }}>›</span>}
            <span className={`pill pill-${cls}`}>{label}</span>
          </span>
        )
      })}
      {all.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sem tasks registradas</span>}
    </div>
  )
}

function Badge({ issue }: { issue: Issue }) {
  if (issue.overdue) return <span className="badge badge-danger">Atrasado</span>
  if (issue.waiting) return <span className="badge badge-warning">Aguardando</span>
  if (issue.nearDeadline) return <span className="badge badge-warning">Vence hoje</span>
  return <span className="badge badge-ok">No prazo</span>
}

function PrazoText({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null
  const now = new Date()
  const due = new Date(dueDate)
  const diffH = Math.round((due.getTime() - now.getTime()) / 3600000)
  const diffD = Math.round(diffH / 24)
  if (diffH < 0) return <p style={{ fontSize: 12, color: '#e24b4a', marginTop: 6 }}>Venceu há {Math.abs(diffD)} dia(s)</p>
  if (diffD === 0) return <p style={{ fontSize: 12, color: '#ba7517', marginTop: 6 }}>Vence em menos de 24h</p>
  return <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Prazo: {due.toLocaleDateString('pt-BR')}</p>
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>{issue.name}</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {issue.key}{issue.score ? ` · Score: ${issue.score} pts` : ''}{issue.services ? ` · ${issue.services}` : ''}
          </p>
        </div>
        <Badge issue={issue} />
      </div>
      {issue.project === 'KAN' && <Pipeline tasks={issue.tasks} />}
      <PrazoText dueDate={issue.dueDate} />
    </div>
  )
}

export default function Page() {
  const [clients, setClients] = useState<Issue[]>([])
  const [saIssues, setSaIssues] = useState<Issue[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, totalSA: 0, atrasados: 0, aguardando: 0, ok: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'KAN' | 'SA'>('KAN')
  const [filter, setFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/jira')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClients(data.clients)
      setSaIssues(data.saIssues)
      setSummary(data.summary)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const implantadores = Array.from(new Set(clients.map(c => c.assignee || 'Sem responsável')))

  const filteredKAN = clients.filter(c => {
    if (filter === 'atrasado') return c.overdue
    if (filter === 'aguardando') return c.waiting
    if (filter !== 'todos') return c.assignee === filter
    return true
  })

  const filteredSA = saIssues.filter(c => {
    if (filter === 'atrasado') return c.overdue
    if (filter === 'aguardando') return c.waiting
    return true
  })

  const byImpl: Record<string, Issue[]> = {}
  filteredKAN.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })

  return (
    <>
      <style>{`
        .pill { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .pill-done { background: #eaf3de; color: #3b6d11; }
        .pill-active { background: #b5d4f4; color: #0c447c; }
        .pill-waiting { background: #faeeda; color: #854f0b; }
        .pill-blocked { background: #f0f0ec; color: #888; border: 0.5px solid #ddd; }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 8px; font-weight: 500; }
        .badge-danger { background: #fcebeb; color: #a32d2d; }
        .badge-warning { background: #faeeda; color: #854f0b; }
        .badge-ok { background: #eaf3de; color: #3b6d11; }
        .filter-btn { font-size: 12px; padding: 5px 14px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; cursor: pointer; }
        .filter-btn.active { background: #fff; color: #1a1a1a; border-color: #999; font-weight: 500; }
        .card { background: #fff; border: 0.5px solid #e0e0d8; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; }
        .metric-card { background: #ececea; border-radius: 8px; padding: 12px 16px; }
        .tab-btn { font-size: 14px; padding: 8px 20px; border: none; background: transparent; color: #888; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; }
        .tab-btn.active { color: #1a1a1a; border-bottom: 2px solid #1a1a1a; }
        @media (prefers-color-scheme: dark) {
          .card { background: #1e1e1e; border-color: #333; }
          .metric-card { background: #222; }
          .filter-btn { border-color: #444; color: #aaa; }
          .filter-btn.active { background: #2a2a2a; color: #f0f0f0; border-color: #666; }
          .pill-blocked { background: #2a2a2a; color: #888; border-color: #444; }
          .tab-btn.active { color: #f0f0f0; border-bottom-color: #f0f0f0; }
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Painel Único</h1>
            {lastUpdate && <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Atualizado às {lastUpdate}</p>}
          </div>
          <button className="filter-btn" onClick={load} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fcebeb', color: '#a32d2d', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            Erro: {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Implantações', value: summary.total },
            { label: 'Serv. Adicionais', value: summary.totalSA },
            { label: 'Atrasados', value: summary.atrasados, color: '#a32d2d' },
            { label: 'Aguardando', value: summary.aguardando, color: '#854f0b' },
            { label: 'No prazo', value: summary.ok, color: '#3b6d11' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: m.color || 'inherit' }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', borderBottom: '0.5px solid #e0e0d8', marginBottom: 16 }}>
          <button className={`tab-btn ${tab === 'KAN' ? 'active' : ''}`} onClick={() => { setTab('KAN'); setFilter('todos') }}>
            Implantações ({summary.total})
          </button>
          <button className={`tab-btn ${tab === 'SA' ? 'active' : ''}`} onClick={() => { setTab('SA'); setFilter('todos') }}>
            Serviços Adicionais ({summary.totalSA})
          </button>
        </div>

        {tab === 'KAN' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando', ...implantadores].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : f === 'aguardando' ? 'Aguardando' : f.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'SA' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : 'Aguardando'}
              </button>
            ))}
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Consultando Jira...</p>}

        {!loading && tab === 'KAN' && Object.entries(byImpl).map(([impl, cls]) => (
          <div key={impl} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #e0e0d8' }}>
              {impl} — {cls.length} cliente(s)
            </p>
            {cls.map(c => <IssueCard key={c.key} issue={c} />)}
          </div>
        ))}

        {!loading && tab === 'SA' && (
          <div>
            {filteredSA.length === 0
              ? <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum serviço encontrado.</p>
              : filteredSA.map(i => <IssueCard key={i.key} issue={i} />)
            }
          </div>
        )}

        {!loading && tab === 'KAN' && filteredKAN.length === 0 && !error && (
          <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum cliente encontrado.</p>
        )}
      </div>
    </>
  )
}