'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Chart from 'chart.js/auto'
import { useSuporte } from '@/hooks/useSuporte'
import type { SupportChat, SupportQueue, SupportAgent } from '@/hooks/useSuporte'

// ── Utilities ────────────────────────────────────────────────────────────────

function fmt(s: number): string {
  if (!s || s === 0) return '—'
  s = Math.round(s)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h${m}m`
  if (m > 0) return `${m}m${sec}s`
  return `${sec}s`
}

function elapsed(ts?: number): number {
  if (!ts || ts === 0) return 0
  return Math.floor(Date.now() / 1000) - ts
}

function fElapsed(ts?: number): string {
  const s = elapsed(ts)
  return s > 0 ? fmt(s) : '—'
}

function isPending(c: SupportChat): boolean {
  if (!c.userId || c.userId === 0) return true
  if (c.onIvr) return true
  if (!c.userResponded) return true
  if (c.lastRcvMsgTime && c.lastSendMsgTime && c.lastRcvMsgTime > c.lastSendMsgTime) return true
  return false
}

function ini(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'
}

function nCls(n: number): string {
  return n >= 8 ? 'green' : n >= 6 ? 'amber' : 'red'
}

function wCls(s: number): string {
  return s > 3600 ? 'sr-wait-critical' : s > 1800 ? 'sr-wait-urgent' : ''
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
.sr{--bg:#0a0a0b;--bg2:#111113;--bg3:#18181b;--bg4:#222226;--border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.12);--text:#e8e8ea;--text2:#8b8b96;--text3:#55555e;--green:#22c55e;--green-dim:#16a34a33;--red:#ef4444;--red-dim:#dc262633;--amber:#f59e0b;--amber-dim:#d9770633;--blue:#3b82f6;--blue-dim:#1d4ed833;--accent:#6366f1;--accent-dim:#4338ca22;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;font-family:var(--sans);background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;min-height:100vh;}
.sr *,.sr *::before,.sr *::after{box-sizing:border-box;}
.sr::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:0;}
.sr-splash{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:400;}
.sr-splash-logo{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.15em;}
.sr-splash-ring{width:32px;height:32px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:sr-spin .6s linear infinite;}
@keyframes sr-spin{to{transform:rotate(360deg)}}
.sr-setup{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:500;}
.sr-setup-box{background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:2.5rem;width:440px;max-width:95vw;}
.sr-setup-logo{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:2rem;display:flex;align-items:center;gap:8px;}
.sr-setup-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);}
.sr-setup-title{font-size:22px;font-weight:600;margin-bottom:.4rem;}
.sr-setup-sub{font-size:13px;color:var(--text2);margin-bottom:2rem;line-height:1.6;}
.sr-field{margin-bottom:1rem;}
.sr-field label{display:block;font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem;}
.sr-field input{width:100%;padding:10px 12px;font-family:var(--mono);font-size:13px;border:1px solid var(--border2);border-radius:8px;background:var(--bg3);color:var(--text);outline:none;transition:border-color .15s;}
.sr-field input:focus{border-color:var(--accent);}
.sr-hint{font-size:11px;color:var(--text3);margin-top:.4rem;}
.sr-btn-connect{width:100%;margin-top:1.5rem;padding:11px;font-size:14px;font-weight:600;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;}
.sr-btn-connect:hover{background:#4f46e5;}
.sr-setup-error{font-size:12px;color:var(--red);margin-top:.75rem;}
.sr-topbar{background:var(--bg2);border-bottom:1px solid var(--border);padding:0 1.5rem;display:flex;align-items:center;justify-content:space-between;height:48px;position:sticky;top:0;z-index:100;gap:16px;}
.sr-brand{display:flex;align-items:center;gap:10px;}
.sr-brand-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);}
.sr-brand-name{font-family:var(--mono);font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;}
.sr-brand-ver{font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:4px;}
.sr-topbar-right{display:flex;align-items:center;gap:8px;}
.sr-status-pill{display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 10px;}
.sr-dot{width:6px;height:6px;border-radius:50%;background:var(--text3);}
.sr-dot.ok{background:var(--green);box-shadow:0 0 6px var(--green);}
.sr-dot.loading{background:var(--amber);animation:sr-blink .8s infinite;}
.sr-dot.error{background:var(--red);box-shadow:0 0 6px var(--red);}
@keyframes sr-blink{0%,100%{opacity:1}50%{opacity:.3}}
.sr-status-txt{font-family:var(--mono);font-size:11px;color:var(--text2);}
.sr-update-time{font-family:var(--mono);font-size:11px;color:var(--text3);}
.sr-btn{font-family:var(--sans);padding:5px 12px;font-size:12px;font-weight:500;border:1px solid var(--border2);border-radius:6px;background:var(--bg3);color:var(--text2);cursor:pointer;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;}
.sr-btn:hover{background:var(--bg4);color:var(--text);}
.sr-btn-accent{border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}
.sr-btn-accent:hover{background:rgba(99,102,241,.2);}
.sr-sel{font-family:var(--mono);padding:4px 8px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text2);cursor:pointer;}
.sr-filter-bar{background:var(--bg2);border-bottom:1px solid var(--border);padding:.6rem 1.5rem;display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
.sr-filter-label{font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;}
.sr-filter-sel,.sr-filter-input{font-family:var(--sans);padding:5px 10px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);cursor:pointer;outline:none;}
.sr-filter-sel{min-width:160px;}
.sr-filter-input{min-width:200px;cursor:text;}
.sr-filter-input::placeholder{color:var(--text3);}
.sr-filter-sel:focus,.sr-filter-input:focus{border-color:var(--accent);}
.sr-fdivider{width:1px;height:20px;background:var(--border);}
.sr-btn-clear{font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text3);cursor:pointer;}
.sr-btn-clear:hover{color:var(--text2);}
.sr-main{padding:1.25rem 1.5rem 3rem;max-width:1800px;margin:0 auto;}
.sr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem;}
.sr-chip{display:inline-flex;align-items:center;gap:6px;background:var(--accent-dim);border:1px solid rgba(99,102,241,.3);color:#818cf8;font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;font-family:var(--mono);}
.sr-chip button{background:none;border:none;color:#818cf8;cursor:pointer;font-size:13px;padding:0;opacity:.7;}
.sr-chip button:hover{opacity:1;}
.sr-sec{font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;margin-top:1.75rem;display:flex;align-items:center;gap:8px;}
.sr-sec::after{content:'';flex:1;height:1px;background:var(--border);}
.sr-sec:first-child{margin-top:0;}
.sr-sec-count{font-size:10px;color:var(--accent);background:var(--accent-dim);padding:1px 7px;border-radius:20px;}
.sr-sec-count.red{color:var(--red);background:var(--red-dim);}
.sr-sec-count.green{color:var(--green);background:var(--green-dim);}
.sr-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;}
.sr-kpi{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;position:relative;overflow:hidden;transition:border-color .2s;}
.sr-kpi:hover{border-color:var(--border2);}
.sr-kpi.accent{border-left:2px solid var(--accent);}
.sr-kpi.red{border-left:2px solid var(--red);}
.sr-kpi.green{border-left:2px solid var(--green);}
.sr-kpi.clickable{cursor:pointer;transition:border-color .15s,transform .1s;}
.sr-kpi.clickable:hover{transform:translateY(-2px);}
.sr-kpi-label{font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem;}
.sr-kpi-value{font-family:var(--mono);font-size:24px;font-weight:500;color:var(--text);line-height:1;}
.sr-kpi-value.red{color:var(--red);}.sr-kpi-value.green{color:var(--green);}.sr-kpi-value.amber{color:var(--amber);}
.sr-kpi-value.sm{font-size:17px;}
.sr-kpi-sub{font-size:11px;color:var(--text3);margin-top:.3rem;}
.sr-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:900px){.sr-chart-grid{grid-template-columns:1fr;}}
.sr-chart-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem 1.1rem;}
.sr-chart-title{font-family:var(--mono);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem;}
.sr-chart-wrap{position:relative;height:200px;}
.sr-gauge-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;}
.sr-gauge-val{font-family:var(--mono);font-size:36px;font-weight:500;line-height:1;margin-top:-20px;}
.sr-gauge-label{font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:4px;}
.sr-health-list{display:flex;flex-direction:column;gap:10px;padding:.25rem 0;height:200px;overflow-y:auto;}
.sr-health-item{display:flex;flex-direction:column;gap:4px;}
.sr-health-header{display:flex;justify-content:space-between;align-items:center;}
.sr-health-name{font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;}
.sr-health-val{font-family:var(--mono);font-size:11px;}
.sr-health-bar-bg{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;}
.sr-health-bar-fill{height:100%;border-radius:2px;transition:width .6s ease;}
.sr-timeline{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;}
.sr-tl-item{display:flex;gap:10px;align-items:flex-start;padding:6px 8px;border-radius:6px;border:1px solid var(--border);}
.sr-tl-item.critical{background:var(--red-dim);border-color:rgba(239,68,68,.2);}
.sr-tl-item.urgent{background:var(--amber-dim);border-color:rgba(245,158,11,.2);}
.sr-tl-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:3px;}
.sr-tl-item.critical .sr-tl-dot{background:var(--red);}
.sr-tl-item.urgent .sr-tl-dot{background:var(--amber);}
.sr-tl-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sr-tl-meta{font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:1px;}
.sr-ranking-list{display:flex;flex-direction:column;gap:6px;}
.sr-ranking-item{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--border);border-radius:8px;cursor:pointer;transition:all .2s;}
.sr-ranking-item:hover{border-color:var(--border2);transform:translateX(2px);}
.sr-ranking-item.crit{border-left-color:var(--red);}
.sr-ranking-item.urg{border-left-color:var(--amber);}
.sr-ranking-item.ok{border-left-color:var(--green);}
.sr-rank-pos{font-family:var(--mono);font-size:11px;color:var(--text3);width:18px;flex-shrink:0;text-align:center;}
.sr-rank-avatar{width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:10px;font-weight:500;flex-shrink:0;}
.sr-ranking-item.crit .sr-rank-avatar{background:var(--red-dim);color:var(--red);}
.sr-ranking-item.urg .sr-rank-avatar{background:var(--amber-dim);color:var(--amber);}
.sr-ranking-item.ok .sr-rank-avatar{background:var(--green-dim);color:var(--green);}
.sr-rank-info{flex:1;overflow:hidden;}
.sr-rank-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sr-rank-meta{font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:1px;display:flex;gap:8px;flex-wrap:wrap;}
.sr-rank-stats{display:flex;gap:12px;flex-shrink:0;align-items:center;}
.sr-rank-stat-val{font-family:var(--mono);font-size:16px;font-weight:500;line-height:1;}
.sr-rank-stat-val.red{color:var(--red);}.sr-rank-stat-val.amber{color:var(--amber);}.sr-rank-stat-val.green{color:var(--green);}
.sr-rank-stat-label{font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;}
.sr-rank-bar-wrap{height:3px;background:var(--bg4);border-radius:2px;overflow:hidden;min-width:65px;}
.sr-rank-bar{height:100%;border-radius:2px;transition:width .6s ease;}
.sr-rank-bar-label{font-family:var(--mono);font-size:9px;color:var(--text3);}
.sr-queues-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;}
.sr-queue-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
.sr-queue-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--border);transition:background .2s;}
.sr-queue-card:hover{border-color:var(--border2);transform:translateY(-1px);}
.sr-queue-card:hover::before{background:var(--accent);}
.sr-queue-name{font-size:12px;font-weight:600;margin-bottom:.6rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sr-queue-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
.sr-qs-label{font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;}
.sr-qs-val{font-family:var(--mono);font-size:14px;font-weight:500;}
.sr-qs-val.red{color:var(--red);}.sr-qs-val.amber{color:var(--amber);}.sr-qs-val.green{color:var(--green);}
.sr-agents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;}
.sr-agent-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;}
.sr-agent-header{display:flex;align-items:center;gap:10px;margin-bottom:.75rem;}
.sr-agent-avatar{width:32px;height:32px;border-radius:8px;background:var(--accent-dim);border:1px solid rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;font-weight:500;color:var(--accent);flex-shrink:0;}
.sr-agent-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sr-agent-status{font-family:var(--mono);font-size:10px;margin-top:1px;}
.sr-agent-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
.sr-as-label{font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;}
.sr-as-val{font-family:var(--mono);font-size:13px;font-weight:500;}
.sr-as-val.red{color:var(--red);}.sr-as-val.amber{color:var(--amber);}.sr-as-val.green{color:var(--green);}
.sr-table-wrap{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;}
.sr-table-wrap table{width:100%;border-collapse:collapse;}
.sr-table-wrap thead th{font-family:var(--mono);font-size:10px;font-weight:500;color:var(--text3);text-align:left;padding:8px 12px;background:var(--bg3);border-bottom:1px solid var(--border);white-space:nowrap;text-transform:uppercase;letter-spacing:.06em;}
.sr-table-wrap tbody td{padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text);font-size:12px;}
.sr-table-wrap tbody tr:last-child td{border-bottom:none;}
.sr-table-wrap tbody tr:hover td{background:var(--bg3);}
.sr-table-wrap tbody tr.row-critical{animation:sr-rowblink 2s infinite;}
@keyframes sr-rowblink{0%,100%{background:transparent}50%{background:rgba(239,68,68,.05)}}
.sr-badge{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:500;}
.sr-badge.red{background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2);}
.sr-badge.amber{background:var(--amber-dim);color:var(--amber);border:1px solid rgba(245,158,11,.2);}
.sr-badge.green{background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.2);}
.sr-badge.gray{background:var(--bg4);color:var(--text3);border:1px solid var(--border);}
.sr-badge.blue{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(59,130,246,.2);}
.sr-badge.pending{background:rgba(245,158,11,.15);color:var(--amber);border:1px solid rgba(245,158,11,.3);animation:sr-pendpulse 2s infinite;}
@keyframes sr-pendpulse{0%,100%{opacity:1}50%{opacity:.6}}
.sr-queue-tag{font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);padding:1px 6px;border-radius:4px;white-space:nowrap;}
.sr-empty-row td{text-align:center;padding:2.5rem;color:var(--text3);font-family:var(--mono);font-size:11px;}
.sr-wait-critical{color:var(--red);font-weight:500;}
.sr-wait-urgent{color:var(--amber);font-weight:500;}
.sr-mono{font-family:var(--mono);}
.sr-conn-ok{color:var(--green);}.sr-conn-off{color:var(--red);}
.sr-conn-dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:3px;background:currentColor;}
.sr-alert-bar{background:var(--amber-dim);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:.6rem 1rem;font-size:12px;color:var(--amber);margin-bottom:1rem;}
.sr-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;animation:sr-fadeIn .15s ease;}
@keyframes sr-fadeIn{from{opacity:0}to{opacity:1}}
.sr-modal{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;width:min(860px,95vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.6);}
.sr-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border);}
.sr-modal-title{font-family:var(--mono);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:10px;}
.sr-modal-count{font-size:11px;color:var(--accent);background:var(--accent-dim);padding:2px 8px;border-radius:20px;}
.sr-modal-close{background:none;border:1px solid var(--border);border-radius:6px;color:var(--text3);cursor:pointer;font-size:16px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.sr-modal-close:hover{color:var(--text);border-color:var(--border2);}
.sr-modal-body{overflow-y:auto;flex:1;}
.sr-modal-body::-webkit-scrollbar{width:4px;}.sr-modal-body::-webkit-scrollbar-track{background:var(--bg3);}.sr-modal-body::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px;}
.sr-modal-table{width:100%;border-collapse:collapse;}
.sr-modal-table thead th{font-family:var(--mono);font-size:10px;color:var(--text3);text-align:left;padding:8px 14px;background:var(--bg3);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.06em;position:sticky;top:0;}
.sr-modal-table tbody td{padding:9px 14px;border-bottom:1px solid var(--border);font-size:12px;}
.sr-modal-table tbody tr:last-child td{border-bottom:none;}
.sr-modal-table tbody tr:hover td{background:var(--bg3);}
.sr-modal-empty{text-align:center;padding:3rem;font-family:var(--mono);font-size:12px;color:var(--text3);}
.sr-modal-agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;padding:1rem;}
.sr-dbg{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.88);overflow:auto;padding:2rem;}
.sr-dbg-inner{max-width:1400px;margin:0 auto;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:1.5rem;}
.sr-dbg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:1.5rem;}
.sr-dbg-card{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;}
.sr-dbg-card-label{font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:.3rem;}
.sr-dbg-card-val{font-family:var(--mono);font-size:20px;font-weight:500;}
.sr-dbg-card-sub{font-family:var(--mono);font-size:10px;color:var(--text3);}
`

// ── Component ─────────────────────────────────────────────────────────────────

export default function SuportePage() {
  const {
    connected, initializing, showSetup, setupError,
    urlInput, setUrlInput, keyInput, setKeyInput,
    connect, resetSetup,
    queues, chats, allChats, agentMap,
    fetchStatus, lastUpdate, intervalSecs, changeInterval, fetchAll,
    filterQueue, setFilterQueue, filterAgent, setFilterAgent,
    filterClient, setFilterClient, clearFilters,
  } = useSuporte()

  // Canvas refs for Chart.js
  const cUrgency = useRef<HTMLCanvasElement>(null)
  const cQueues   = useRef<HTMLCanvasElement>(null)
  const cWait     = useRef<HTMLCanvasElement>(null)
  const cStatus   = useRef<HTMLCanvasElement>(null)
  const cNPS      = useRef<HTMLCanvasElement>(null)
  const cAgentTMA = useRef<HTMLCanvasElement>(null)
  const cAgentPend = useRef<HTMLCanvasElement>(null)
  const chartsRef  = useRef<Record<string, InstanceType<typeof Chart>>>({})

  const [kpiModal, setKpiModal] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Set Chart.js defaults once
  useEffect(() => {
    Chart.defaults.color = '#55555e'
    Chart.defaults.borderColor = 'rgba(255,255,255,0.07)'
    Chart.defaults.font.family = "'DM Mono', monospace"
    Chart.defaults.font.size = 10
  }, [])

  function mkChart(key: string, canvas: HTMLCanvasElement | null, type: any, data: any, opts: any = {}) {
    if (chartsRef.current[key]) chartsRef.current[key].destroy()
    if (!canvas) return
    chartsRef.current[key] = new Chart(canvas, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, animation: { duration: 400 }, ...opts },
    })
  }

  function drawNPS(canvas: HTMLCanvasElement | null, val: string | null) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cx = canvas.width / 2, cy = canvas.height - 10, r = 70
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0, false)
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.stroke()
    if (val !== null) {
      const n = parseFloat(val)
      const pct = Math.max(0, Math.min(10, n)) / 10
      const color = n >= 8 ? '#22c55e' : n >= 6 ? '#f59e0b' : '#ef4444'
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * pct, false)
      ctx.lineWidth = 14; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke()
    }
  }

  // Draw charts whenever filtered data changes
  useEffect(() => {
    if (!connected) return
    const now = Math.floor(Date.now() / 1000)
    const pending = chats.filter(isPending)

    // 1) Urgency donut
    const crit = pending.filter(c => elapsed(c.lastRcvMsgTime || c.beginTime) > 3600).length
    const urg  = pending.filter(c => { const s = elapsed(c.lastRcvMsgTime || c.beginTime); return s > 1800 && s <= 3600 }).length
    const att  = pending.filter(c => { const s = elapsed(c.lastRcvMsgTime || c.beginTime); return s > 600 && s <= 1800 }).length
    const norm = pending.filter(c => elapsed(c.lastRcvMsgTime || c.beginTime) <= 600).length
    mkChart('urgency', cUrgency.current, 'doughnut', {
      labels: ['Crítico', 'Urgente', 'Atenção', 'Normal'],
      datasets: [{ data: [crit, urg, att, norm], backgroundColor: ['#ef4444', '#f59e0b', 'rgba(245,158,11,.5)', '#22c55e'], borderWidth: 0, hoverOffset: 4 }],
    }, { cutout: '65%' })

    // 2) Volume by queue
    const activeQ = queues.filter(q => q.enabled && q.openChats > 0).sort((a, b) => b.openChats - a.openChats).slice(0, 8)
    mkChart('queues', cQueues.current, 'bar', {
      labels: activeQ.map(q => q.name.length > 18 ? q.name.slice(0, 16) + '…' : q.name),
      datasets: [
        { label: 'Abertos', data: activeQ.map(q => q.openChats), backgroundColor: 'rgba(99,102,241,.6)', borderRadius: 3 },
        { label: 'Respondidos hoje', data: activeQ.map(q => q.todaysRespondedChats || 0), backgroundColor: 'rgba(34,197,94,.5)', borderRadius: 3 },
      ],
    }, { indexAxis: 'y', plugins: { legend: { display: true, position: 'top', labels: { color: '#55555e', boxWidth: 8, padding: 12 } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55555e' } }, y: { grid: { display: false }, ticks: { color: '#8b8b96', font: { size: 10 } } } } })

    // 3) Wait histogram
    const wb = [0, 0, 0, 0, 0, 0]
    chats.forEach(c => {
      const min = (now - (c.beginTime || now)) / 60
      if (min < 5) wb[0]++; else if (min < 15) wb[1]++; else if (min < 30) wb[2]++; else if (min < 60) wb[3]++; else if (min < 120) wb[4]++; else wb[5]++
    })
    mkChart('wait', cWait.current, 'bar', {
      labels: ['<5m', '5-15m', '15-30m', '30-60m', '1-2h', '>2h'],
      datasets: [{ data: wb, backgroundColor: ['#22c55e', 'rgba(34,197,94,.7)', 'rgba(245,158,11,.6)', 'rgba(245,158,11,.9)', 'rgba(239,68,68,.7)', '#ef4444'], borderRadius: 4 }],
    }, { scales: { x: { grid: { display: false }, ticks: { color: '#8b8b96' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55555e', stepSize: 1 } } } })

    // 4) Status stacked by queue
    const topQ = queues.filter(q => q.enabled && q.connected && (q.openChats > 0 || q.todaysRespondedChats > 0)).sort((a, b) => b.openChats - a.openChats).slice(0, 6)
    mkChart('status', cStatus.current, 'bar', {
      labels: topQ.map(q => q.name.length > 14 ? q.name.slice(0, 12) + '…' : q.name),
      datasets: [
        { label: 'Pendentes', data: topQ.map(q => chats.filter(c => c._qId === q.id && isPending(c)).length), backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 3, stack: 's' },
        { label: 'Respondidos', data: topQ.map(q => chats.filter(c => c._qId === q.id && !isPending(c)).length), backgroundColor: 'rgba(34,197,94,.5)', borderRadius: 3, stack: 's' },
      ],
    }, { plugins: { legend: { display: true, position: 'top', labels: { color: '#55555e', boxWidth: 8, padding: 12 } } }, scales: { x: { grid: { display: false }, ticks: { color: '#8b8b96', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55555e', stepSize: 1 }, stacked: true } } })

    // 5) Agent TMA
    const agIds = Object.keys(agentMap).map(Number).filter(u => (agentMap[u].tma ?? 0) > 0 && (agentMap[u].tma ?? 0) < 86400).sort((a, b) => (agentMap[a].tma ?? 0) - (agentMap[b].tma ?? 0)).slice(0, 8)
    mkChart('agentTMA', cAgentTMA.current, 'bar', {
      labels: agIds.map(u => agentMap[u].name.split(' ')[0]),
      datasets: [{ data: agIds.map(u => Math.round((agentMap[u].tma ?? 0) / 60)), backgroundColor: agIds.map(u => { const m = (agentMap[u].tma ?? 0) / 60; return m > 30 ? 'rgba(239,68,68,.6)' : m > 15 ? 'rgba(245,158,11,.6)' : 'rgba(34,197,94,.6)' }), borderRadius: 4 }],
    }, { scales: { x: { grid: { display: false }, ticks: { color: '#8b8b96' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55555e' }, title: { display: true, text: 'minutos', color: '#55555e', font: { size: 9 } } } } })

    // 6) Agent pending stacked bar
    const pendByAgent: Record<number, { crit: number, urg: number, att: number }> = {}
    pending.filter(c => c.userId).forEach(c => {
      const u = c.userId!
      if (!pendByAgent[u]) pendByAgent[u] = { crit: 0, urg: 0, att: 0 }
      const s = elapsed(c.lastRcvMsgTime || c.beginTime)
      if (s > 3600) pendByAgent[u].crit++; else if (s > 1800) pendByAgent[u].urg++; else pendByAgent[u].att++
    })
    const ranked = Object.entries(pendByAgent).map(([uid, v]) => ({ uid: Number(uid), ...v, total: v.crit + v.urg + v.att })).sort((a, b) => b.crit - a.crit || b.urg - a.urg || b.total - a.total).slice(0, 8)
    mkChart('agentPend', cAgentPend.current, 'bar', {
      labels: ranked.map(r => agentMap[r.uid]?.name.split(' ')[0] || 'A' + r.uid),
      datasets: [
        { label: 'Crítico', data: ranked.map(r => r.crit), backgroundColor: 'rgba(239,68,68,.8)', borderRadius: 3, stack: 's' },
        { label: 'Urgente', data: ranked.map(r => r.urg), backgroundColor: 'rgba(245,158,11,.8)', borderRadius: 3, stack: 's' },
        { label: 'Normal', data: ranked.map(r => r.att), backgroundColor: 'rgba(34,197,94,.6)', borderRadius: 3, stack: 's' },
      ],
    }, { plugins: { legend: { display: true, position: 'top', labels: { color: '#55555e', boxWidth: 8, padding: 10 } } }, scales: { x: { grid: { display: false }, ticks: { color: '#8b8b96' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55555e', stepSize: 1 }, stacked: true } } })

    // NPS gauge
    let nS = 0, nT = 0
    const qForNPS = filterQueue ? queues.filter(q => String(q.id) === filterQueue) : queues
    qForNPS.forEach(q => { if (q.todaysRespondedSurveys > 0) { nS += q.todaysSurveyGrade * q.todaysRespondedSurveys; nT += q.todaysRespondedSurveys } })
    drawNPS(cNPS.current, nT > 0 ? (nS / nT).toFixed(1) : null)

  }, [chats, queues, agentMap, connected]) // eslint-disable-line

  useEffect(() => () => { Object.values(chartsRef.current).forEach(c => c.destroy()) }, [])

  // ── Derived values ───────────────────────────────────────────────────────────

  const pending = chats.filter(isPending)

  let tmaS = 0, tmaC = 0, tmS = 0, tmC = 0, nS = 0, nT = 0
  const qCalc = filterQueue ? queues.filter(q => String(q.id) === filterQueue) : queues
  qCalc.forEach(q => {
    if ((q.todaysAvgContactTime ?? 0) > 0 && (q.todaysAvgContactTime ?? 0) < 86400) { tmaS += q.todaysAvgContactTime; tmaC++ }
    if ((q.todaysAvgAnswerTime ?? 0) > 0 && (q.todaysAvgAnswerTime ?? 0) < 86400) { tmS += q.todaysAvgAnswerTime; tmC++ }
    if (q.todaysRespondedSurveys > 0) { nS += q.todaysSurveyGrade * q.todaysRespondedSurveys; nT += q.todaysRespondedSurveys }
  })
  if (filterAgent && agentMap[Number(filterAgent)]) {
    const a = agentMap[Number(filterAgent)]
    if ((a.tma ?? 0) > 0 && (a.tma ?? 0) < 86400) { tmaS = a.tma!; tmaC = 1 }
    if ((a.surveys ?? 0) > 0) { nS = (a.nps || 0) * a.surveys!; nT = a.surveys! }
  }
  const npsVal = nT > 0 ? (nS / nT).toFixed(1) : null
  const agentCount = filterAgent ? 1 : Object.keys(agentMap).length

  // Agent ranking
  const pendByAgent: Record<number, { uid: number, chats: SupportChat[], maxWait: number, crit: number, urg: number, att: number }> = {}
  pending.filter(c => c.userId).forEach(c => {
    const u = c.userId!
    if (!pendByAgent[u]) pendByAgent[u] = { uid: u, chats: [], maxWait: 0, crit: 0, urg: 0, att: 0 }
    pendByAgent[u].chats.push(c)
    const s = elapsed(c.lastRcvMsgTime || c.beginTime)
    pendByAgent[u].maxWait = Math.max(pendByAgent[u].maxWait, s)
    if (s > 3600) pendByAgent[u].crit++; else if (s > 1800) pendByAgent[u].urg++; else pendByAgent[u].att++
  })
  const inQueue = pending.filter(c => c.onQueue || !c.userId)
  const rankedAgents = Object.values(pendByAgent).sort((a, b) => b.crit - a.crit || b.urg - a.urg || b.chats.length - a.chats.length)
  const maxPend = Math.max(...rankedAgents.map(r => r.chats.length), 1)

  // Health bars
  const hQueues = queues.filter(q => q.enabled && q.connected && (q.openChats > 0 || q.todaysRespondedChats > 0)).sort((a, b) => b.openChats - a.openChats).slice(0, 8)
  const maxVal = Math.max(...hQueues.map(q => q.openChats + (q.todaysRespondedChats || 0)), 1)

  // ── Inline badge helpers ─────────────────────────────────────────────────────

  function Situation({ c }: { c: SupportChat }) {
    if (!c.userId || c.userId === 0) return <span className="sr-badge blue">↗ na fila</span>
    if (c.onIvr) return <span className="sr-badge gray">URA</span>
    if (!c.userResponded) return <span className="sr-badge pending">⏳ aguard. 1ª resp.</span>
    if (c.lastRcvMsgTime && c.lastSendMsgTime && c.lastRcvMsgTime > c.lastSendMsgTime) return <span className="sr-badge amber">⏳ cliente respondeu</span>
    return <span className="sr-badge green">✓ agente respondeu</span>
  }

  function UrgBadge({ s }: { s: number }) {
    if (s > 3600) return <span className="sr-badge red">↑ crítico</span>
    if (s > 1800) return <span className="sr-badge amber">↑ urgente</span>
    if (s > 600) return <span className="sr-badge amber">↑ atenção</span>
    return <span className="sr-badge green">↑ normal</span>
  }

  // ── Debug values ──────────────────────────────────────────────────────────────

  const total = allChats.length
  const pendingN = allChats.filter(isPending).length
  function dbgPct(n: number) { return total > 0 ? Math.round(n / total * 100) : 0 }

  // ── KPI Modal content ────────────────────────────────────────────────────────

  function KpiModalContent() {
    if (!kpiModal) return null
    if (kpiModal === 'agents') {
      return (
        <>
          <div className="sr-modal-header">
            <div className="sr-modal-title">Agentes online agora <span className="sr-modal-count">{Object.keys(agentMap).length}</span></div>
            <button className="sr-modal-close" onClick={() => setKpiModal(null)}>×</button>
          </div>
          <div className="sr-modal-body">
            <div className="sr-modal-agent-grid">
              {Object.values(agentMap).length === 0
                ? <div className="sr-modal-empty">Nenhum agente online</div>
                : Object.values(agentMap).map(a => {
                  const open = allChats.filter(c => c.userId === a.id).length
                  const pend = allChats.filter(c => c.userId === a.id && isPending(c)).length
                  const stC = a.paused ? 'var(--amber)' : a.available ? 'var(--green)' : 'var(--text3)'
                  const stT = a.paused ? 'Pausado' : a.available ? 'Disponível' : 'Indisponível'
                  return (
                    <div key={a.id} className="sr-agent-card">
                      <div className="sr-agent-header">
                        <div className="sr-agent-avatar">{ini(a.name)}</div>
                        <div><div className="sr-agent-name">{a.name}</div><div className="sr-agent-status" style={{ color: stC }}>● {stT}</div></div>
                      </div>
                      <div className="sr-agent-stats">
                        <div><div className="sr-as-label">Abertos</div><div className="sr-as-val">{open}</div></div>
                        <div><div className="sr-as-label">Pendentes</div><div className={`sr-as-val ${pend > 0 ? 'red' : ''}`}>{pend}</div></div>
                        <div><div className="sr-as-label">TMA</div><div className="sr-as-val">{(a.tma ?? 0) > 0 && (a.tma ?? 0) < 86400 ? fmt(a.tma!) : '—'}</div></div>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        </>
      )
    }
    const rows = (() => {
      if (kpiModal === 'open') return chats
      if (kpiModal === 'pending') return chats.filter(isPending).sort((a, b) => elapsed(b.lastRcvMsgTime || b.beginTime) - elapsed(a.lastRcvMsgTime || a.beginTime))
      return chats.filter(c => !isPending(c)).sort((a, b) => elapsed(b.lastSendMsgTime || b.beginTime) - elapsed(a.lastSendMsgTime || a.beginTime))
    })()
    const titles: Record<string, string> = { open: 'Chats abertos agora', pending: 'Aguardando resposta', answered: 'Agente respondeu — aguardando cliente' }
    const headers: Record<string, string[]> = {
      open: ['Cliente', 'Fila', 'Atendente', 'Situação', 'Espera'],
      pending: ['Cliente', 'Fila', 'Atendente', 'Aguardando', 'Motivo'],
      answered: ['Cliente', 'Fila', 'Atendente', 'Últ. resposta', 'Início'],
    }
    return (
      <>
        <div className="sr-modal-header">
          <div className="sr-modal-title">{titles[kpiModal]} <span className="sr-modal-count">{rows.length}</span></div>
          <button className="sr-modal-close" onClick={() => setKpiModal(null)}>×</button>
        </div>
        <div className="sr-modal-body">
          <table className="sr-modal-table">
            <thead><tr>{headers[kpiModal].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={5} className="sr-modal-empty">Sem registros</td></tr>
                : rows.map((c, i) => {
                  const q = queues.find(q => q.id === c._qId)
                  const a = agentMap[c.userId!]
                  const wait = elapsed(c.lastRcvMsgTime || c.beginTime)
                  if (kpiModal === 'open') return (
                    <tr key={i}><td className="sr-mono">{c.clientName || c.clientNumber || '—'}</td><td>{q?.name || '—'}</td><td>{a ? a.name : c.userId ? 'ID ' + c.userId : 'Na fila'}</td><td><Situation c={c} /></td><td className={`sr-mono ${wCls(wait)}`}>{fElapsed(c.lastRcvMsgTime || c.beginTime)}</td></tr>
                  )
                  if (kpiModal === 'pending') {
                    const motivo = (!c.userId || c.userId === 0 || c.onQueue) ? 'Na fila' : !c.userResponded ? 'Nunca respondeu' : 'Cliente respondeu depois'
                    return <tr key={i}><td className="sr-mono">{c.clientName || c.clientNumber || '—'}</td><td>{q?.name || '—'}</td><td className="sr-mono">{a ? a.name : c.userId ? 'ID ' + c.userId : '—'}</td><td className={`sr-mono ${wCls(wait)}`}>{fElapsed(c.lastRcvMsgTime || c.beginTime)}</td><td><span className="sr-badge amber">{motivo}</span></td></tr>
                  }
                  return <tr key={i}><td className="sr-mono">{c.clientName || c.clientNumber || '—'}</td><td>{q?.name || '—'}</td><td className="sr-mono">{a ? a.name : c.userId ? 'ID ' + c.userId : '—'}</td><td className="sr-mono">{fElapsed(c.lastSendMsgTime)}</td><td className="sr-mono">{fElapsed(c.beginTime)}</td></tr>
                })
              }
            </tbody>
          </table>
        </div>
      </>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="sr">
      <style>{CSS}</style>

      {/* Splash */}
      {initializing && (
        <div className="sr-splash">
          <div className="sr-splash-logo">Único · Ops Center</div>
          <div className="sr-splash-ring" />
        </div>
      )}

      {/* Setup */}
      {showSetup && !initializing && (
        <div className="sr-setup">
          <div className="sr-setup-box">
            <div className="sr-setup-logo"><div className="sr-setup-dot" />Único Ops Center</div>
            <div className="sr-setup-title">Conectar ao sistema</div>
            <div className="sr-setup-sub">Configure uma vez — salvo no navegador automaticamente.</div>
            <div className="sr-field">
              <label>URL da instância</label>
              <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            </div>
            <div className="sr-field">
              <label>apiKey global</label>
              <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && connect()} placeholder="••••••••••••••••••" />
              <div className="sr-hint">Configurações → Geral. Salva com segurança no seu navegador.</div>
            </div>
            <button className="sr-btn-connect" onClick={connect}>Conectar →</button>
            {setupError && <div className="sr-setup-error">{setupError}</div>}
          </div>
        </div>
      )}

      {/* Main dashboard */}
      {connected && !initializing && (
        <>
          {/* Topbar */}
          <div className="sr-topbar">
            <div className="sr-brand">
              <div className="sr-brand-dot" />
              <span className="sr-brand-name">Único Ops</span>
              <span className="sr-brand-ver">v3.1</span>
            </div>
            <span className="sr-update-time">{lastUpdate}</span>
            <div className="sr-topbar-right">
              <select className="sr-sel" value={intervalSecs} onChange={e => changeInterval(Number(e.target.value))}>
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
              </select>
              <div className="sr-status-pill">
                <div className={`sr-dot ${fetchStatus}`} />
                <span className="sr-status-txt">{fetchStatus === 'loading' ? 'syncing…' : fetchStatus === 'ok' ? 'live' : fetchStatus === 'error' ? 'error' : '—'}</span>
              </div>
              <Link href="/" className="sr-btn">⚡ Implantações</Link>
              <button className="sr-btn sr-btn-accent" onClick={fetchAll}>↺ Sync</button>
              <button className="sr-btn" onClick={resetSetup} title="Configurações">⚙</button>
              <button className="sr-btn" onClick={() => setShowDebug(v => !v)}>🔍 debug</button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="sr-filter-bar">
            <span className="sr-filter-label">Fila</span>
            <select className="sr-filter-sel" value={filterQueue} onChange={e => setFilterQueue(e.target.value)}>
              <option value="">Todas as filas</option>
              {queues.filter(q => q.enabled && q.connected).map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
            <div className="sr-fdivider" />
            <span className="sr-filter-label">Agente</span>
            <select className="sr-filter-sel" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
              <option value="">Todos os agentes</option>
              {Object.values(agentMap).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="sr-fdivider" />
            <input className="sr-filter-input" type="text" value={filterClient} onChange={e => setFilterClient(e.target.value)} placeholder="Buscar cliente, número ou protocolo…" />
            <button className="sr-btn-clear" onClick={clearFilters}>✕ Limpar</button>
          </div>

          {/* Main content */}
          <div className="sr-main">
            {/* Active filter chips */}
            {(filterQueue || filterAgent || filterClient) && (
              <div className="sr-chips">
                {filterQueue && <div className="sr-chip">Fila: {queues.find(q => String(q.id) === filterQueue)?.name || filterQueue}<button onClick={() => setFilterQueue('')}>×</button></div>}
                {filterAgent && <div className="sr-chip">Agente: {agentMap[Number(filterAgent)]?.name || 'ID ' + filterAgent}<button onClick={() => setFilterAgent('')}>×</button></div>}
                {filterClient && <div className="sr-chip">Busca: "{filterClient}"<button onClick={() => setFilterClient('')}>×</button></div>}
              </div>
            )}

            {/* KPIs */}
            <div className="sr-sec">KPIs em tempo real</div>
            <div className="sr-kpi-grid">
              <div className="sr-kpi accent clickable" onClick={() => setKpiModal('open')}>
                <div className="sr-kpi-label">Abertos agora</div>
                <div className="sr-kpi-value">{chats.length}</div>
                <div className="sr-kpi-sub">{chats.filter(c => !c.userId || c.userId === 0).length} na fila</div>
              </div>
              <div className="sr-kpi red clickable" onClick={() => setKpiModal('pending')}>
                <div className="sr-kpi-label">Aguard. resposta</div>
                <div className="sr-kpi-value red">{pending.length}</div>
                <div className="sr-kpi-sub">cliente pendente</div>
              </div>
              <div className="sr-kpi green clickable" onClick={() => setKpiModal('answered')}>
                <div className="sr-kpi-label">Agente respondeu</div>
                <div className="sr-kpi-value green">{chats.filter(c => !isPending(c)).length}</div>
                <div className="sr-kpi-sub">aguardando cliente</div>
              </div>
              <div className="sr-kpi green clickable" onClick={() => setKpiModal('agents')}>
                <div className="sr-kpi-label">Agentes online</div>
                <div className="sr-kpi-value">{agentCount}</div>
                <div className="sr-kpi-sub">logados agora</div>
              </div>
              <div className="sr-kpi">
                <div className="sr-kpi-label">TMA</div>
                <div className="sr-kpi-value sm">{tmaC > 0 ? fmt(Math.round(tmaS / tmaC)) : '—'}</div>
                <div className="sr-kpi-sub">tempo médio atend.</div>
              </div>
              <div className="sr-kpi">
                <div className="sr-kpi-label">TMPR</div>
                <div className="sr-kpi-value sm">{tmC > 0 ? fmt(Math.round(tmS / tmC)) : '—'}</div>
                <div className="sr-kpi-sub">tempo 1ª resposta</div>
              </div>
              <div className="sr-kpi">
                <div className="sr-kpi-label">NPS médio</div>
                <div className={`sr-kpi-value sm ${npsVal ? nCls(parseFloat(npsVal)) : ''}`}>{npsVal || '—'}</div>
                <div className="sr-kpi-sub">{nT} pesquisas respondidas</div>
              </div>
            </div>

            {/* Charts row 1 */}
            <div className="sr-sec">Análise visual</div>
            <div className="sr-chart-grid">
              <div className="sr-chart-card">
                <div className="sr-chart-title">Urgência dos pendentes</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 200 }}>
                  <div style={{ flex: 1, position: 'relative' }}><canvas ref={cUrgency} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    {[
                      { color: 'var(--red)', label: `Crítico (>60m): ${pending.filter(c => elapsed(c.lastRcvMsgTime || c.beginTime) > 3600).length}` },
                      { color: 'var(--amber)', label: `Urgente (>30m): ${pending.filter(c => { const s = elapsed(c.lastRcvMsgTime || c.beginTime); return s > 1800 && s <= 3600 }).length}` },
                      { color: 'rgba(245,158,11,.5)', label: `Atenção (>10m): ${pending.filter(c => { const s = elapsed(c.lastRcvMsgTime || c.beginTime); return s > 600 && s <= 1800 }).length}` },
                      { color: 'var(--green)', label: `Normal (<10m): ${pending.filter(c => elapsed(c.lastRcvMsgTime || c.beginTime) <= 600).length}` },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text2)' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Volume aberto por fila</div>
                <div className="sr-chart-wrap"><canvas ref={cQueues} /></div>
              </div>
            </div>

            {/* Charts row 2 */}
            <div className="sr-chart-grid" style={{ marginTop: 12 }}>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Distribuição tempo de espera</div>
                <div className="sr-chart-wrap"><canvas ref={cWait} /></div>
              </div>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Situação dos atendimentos por fila</div>
                <div className="sr-chart-wrap"><canvas ref={cStatus} /></div>
              </div>
            </div>

            {/* Charts row 3 */}
            <div className="sr-chart-grid" style={{ marginTop: 12 }}>
              <div className="sr-chart-card">
                <div className="sr-chart-title">NPS geral do dia</div>
                <div className="sr-gauge-wrap">
                  <canvas ref={cNPS} width={200} height={120} />
                  <div className={`sr-gauge-val ${npsVal ? nCls(parseFloat(npsVal)) : ''}`} style={{ color: npsVal ? undefined : 'var(--text3)' }}>{npsVal || '—'}</div>
                  <div className="sr-gauge-label">{nT > 0 ? 'de 10 pontos' : 'sem pesquisas respondidas'}</div>
                </div>
              </div>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Carga por fila (abertos vs respondidos hoje)</div>
                <div className="sr-health-list">
                  {hQueues.length === 0
                    ? <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>Sem dados</div>
                    : hQueues.map(q => {
                      const tot = q.openChats + (q.todaysRespondedChats || 0)
                      const pct = Math.round((q.openChats / Math.max(tot, 1)) * 100)
                      const color = pct > 70 ? 'var(--red)' : pct > 40 ? 'var(--amber)' : 'var(--green)'
                      const bW = Math.round((tot / maxVal) * 100)
                      return (
                        <div key={q.id} className="sr-health-item">
                          <div className="sr-health-header">
                            <span className="sr-health-name" title={q.name}>{q.name.length > 22 ? q.name.slice(0, 20) + '…' : q.name}</span>
                            <span className="sr-health-val" style={{ color }}>{q.openChats} abertos / {q.todaysRespondedChats || 0} resol.</span>
                          </div>
                          <div className="sr-health-bar-bg"><div className="sr-health-bar-fill" style={{ width: bW + '%', background: color }} /></div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>

            {/* Urgency radar + Agent TMA */}
            <div className="sr-sec">Radar de urgência — clientes aguardando resposta <span className={`sr-sec-count red`}>{pending.length}</span></div>
            <div className="sr-chart-grid" style={{ marginTop: 0 }}>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Fila crítica</div>
                <div className="sr-timeline">
                  {pending.length === 0
                    ? <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11, padding: '.5rem' }}>✓ Nenhum cliente aguardando</div>
                    : pending.slice(0, 15).sort((a, b) => elapsed(b.lastRcvMsgTime || b.beginTime) - elapsed(a.lastRcvMsgTime || a.beginTime)).map((c, i) => {
                      const wS = elapsed(c.lastRcvMsgTime || c.beginTime)
                      const cls = wS > 3600 ? 'critical' : wS > 1800 ? 'urgent' : ''
                      const ag = c.onQueue ? 'na fila' : (c.userId ? (agentMap[c.userId]?.name.split(' ')[0] || 'agente ' + c.userId) : '—')
                      return (
                        <div key={i} className={`sr-tl-item ${cls}`}>
                          <div className="sr-tl-dot" />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="sr-tl-name">{c.clientName || c.clientNumber || c.clientId || '—'}</div>
                            <div className="sr-tl-meta">{c._qN || '—'} · {ag} · aguardando {fmt(wS)}</div>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Tempo médio de resposta por agente</div>
                <div className="sr-chart-wrap"><canvas ref={cAgentTMA} /></div>
              </div>
            </div>

            {/* Agent ranking */}
            <div className="sr-sec">Ranking — quem está deixando clientes sem resposta <span className="sr-sec-count red">{rankedAgents.length}{inQueue.length > 0 ? ` agentes + ${inQueue.length} na fila` : ' agentes'}</span></div>
            <div className="sr-chart-grid">
              <div>
                <div className="sr-ranking-list">
                  {rankedAgents.length === 0 && inQueue.length === 0
                    ? <div style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 11, padding: '.75rem 1rem', background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, textAlign: 'center' }}>✓ Todos os agentes responderam seus clientes</div>
                    : <>
                      {rankedAgents.map((r, i) => {
                        const a = agentMap[r.uid] || { id: r.uid, name: 'Agente ' + r.uid, available: false, paused: false }
                        const cls = r.crit > 0 ? 'crit' : r.urg > 0 ? 'urg' : 'ok'
                        const barPct = Math.round((r.chats.length / maxPend) * 100)
                        const barColor = r.crit > 0 ? 'var(--red)' : r.urg > 0 ? 'var(--amber)' : 'var(--green)'
                        const stDot = a.paused ? 'var(--amber)' : a.available ? 'var(--green)' : 'var(--red)'
                        return (
                          <div key={r.uid} className={`sr-ranking-item ${cls}`} onClick={() => setFilterAgent(String(r.uid))}>
                            <div className="sr-rank-pos">{i + 1}</div>
                            <div className="sr-rank-avatar">{ini(a.name)}</div>
                            <div className="sr-rank-info">
                              <div className="sr-rank-name">{a.name}</div>
                              <div className="sr-rank-meta">
                                <span style={{ color: stDot }}>●</span>
                                {r.crit > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{r.crit} crítico{r.crit > 1 ? 's' : ''}</span>}
                                {r.urg > 0 && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{r.urg} urgente{r.urg > 1 ? 's' : ''}</span>}
                                <span>máx {fmt(r.maxWait)}</span>
                              </div>
                            </div>
                            <div className="sr-rank-stats">
                              <div>
                                <div className={`sr-rank-stat-val ${r.crit > 0 ? 'red' : r.urg > 0 ? 'amber' : 'green'}`}>{r.chats.length}</div>
                                <div className="sr-rank-stat-label">pendentes</div>
                              </div>
                              <div>
                                <div className="sr-rank-bar-wrap"><div className="sr-rank-bar" style={{ width: barPct + '%', background: barColor }} /></div>
                                <div className="sr-rank-bar-label">{barPct}% do máx</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {inQueue.length > 0 && (
                        <div className="sr-ranking-item" style={{ borderLeftColor: 'var(--blue)' }}>
                          <div className="sr-rank-pos">—</div>
                          <div className="sr-rank-avatar" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>FI</div>
                          <div className="sr-rank-info">
                            <div className="sr-rank-name">Na fila — sem agente</div>
                            <div className="sr-rank-meta">aguardando distribuição</div>
                          </div>
                          <div className="sr-rank-stats">
                            <div><div className="sr-rank-stat-val" style={{ color: 'var(--blue)' }}>{inQueue.length}</div><div className="sr-rank-stat-label">na fila</div></div>
                          </div>
                        </div>
                      )}
                    </>
                  }
                </div>
              </div>
              <div className="sr-chart-card">
                <div className="sr-chart-title">Pendentes por agente (por urgência)</div>
                <div className="sr-chart-wrap"><canvas ref={cAgentPend} /></div>
              </div>
            </div>

            {/* Agents section (visible when filter is active) */}
            {(filterQueue || filterAgent) && (
              <>
                <div className="sr-sec">Agentes <span className="sr-sec-count">{[...new Set(chats.filter(c => c.userId).map(c => c.userId))].length}</span></div>
                <div className="sr-agents-grid">
                  {[...new Set(chats.filter(c => c.userId).map(c => c.userId!))].map(uid => {
                    const a = agentMap[uid] || { id: uid, name: 'Agente ' + uid }
                    const ca = chats.filter(c => c.userId === uid).length
                    const pend = chats.filter(c => c.userId === uid && isPending(c)).length
                    const stC = a.paused ? 'var(--amber)' : a.available ? 'var(--green)' : 'var(--red)'
                    return (
                      <div key={uid} className="sr-agent-card">
                        <div className="sr-agent-header">
                          <div className="sr-agent-avatar">{ini(a.name)}</div>
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div className="sr-agent-name">{a.name}</div>
                            <div className="sr-agent-status" style={{ color: stC }}>● {a.paused ? 'pausa' : a.available ? 'disponível' : 'indisponível'}</div>
                          </div>
                        </div>
                        <div className="sr-agent-stats">
                          <div><div className="sr-as-label">Ativos</div><div className={`sr-as-val ${ca > 8 ? 'red' : ca > 5 ? 'amber' : ''}`}>{ca}</div></div>
                          <div><div className="sr-as-label">Pendentes</div><div className={`sr-as-val ${pend > 0 ? 'amber' : 'green'}`}>{pend}</div></div>
                          <div><div className="sr-as-label">Hoje</div><div className="sr-as-val">{a.chatsToday || '—'}</div></div>
                          <div><div className="sr-as-label">TMA</div><div className="sr-as-val" style={{ fontSize: 11 }}>{fmt(a.tma ?? 0)}</div></div>
                          <div><div className="sr-as-label">NPS</div><div className={`sr-as-val ${(a.surveys ?? 0) > 0 ? nCls(a.nps ?? 0) : ''}`}>{(a.surveys ?? 0) > 0 ? (a.nps ?? 0).toFixed(1) : '—'}</div></div>
                          <div><div className="sr-as-label">Pesq.</div><div className="sr-as-val">{a.surveys || 0}</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Queues section (hidden when filter is active) */}
            {!filterQueue && !filterAgent && (
              <>
                <div className="sr-sec">Status das filas</div>
                <div className="sr-queues-grid">
                  {queues.filter(q => q.enabled).map(q => {
                    const conn = q.connected && q.authenticated
                    const nps = q.todaysRespondedSurveys > 0 ? parseFloat(String(q.todaysSurveyGrade)).toFixed(1) : '—'
                    const npsC = q.todaysRespondedSurveys > 0 ? nCls(parseFloat(String(q.todaysSurveyGrade))) : ''
                    return (
                      <div key={q.id} className="sr-queue-card" onClick={() => setFilterQueue(String(q.id))}>
                        <div className="sr-queue-name">{q.name}</div>
                        <div className="sr-queue-stats">
                          <div><div className="sr-qs-label">Abertos</div><div className={`sr-qs-val ${(q.openChats || 0) > 10 ? 'red' : (q.openChats || 0) > 5 ? 'amber' : ''}`}>{q.openChats || 0}</div></div>
                          <div><div className="sr-qs-label">Fila</div><div className={`sr-qs-val ${(q.chatsOnQueue || 0) > 3 ? 'red' : (q.chatsOnQueue || 0) > 0 ? 'amber' : ''}`}>{q.chatsOnQueue || 0}</div></div>
                          <div><div className="sr-qs-label">Agentes</div><div className="sr-qs-val">{q.loggedAgentsCount || 0}</div></div>
                          <div><div className="sr-qs-label">NPS</div><div className={`sr-qs-val ${npsC}`}>{nps}</div></div>
                          <div><div className="sr-qs-label">TMA</div><div className="sr-qs-val" style={{ fontSize: 11 }}>{fmt(q.todaysAvgContactTime || 0)}</div></div>
                          <div><div className="sr-qs-label">Status</div><span className={conn ? 'sr-conn-ok' : 'sr-conn-off'}><span className="sr-conn-dot" />{conn ? 'online' : 'offline'}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Pending table */}
            <div className="sr-sec" style={{ marginTop: '1.75rem' }}>Todos pendentes <span className="sr-sec-count red">{pending.length}</span></div>
            <div className="sr-table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead><tr><th style={{ width: '19%' }}>Cliente</th><th style={{ width: '13%' }}>Fila</th><th style={{ width: '11%' }}>Aguardando</th><th style={{ width: '13%' }}>Agente</th><th style={{ width: '10%' }}>Urgência</th><th style={{ width: '10%' }}>Aberto há</th><th style={{ width: '24%' }}>Protocolo</th></tr></thead>
                <tbody>
                  {pending.length === 0
                    ? <tr className="sr-empty-row"><td colSpan={7}>nenhum cliente aguardando resposta</td></tr>
                    : pending.slice().sort((a, b) => elapsed(b.lastRcvMsgTime || b.beginTime) - elapsed(a.lastRcvMsgTime || a.beginTime)).slice(0, 50).map((c, i) => {
                      const wT = c.lastRcvMsgTime || c.beginTime
                      const wS = elapsed(wT)
                      return (
                        <tr key={i} className={wS > 3600 ? 'row-critical' : ''}>
                          <td className="sr-mono">{c.clientName || c.clientNumber || c.clientId || '—'}</td>
                          <td><span className="sr-queue-tag">{c._qN || '—'}</span></td>
                          <td className={`sr-mono ${wCls(wS)}`}>{fElapsed(wT)}</td>
                          <td className="sr-mono">{c.onQueue ? <span className="sr-badge blue">na fila</span> : (c.userId ? (agentMap[c.userId]?.name || 'ID ' + c.userId) : '—')}</td>
                          <td><UrgBadge s={wS} /></td>
                          <td className="sr-mono">{fElapsed(c.beginTime)}</td>
                          <td className="sr-mono" style={{ color: 'var(--text3)' }}>{c.protocol || '—'}</td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>

            {/* All chats table */}
            <div className="sr-sec">Todos os atendimentos <span className="sr-sec-count">{chats.length}</span></div>
            <div className="sr-table-wrap" style={{ marginBottom: '2rem' }}>
              <table>
                <thead><tr><th style={{ width: '16%' }}>Cliente</th><th style={{ width: '13%' }}>Fila</th><th style={{ width: '10%' }}>Aberto há</th><th style={{ width: '11%' }}>Últ. rcv</th><th style={{ width: '11%' }}>Últ. env.</th><th style={{ width: '13%' }}>Agente</th><th style={{ width: '14%' }}>Situação</th><th style={{ width: '12%' }}>Protocolo</th></tr></thead>
                <tbody>
                  {chats.length === 0
                    ? <tr className="sr-empty-row"><td colSpan={8}>nenhum atendimento encontrado</td></tr>
                    : chats.slice().sort((a, b) => elapsed(b.beginTime) - elapsed(a.beginTime)).slice(0, 100).map((c, i) => (
                      <tr key={i}>
                        <td className="sr-mono">{c.clientName || c.clientNumber || c.clientId || '—'}</td>
                        <td><span className="sr-queue-tag">{c._qN || '—'}</span></td>
                        <td className="sr-mono">{fElapsed(c.beginTime)}</td>
                        <td className="sr-mono">{c.lastRcvMsgTime ? fElapsed(c.lastRcvMsgTime) : '—'}</td>
                        <td className="sr-mono">{c.lastSendMsgTime ? fElapsed(c.lastSendMsgTime) : '—'}</td>
                        <td className="sr-mono" style={{ color: 'var(--text2)' }}>{c.userId ? (agentMap[c.userId]?.name || 'ID ' + c.userId) : '—'}</td>
                        <td><Situation c={c} /></td>
                        <td className="sr-mono" style={{ color: 'var(--text3)' }}>{c.protocol || '—'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Debug panel */}
      {showDebug && (
        <div className="sr-dbg">
          <div className="sr-dbg-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>🔍 Diagnóstico — dados brutos da API</div>
              <button className="sr-btn" onClick={() => setShowDebug(false)}>✕ Fechar</button>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Resumo de campos</div>
            <div className="sr-dbg-grid">
              {[
                { l: 'Total chats', v: total, c: 'var(--accent)' },
                { l: 'isPending()', v: pendingN, c: 'var(--red)' },
                { l: 'onQueue=true', v: allChats.filter(c => c.onQueue).length, c: 'var(--blue)' },
                { l: 'tem lastSendMsgTime', v: allChats.filter(c => c.lastSendMsgTime && c.lastSendMsgTime > 0).length, c: 'var(--green)' },
                { l: 'tem lastRcvMsgTime', v: allChats.filter(c => c.lastRcvMsgTime && c.lastRcvMsgTime > 0).length, c: '' },
                { l: 'rcvMsg > sendMsg', v: allChats.filter(c => c.lastRcvMsgTime && c.lastSendMsgTime && c.lastRcvMsgTime > c.lastSendMsgTime).length, c: 'var(--amber)' },
                { l: 'responded=true', v: allChats.filter(c => c.responded).length, c: '' },
                { l: 'userResponded=true', v: allChats.filter(c => c.userResponded).length, c: '' },
                { l: 'tem userId (agente)', v: allChats.filter(c => c.userId && c.userId !== 0).length, c: 'var(--green)' },
                { l: 'sem userId (fila)', v: allChats.filter(c => !c.userId || c.userId === 0).length, c: 'var(--red)' },
              ].map(d => (
                <div key={d.l} className="sr-dbg-card">
                  <div className="sr-dbg-card-label">{d.l}</div>
                  <div className="sr-dbg-card-val" style={{ color: d.c || 'var(--text)' }}>{d.v}</div>
                  <div className="sr-dbg-card-sub">de {total} total ({dbgPct(d.v)}%)</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Amostra — primeiros 30 chats</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    {['cliente', 'fila', 'userId', 'onQueue', 'responded', 'userResponded', 'lastRcvMsgTime', 'lastSendMsgTime', 'rcv>send?', 'isPending()'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allChats.slice(0, 30).map((c, i) => {
                    const pend = isPending(c)
                    const rcvGtS = c.lastRcvMsgTime && c.lastSendMsgTime && c.lastRcvMsgTime > c.lastSendMsgTime
                    const now = Math.floor(Date.now() / 1000)
                    const ts = (t?: number) => t && t > 0 ? `${Math.round((now - t) / 60)}m atrás` : '—'
                    const v = (x: any) => x === undefined ? 'undef' : x === null ? 'null' : x === 0 ? '0' : String(x)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: pend ? 'rgba(239,68,68,.07)' : undefined }}>
                        <td style={{ padding: '5px 10px', color: 'var(--text2)' }}>{String(c.clientName || c.clientNumber || c.clientId || '?').slice(0, 18)}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text3)' }}>{String(c._qN || '?').slice(0, 14)}</td>
                        <td style={{ padding: '5px 10px' }}>{v(c.userId)}</td>
                        <td style={{ padding: '5px 10px' }}>{v(c.onQueue)}</td>
                        <td style={{ padding: '5px 10px' }}>{v(c.responded)}</td>
                        <td style={{ padding: '5px 10px' }}>{v(c.userResponded)}</td>
                        <td style={{ padding: '5px 10px' }}>{ts(c.lastRcvMsgTime)}</td>
                        <td style={{ padding: '5px 10px' }}>{ts(c.lastSendMsgTime)}</td>
                        <td style={{ padding: '5px 10px', color: rcvGtS ? 'var(--red)' : 'var(--green)' }}>{rcvGtS ? 'sim' : 'não'}</td>
                        <td style={{ padding: '5px 10px', color: pend ? 'var(--red)' : 'var(--green)', fontWeight: pend ? 600 : undefined }}>{pend ? 'SIM' : 'não'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* KPI Modal */}
      {kpiModal && (
        <div className="sr-modal-overlay" onClick={e => e.target === e.currentTarget && setKpiModal(null)}>
          <div className="sr-modal">
            <KpiModalContent />
          </div>
        </div>
      )}
    </div>
  )
}

