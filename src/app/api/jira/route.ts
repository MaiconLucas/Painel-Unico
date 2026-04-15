import { NextResponse } from 'next/server'

const JIRA_BASE = process.env.JIRA_BASE_URL!
const EMAIL = process.env.JIRA_EMAIL!
const TOKEN = process.env.JIRA_API_TOKEN!
const PROJECT_KAN = process.env.JIRA_PROJECT_KEY || 'KAN'
const PROJECT_SA = process.env.JIRA_PROJECT_KEY_SA || 'SA'

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

function extractText(description: any): string {
  if (!description) return ''
  if (typeof description === 'string') return description
  const walk = (node: any): string => {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    if (node.content) return node.content.map(walk).join(node.type === 'paragraph' ? '\n' : '')
    return ''
  }
  return walk(description)
}

function parseDescription(desc: string) {
  const scoreMatch = desc.match(/score de complexidade[^:\d]*:?\s*\*?\*?\s*(\d+)/i)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null

  const servBlockMatch = desc.match(/servi[çc]os contratados[^\n]*\n([\s\S]*?)(?:\n\*\*[A-Z]|\n\n\*\*|$)/i)
  let services: string | null = null
  if (servBlockMatch) {
    const items = [...servBlockMatch[1].matchAll(/[*\-•]\s*([^\n*]+)/g)].map(m => m[1].trim()).filter(Boolean)
    if (items.length > 0) services = items.join(' · ')
  }

  const planoMatch = desc.match(/plano[*:\s]+([^\n*]+)/i)
  const plano = planoMatch ? planoMatch[1].trim() : null

  return { score, services, plano }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // KAN — Epics abertos
    const epicJql = encodeURIComponent(`project=${PROJECT_KAN} AND issuetype in ("Épico","Epic","épico") AND status!="Concluído"`)
    const epicsData = await jiraFetch(
      `/search/jql?jql=${epicJql}&maxResults=100&fields=summary,status,assignee,duedate,description`
    )
    const epics = epicsData.issues || []

    const clients = await Promise.all(epics.map(async (epic: any) => {
      let tasks: any[] = []
      try {
        const taskJql = encodeURIComponent(`project=${PROJECT_KAN} AND issuetype=Tarefa AND parent="${epic.key}"`)
        const tasksData = await jiraFetch(
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status,assignee`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          key: t.key,
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
          assignee: t.fields.assignee?.displayName || null,
        }))
      } catch (_) {}

      const desc = extractText(epic.fields.description)
      const { score, services, plano } = parseDescription(desc)

      const due = epic.fields.duedate || null
      const status = epic.fields.status?.name || ''
      const now = new Date()
      const dueDate = due ? new Date(due) : null

      return {
        key: epic.key,
        name: epic.fields.summary,
        assignee: epic.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score,
        services,
        plano,
        tasks,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'KAN',
      }
    }))

    // SA — Issues abertas
    const saJql = encodeURIComponent(`project=${PROJECT_SA} AND status!="Concluído" AND status!="Cancelado"`)
    const saData = await jiraFetch(
      `/search/jql?jql=${saJql}&maxResults=100&fields=summary,status,assignee,duedate,description`
    )
    const saIssues = (saData.issues || []).map((issue: any) => {
      const status = issue.fields.status?.name || ''
      const due = issue.fields.duedate || null
      const now = new Date()
      const dueDate = due ? new Date(due) : null
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
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'SA',
      }
    })

    // Tasks KAN concluídas no período
    const doneTasksJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issuetype=Tarefa AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
    )
    const doneTasksData = await jiraFetch(
      `/search/jql?jql=${doneTasksJql}&maxResults=200&fields=summary,status,assignee,parent,resolutiondate`
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
      `/search/jql?jql=${doneSaJql}&maxResults=200&fields=summary,status,assignee,resolutiondate`
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
        const s = task.status.toLowerCase()
        if (s.includes('conclu')) return
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
    const total = clients.length
    const totalSA = saIssues.length
    const atrasados = allIssues.filter((c: any) => c.overdue).length
    const aguardando = allIssues.filter((c: any) => c.waiting).length
    const ok = allIssues.length - atrasados - aguardando

    return NextResponse.json({
      clients,
      saIssues,
      summary: { total, totalSA, atrasados, aguardando, ok },
      doneTasks,
      doneSa,
      pendingTasksByAssignee,
      period: { year, month },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}