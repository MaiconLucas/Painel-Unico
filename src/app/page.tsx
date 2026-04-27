'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useJiraData } from '@/hooks/useJiraData'
import ClientDrawer from '@/components/ClientDrawer'
import IssueCard from '@/components/IssueCard'
import DashboardTab from '@/components/DashboardTab'
import SlaConfigTab from '@/components/SlaConfigTab'
import NovaImplantacaoTab from '@/components/NovaImplantacaoTab'
import { openJira, getStatusClass } from '@/lib/helpers'
import { MONTH_NAMES } from '@/lib/constants'
import type { Issue } from '@/types'

export default function Page() {
  const now = new Date()
  const [tab, setTab] = useState<'KAN' | 'SA' | 'DASHBOARD' | 'PRODUCAO' | 'CONFIG' | 'NOVA'>('KAN')
  const [alertFilter, setAlertFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [taskStatusFilter, setTaskStatusFilter] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [periodYear, setPeriodYear] = useState(now.getFullYear())
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  const {
    clients, saIssues, summary, doneTasks, doneSa,
    pendingByAssignee, slaConfig, loading, error, lastUpdate,
    load, handleSlaConfigSave,
  } = useJiraData(periodYear, periodMonth)

  useEffect(() => { load() }, [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedIssue(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePeriod = (year: number, month: number) => {
    setPeriodYear(year); setPeriodMonth(month); load(year, month)
  }

  const implantadores = Array.from(new Set(clients.map(c => c.assignee || 'Sem responsável')))
  const availableStatuses = Array.from(new Set(clients.map(c => c.status).filter(Boolean)))

  function clientMatchesTaskStatusFilter(c: Issue): boolean {
    if (taskStatusFilter === 'todos') return true
    if (taskStatusFilter === 'a-fazer') return c.tasks.some(t => getStatusClass(t.status) === 'todo')
    if (taskStatusFilter === 'em-andamento') return c.tasks.some(t => getStatusClass(t.status) === 'active')
    if (taskStatusFilter === 'aguardando') return c.tasks.some(t => getStatusClass(t.status) === 'waiting')
    if (taskStatusFilter === 'sem-tasks') return c.tasks.length === 0
    return true
  }

  const filteredKAN = clients.filter(c => {
    if (c.alert === 'done') return false
    const alertMatch = (() => {
      if (alertFilter === 'critico') return c.alert === 'critical'
      if (alertFilter === 'atencao') return c.alert === 'warning'
      if (alertFilter === 'aguardando') return c.alert === 'waiting' || c.alert === 'bloqueado'
      if (alertFilter === 'semtasks') return c.alert === 'noTasks'
      if (!['todos', 'critico', 'atencao', 'aguardando', 'semtasks'].includes(alertFilter)) return c.assignee === alertFilter
      return true
    })()
    const statusMatch = statusFilter === 'todos' || c.status === statusFilter
    const taskMatch = clientMatchesTaskStatusFilter(c)
    const searchMatch = !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase())
    return alertMatch && statusMatch && taskMatch && searchMatch
  })

  const filteredSA = saIssues.filter(c => {
    if (alertFilter === 'critico') return c.alert === 'critical'
    if (alertFilter === 'atencao') return c.alert === 'warning'
    if (alertFilter === 'aguardando') return c.alert === 'waiting'
    return true
  })

  const byImpl: Record<string, Issue[]> = {}
  filteredKAN.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })
  Object.keys(byImpl).forEach(k => {
    byImpl[k].sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, waiting: 2, bloqueado: 2, noTasks: 3, ok: 4, done: 5 }
      return (order[a.alert] ?? 9) - (order[b.alert] ?? 9)
    })
  })

  const allImplantadores = Array.from(new Set([
    ...implantadores,
    ...Object.keys(pendingByAssignee),
    ...doneTasks.map(t => t.assignee || ''),
    ...doneSa.map(t => t.assignee || ''),
  ])).filter(n => n && n !== 'Sem responsável')

  return (
    <>
      <style>{`
        :root {
          --c-bg: #f5f5f3; --c-surface: #ffffff; --c-border: #e8e8e4;
          --c-text: #1a1a1a; --c-muted: #88887a;
          --c-ok: #2d7a3a; --c-ok-bg: #e8f5eb;
          --c-warn: #8a5c00; --c-warn-bg: #fdf3d7;
          --c-err: #c0392b; --c-err-bg: #fdecea;
          --c-blue: #1a56db; --c-blue-bg: #ebf0ff;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --c-bg: #111110; --c-surface: #1c1c1a; --c-border: #2e2e2b;
            --c-text: #f0f0ec; --c-muted: #66665e;
            --c-ok: #4caf6a; --c-ok-bg: #0f2d18;
            --c-warn: #d4a012; --c-warn-bg: #2a2000;
            --c-err: #e05c4a; --c-err-bg: #2a0f0a;
            --c-blue: #5b8ef0; --c-blue-bg: #0d1a3a;
          }
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--c-bg); color: var(--c-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
        .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s, box-shadow 0.15s; }
        .card:hover { border-color: var(--c-muted); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .badge.ok { background: var(--c-ok-bg); color: var(--c-ok); }
        .badge.warn { background: var(--c-warn-bg); color: var(--c-warn); }
        .badge.err { background: var(--c-err-bg); color: var(--c-err); }
        .badge.info { background: var(--c-blue-bg); color: var(--c-blue); }
        .badge.neutral { background: var(--c-border); color: var(--c-muted); }
        .meta { font-size: 11px; color: var(--c-muted); background: var(--c-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; display: inline-block; }
        .link-btn { background: none; border: none; cursor: pointer; color: var(--c-text); font-family: inherit; font-size: inherit; font-weight: inherit; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
        .filter-btn { font-size: 12px; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--c-border); background: transparent; color: var(--c-muted); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .filter-btn:hover { border-color: var(--c-muted); color: var(--c-text); }
        .filter-btn.on { background: var(--c-surface); color: var(--c-text); border-color: var(--c-text); font-weight: 600; }
        .tab-btn { font-size: 13px; padding: 8px 14px; border: none; background: transparent; color: var(--c-muted); cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
        .tab-btn.on { color: var(--c-text); border-bottom-color: var(--c-text); }
        .stat { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; }
        .section-label { font-size: 11px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.07em; }
        .prod-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
        .prod-header { padding: 14px 16px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; }
        .prod-section { padding: 12px 16px; }
        .prod-section + .prod-section { border-top: 1px solid var(--c-border); }
        .done-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
        .done-row + .done-row { border-top: 1px solid var(--c-border); }
        select { font-size: 13px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; outline: none; }
        .filter-group { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
        .filter-divider { width: 1px; height: 20px; background: var(--c-border); margin: 0 4px; flex-shrink: 0; }
      `}</style>

      {selectedIssue && (
        <ClientDrawer issue={selectedIssue} slaConfig={slaConfig} onClose={() => setSelectedIssue(null)} />
      )}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Painel Único</h1>
            {lastUpdate && <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>Atualizado às {lastUpdate}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/suporte" className="filter-btn" style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--c-text)' }}>
              📊 Suporte
            </Link>
            <button className="filter-btn" onClick={() => load()} disabled={loading} style={{ fontWeight: 500 }}>
              {loading ? '...' : '↻ Atualizar'}
            </button>
          </div>
        </div>

        {error && <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '12px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>Erro: {error}</div>}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Implantações', value: summary.total, color: '' },
            { label: 'Serv. Adicionais', value: summary.totalSA, color: '' },
            { label: '🔴 Críticos', value: summary.atrasados, color: 'var(--c-err)' },
            { label: '🟡 Atenção', value: summary.alertas, color: 'var(--c-warn)' },
            { label: '⏸ Aguardando', value: summary.aguardando, color: 'var(--c-blue)' },
            { label: '🟢 No prazo', value: summary.ok, color: 'var(--c-ok)' },
          ].map(m => (
            <div key={m.label} className="stat">
              <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: m.color || 'var(--c-text)' }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', marginBottom: 16, overflowX: 'auto' }}>
          {[
            { key: 'KAN', label: `Implantações (${summary.total})` },
            { key: 'SA', label: `Serv. Adicionais (${summary.totalSA})` },
            { key: 'DASHBOARD', label: '📊 Dashboard' },
            { key: 'PRODUCAO', label: 'Produção' },
            { key: 'CONFIG', label: '⚙ SLAs' },
            { key: 'NOVA', label: '+ Nova Implantação' },
          ].map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'on' : ''}`}
              onClick={() => { setTab(t.key as any); setAlertFilter('todos'); setStatusFilter('todos'); setTaskStatusFilter('todos'); setSearchQuery('') }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros KAN */}
        {tab === 'KAN' && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Pesquisar cliente..."
              style={{
                width: '100%', fontSize: 13, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--c-border)', background: 'var(--c-surface)',
                color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit', marginBottom: 10,
              }}
            />
            <div className="filter-group">
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'critico', label: '🔴 Críticos' },
                { key: 'atencao', label: '🟡 Atenção' },
                { key: 'aguardando', label: '⏸ Aguardando' },
                { key: 'semtasks', label: '⚠️ Sem tasks' },
              ].map(f => (
                <button key={f.key} className={`filter-btn ${alertFilter === f.key ? 'on' : ''}`} onClick={() => setAlertFilter(f.key)}>{f.label}</button>
              ))}
              <div className="filter-divider" />
              {implantadores.map(impl => (
                <button key={impl} className={`filter-btn ${alertFilter === impl ? 'on' : ''}`} onClick={() => setAlertFilter(impl)}>{impl.split(' ')[0]}</button>
              ))}
            </div>
            <div className="filter-group">
              <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Epic:</span>
              {['todos', ...availableStatuses].map(s => (
                <button key={s} className={`filter-btn ${statusFilter === s ? 'on' : ''}`} onClick={() => setStatusFilter(s)}>{s === 'todos' ? 'Todos' : s}</button>
              ))}
            </div>
            <div className="filter-group">
              <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasks:</span>
              {[
                { key: 'todos', label: 'Todas' },
                { key: 'a-fazer', label: 'A fazer' },
                { key: 'em-andamento', label: 'Em andamento' },
                { key: 'aguardando', label: 'Aguardando' },
                { key: 'sem-tasks', label: 'Sem tasks' },
              ].map(f => (
                <button key={f.key} className={`filter-btn ${taskStatusFilter === f.key ? 'on' : ''}`} onClick={() => setTaskStatusFilter(f.key)}>{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {tab === 'SA' && (
          <div className="filter-group" style={{ marginBottom: 16 }}>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'critico', label: '🔴 Críticos' },
              { key: 'atencao', label: '🟡 Atenção' },
              { key: 'aguardando', label: '⏸ Aguardando' },
            ].map(f => (
              <button key={f.key} className={`filter-btn ${alertFilter === f.key ? 'on' : ''}`} onClick={() => setAlertFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}

        {tab === 'PRODUCAO' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>Período:</span>
            <select value={periodMonth} onChange={e => handlePeriod(periodYear, parseInt(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={periodYear} onChange={e => handlePeriod(parseInt(e.target.value), periodMonth)}>
              {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-muted)', fontSize: 13 }}>Consultando Jira...</div>}

        {/* KAN */}
        {!loading && tab === 'KAN' && (
          filteredKAN.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum cliente encontrado.</p>
            : Object.entries(byImpl).map(([impl, cls]) => (
              <div key={impl} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
                  <span className="section-label">{impl}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cls.filter(c => c.alert === 'critical').length > 0 && <span className="badge err">{cls.filter(c => c.alert === 'critical').length} crítico(s)</span>}
                    {cls.filter(c => c.alert === 'warning').length > 0 && <span className="badge warn">{cls.filter(c => c.alert === 'warning').length} atenção</span>}
                    {cls.filter(c => c.alert === 'bloqueado').length > 0 && <span className="badge neutral">{cls.filter(c => c.alert === 'bloqueado').length} bloqueado(s)</span>}
                    <span className="section-label">{cls.length} cliente(s)</span>
                  </div>
                </div>
                {cls.map(c => <IssueCard key={c.key} issue={c} onOpen={() => setSelectedIssue(c)} />)}
              </div>
            ))
        )}

        {/* SA */}
        {!loading && tab === 'SA' && (
          filteredSA.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum serviço encontrado.</p>
            : filteredSA.map(i => <IssueCard key={i.key} issue={i} onOpen={() => setSelectedIssue(i)} />)
        )}

        {/* Dashboard */}
        {!loading && tab === 'DASHBOARD' && <DashboardTab clients={clients} />}

        {/* Produção */}
        {!loading && tab === 'PRODUCAO' && (
          allImplantadores.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum dado para este período.</p>
            : allImplantadores.map(impl => {
              const pending = pendingByAssignee[impl] || []
              const doneKAN = doneTasks.filter(t => t.assignee === impl)
              const doneSaImpl = doneSa.filter(t => t.assignee === impl)
              const activeClients = clients.filter(c => c.assignee === impl)
              const totalEntregas = doneKAN.length + doneSaImpl.length

              return (
                <div key={impl} className="prod-card">
                  <div className="prod-header">
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15 }}>{impl}</p>
                      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>{activeClients.length} cliente(s) ativo(s)</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className="badge neutral">{pending.length} pendente(s)</span>
                      <span className="badge ok">{doneKAN.length} task(s) KAN</span>
                      <span className="badge ok">{doneSaImpl.length} serviço(s) SA</span>
                      <span className="badge info">{totalEntregas} total</span>
                    </div>
                  </div>
                  {pending.length > 0 && (
                    <div className="prod-section">
                      <p className="section-label" style={{ marginBottom: 10 }}>Tasks pendentes</p>
                      {pending.map((task: any) => (
                        <div key={task.key} className="done-row">
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-warn)', flexShrink: 0, display: 'inline-block' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button onClick={(e) => openJira(task.key, e)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>{task.summary.replace(/.*?[-–]\s*/, '').trim()}</button>
                            <button onClick={(e) => openJira(task.epicKey, e)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>{task.epicName}</button>
                          </div>
                          <span className="meta">{task.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {totalEntregas > 0 && (
                    <div className="prod-section">
                      <p className="section-label" style={{ marginBottom: 10 }}>Concluído em {MONTH_NAMES[periodMonth - 1]}/{periodYear}</p>
                      {[
                        ...doneKAN.map(t => ({ ...t, proj: 'KAN' })),
                        ...doneSaImpl.map(t => ({ ...t, proj: 'SA' })),
                      ].sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '')).map(task => (
                        <div key={task.key} className="done-row">
                          <span className={`badge ${task.proj === 'KAN' ? 'info' : 'ok'}`} style={{ fontSize: 10, padding: '2px 6px' }}>{task.proj}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button onClick={(e) => openJira(task.key, e)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>{task.summary.replace(/.*?[-–]\s*/, '').trim()}</button>
                            {task.parentName && <button onClick={(e) => openJira(task.parentKey!, e)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>{task.parentName}</button>}
                          </div>
                          {task.resolvedAt && <span className="meta">{new Date(task.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
        )}

        {/* Config */}
        {tab === 'CONFIG' && <SlaConfigTab config={slaConfig} onSave={handleSlaConfigSave} />}

        {/* Nova Implantação */}
        {tab === 'NOVA' && <NovaImplantacaoTab />}
      </div>
    </>
  )
}
