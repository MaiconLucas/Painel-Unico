'use client'

import { useState, useCallback, useEffect } from 'react'
import { useJiraMembers, type JiraMember } from '@/hooks/useJiraMembers'

type Row = { instancia: string; prioridade: string }
type Assignment = { member: JiraMember; rows: Row[] }
type TrackingTask = { key: string; name: string; status: string; assignee: string | null; url: string; updatedAt: string }

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--c-border)', background: 'var(--c-surface)',
  color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--c-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6,
}

function priorityOrder(p: string): number {
  const s = p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (s === 'alta' || s === 'high' || s === '1') return 1
  if (s === 'media' || s === 'medium' || s === '2') return 2
  if (s === 'baixa' || s === 'low' || s === '3') return 3
  const n = parseInt(s)
  return isNaN(n) ? 99 : n
}

function distribute(rows: Row[], selected: JiraMember[]): Assignment[] {
  const sorted = [...rows].sort((a, b) => priorityOrder(a.prioridade) - priorityOrder(b.prioridade))
  const assignments: Assignment[] = selected.map(m => ({ member: m, rows: [] }))
  sorted.forEach((row, i) => assignments[i % selected.length].rows.push(row))
  return assignments
}

async function parseSpreadsheet(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
        if (json.length < 2) return resolve([])

        const headers = json[0].map(h =>
          String(h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
        )
        const instIdx = headers.findIndex(h => h.includes('instancia') || h.includes('instance') || h.includes('cliente'))
        const priIdx = headers.findIndex(h => h.includes('prioridade') || h.includes('priority') || h.includes('prior'))

        if (instIdx === -1) return reject(new Error('Coluna "Instância" não encontrada na planilha'))

        const rows: Row[] = json.slice(1)
          .filter(row => String(row[instIdx] || '').trim())
          .map(row => ({
            instancia: String(row[instIdx] || '').trim(),
            prioridade: priIdx >= 0 ? String(row[priIdx] || '0').trim() : '0',
          }))
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

function statusColor(s: string) {
  const l = s.toLowerCase()
  if (l.includes('conclu')) return 'var(--c-ok)'
  if (l.includes('andamento')) return 'var(--c-blue)'
  if (l.includes('aguardando')) return 'var(--c-warn)'
  return 'var(--c-muted)'
}

export default function LigacoesTab() {
  const { members, loading: loadingMembers } = useJiraMembers()
  const [rows, setRows] = useState<Row[]>([])
  const [fileError, setFileError] = useState('')
  const [fileName, setFileName] = useState('')
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set())
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [tracking, setTracking] = useState<TrackingTask[]>([])
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [trackingSearch, setTrackingSearch] = useState('')

  const loadTracking = useCallback(async () => {
    setLoadingTracking(true)
    try {
      const res = await fetch('/api/jira/ligacoes')
      const d = await res.json()
      setTracking(d.tasks || [])
    } finally {
      setLoadingTracking(false)
    }
  }, [])

  useEffect(() => { loadTracking() }, [loadTracking])

  async function handleFile(file: File) {
    setFileError('')
    setRows([])
    setAssignments([])
    setFileName(file.name)
    try {
      const parsed = await parseSpreadsheet(file)
      if (parsed.length === 0) throw new Error('Nenhum dado encontrado na planilha')
      setRows(parsed)
    } catch (e: any) {
      setFileError(e.message)
    }
  }

  function toggleMember(idx: number) {
    setSelectedIdxs(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
    setAssignments([])
  }

  function handlePreview() {
    const selected = members.filter((_, i) => selectedIdxs.has(i))
    if (!selected.length || !rows.length) return
    setAssignments(distribute(rows, selected))
  }

  async function handleSubmit() {
    if (!assignments.length) return
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const res = await fetch('/api/jira/ligacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      const d = await res.json()
      setSubmitResult({ created: d.results?.length || 0, errors: d.errors || [] })
      if (d.results?.length) {
        setRows([])
        setFileName('')
        setAssignments([])
        setSelectedIdxs(new Set())
        loadTracking()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTracking = tracking.filter(t =>
    !trackingSearch.trim() ||
    t.name.toLowerCase().includes(trackingSearch.toLowerCase()) ||
    (t.assignee || '').toLowerCase().includes(trackingSearch.toLowerCase())
  )

  const byAssignee = filteredTracking.reduce<Record<string, TrackingTask[]>>((acc, t) => {
    const k = t.assignee || 'Sem responsável'
    if (!acc[k]) acc[k] = []
    acc[k].push(t)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* SEÇÃO 1: DISTRIBUIÇÃO */}
      <div>
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Distribuição de Ligações</p>
        <p style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 20 }}>
          Suba uma planilha com instância e prioridade, selecione os atendentes e distribua as ligações no Jira.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload */}
          <div>
            <label style={labelStyle}>Planilha (.xlsx, .xls, .csv)</label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              padding: '14px 18px', borderRadius: 8, border: '2px dashed var(--c-border)',
              background: 'var(--c-surface)', color: 'var(--c-muted)', fontSize: 13,
              transition: 'all 0.15s',
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--c-blue)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)' }}
            onDrop={e => {
              e.preventDefault()
              e.currentTarget.style.borderColor = 'var(--c-border)'
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
            >
              <span style={{ fontSize: 20 }}>📄</span>
              <span>{fileName || 'Clique para selecionar ou arraste o arquivo aqui'}</span>
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </label>
            {fileError && <p style={{ fontSize: 12, color: 'var(--c-err)', marginTop: 6 }}>{fileError}</p>}
            {rows.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--c-bg)', border: '1px solid var(--c-border)', fontSize: 12 }}>
                <p style={{ fontWeight: 700, color: 'var(--c-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {rows.length} clientes encontrados
                </p>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--c-text)' }}>{r.instancia}</span>
                      <span style={{ color: 'var(--c-muted)' }}>Prioridade: {r.prioridade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Seleção de membros */}
          {rows.length > 0 && (
            <div>
              <label style={labelStyle}>Atendentes que receberão ligações <span style={{ color: 'var(--c-err)' }}>*</span></label>
              {loadingMembers
                ? <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Carregando equipe do Jira...</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {members.map((m, i) => (
                      <label key={m.accountId} style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14,
                        padding: '8px 12px', borderRadius: 8,
                        background: selectedIdxs.has(i) ? 'var(--c-blue-bg)' : 'var(--c-surface)',
                        border: `1px solid ${selectedIdxs.has(i) ? 'var(--c-blue)' : 'var(--c-border)'}`,
                        transition: 'all 0.1s',
                      }}>
                        <input type="checkbox" checked={selectedIdxs.has(i)} onChange={() => toggleMember(i)}
                          style={{ width: 16, height: 16, accentColor: 'var(--c-blue)', cursor: 'pointer' }} />
                        <span style={{ fontWeight: selectedIdxs.has(i) ? 600 : 400, color: selectedIdxs.has(i) ? 'var(--c-blue)' : 'var(--c-text)' }}>
                          {m.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* Botão preview */}
          {rows.length > 0 && selectedIdxs.size > 0 && (
            <button onClick={handlePreview} style={{
              fontSize: 13, padding: '9px 20px', borderRadius: 8, alignSelf: 'flex-start',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              color: 'var(--c-text)', cursor: 'pointer', fontWeight: 600,
            }}>
              Visualizar distribuição
            </button>
          )}

          {/* Preview da distribuição */}
          {assignments.length > 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
              <p style={{ fontWeight: 700, color: 'var(--c-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Distribuição — {rows.length} ligações para {assignments.length} atendente(s)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {assignments.map(a => (
                  <div key={a.member.accountId}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-blue)', marginBottom: 4 }}>
                      {a.member.name} — {a.rows.length} ligação(ões)
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 12 }}>
                      {a.rows.map((r, i) => (
                        <p key={i} style={{ fontSize: 12, color: 'var(--c-text)' }}>
                          • {r.instancia} <span style={{ color: 'var(--c-muted)' }}>(prioridade: {r.prioridade})</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resultado */}
          {submitResult && (
            <div>
              {submitResult.created > 0 && (
                <div style={{ background: 'var(--c-ok-bg)', color: 'var(--c-ok)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
                  ✓ {submitResult.created} task(s) criada(s) no Jira com sucesso.
                </div>
              )}
              {submitResult.errors.length > 0 && (
                <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '10px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-line' }}>
                  {submitResult.errors.join('\n')}
                </div>
              )}
            </div>
          )}

          {/* Botão enviar */}
          {assignments.length > 0 && (
            <button onClick={handleSubmit} disabled={submitting} style={{
              fontSize: 14, padding: '10px 28px', borderRadius: 20, alignSelf: 'flex-start',
              background: submitting ? 'var(--c-border)' : 'var(--c-text)',
              color: submitting ? 'var(--c-muted)' : 'var(--c-bg)',
              border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600, transition: 'all 0.15s',
            }}>
              {submitting ? 'Criando tasks no Jira...' : `Criar ${rows.length} tasks no Jira`}
            </button>
          )}
        </div>
      </div>

      {/* DIVISOR */}
      <div style={{ height: 1, background: 'var(--c-border)' }} />

      {/* SEÇÃO 2: ACOMPANHAMENTO */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Acompanhamento</p>
            <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>Tasks de ligação abertas no SA do Jira</p>
          </div>
          <button onClick={loadTracking} disabled={loadingTracking} style={{
            fontSize: 12, padding: '6px 14px', borderRadius: 8,
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            color: 'var(--c-muted)', cursor: 'pointer',
          }}>
            {loadingTracking ? 'Atualizando...' : '↺ Atualizar'}
          </button>
        </div>

        <input
          type="text"
          value={trackingSearch}
          onChange={e => setTrackingSearch(e.target.value)}
          placeholder="Pesquisar por instância ou atendente..."
          style={{ ...inputStyle, marginBottom: 16, fontSize: 13 }}
        />

        {loadingTracking ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', padding: '2rem' }}>Carregando...</p>
        ) : filteredTracking.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', padding: '2rem' }}>Nenhuma ligação em aberto.</p>
        ) : (
          Object.entries(byAssignee).map(([assignee, tasks]) => (
            <div key={assignee} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{assignee}</span>
                <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{tasks.length} ligação(ões)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tasks.map(t => (
                  <div key={t.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                    fontSize: 13,
                  }}>
                    <div>
                      <a href={t.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontWeight: 600, color: 'var(--c-text)', textDecoration: 'none' }}>
                        {t.name.replace('Ligação — ', '')}
                      </a>
                      <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 8 }}>{t.key}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: statusColor(t.status),
                      padding: '3px 8px', borderRadius: 6, background: 'var(--c-bg)',
                    }}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
