'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Eye, MessageSquare, Shield, ShieldAlert, ShieldCheck, ShieldX,
  ChevronDown, TrendingUp, Newspaper, Database, Calendar, BarChart3,
  AlertTriangle, CheckCircle2, XCircle, Activity, Hash, Link2,
} from 'lucide-react'
import {
  USER_ENTRIES, EXTERNAL_SIGNALS, DEPTH_CARD_EXAMPLES,
  DEPTH_LABELS, CARD_TYPE_LABELS, DEPTH_ALLOWED_CARDS, ENTRY_SOURCE_LABELS,
} from '../../data/card-engine'
import type { AssetDepth, UserEntry, DepthCard, ExternalSignal } from '../../data/types'
import BlurFade from '../ui/BlurFade'

type EngineView = 'entries' | 'signals' | 'cards'

const SIGNAL_ICONS: Record<string, typeof Newspaper> = {
  news: Newspaper,
  data: Database,
  event: Calendar,
  sentiment: BarChart3,
}

function DepthBadge({ depth }: { depth: AssetDepth }) {
  const info = DEPTH_LABELS[depth]
  return (
    <span className="ce-depth-badge" style={{ color: info.color, background: info.bg }}>
      {info.label}
    </span>
  )
}

function DepthMeter({ depth }: { depth: AssetDepth }) {
  const level = depth === 'shallow' ? 1 : depth === 'medium' ? 2 : 3
  return (
    <div className="ce-depth-meter">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`ce-depth-bar ${i <= level ? 'filled' : ''}`}
          style={{
            background: i <= level ? DEPTH_LABELS[depth].color : 'rgba(0,0,0,.06)',
            height: `${8 + i * 6}px`,
          }}
        />
      ))}
    </div>
  )
}

function SourceBadge({ source }: { source: UserEntry['source'] }) {
  const colors: Record<string, { color: string; bg: string }> = {
    behavior: { color: '#2563EB', bg: '#EFF6FF' },
    conversation: { color: '#059669', bg: '#ECFDF5' },
    both: { color: '#7C3AED', bg: '#F3EAFA' },
  }
  const c = colors[source]
  return (
    <span className="ce-source-badge" style={{ color: c.color, background: c.bg }}>
      {ENTRY_SOURCE_LABELS[source]}
    </span>
  )
}

