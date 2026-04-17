'use client'

import { alertBg, alertColor, alertIcon, alertLabel } from '@/lib/helpers'
import type { Issue } from '@/types'

export default function IssueCard({ issue, onOpen }: { issue: Issue, onOpen: () => void }) {
  const progress = issue.allTasksCount > 0
    ? Math.round((issue.doneTasksCount / issue.allTasksCount) * 100)
    : null

  return (
    <div className="card" onClick={onOpen} style={{ borderLeft: `3px solid ${alertColor(issue.alert)}`, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{issue.name}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            <span className="meta">{issue.key}</span>
            {issue.score != null && <span className="meta">{issue.score} pts</span>}
            {progress !== null && <span className="meta">{issue.doneTasksCount}/{issue.allTasksCount} etapas</span>}
            <span className="meta">{issue.status}</span>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: alertBg(issue.alert), borderRadius: 8, padding: '5px 10px',
        }}>
          <span style={{ fontSize: 13 }}>{alertIcon(issue.alert)}</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: alertColor(issue.alert), whiteSpace: 'nowrap' }}>
              {issue.stage || alertLabel(issue.alert)}
            </p>
            <p style={{ fontSize: 10, color: alertColor(issue.alert), opacity: 0.85, marginTop: 1, whiteSpace: 'nowrap' }}>
              {issue.alertReason}
            </p>
          </div>
        </div>
      </div>

      {progress !== null && (
        <div style={{ marginTop: 10, height: 3, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: progress === 100 ? 'var(--c-ok)' : alertColor(issue.alert),
            borderRadius: 2, transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 8 }}>Clique para ver detalhes →</p>
    </div>
  )
}
