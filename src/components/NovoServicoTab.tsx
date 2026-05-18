'use client'

import { useState, useMemo } from 'react'
import { FREE_TASKS } from '@/lib/constants'
import { useJiraMembers } from '@/hooks/useJiraMembers'
import type { Issue } from '@/types'

type CreatedIssue = { key: string; url: string; service: string }

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--c-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--c-border)', background: 'var(--c-surface)',
  color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
}

export default function NovoServicoTab({ clients }: { clients: Issue[] }) {
  const { members, loading: loadingMembers } = useJiraMembers()
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Issue | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [description, setDescription] = useState('')
  const [assigneeIndex, setAssigneeIndex] = useState('')
  const [services, setServices] = useState<Record<string, boolean>>(
    Object.fromEntries(FREE_TASKS.map(t => [t, false]))
  )
  const [clienteIdentificacao, setClienteIdentificacao] = useState('')
  const [iaType, setIaType] = useState('')
  const [pabxNumbers, setPabxNumbers] = useState('')
  const [pabxServiceType, setPabxServiceType] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<CreatedIssue[]>([])
  const [error, setError] = useState('')

  const selectedAssignee = assigneeIndex !== '' ? members[parseInt(assigneeIndex)] : null
  const selectedServices = FREE_TASKS.filter(t => services[t])
  const hasServices = selectedServices.length > 0
  const iaSelected = services['IA']
  const pabxSelected = services['PABX']
  const isDisabled = !selectedAssignee || !hasServices || !clienteIdentificacao.trim() || loading ||
    (iaSelected && !iaType.trim()) ||
    (pabxSelected && (!pabxNumbers.trim() || !pabxServiceType.trim()))

  const suggestions = useMemo(() => {
    if (!search.trim() || search.length < 2) return []
    const q = search.toLowerCase()
    return clients.filter(c => c.alert !== 'done' && c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [search, clients])

  function selectClient(c: Issue) {
    setSelectedClient(c)
    setSearch(c.name)
    setClienteIdentificacao(c.name)
    setShowSuggestions(false)
    if (c.assignee) {
      const idx = members.findIndex(m => m.name === c.assignee)
      if (idx >= 0) setAssigneeIndex(String(idx))
    }
  }

  function clearClient() {
    setSelectedClient(null)
    setSearch('')
    setClienteIdentificacao('')
    setAssigneeIndex('')
  }

  function serviceLabel(svc: string) {
    if (svc === 'IA' && iaType.trim()) return `IA (${iaType.trim()})`
    if (svc === 'PABX' && pabxServiceType.trim() && pabxNumbers.trim())
      return `PABX (${pabxServiceType.trim()} - ${pabxNumbers.trim()} números)`
    return svc
  }

  function buildTitle(svc: string) {
    const label = serviceLabel(svc)
    const cliente = clienteIdentificacao.trim()
    return cliente ? `${label} — ${cliente}` : label
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDisabled) return
    setLoading(true)
    setError('')
    setCreated([])

    const results: CreatedIssue[] = []
    const errors: string[] = []

    for (const svc of selectedServices) {
      try {
        const res = await fetch('/api/jira/create-sa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: buildTitle(svc),
            description,
            assigneeAccountId: selectedAssignee!.accountId,
            assigneeName: selectedAssignee!.name,
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar')
        results.push({ key: data.key, url: data.url, service: serviceLabel(svc) })
      } catch (err: any) {
        errors.push(`${svc}: ${err.message}`)
      }
    }

    setCreated(results)
    if (errors.length) setError(errors.join('\n'))
    if (results.length) {
      setServices(Object.fromEntries(FREE_TASKS.map(t => [t, false])))
      setClienteIdentificacao('')
      setDescription('')
      setIaType('')
      setPabxNumbers('')
      setPabxServiceType('')
    }
    setLoading(false)
  }

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Novo Serviço Adicional</p>
      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 20 }}>Cria issue(s) no projeto SA do Jira.</p>

      {created.length > 0 && (
        <div style={{ background: 'var(--c-ok-bg)', color: 'var(--c-ok)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ {created.length} serviço(s) criado(s):{' '}
          {created.map((c, i) => (
            <span key={c.key}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-ok)', fontWeight: 700 }}>{c.key} ({c.service}) ↗</a>
              {i < created.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, whiteSpace: 'pre-line' }}>
          Erro: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Pesquisa de cliente */}
        <div>
          <label style={labelStyle}>Pesquisar cliente (opcional)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); if (!e.target.value) setSelectedClient(null) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Nome ou CNPJ do cliente..."
              style={{ ...inputStyle, paddingRight: selectedClient ? 36 : 14 }}
            />
            {selectedClient && (
              <button type="button" onClick={clearClient} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 14, lineHeight: 1,
              }}>✕</button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)', overflow: 'hidden',
              }}>
                {suggestions.map(c => (
                  <button key={c.key} type="button" onMouseDown={() => selectClient(c)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '9px 14px', border: 'none', background: 'none',
                    color: 'var(--c-text)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    borderBottom: '1px solid var(--c-border)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{c.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedClient && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--c-blue-bg)', border: '1px solid var(--c-blue)', fontSize: 12, color: 'var(--c-blue)' }}>
              ✓ Cliente selecionado: <strong>{selectedClient.name}</strong> ({selectedClient.key})
            </div>
          )}
        </div>

        {/* CNPJ / Instância */}
        <div>
          <label style={labelStyle}>CNPJ / Instância <span style={{ color: 'var(--c-err)' }}>*</span></label>
          <input
            type="text"
            value={clienteIdentificacao}
            onChange={e => setClienteIdentificacao(e.target.value)}
            placeholder="Ex: 07952505000103 - drogariamaissaudeuba.atenderbem.com"
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>
            Será usado no título da issue no Jira. Preenchido automaticamente ao selecionar um cliente acima.
          </p>
        </div>

        {/* Descrição */}
        <div>
          <label style={labelStyle}>Descrição</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Informações adicionais, observações..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Responsável */}
        <div>
          <label style={labelStyle}>Responsável <span style={{ color: 'var(--c-err)' }}>*</span></label>
          <select
            value={assigneeIndex}
            onChange={e => setAssigneeIndex(e.target.value)}
            required
            disabled={loadingMembers}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="" disabled>{loadingMembers ? 'Carregando...' : 'Selecione o responsável'}</option>
            {members.map((m, i) => (
              <option key={m.accountId} value={String(i)}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Serviços */}
        <div>
          <p style={{ ...labelStyle, marginBottom: 10 }}>
            Serviços <span style={{ color: 'var(--c-err)' }}>*</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--c-muted)', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              — cada selecionado cria uma issue SA
            </span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FREE_TASKS.map(task => (
              <div key={task}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14,
                  padding: '8px 12px', borderRadius: 8,
                  background: services[task] ? 'var(--c-blue-bg)' : 'var(--c-surface)',
                  border: `1px solid ${services[task] ? 'var(--c-blue)' : 'var(--c-border)'}`,
                  transition: 'all 0.1s',
                }}>
                  <input
                    type="checkbox"
                    checked={services[task] || false}
                    onChange={e => setServices(prev => ({ ...prev, [task]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--c-blue)', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: services[task] ? 600 : 400, color: services[task] ? 'var(--c-blue)' : 'var(--c-text)', flex: 1 }}>
                    {task}
                  </span>
                  {selectedClient && services[task] && (
                    <span style={{ fontSize: 10, color: 'var(--c-blue)', opacity: 0.7 }}>
                      → {serviceLabel(task)} — {selectedClient.name.slice(0, 20)}{selectedClient.name.length > 20 ? '…' : ''}
                    </span>
                  )}
                </label>
                {task === 'IA' && services['IA'] && (
                  <input
                    type="text"
                    value={iaType}
                    onChange={e => setIaType(e.target.value)}
                    placeholder="Qual tipo de IA? (ex: ChatGPT, Gemini...)"
                    style={{
                      ...inputStyle, fontSize: 13, padding: '8px 12px',
                      border: '1px solid var(--c-blue)', background: 'var(--c-blue-bg)', marginTop: 6,
                    }}
                  />
                )}
                {task === 'PABX' && services['PABX'] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    <input
                      type="number"
                      min={1}
                      value={pabxNumbers}
                      onChange={e => setPabxNumbers(e.target.value)}
                      placeholder="Quantidade de números"
                      style={{
                        ...inputStyle, fontSize: 13, padding: '8px 12px',
                        border: '1px solid var(--c-blue)', background: 'var(--c-blue-bg)',
                      }}
                    />
                    <input
                      type="text"
                      value={pabxServiceType}
                      onChange={e => setPabxServiceType(e.target.value)}
                      placeholder="Tipo de PABX (ex: Virtual, Físico, Nuvem...)"
                      style={{
                        ...inputStyle, fontSize: 13, padding: '8px 12px',
                        border: '1px solid var(--c-blue)', background: 'var(--c-blue-bg)',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        {selectedServices.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--c-bg)', border: '1px solid var(--c-border)', fontSize: 12 }}>
            <p style={{ fontWeight: 700, color: 'var(--c-muted)', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issues que serão criadas</p>
            {selectedServices.map(svc => (
              <p key={svc} style={{ color: 'var(--c-text)', marginBottom: 3 }}>• {buildTitle(svc)}</p>
            ))}
          </div>
        )}

        <div style={{ paddingTop: 4 }}>
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              fontSize: 14, padding: '10px 28px', borderRadius: 20,
              background: isDisabled ? 'var(--c-border)' : 'var(--c-text)',
              color: isDisabled ? 'var(--c-muted)' : 'var(--c-bg)',
              border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {loading ? 'Criando...' : `Criar ${selectedServices.length > 1 ? `${selectedServices.length} serviços` : 'serviço'} no Jira`}
          </button>
        </div>
      </form>
    </div>
  )
}