function EntryCard({ entry }: { entry: UserEntry }) {
  const [expanded, setExpanded] = useState(false)
  const info = DEPTH_LABELS[entry.depth]
  const assocEntries = USER_ENTRIES.filter((e) => entry.associations.includes(e.id))

  return (
    <div className={`ce-asset-card depth-${entry.depth}`}>
      <div className="ce-asset-header" onClick={() => setExpanded(!expanded)}>
        <div className="ce-asset-main">
          <div className="ce-asset-name-row">
            <span className="ce-asset-name">{entry.name}</span>
            <SourceBadge source={entry.source} />
          </div>
          <DepthBadge depth={entry.depth} />
        </div>
        <div className="ce-asset-meta">
          <DepthMeter depth={entry.depth} />
          <ChevronDown size={14} className={`ce-chevron ${expanded ? 'open' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="ce-asset-detail"
          >
            <div className="ce-detail-inner">
              <div className="ce-reason">
                <Shield size={12} />
                <span>{entry.depthReason}</span>
              </div>

              {assocEntries.length > 0 && (
                <div className="ce-assoc-group">
                  <div className="ce-signal-label">
                    <Link2 size={11} />
                    关联词条
                  </div>
                  <div className="ce-assoc-tags">
                    {assocEntries.map((ae) => (
                      <span key={ae.id} className="ce-assoc-tag">
                        <DepthBadge depth={ae.depth} />
                        {ae.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entry.behaviorSignals.length > 0 && (
                <div className="ce-signal-group">
                  <div className="ce-signal-label">
                    <Eye size={11} />
                    行为埋点
                  </div>
                  {entry.behaviorSignals.map((s, i) => (
                    <div key={i} className="ce-signal-item">
                      <span className="ce-signal-time">{s.timestamp}</span>
                      <span>{s.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {entry.conversationSignals.length > 0 && (
                <div className="ce-signal-group">
                  <div className="ce-signal-label">
                    <MessageSquare size={11} />
                    对话内容
                  </div>
                  {entry.conversationSignals.map((s, i) => (
                    <div key={i} className="ce-conv-item">
                      <div className="ce-conv-quote">{s.quote}</div>
                      <div className="ce-conv-meta">
                        <span>→ {s.inferredIntent}</span>
                        <DepthBadge depth={s.depthContribution} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="ce-rules-box">
                <div className="ce-rules-label">{info.description}深度可生成：</div>
                <div className="ce-rules-list">
                  {DEPTH_ALLOWED_CARDS[entry.depth].can.map((c, i) => (
                    <div key={i} className="ce-rule ok">
                      <CheckCircle2 size={11} />
                      <span>{c}</span>
                    </div>
                  ))}
                  {DEPTH_ALLOWED_CARDS[entry.depth].cannot.map((c, i) => (
                    <div key={i} className="ce-rule no">
                      <XCircle size={11} />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExternalSignalCard({ signal }: { signal: ExternalSignal }) {
  const Icon = SIGNAL_ICONS[signal.category] || Newspaper
  return (
    <div className="ce-ext-card">
      <div className="ce-ext-head">
        <div className={`ce-ext-icon impact-${signal.impact}`}>
          <Icon size={13} />
        </div>
        <div className="ce-ext-info">
          <span className="ce-ext-title">{signal.title}</span>
          <div className="ce-ext-meta">
            <span className="ce-ext-source">{signal.source}</span>
            <span className="ce-ext-time">{signal.timestamp}</span>
          </div>
        </div>
      </div>
      <div className="ce-ext-assets">
        {signal.relevantEntries.map((a) => (
          <span key={a} className="ce-ext-asset-tag">{a}</span>
        ))}
      </div>
    </div>
  )
}

function DepthCardComponent({ card }: { card: DepthCard }) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className={`ce-card accent-${card.accent} ${card.allowed ? '' : 'is-violation'}`}>
      {!card.allowed && (
        <div className="ce-violation-banner">
          <ShieldX size={13} />
          <span>违规示例 — 实际系统应拦截</span>
        </div>
      )}

      <div className="ce-card-top">
        <div className="ce-card-badges">
          <DepthBadge depth={card.depth} />
          <span className="ce-card-type">{CARD_TYPE_LABELS[card.cardType]}</span>
          <span className="ce-card-asset">
            <Hash size={9} />
            {card.entryName}
          </span>
        </div>
      </div>

      <h3 className="ce-card-title">{card.title}</h3>
      <p className="ce-card-body">{card.body}</p>

      {card.dataPoints && card.dataPoints.length > 0 && (
        <div className="ce-card-data">
          {card.dataPoints.map((dp, i) => (
            <div key={i} className={`ce-data-point tone-${dp.tone}`}>
              <span className="ce-dp-label">{dp.label}</span>
              <strong>{dp.value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="ce-card-tags">
        {card.tags.map((t) => (
          <span key={t} className={`ce-tag ${!card.allowed ? 'bad' : ''}`}>{t}</span>
        ))}
      </div>

      <button className="ce-detail-toggle" onClick={() => setShowDetail(!showDetail)}>
        {showDetail ? '收起生成逻辑' : '查看生成逻辑'}
        <ChevronDown size={13} className={showDetail ? 'open' : ''} />
      </button>

      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="ce-gen-logic">
              <div className="ce-logic-row">
                <Activity size={12} />
                <div>
                  <div className="ce-logic-label">生成依据</div>
                  <div className="ce-logic-text">{card.generationRationale}</div>
                </div>
              </div>
              <div className={`ce-logic-row ${card.allowed ? 'check-ok' : 'check-fail'}`}>
                {card.allowed ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                <div>
                  <div className="ce-logic-label">边界自检</div>
                  <div className="ce-logic-text">{card.boundaryCheck}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DepthRulesOverview() {
  const depths: AssetDepth[] = ['shallow', 'medium', 'deep']
  return (
    <div className="ce-rules-overview">
      {depths.map((d) => {
        const info = DEPTH_LABELS[d]
        return (
          <div key={d} className="ce-rule-col" style={{ borderColor: info.color }}>
            <div className="ce-rule-head" style={{ background: info.bg }}>
              <span className="ce-rule-depth" style={{ color: info.color }}>{info.label}</span>
              <span className="ce-rule-desc">{info.description}</span>
            </div>
            <div className="ce-rule-body">
              {DEPTH_ALLOWED_CARDS[d].can.map((c, i) => (
                <div key={`can-${i}`} className="ce-rule ok"><CheckCircle2 size={10} /><span>{c}</span></div>
              ))}
              {DEPTH_ALLOWED_CARDS[d].cannot.map((c, i) => (
                <div key={`no-${i}`} className="ce-rule no"><XCircle size={10} /><span>{c}</span></div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CardEngine() {
  const [view, setView] = useState<EngineView>('entries')
  const [depthFilter, setDepthFilter] = useState<AssetDepth | 'all'>('all')

  const views: { key: EngineView; label: string }[] = [
    { key: 'entries', label: '用户词条' },
    { key: 'signals', label: '外部信号' },
    { key: 'cards', label: '卡片案例' },
  ]

  const filteredEntries = depthFilter === 'all'
    ? USER_ENTRIES
    : USER_ENTRIES.filter((e) => e.depth === depthFilter)

  const filteredCards = depthFilter === 'all'
    ? DEPTH_CARD_EXAMPLES
    : DEPTH_CARD_EXAMPLES.filter((c) => c.depth === depthFilter)

  return (
    <div className="card-engine">
      <BlurFade delay={0.04}>
        <div className="ce-header">
          <div className="ce-header-text">
            <h3 className="ce-main-title">卡片生成引擎</h3>
            <span className="ce-main-sub">用户词条深度 × 外部信号 → 卡片内容边界</span>
          </div>
          <div className="ce-header-badge">
            <AlertTriangle size={12} />
            <span>宁可低估</span>
          </div>
        </div>
      </BlurFade>

      <div className="ce-view-tabs">
        {views.map((v) => (
          <button
            key={v.key}
            className={`ce-view-tab ${view === v.key ? 'active' : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="ce-body">
        <AnimatePresence mode="wait">
          {view === 'entries' && (
            <motion.div
              key="entries"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <BlurFade delay={0.04}>
                <DepthRulesOverview />
              </BlurFade>

              <div className="ce-depth-filter" style={{ marginTop: 10 }}>
                {(['all', 'shallow', 'medium', 'deep'] as const).map((d) => (
                  <button
                    key={d}
                    className={`ce-filter-btn ${depthFilter === d ? 'active' : ''}`}
                    onClick={() => setDepthFilter(d)}
                  >
                    {d === 'all' ? '全部' : DEPTH_LABELS[d].label + ' · ' + DEPTH_LABELS[d].description}
                  </button>
                ))}
              </div>

              <div className="ce-section-label">
                <TrendingUp size={13} />
                用户词条（{filteredEntries.length} 个）
              </div>

              {filteredEntries.map((entry, i) => (
                <BlurFade key={entry.id} delay={0.06 + i * 0.04} offset={8}>
                  <EntryCard entry={entry} />
                </BlurFade>
              ))}

              <BlurFade delay={0.3}>
                <div className="ce-boundary-summary">
                  <div className="ce-boundary-title">
                    <Shield size={14} />
                    两条边界
                  </div>
                  <div className="ce-boundary-item">
                    <strong>边界一：不预设持有</strong>
                    <p>埋点信号最多抬到"中"，只有对话中明说才到"深"。区分"看好"和"持有"。</p>
                  </div>
                  <div className="ce-boundary-item">
                    <strong>边界二：不替用户决定</strong>
                    <p>禁止可直接照做的指令。摊开决策要素、选项代价，把判断留给用户。</p>
                  </div>
                </div>
              </BlurFade>
            </motion.div>
          )}

          {view === 'signals' && (
            <motion.div
              key="signals"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <div className="ce-section-label">
                <Database size={13} />
                可用外部信号（{EXTERNAL_SIGNALS.length} 条）
              </div>
              <div className="ce-signal-legend">
                <span className="ce-sl-item"><span className="ce-sl-dot impact-positive" />利好</span>
                <span className="ce-sl-item"><span className="ce-sl-dot impact-negative" />利空</span>
                <span className="ce-sl-item"><span className="ce-sl-dot impact-neutral" />中性</span>
              </div>
              {EXTERNAL_SIGNALS.map((sig, i) => (
                <BlurFade key={sig.id} delay={0.04 + i * 0.05} offset={8}>
                  <ExternalSignalCard signal={sig} />
                </BlurFade>
              ))}

              <BlurFade delay={0.4}>
                <div className="ce-signal-flow">
                  <div className="ce-flow-title">信号合流逻辑</div>
                  <div className="ce-flow-diagram">
                    <div className="ce-flow-node source">行为埋点</div>
                    <div className="ce-flow-arrow">→</div>
                    <div className="ce-flow-node center">AI 中枢判断</div>
                    <div className="ce-flow-arrow">→</div>
                    <div className="ce-flow-node output">生成卡片</div>
                  </div>
                  <div className="ce-flow-diagram">
                    <div className="ce-flow-node source">对话内容</div>
                    <div className="ce-flow-arrow">↗</div>
                    <div className="ce-flow-node note">词条深度 + 外部信号 = 卡片内容边界</div>
                  </div>
                </div>
              </BlurFade>
            </motion.div>
          )}

          {view === 'cards' && (
            <motion.div
              key="cards"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <div className="ce-depth-filter">
                {(['all', 'shallow', 'medium', 'deep'] as const).map((d) => (
                  <button
                    key={d}
                    className={`ce-filter-btn ${depthFilter === d ? 'active' : ''}`}
                    onClick={() => setDepthFilter(d)}
                  >
                    {d === 'all' ? '全部' : DEPTH_LABELS[d].label + ' · ' + DEPTH_LABELS[d].description}
                  </button>
                ))}
              </div>

              <div className="ce-cards-list">
                {filteredCards.map((card, i) => (
                  <BlurFade key={card.id} delay={0.04 + i * 0.06} offset={10}>
                    <DepthCardComponent card={card} />
                  </BlurFade>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
