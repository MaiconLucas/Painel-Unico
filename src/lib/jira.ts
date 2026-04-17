const JIRA_BASE = process.env.JIRA_BASE_URL!
const EMAIL = process.env.JIRA_EMAIL!
const TOKEN = process.env.JIRA_API_TOKEN!
export const PROJECT_KAN = process.env.JIRA_PROJECT_KEY || 'KAN'
export const PROJECT_SA = process.env.JIRA_PROJECT_KEY_SA || 'SA'

export const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')
export const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

export async function jiraFetch(path: string) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function jiraPut(path: string, body: unknown) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Jira PUT error: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

export async function jiraPost(path: string, body: unknown) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return res.json()
}
