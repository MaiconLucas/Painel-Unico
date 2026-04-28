'use client'

import { useState } from 'react'
import { IMPLANTADORES } from '@/lib/constants'

export default function NovoServicoTab() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIndex, setAssigneeIndex] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ key: string; url: string } | null>(null)
  const [error, setError] = useState('')

  const selectedAssignee = assigneeIndex !== '' ? IMPLANTADORES[parseInt(assigneeIndex)] : null
  const isDisabled = !title.trim() || !selectedAssignee || loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDisabled) return
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const res = await fetch('/api/jira/create-sa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          assigneeAccountId: selectedAssignee!.accountId,
          assigneeName: selectedAssignee!.name,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar')
      setSuccess({ key: data.key, url: data.url })
      setTitle('')
      setDescription('')
      setAssigneeIndex('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Novo Serviço Adicional</p>
      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 20 }}>Cria uma issue no projeto SA do Jira.</p>

      {success && (
        <div style={{ background: 'var(--c-ok-bg)', color: 'var(--c-ok)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Serviço criado com sucesso!{' '}
          <a href={success.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-ok)', fontWeight: 700 }}>
            {success.key} ↗
          </a>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Erro: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Título <span style={{ color: 'var(--c-err)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: CRM — empresa.atenderbem.com"
            required
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Descrição
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Informações adicionais, observações..."
            rows={3}
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Responsável <span style={{ color: 'var(--c-err)' }}>*</span>
          </label>
          <select
            value={assigneeIndex}
            onChange={e => setAssigneeIndex(e.target.value)}
            required
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>Selecione o responsável</option>
            {IMPLANTADORES.map((impl, i) => (
              <option key={impl.name} value={String(i)}>{impl.name}</option>
            ))}
          </select>
        </div>

        <div style={{ paddingTop: 8 }}>
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
            {loading ? 'Criando...' : 'Criar no Jira'}
          </button>
        </div>
      </form>
    </div>
  )
}
