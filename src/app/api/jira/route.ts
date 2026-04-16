import { NextResponse } from 'next/server'
import slaConfigDefault from '@/sla-config.json'

const JIRA_BASE = process.env.JIRA_BASE_URL!
const EMAIL = process.env.JIRA_EMAIL!
const TOKEN = process.env.JIRA_API_TOKEN!
const PROJECT_KAN = process.env.JIRA_PROJECT_KEY || 'KAN'
const PROJECT_SA = process.env.JIRA_PROJECT_KEY_SA || 'SA'
const SLA_CONFIG_ISSUE = 'SA-34'

const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

async function jiraFetch(path: string) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function jiraPut(path: string, body: any) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Jira PUT error: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

// Extrai JSON da description ADF da issue de config
function extractJsonFromAdf(description: any): any | null {
  if (!description) return null
  try {
    function walk(node: any): string {
      if (!node) return ''
      if (node.type === 'text') return node.text || ''
      if (node.type === 'hardBreak') return '\n'
      return (node.content || []).map(walk).join('')
    }
    const raw = walk(description)
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch (_) {}
  return null
}

// Carrega SLA config do Jira (SA-34)
async function loadSlaConfig() {
  try {
    const data = await jiraFetch(`/issue/${SLA_CONFIG_ISSUE}?fields=description`)
    const parsed = extractJsonFromAdf(data.fields.description)
    if (parsed && parsed.services && parsed.flow) return parsed
  } catch (_) {}
  return slaConfigDefault
}

function extractText(description: any): string {
  if (!description) return ''
  if (typeof description === 'string') return description
  function walk(node: any): string {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    const children = (node.content || []).map(walk).join('')
    const blockTypes = ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList']
    return blockTypes.includes(node.type) ? children + '\n' : children
  }
  return walk(description)
}

function parseDescription(raw: string) {
  const desc = raw.replace(/\\n/g, '\n')
  const scoreMatch = desc.match(/(?:score|peso) de complexidade[^:\d]*:?\s*\*?\s*(\d+)/i)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null
  const planoMatch = desc.match(/plano[*:\s]+([^\n]+)/i)
  const plano = planoMatch ? planoMatch[1].replace(/\*/g, '').trim() : null
  let services: string | null = null
  const newFmt = desc.match(/servi[çc]os contratados[*:\s]*\n([\s\S]*?)(?:\n\*\*|\nPorte|\nImplantador|\nPeso|\nScore|\nNível|\n\n|$)/i)
  if (newFmt) {
    const items = newFmt[1]
      .split('\n')
      .map((l: string) => l.replace(/^[*\-•]\s*/, '').replace(/\*/g, '').trim())
      .filter((l: string) => l.length > 0 && !l.match(/^(porte|agentes|localidades|score|peso|implantador|instância|nível|técnico)/i))
    if (items.length > 0) services = items.join(' · ')
  }
  if (!services) {
    const inlineFmt = desc.match(/servi[çc]os?[*:\s]+([^\n]+)/i)
    if (inlineFmt) {
      services = inlineFmt[1]
        .replace(/\*/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.match(/^(porte|implantador|peso|score)/i))
        .join(' · ')
    }
  }
  return { score, services, plano }
}

function businessDaysBetween(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur < endDay) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function calcStageAlert(tasks: any[], epicCreatedAt: string, slaConfig: any) {
  const flow: string[] = slaConfig.flow
  const services = slaConfig.services
  const warningThreshold = slaConfig.alerts.warningThreshold

  const orderedTasks = flow
    .map((flowKey: string) => tasks.find((t: any) =>
      t.summary?.toLowerCase().includes(flowKey.toLowerCase())
    ))
    .filter(Boolean)

  const freeTasks = tasks.filter((t: any) =>
    !flow.some((f: string) => t.summary?.toLowerCase().includes(f.toLowerCase()))
  )

  const allOrdered = [...orderedTasks, ...freeTasks]

  const currentTask = allOrdered.find((t: any) => {
    const s = t.status?.toLowerCase()
    return !s?.includes('conclu')
  })

  if (!currentTask) {
    return { stage: null, stageStatus: 'done', daysInStage: 0, alert: 'done', alertReason: 'Todas as etapas concluídas', currentTaskKey: undefined }
  }

  const taskStatus = currentTask.status?.toLowerCase() || ''
  const isWaitingClient = taskStatus.includes('aguardando')
  const since = currentTask.updatedAt || currentTask.createdAt || epicCreatedAt
  const daysInStage = businessDaysBetween(new Date(since), new Date())
  const serviceKey = flow.find((f: string) => currentTask.summary?.toLowerCase().includes(f.toLowerCase()))
  const serviceConfig = services.find((s: any) => s.key === serviceKey)

  let alert: string
  let alertReason: string

  if (tasks.length === 0) {
    alert = 'noTasks'
    alertReason = 'Nenhuma task criada ainda'
  } else if (isWaitingClient) {
    alert = 'waiting'
    alertReason = `Aguardando cliente há ${daysInStage} dia(s) útil(eis)`
  } else if (!serviceConfig?.slaDays) {
    if (daysInStage >= 5) {
      alert = 'critical'
      alertReason = `Parado há ${daysInStage} dias úteis (sem SLA definido)`
    } else if (daysInStage >= 3) {
      alert = 'warning'
      alertReason = `${daysInStage} dias úteis nessa etapa`
    } else {
      alert = 'ok'
      alertReason = `${daysInStage} dia(s) nessa etapa`
    }
  } else {
    const sla = serviceConfig.slaDays
    const ratio = daysInStage / sla
    if (ratio >= 1) {
      alert = 'critical'
      alertReason = `SLA estourado: ${daysInStage}/${sla} dias úteis`
    } else if (ratio >= warningThreshold) {
      alert = 'warning'
      alertReason = `Atenção: ${daysInStage}/${sla} dias úteis (${Math.round(ratio * 100)}% do SLA)`
    } else {
      alert = 'ok'
      alertReason = `${daysInStage}/${sla} dias úteis`
    }
  }

  return {
    stage: currentTask.summary?.replace(/.*?[-–]\s*/, '').trim() || currentTask.summary,
    stageStatus: taskStatus,
    daysInStage,
    alert,
    alertReason,
    currentTaskKey: currentTask.key,
  }
}

// ─── GET — carrega dados do painel ────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // Carrega SLA config do Jira
    const slaConfig = await loadSlaConfig()

    // KAN — Epics abertos
    const epicJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issuetype in ("Épico","Epic","épico") AND status!="Concluído"`
    )
    const epicsData = await jiraFetch(
      `/search/jql?jql=${epicJql}&maxResults=100&fields=summary,status,assignee,duedate,description,created`
    )
    const epics = epicsData.issues || []

    const clients = await Promise.all(epics.map(async (epic: any) => {
      let tasks: any[] = []
      try {
        const taskJql = encodeURIComponent(
          `project=${PROJECT_KAN} AND issuetype=Tarefa AND parent=${epic.key}`
        )
        const tasksData = await jiraFetch(
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status,assignee,created,updated`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          key: t.key,
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
          assignee: t.fields.assignee?.displayName || null,
          createdAt: t.fields.created,
          updatedAt: t.fields.updated,
        }))
      } catch (_) {}

      const desc = extractText(epic.fields.description)
      const { score, services, plano } = parseDescription(desc)
      const due = epic.fields.duedate || null
      const status = epic.fields.status?.name || ''
      const now = new Date()
      const dueDate = due ? new Date(due) : null
      const pendingTasks = tasks.filter((t: any) => !t.status?.toLowerCase().includes('conclu'))
      const stageAlert = calcStageAlert(tasks, epic.fields.created, slaConfig)

      return {
        key: epic.key,
        name: epic.fields.summary,
        assignee: epic.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score,
        services,
        plano,
        tasks: pendingTasks,
        allTasksCount: tasks.length,
        doneTasksCount: tasks.filter((t: any) => t.status?.toLowerCase().includes('conclu')).length,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'KAN',
        stage: stageAlert.stage,
        stageStatus: stageAlert.stageStatus,
        daysInStage: stageAlert.daysInStage,
        alert: stageAlert.alert,
        alertReason: stageAlert.alertReason,
        currentTaskKey: stageAlert.currentTaskKey,
      }
    }))

    // SA — Issues abertas
    const saJql = encodeURIComponent(
      `project=${PROJECT_SA} AND status!="Concluído" AND status!="Cancelado" AND summary!="CONFIG — SLAs"`
    )
    const saData = await jiraFetch(
      `/search/jql?jql=${saJql}&maxResults=100&fields=summary,status,assignee,duedate,created,updated`
    )
    const saIssues = (saData.issues || []).map((issue: any) => {
      const status = issue.fields.status?.name || ''
      const due = issue.fields.duedate || null
      const now = new Date()
      const dueDate = due ? new Date(due) : null
      const isWaiting = status.toLowerCase().includes('aguardando')
      const daysInStage = businessDaysBetween(new Date(issue.fields.updated || issue.fields.created), new Date())
      return {
        key: issue.key,
        name: issue.fields.summary,
        assignee: issue.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score: null,
        services: null,
        plano: null,
        tasks: [],
        allTasksCount: 0,
        doneTasksCount: 0,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: isWaiting,
        project: 'SA',
        stage: status,
        daysInStage,
        alert: isWaiting ? 'waiting' : daysInStage >= 5 ? 'critical' : daysInStage >= 3 ? 'warning' : 'ok',
        alertReason: isWaiting ? `Aguardando há ${daysInStage} dia(s)` : `${daysInStage} dia(s) nesse status`,
        currentTaskKey: undefined,
      }
    })

    // Tasks KAN concluídas no período
    const doneTasksJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issuetype=Tarefa AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
    )
    const doneTasksData = await jiraFetch(
      `/search/jql?jql=${doneTasksJql}&maxResults=200&fields=summary,assignee,parent,resolutiondate`
    )
    const doneTasks = (doneTasksData.issues || []).map((t: any) => ({
      key: t.key,
      summary: t.fields.summary,
      assignee: t.fields.assignee?.displayName || null,
      parentKey: t.fields.parent?.key || null,
      parentName: t.fields.parent?.fields?.summary || null,
      resolvedAt: t.fields.resolutiondate || null,
    }))

    // SA concluídos no período
    const doneSaJql = encodeURIComponent(
      `project=${PROJECT_SA} AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
    )
    const doneSaData = await jiraFetch(
      `/search/jql?jql=${doneSaJql}&maxResults=200&fields=summary,assignee,resolutiondate`
    )
    const doneSa = (doneSaData.issues || []).map((t: any) => ({
      key: t.key,
      summary: t.fields.summary,
      assignee: t.fields.assignee?.displayName || null,
      parentKey: null,
      parentName: null,
      resolvedAt: t.fields.resolutiondate || null,
    }))

    // Tasks pendentes por assignee
    const pendingTasksByAssignee: Record<string, any[]> = {}
    clients.forEach(epic => {
      epic.tasks.forEach((task: any) => {
        const responsible = task.assignee || epic.assignee || 'Sem responsável'
        if (!pendingTasksByAssignee[responsible]) pendingTasksByAssignee[responsible] = []
        pendingTasksByAssignee[responsible].push({
          key: task.key,
          summary: task.summary,
          status: task.status,
          epicKey: epic.key,
          epicName: epic.name,
        })
      })
    })

    const allIssues = [...clients, ...saIssues]
    const atrasados = allIssues.filter((c: any) => c.alert === 'critical').length
    const aguardando = allIssues.filter((c: any) => c.alert === 'waiting').length
    const alertas = allIssues.filter((c: any) => c.alert === 'warning').length
    const ok = allIssues.filter((c: any) => c.alert === 'ok' || c.alert === 'done').length

    return NextResponse.json({
      clients,
      saIssues,
      summary: { total: clients.length, totalSA: saIssues.length, atrasados, aguardando, alertas, ok },
      doneTasks,
      doneSa,
      pendingTasksByAssignee,
      period: { year, month },
      slaConfig,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST — salva SLA config no Jira ─────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.services || !body.flow || !body.alerts) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const jsonStr = JSON.stringify(body, null, 2)

    // Atualiza description da SA-34 com o JSON novo em formato ADF
    await jiraPut(`/issue/${SLA_CONFIG_ISSUE}`, {
      fields: {
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'codeBlock',
              attrs: { language: 'json' },
              content: [{ type: 'text', text: jsonStr }],
            },
          ],
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}