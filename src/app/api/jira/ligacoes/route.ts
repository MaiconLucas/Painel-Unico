import { NextResponse } from 'next/server'
import { jiraFetch, jiraPost, PROJECT_SA } from '@/lib/jira'

export async function GET() {
  const jql = encodeURIComponent(
    `project=${PROJECT_SA} AND summary ~ "Ligação —" AND status!="Concluído" AND status!="Cancelado" ORDER BY created DESC`
  )
  const data = await jiraFetch(
    `/search/jql?jql=${jql}&maxResults=200&fields=summary,status,assignee,created,updated`
  )
  const tasks = (data.issues || []).map((t: any) => ({
    key: t.key,
    name: t.fields.summary,
    status: t.fields.status?.name || '',
    assignee: t.fields.assignee?.displayName || null,
    createdAt: t.fields.created,
    updatedAt: t.fields.updated,
    url: `https://suporteunico.atlassian.net/browse/${t.key}`,
  }))
  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const { assignments } = await request.json()
  // assignments: [{ member: { accountId, name }, rows: [{ instancia, prioridade }] }]

  const results: { key: string; url: string; instancia: string; assignee: string }[] = []
  const errors: string[] = []

  for (const assignment of assignments) {
    for (const row of assignment.rows) {
      try {
        const title = `Ligação — ${row.instancia}`
        const descText = [
          `Prioridade: ${row.prioridade}`,
          `Responsável: ${assignment.member.name}`,
        ].join('\n')

        // Check duplicate
        const checkJql = encodeURIComponent(
          `project=${PROJECT_SA} AND summary ~ "${title.replace(/"/g, '\\"')}" AND status!="Concluído"`
        )
        const checkData = await jiraFetch(`/search/jql?jql=${checkJql}&maxResults=5&fields=summary`)
        const duplicate = (checkData.issues || []).find(
          (i: any) => i.fields.summary.toLowerCase().trim() === title.toLowerCase().trim()
        )
        if (duplicate) {
          errors.push(`Duplicado: ${title} (${duplicate.key})`)
          continue
        }

        const fields: Record<string, unknown> = {
          project: { key: PROJECT_SA },
          summary: title,
          issuetype: { name: 'Tarefa' },
          description: {
            type: 'doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: descText }] }],
          },
        }
        if (assignment.member.accountId) {
          fields.assignee = { accountId: assignment.member.accountId }
        }

        const data = await jiraPost('/issue', { fields })
        if (!data.key) throw new Error(data.errorMessages?.[0] || 'Erro ao criar')

        results.push({
          key: data.key,
          url: `https://suporteunico.atlassian.net/browse/${data.key}`,
          instancia: row.instancia,
          assignee: assignment.member.name,
        })
      } catch (err: any) {
        errors.push(`${row.instancia}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({ results, errors })
}
