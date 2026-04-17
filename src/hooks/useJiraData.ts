'use client'

import { useState, useCallback } from 'react'
import type { Issue, DoneTask, SlaConfig, Summary } from '@/types'

export function useJiraData(periodYear: number, periodMonth: number) {
  const [clients, setClients] = useState<Issue[]>([])
  const [saIssues, setSaIssues] = useState<Issue[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, totalSA: 0, atrasados: 0, aguardando: 0, alertas: 0, ok: 0 })
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>([])
  const [doneSa, setDoneSa] = useState<DoneTask[]>([])
  const [pendingByAssignee, setPendingByAssignee] = useState<Record<string, any[]>>({})
  const [slaConfig, setSlaConfig] = useState<SlaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')

  const load = useCallback(async (year = periodYear, month = periodMonth) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/jira?year=${year}&month=${month}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClients(data.clients)
      setSaIssues(data.saIssues)
      setSummary(data.summary)
      setDoneTasks(data.doneTasks || [])
      setDoneSa(data.doneSa || [])
      setPendingByAssignee(data.pendingTasksByAssignee || {})
      if (data.slaConfig) setSlaConfig(data.slaConfig)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [periodYear, periodMonth])

  async function handleSlaConfigSave(newConfig: SlaConfig) {
    const res = await fetch('/api/jira', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Erro ao salvar')
    setSlaConfig(newConfig)
  }

  return {
    clients,
    saIssues,
    summary,
    doneTasks,
    doneSa,
    pendingByAssignee,
    slaConfig,
    loading,
    error,
    lastUpdate,
    load,
    handleSlaConfigSave,
  }
}
