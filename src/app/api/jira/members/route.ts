import { NextResponse } from 'next/server'
import { jiraFetch, PROJECT_KAN } from '@/lib/jira'

export async function GET() {
  const data = await jiraFetch(
    `/user/assignable/search?project=${PROJECT_KAN}&maxResults=50`
  )
  const members = (data || []).map((u: any) => ({
    accountId: u.accountId,
    name: u.displayName,
    avatar: u.avatarUrls?.['24x24'] || null,
  }))
  return NextResponse.json({ members })
}
