'use client'

import { useEffect, useState } from 'react'
import type { SlaConfig } from '@/types'

export default function SlaConfigTab({ config, onSave }: { config: SlaConfig | null, onSave: (c: SlaConfig) => Promise<void> }) {
  const [editing, setEditing] = useState<SlaConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { if (config) setEditing(JSON.parse(JSON.stringify(config))) }, [config])

  if (!editing) return <p style={{ color: 'var(--c-muted)', fontSize: 13 }}>Carregando...</p>

  function updateSla(key: string, value: number) {
    setEditing(prev => prev ? { ...prev, services: prev.services.map(s => s.key === key ? { ...s, slaDays: value } : s) } : prev)
  }

  function updateThreshold(value: number) {
    setEditing(prev => prev ? { ...prev, alerts: { warningThreshold: value / 100 } } : prev)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true); setSaveError('')
    try {
      await onSave(editing)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { setSaveError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Configuração de SLAs</p>
          <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>Salvo no Jira (SA-34) — válido em qualquer dispositivo.</p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          fontSize: 13, padding: '8px 20px', borderRadius: 20,
          background: saved ? 'var(--c-ok)' : 'var(--c-text)',
          color: saved ? '#fff' : 'var(--c-bg)',
          border: 'none', cursor: saving ? 'wait' : 'pointer',
          fontWeight: 600, transition: 'background 0.2s', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>

      {saveError && <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>Erro: {saveError}</div>}

      <div style={{ marginBottom: 20 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Fluxo sequencial</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {editing.flow.map((step, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--c-muted)' }}>→</span>}
              <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', fontWeight: 500 }}>{step}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="section-label" style={{ marginBottom: 12 }}>SLA por serviço (dias úteis)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {editing.services.map(svc => (
          <div key={svc.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '12px 16px',
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{svc.label}</p>
              <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {svc.waitClient ? 'Depende do cliente' : svc.individual ? 'Escopo individual' : svc.slaDays ? `Alerta amarelo com ${Math.ceil(svc.slaDays * editing.alerts.warningThreshold)} dia(s)` : 'Sem SLA definido'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {svc.waitClient && <span className="badge warn">Aguarda cliente</span>}
              {svc.individual && <span className="badge neutral">Individual</span>}
              {!svc.waitClient && !svc.individual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateSla(svc.key, Math.max(1, (svc.slaDays || 1) - 1))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{svc.slaDays ?? '—'}</span>
                  <button onClick={() => updateSla(svc.key, (svc.slaDays || 0) + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <p className="section-label">Threshold de alerta amarelo</p>
            <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 4 }}>Alerta 🟡 quando atingir <strong>{Math.round(editing.alerts.warningThreshold * 100)}%</strong> do SLA</p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(editing.alerts.warningThreshold * 100)}%</span>
        </div>
        <input type="range" min={50} max={95} step={5} value={Math.round(editing.alerts.warningThreshold * 100)} onChange={e => updateThreshold(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-warn)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>
          <span>50% — alerta mais cedo</span><span>95% — alerta mais tarde</span>
        </div>
      </div>
    </div>
  )
}
