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

export async function GET() {
  try {
    // KAN — Implantações
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
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
        }))
      } catch (_) {}

      const desc: string = epic.fields.description?.content
        ?.flatMap((b: any) => b.content || [])
        ?.map((c: any) => c.text || '')
        ?.join(' ') || ''

      const scoreMatch = desc.match(/score[:\s]+(\d+)/i)
      const servicesMatch = desc.match(/servi[çc]os[:\s]+([^\n]+)/i)
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
        score: scoreMatch ? parseInt(scoreMatch[1]) : null,
        services: servicesMatch ? servicesMatch[1].trim() : null,
        tasks,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'KAN',
      }
    }))

    // SA — Serviços Adicionais
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
        tasks: [],
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'SA',
      }
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
      summary: { total, totalSA, atrasados, aguardando, ok }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}