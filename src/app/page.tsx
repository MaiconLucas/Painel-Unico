'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useJiraData } from '@/hooks/useJiraData'
import ClientDrawer from '@/components/ClientDrawer'
import IssueCard from '@/components/IssueCard'
import DashboardTab from '@/components/DashboardTab'
import SlaConfigTab from '@/components/SlaConfigTab'
import NovaImplantacaoTab from '@/components/NovaImplantacaoTab'
import NovoServicoTab from '@/components/NovoServicoTab'
import { openJira, getStatusClass } from '@/lib/helpers'
import { MONTH_NAMES } from '@/lib/constants'
import type { Issue } from '@/types'

type Tab = 'KAN' | 'SA' | 'DASHBOARD' | 'PRODUCAO' | 'CONFIG' | 'NOVA' | 'NOVO_SA'

export default function Page() {
  const now = new Date()
  const [tab, setTab] = useState<Tab>('KAN')
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

  function changeTab(t: Tab) {
    setTab(t); setAlertFilter('todos'); setStatusFilter('todos'); setTaskStatusFilter('todos'); setSearchQuery('')
  }

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
    if (alertFilter === 'aguardando') return c.alert === 'waiting' || c.alert === 'bloqueado'
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

  const tabTitles: Record<Tab, string> = {
    KAN: 'Implantações', SA: 'Serv. Adicionais', DASHBOARD: 'Dashboard',
    PRODUCAO: 'Produção', CONFIG: 'SLAs', NOVA: 'Nova Implantação', NOVO_SA: 'Novo Serviço',
  }

  const stats = [
    { label: 'Críticos', value: summary.atrasados, color: 'var(--c-err)', dot: '#e05c4a' },
    { label: 'Atenção', value: summary.alertas, color: 'var(--c-warn)', dot: '#d4a012' },
    { label: 'Aguardando', value: summary.aguardando, color: 'var(--c-blue)', dot: '#5b8ef0' },
    { label: 'No prazo', value: summary.ok, color: 'var(--c-ok)', dot: '#4caf6a' },
  ]

  return (
    <>
      <style>{`
        :root {
          --c-bg: #f5f5f3; --c-surface: #ffffff; --c-border: #e8e8e4;
          --c-text: #1a1a1a; --c-muted: #88887a; --c-sidebar: #f0f0ee;
          --c-ok: #2d7a3a; --c-ok-bg: #e8f5eb;
          --c-warn: #8a5c00; --c-warn-bg: #fdf3d7;
          --c-err: #c0392b; --c-err-bg: #fdecea;
          --c-blue: #1a56db; --c-blue-bg: #ebf0ff;
          --sidebar-w: 220px;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --c-bg: #111110; --c-surface: #1c1c1a; --c-border: #2e2e2b;
            --c-text: #f0f0ec; --c-muted: #66665e; --c-sidebar: #0d0d0c;
            --c-ok: #4caf6a; --c-ok-bg: #0f2d18;
            --c-warn: #d4a012; --c-warn-bg: #2a2000;
            --c-err: #e05c4a; --c-err-bg: #2a0f0a;
            --c-blue: #5b8ef0; --c-blue-bg: #0d1a3a;
          }
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: var(--c-bg); color: var(--c-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }

        /* Sidebar */
        .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-w); background: var(--c-sidebar); border-right: 1px solid var(--c-border); display: flex; flex-direction: column; z-index: 50; overflow-y: auto; }
        .sidebar-logo { padding: 20px 16px 16px; border-bottom: 1px solid var(--c-border); }
        .sidebar-section { padding: 8px 0; border-bottom: 1px solid var(--c-border); }
        .sidebar-label { font-size: 10px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 16px 4px; }
        .nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 16px; cursor: pointer; border: none; background: none; color: var(--c-muted); font-family: inherit; font-size: 13px; font-weight: 500; width: 100%; text-align: left; transition: all 0.12s; border-left: 2px solid transparent; text-decoration: none; }
        .nav-item:hover { background: var(--c-border); color: var(--c-text); }
        .nav-item.active { background: var(--c-surface); color: var(--c-text); border-left-color: var(--c-text); font-weight: 600; }
        .nav-item.create { color: var(--c-blue); }
        .nav-item.create:hover { background: var(--c-blue-bg); color: var(--c-blue); }
        .nav-badge { margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: var(--c-border); color: var(--c-muted); }
        .nav-item.active .nav-badge { background: var(--c-bg); }
        .stat-row { display: flex; align-items: center; gap: 10px; padding: 6px 16px; }
        .stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .stat-val { font-size: 15px; font-weight: 700; min-width: 28px; }
        .stat-lbl { font-size: 11px; color: var(--c-muted); }

        /* Main */
        .main { margin-left: var(--sidebar-w); min-height: 100vh; display: flex; flex-direction: column; }
        .main-header { padding: 20px 28px 0; background: var(--c-bg); position: sticky; top: 0; z-index: 20; }
        .main-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .main-content { padding: 20px 28px 40px; flex: 1; }

        /* Cards & misc */
        .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s, box-shadow 0.15s; }
        .card:hover { border-color: var(--c-muted); box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .badge.ok { background: var(--c-ok-bg); color: var(--c-ok); }
        .badge.warn { background: var(--c-warn-bg); color: var(--c-warn); }
        .badge.err { background: var(--c-err-bg); color: var(--c-err); }
        .badge.info { background: var(--c-blue-bg); color: var(--c-blue); }
        .badge.neutral { background: var(--c-border); color: var(--c-muted); }
        .meta { font-size: 11px; color: var(--c-muted); background: var(--c-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; display: inline-block; }
        .link-btn { background: none; border: none; cursor: pointer; color: var(--c-text); font-family: inherit; font-size: inherit; font-weight: inherit; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
        .filter-btn { font-size: 12px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--c-border); background: transparent; color: var(--c-muted); cursor: pointer; transition: all 0.12s; white-space: nowrap; }
        .filter-btn:hover { border-color: var(--c-muted); color: var(--c-text); }
        .filter-btn.on { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); font-weight: 600; }
        .section-label { font-size: 11px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.07em; }
        .filter-group { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
        .filter-divider { width: 1px; height: 18px; background: var(--c-border); margin: 0 3px; flex-shrink: 0; }
        .filters-bar { background: var(--c-bg); padding-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
        .search-input { width: 100%; font-size: 13px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); outline: none; font-family: inherit; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--c-muted); }
        .impl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--c-border); }
        .prod-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
        .prod-header { padding: 14px 16px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; }
        .prod-section { padding: 12px 16px; }
        .prod-section + .prod-section { border-top: 1px solid var(--c-border); }
        .done-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
        .done-row + .done-row { border-top: 1px solid var(--c-border); }
        select { font-size: 13px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; outline: none; }
      `}</style>

      {selectedIssue && (
        <ClientDrawer issue={selectedIssue} slaConfig={slaConfig} onClose={() => setSelectedIssue(null)} />
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Painel Único</p>
          {lastUpdate && <p style={{ fontSize: 10, color: 'var(--c-muted)' }}>Atualizado às {lastUpdate}</p>}
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              marginTop: 10, fontSize: 11, padding: '5px 12px', borderRadius: 20,
              border: '1px solid var(--c-border)', background: 'transparent',
              color: loading ? 'var(--c-muted)' : 'var(--c-text)', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500, transition: 'all 0.12s', width: '100%',
            }}
          >
            {loading ? 'Atualizando...' : '↻ Atualizar dados'}
          </button>
        </div>

        {/* Stats */}
        <div className="sidebar-section">
          <p className="sidebar-label">Visão geral</p>
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', padding: '4px 16px 8px' }}>
            <div style={{ width: '50%', paddingBottom: 10 }}>
              <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 1 }}>Implantações</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{loading ? '—' : summary.total}</p>
            </div>
            <div style={{ width: '50%', paddingBottom: 10 }}>
              <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 1 }}>Serv. Adicionais</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{loading ? '—' : summary.totalSA}</p>
            </div>
            {stats.map(s => (
              <div key={s.label} style={{ width: '50%', paddingBottom: 8 }}>
                <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 1 }}>{s.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{loading ? '—' : s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-section" style={{ flex: 1 }}>
          <p className="sidebar-label">Menu</p>
          {([
            { key: 'KAN', label: 'Implantações', icon: '📋', count: summary.total },
            { key: 'SA', label: 'Serv. Adicionais', icon: '🔧', count: summary.totalSA },
            { key: 'DASHBOARD', label: 'Dashboard', icon: '📊', count: null },
            { key: 'PRODUCAO', label: 'Produção', icon: '🏭', count: null },
            { key: 'CONFIG', label: 'SLAs', icon: '⚙', count: null },
          ] as { key: Tab; label: string; icon: string; count: number | null }[]).map(item => (
            <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => changeTab(item.key)}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.count !== null && <span className="nav-badge">{item.count}</span>}
            </button>
          ))}
        </div>

        {/* Create */}
        <div className="sidebar-section">
          <p className="sidebar-label">Criar</p>
          {([
            { key: 'NOVA', label: 'Nova Implantação' },
            { key: 'NOVO_SA', label: 'Novo Serviço' },
          ] as { key: Tab; label: string }[]).map(item => (
            <button key={item.key} className={`nav-item create ${tab === item.key ? 'active' : ''}`} onClick={() => changeTab(item.key)}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>+</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 8px' }}>
          <Link href="/suporte" className="nav-item" style={{ display: 'flex', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
            <span style={{ fontSize: 14 }}>📊</span>
            <span>Suporte</span>
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        {/* Sticky header */}
        <div className="main-header">
          <div className="main-header-top">
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{tabTitles[tab]}</h1>
              {tab === 'KAN' && !loading && (
                <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                  {filteredKAN.length} de {clients.filter(c => c.alert !== 'done').length} clientes
                </p>
              )}
              {tab === 'SA' && !loading && (
                <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                  {filteredSA.length} de {saIssues.length} serviços
                </p>
              )}
            </div>
            {error && <span style={{ fontSize: 12, color: 'var(--c-err)', background: 'var(--c-err-bg)', padding: '4px 10px', borderRadius: 6 }}>Erro: {error}</span>}
          </div>

          {/* Filtros KAN */}
          {tab === 'KAN' && (
            <div className="filters-bar">
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Pesquisar cliente..."
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
                {implantadores.length > 0 && <div className="filter-divider" />}
                {implantadores.map(impl => (
                  <button key={impl} className={`filter-btn ${alertFilter === impl ? 'on' : ''}`} onClick={() => setAlertFilter(impl)}>{impl.split(' ')[0]}</button>
                ))}
              </div>
              <div className="filter-group">
                <span className="section-label" style={{ marginRight: 4 }}>Epic:</span>
                {['todos', ...availableStatuses].map(s => (
                  <button key={s} className={`filter-btn ${statusFilter === s ? 'on' : ''}`} onClick={() => setStatusFilter(s)}>{s === 'todos' ? 'Todos' : s}</button>
                ))}
                <div className="filter-divider" />
                <span className="section-label" style={{ marginRight: 4 }}>Tasks:</span>
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
            <div className="filters-bar">
              <div className="filter-group">
                {[
                  { key: 'todos', label: 'Todos' },
                  { key: 'critico', label: '🔴 Críticos' },
                  { key: 'atencao', label: '🟡 Atenção' },
                  { key: 'aguardando', label: '⏸ Aguardando' },
                ].map(f => (
                  <button key={f.key} className={`filter-btn ${alertFilter === f.key ? 'on' : ''}`} onClick={() => setAlertFilter(f.key)}>{f.label}</button>
                ))}
              </div>
            </div>
          )}

          {tab === 'PRODUCAO' && (
            <div className="filters-bar">
              <div className="filter-group">
                <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>Período:</span>
                <select value={periodMonth} onChange={e => handlePeriod(periodYear, parseInt(e.target.value))}>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={periodYear} onChange={e => handlePeriod(parseInt(e.target.value), periodMonth)}>
                  {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--c-border)' }} />
        </div>

        {/* Content */}
        <div className="main-content">
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem', color: 'var(--c-muted)', gap: 10 }}>
              <span style={{ fontSize: 13 }}>Consultando Jira...</span>
            </div>
          )}

          {/* KAN */}
          {!loading && tab === 'KAN' && (
            filteredKAN.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '4rem', fontSize: 13 }}>Nenhum cliente encontrado.</p>
              : Object.entries(byImpl).map(([impl, cls]) => (
                <div key={impl} style={{ marginBottom: 32 }}>
                  <div className="impl-header">
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
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '4rem', fontSize: 13 }}>Nenhum serviço encontrado.</p>
              : filteredSA.map(i => <IssueCard key={i.key} issue={i} onOpen={() => setSelectedIssue(i)} />)
          )}

          {/* Dashboard */}
          {!loading && tab === 'DASHBOARD' && <DashboardTab clients={clients} />}

          {/* Produção */}
          {!loading && tab === 'PRODUCAO' && (
            allImplantadores.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '4rem', fontSize: 13 }}>Nenhum dado para este período.</p>
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

          {tab === 'CONFIG' && <SlaConfigTab config={slaConfig} onSave={handleSlaConfigSave} />}
          {tab === 'NOVA' && <NovaImplantacaoTab />}
          {tab === 'NOVO_SA' && <NovoServicoTab />}
        </div>
      </div>
    </>
  )
}
