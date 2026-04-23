import { useState, useCallback, useRef, useEffect } from 'react'

export interface SupportQueue {
  id: number
  name: string
  enabled: boolean
  connected: boolean
  authenticated: boolean
  openChats: number
  chatsOnQueue: number
  loggedAgentsCount: number
  todaysRespondedChats: number
  todaysAvgContactTime: number
  todaysAvgAnswerTime: number
  todaysSurveyGrade: number
  todaysRespondedSurveys: number
}

export interface SupportChat {
  clientName?: string
  clientNumber?: string
  clientId?: string
  protocol?: string
  userId?: number
  onQueue?: boolean
  onIvr?: boolean
  responded?: boolean
  userResponded?: boolean
  lastRcvMsgTime?: number
  lastSendMsgTime?: number
  beginTime?: number
  _qId?: number
  _qN?: string
}

export interface SupportAgent {
  id: number
  name: string
  chatsToday?: number
  nps?: number
  surveys?: number
  tma?: number
  paused?: boolean
  available?: boolean
}

const SK = 'uc_key'
const SU = 'uc_url'

export function useSuporte() {
  const [connected, setConnected] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [urlInput, setUrlInput] = useState('https://unicocontato.atenderbem.com')
  const [keyInput, setKeyInput] = useState('')

  const baseRef = useRef('')
  const keyRef = useRef('')
  const agentCacheRef = useRef<Record<number, SupportAgent>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [queues, setQueues] = useState<SupportQueue[]>([])
  const [allChats, setAllChats] = useState<SupportChat[]>([])
  const [agentMap, setAgentMap] = useState<Record<number, SupportAgent>>({})
  const [fetchStatus, setFetchStatus] = useState<'' | 'loading' | 'ok' | 'error'>('')
  const [lastUpdate, setLastUpdate] = useState('')
  const [intervalSecs, setIntervalSecs] = useState(120)

  const [filterQueue, setFilterQueue] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterClient, setFilterClient] = useState('')

  const doPost = useCallback(async (path: string, body: object): Promise<any> => {
    const r = await fetch(baseRef.current + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  }, [])

  const fetchAll = useCallback(async () => {
    if (!baseRef.current) return
    setFetchStatus('loading')
    try {
      const qData: SupportQueue[] = await doPost('/int/getAllQueues', { apiKey: keyRef.current })
      const active = qData.filter(q => q.enabled && q.connected && q.openChats > 0)
      const chatArr: SupportChat[] = []
      await Promise.all(active.map(async q => {
        try {
          const r = await doPost('/int/getAllOpenChats', { queueId: q.id, apiKey: keyRef.current })
          ;(r.chats || []).forEach((c: SupportChat) => chatArr.push({ ...c, _qId: q.id, _qN: q.name }))
        } catch {}
      }))
      const uids = [...new Set(chatArr.filter(c => c.userId).map(c => c.userId!))]
      const cache = agentCacheRef.current
      await Promise.all(
        uids.filter(u => !cache[u]).map(async u => {
          try {
            const chat = chatArr.find(c => c.userId === u)
            if (!chat) return
            const d = await doPost('/int/getUserDetail', { queueId: chat._qId, apiKey: keyRef.current, userId: u })
            cache[u] = {
              id: u,
              name: d.fullName || d.username || 'Agente ' + u,
              chatsToday: d.chatsToday,
              nps: d.todaysSurveyGrade,
              surveys: d.todaysRespondedSurveys,
              tma: d.todaysAvgContactTime,
              paused: d.paused,
              available: d.available,
            }
          } catch {
            cache[u] = { id: u, name: 'Agente ' + u }
          }
        })
      )
      setQueues(qData)
      setAllChats(chatArr)
      setAgentMap({ ...cache })
      setLastUpdate('sync ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setFetchStatus('ok')
    } catch {
      setFetchStatus('error')
    }
  }, [doPost])

  const startTimer = useCallback((secs: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(fetchAll, secs * 1000)
  }, [fetchAll])

  const connect = useCallback(async () => {
    if (!keyInput.trim()) { setSetupError('Informe a apiKey.'); return }
    setSetupError('')
    const base = urlInput.trim().replace(/\/$/, '')
    const key = keyInput.trim()
    try {
      const r = await fetch(base + '/int/getAllQueues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      localStorage.setItem(SK, key)
      localStorage.setItem(SU, base)
      baseRef.current = base
      keyRef.current = key
      setConnected(true)
      setShowSetup(false)
      await fetchAll()
      startTimer(intervalSecs)
    } catch (e: any) {
      setSetupError('Erro: ' + e.message)
    }
  }, [urlInput, keyInput, fetchAll, startTimer, intervalSecs])

  const resetSetup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setConnected(false)
    setShowSetup(true)
    setFetchStatus('')
    baseRef.current = ''
    keyRef.current = ''
  }, [])

  const changeInterval = useCallback((secs: number) => {
    setIntervalSecs(secs)
    if (baseRef.current) startTimer(secs)
  }, [startTimer])

  useEffect(() => {
    const k = localStorage.getItem(SK)
    const u = localStorage.getItem(SU)
    if (k && u) {
      setUrlInput(u); setKeyInput(k)
      baseRef.current = u; keyRef.current = k
      setConnected(true)
      fetchAll().then(() => startTimer(120))
    } else {
      setShowSetup(true)
    }
    setInitializing(false)
  }, []) // eslint-disable-line

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const chats = allChats.filter(c => {
    if (filterQueue && String(c._qId) !== filterQueue) return false
    if (filterAgent && String(c.userId) !== filterAgent) return false
    if (filterClient) {
      const q = filterClient.toLowerCase()
      return (c.clientName || '').toLowerCase().includes(q)
        || (c.clientNumber || '').toLowerCase().includes(q)
        || (c.protocol || '').toLowerCase().includes(q)
    }
    return true
  })

  return {
    connected, initializing, showSetup, setupError,
    urlInput, setUrlInput, keyInput, setKeyInput,
    connect, resetSetup,
    queues, chats, allChats, agentMap,
    fetchStatus, lastUpdate, intervalSecs, changeInterval, fetchAll,
    filterQueue, setFilterQueue, filterAgent, setFilterAgent,
    filterClient, setFilterClient,
    clearFilters: () => { setFilterQueue(''); setFilterAgent(''); setFilterClient('') },
  }
}
