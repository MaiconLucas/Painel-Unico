import { NextResponse } from 'next/server'
import { jiraFetch, PROJECT_KAN } from '@/lib/jira'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  if (key) {
    // Debug a specific issue
    const data = await jiraFetch(`/issue/${key}?fields=summary,status,issuetype,assignee,parent`)
    const children = await jiraFetch(
      `/search/jql?jql=${encodeURIComponent(`project=${PROJECT_KAN} AND parent=${key}`)}&maxResults=50&fields=summary,status`
    )
    return NextResponse.json({
      key,
      summary: data.fields.summary,
      issuetype: data.fields.issuetype?.name,
      status: data.fields.status?.name,
      assignee: data.fields.assignee?.displayName,
      parent: data.fields.parent?.key,
      childTasks: (children.issues || []).map((t: any) => ({
        key: t.key,
        summary: t.fields.summary,
        status: t.fields.status?.name,
      })),
    })
  }

  // List all epics (with their raw issuetype/status names)
  const jql = encodeURIComponent(`project=${PROJECT_KAN} AND issuetype in ("Épico","Epic","épico","epic") ORDER BY created DESC`)
  const data = await jiraFetch(`/search/jql?jql=${jql}&maxResults=200&fields=summary,status,issuetype`)
  const allTypes = encodeURIComponent(`project=${PROJECT_KAN} AND created >= -90d`)
  const sample = await jiraFetch(`/search/jql?jql=${allTypes}&maxResults=10&fields=issuetype`)

  return NextResponse.json({
    totalEpics: data.total,
    epics: (data.issues || []).map((i: any) => ({
      key: i.key,
      summary: i.fields.summary,
      issuetype: i.fields.issuetype?.name,
      status: i.fields.status?.name,
    })),
    sampleIssueTypes: [...new Set((sample.issues || []).map((i: any) => i.fields.issuetype?.name))],
  })
}
