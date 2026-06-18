'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bookmark,
  ChevronRight,
  Eye,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Newspaper,
  Database,
  Calendar,
  GraduationCap,
  BarChart3,
  Clock,
  Zap,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  Calculator,
  DollarSign,
  X,
  PieChart,
} from 'lucide-react'
import { useAppStore } from '../../store/app-store'
import { CATEGORY_GROUPS, CALENDAR_EVENTS, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../../data/feed-cards'
import type { FeedCard, CategoryGroup, CalendarEvent } from '../../data/feed-cards'
import type { GenUITopicCard, StockIndex, TopicTone, PortfolioItem } from '../../data/types'
import BlurFade from '../ui/BlurFade'

/* ========== Shared helpers ========== */

function Sparkline({ data, color, width = 72, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`
  return (
    <svg width={width} height={height} className="sparkline">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MiniPie({ data, size = 44 }: { data: { value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const r = size * 0.4
  const cx = size / 2
  const cy = size / 2
  let angle = -Math.PI / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const sweep = (d.value / total) * 2 * Math.PI
        const x1 = cx + r * Math.cos(angle)
        const y1 = cy + r * Math.sin(angle)
        angle += sweep
        const x2 = cx + r * Math.cos(angle)
        const y2 = cy + r * Math.sin(angle)
        const large = sweep > Math.PI ? 1 : 0
        return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`} fill={d.color} />
      })}
    </svg>
  )
}

function MiniIndex({ idx }: { idx: StockIndex }) {
  const isUp = idx.change >= 0
  const color = isUp ? '#10B981' : '#EF4444'
  return (
    <div className="fc-mini-index">
      <div className="fc-mi-top">
        <span className="fc-mi-name">{idx.name}</span>
        <span className="fc-mi-pct" style={{ color }}>{isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%</span>
      </div>
      <div className="fc-mi-val">{idx.value.toFixed(2)}</div>
      <Sparkline data={idx.sparkline} color={color} />
    </div>
  )
}

/* ========== Detail Popup ========== */

function DetailPopup({ open, title, icon, onClose, children }: {
  open: boolean; title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="dp-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="dp-header">
              <button className="dp-back" onClick={onClose}>
                <ArrowLeft size={18} />
              </button>
              <div className="dp-title-row">
                {icon}
                <span className="dp-title">{title}</span>
              </div>
            </div>
            <div className="dp-content">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ========== Calendar (inline, 2-col) ========== */

const CALENDAR_WEEKS = [
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
]
const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const TODAY = 17

function getEventsForDay(day: number): CalendarEvent[] {
  const dateStr = `06/${day.toString().padStart(2, '0')}`
  return CALENDAR_EVENTS.filter((e) => e.date === dateStr)
}

const EVENT_DAYS = [...new Set(CALENDAR_EVENTS.map((e) => parseInt(e.date.split('/')[1])))].sort((a, b) => a - b)

function CalendarCard() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const selectedEvents = selectedDay !== null ? getEventsForDay(selectedDay) : []

  const handleDateClick = (day: number) => {
    const events = getEventsForDay(day)
    if (events.length > 0) {
      setSelectedDay(day)
      setIsFlipped(true)
    }
  }

  const navigateDay = (direction: -1 | 1) => {
    if (selectedDay === null) return
    const idx = EVENT_DAYS.indexOf(selectedDay) + direction
    if (idx >= 0 && idx < EVENT_DAYS.length) setSelectedDay(EVENT_DAYS[idx])
  }

  const canGoPrev = selectedDay !== null && EVENT_DAYS.indexOf(selectedDay) > 0
  const canGoNext = selectedDay !== null && EVENT_DAYS.indexOf(selectedDay) < EVENT_DAYS.length - 1

  return (
    <div className="prev-card span-2 cal-prev-card">
      <div className="prev-card-head">
        <Calendar size={14} />
        <span>日历</span>
        <div className="cal-view-toggle">
          <button className={`cal-view-btn ${!isFlipped ? 'active' : ''}`} onClick={() => setIsFlipped(false)}>日历视图</button>
          <button className={`cal-view-btn ${isFlipped ? 'active' : ''}`} onClick={() => { if (!isFlipped) { setIsFlipped(true); if (selectedDay === null) setSelectedDay(EVENT_DAYS[0] ?? TODAY) } }}>列表视图</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isFlipped ? (
          <motion.div key="front" initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: 90, opacity: 0 }} transition={{ duration: 0.3 }} style={{ transformStyle: 'preserve-3d', perspective: 800 }}>
            <div className="cal-month-label">2026 年 6 月</div>
            <div className="cal-grid">
              <div className="cal-day-headers">
                {DAY_LABELS.map((d) => <span key={d} className="cal-day-header">{d}</span>)}
              </div>
              {CALENDAR_WEEKS.map((week, wi) => (
                <div key={wi} className="cal-week">
                  {week.map((day) => {
                    const events = getEventsForDay(day)
                    const hasEvents = events.length > 0
                    const eventTypes = [...new Set(events.map((e) => e.type))]
                    return (
                      <button key={day} className={`cal-cell ${day === TODAY ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`} onClick={() => handleDateClick(day)} disabled={!hasEvents}>
                        <span className="cal-day-num">{day}</span>
                        {hasEvents && (
                          <div className="cal-event-dots">
                            {eventTypes.map((t) => <span key={t} className="cal-event-dot" style={{ background: EVENT_TYPE_COLORS[t] }} />)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="cal-legend">
              {(Object.keys(EVENT_TYPE_COLORS) as CalendarEvent['type'][]).map((t) => (
                <span key={t} className="cal-legend-item">
                  <span className="cal-legend-dot" style={{ background: EVENT_TYPE_COLORS[t] }} />
                  {EVENT_TYPE_LABELS[t]}
                </span>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key={`back-${selectedDay}`} initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: 90, opacity: 0 }} transition={{ duration: 0.3 }} style={{ transformStyle: 'preserve-3d', perspective: 800 }}>
            <div className="cal-date-nav">
              <button className="cal-nav-arrow" disabled={!canGoPrev} onClick={() => navigateDay(-1)}><ChevronLeft size={16} /></button>
              <span className="cal-selected-date">6 月 {selectedDay} 日<span className="cal-weekday"> · 周{DAY_LABELS[(((selectedDay! - 15) % 7) + 7) % 7]}</span></span>
              <button className="cal-nav-arrow" disabled={!canGoNext} onClick={() => navigateDay(1)}><ChevronRight size={16} /></button>
            </div>
            <div className="cal-event-list">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="cal-event-item">
                  <div className="cal-event-type-bar" style={{ background: EVENT_TYPE_COLORS[ev.type] }} />
                  <div className="cal-event-content">
                    <div className="cal-event-top">
                      <span className="cal-event-title">{ev.title}</span>
                      <span className="cal-event-type-label" style={{ color: EVENT_TYPE_COLORS[ev.type], background: `${EVENT_TYPE_COLORS[ev.type]}15` }}>{EVENT_TYPE_LABELS[ev.type]}</span>
                    </div>
                    {ev.time && <span className="cal-event-time">{ev.time}</span>}
                    <p className="cal-event-desc">{ev.description}</p>
                    {ev.tags && (
                      <div className="cal-event-tags">
                        {ev.tags.map((t) => <span key={t} className="fc-tag">{t}</span>)}
                        {ev.relatedEntries?.map((a) => <span key={a} className="fc-tag asset">{a}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ========== News Detail ========== */

function NewsDetail({ cards }: { cards: FeedCard[] }) {
  return (
    <div className="detail-news">
      {cards.map((card) => {
        const impactColor = card.impact === 'positive' ? '#10B981' : card.impact === 'negative' ? '#EF4444' : '#8B5CF6'
        return (
          <div key={card.id} className="dn-card">
            <div className="dn-impact" style={{ background: impactColor }} />
            <div className="dn-body">
              <h4 className="dn-title">{card.title}</h4>
              <div className="dn-meta">
                <span>{card.source || card.topic}</span>
                <span>{card.timestamp}</span>
              </div>
              {card.body && <p className="dn-text">{card.body}</p>}
              {card.dataPoints && card.dataPoints.length > 0 && (
                <div className="fc-data-row" style={{ marginTop: 6 }}>
                  {card.dataPoints.map((dp, i) => (
                    <div key={i} className={`fc-dp tone-${dp.tone}`}>
                      <span className="fc-dp-label">{dp.label}</span>
                      <strong>{dp.value}</strong>
                    </div>
                  ))}
                </div>
              )}
              {card.tags && (
                <div className="fc-tags" style={{ marginTop: 6 }}>
                  {card.tags.map((t) => <span key={t} className="fc-tag">{t}</span>)}
                  {card.relatedEntries?.map((a) => <span key={a} className="fc-tag asset">{a}</span>)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ========== Market Detail ========== */

function MarketDetail({ cards, sectorCards }: { cards: FeedCard[]; sectorCards?: FeedCard[] }) {
  const marketCard = cards.find((c) => c.type === 'market-overview')
  const sectorCard = sectorCards?.find((c) => c.type === 'sector-heat')
  return (
    <div className="detail-market">
      {marketCard?.indices && (
        <>
          <div className="dm-spotlight-label">今日行情</div>
          <div className="fc-indices-grid">
            {marketCard.indices.map((idx) => <MiniIndex key={idx.code} idx={idx} />)}
          </div>
        </>
      )}
      {sectorCard?.sectors && (
        <>
          <div className="dm-spotlight-label" style={{ marginTop: 16 }}>板块热度</div>
          <div className="fc-sectors-grid">
            {sectorCard.sectors.map((s) => {
              const isUp = s.change >= 0
              return (
                <div key={s.name} className="fc-sector-chip" style={{
                  background: isUp
                    ? `rgba(16,185,129,${Math.min(Math.abs(s.change) / 8, 0.28)})`
                    : `rgba(239,68,68,${Math.min(Math.abs(s.change) / 8, 0.28)})`,
                }}>
                  <span className="fc-sector-name">{s.name}</span>
                  <span className="fc-sector-chg" style={{ color: isUp ? '#10B981' : '#EF4444' }}>
                    {isUp ? '+' : ''}{s.change.toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
          {sectorCard.body && <p className="fc-body" style={{ marginTop: 10 }}>{sectorCard.body}</p>}
        </>
      )}
    </div>
  )
}

/* ========== Portfolio Detail ========== */

function PortfolioDetail({ card }: { card: FeedCard }) {
  if (!card.portfolio) return null
  const total = card.portfolio.reduce((s, p) => s + p.shares * p.price, 0)
  const totalGain = card.portfolio.reduce((s, p) => s + p.shares * p.change, 0)

  return (
    <div className="detail-portfolio">
      <div className="ph-card" style={{ margin: 0 }}>
        <div className="ph-header">
          <div className="ph-total-row">
            <div>
              <span className="ph-label">持仓总市值</span>
              <span className="ph-value">¥{total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={`ph-gain ${totalGain >= 0 ? 'up' : 'down'}`}>
              今日 {totalGain >= 0 ? '+' : ''}¥{totalGain.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="ph-positions">
          {card.portfolio.map((p) => {
            const isUp = p.change >= 0
            const positionGain = p.shares * p.change
            return (
              <div key={p.symbol} className="ph-stock-row">
                <div className="ph-stock-left">
                  <span className="ph-stock-color" style={{ background: p.color }} />
                  <div className="ph-stock-info">
                    <span className="ph-stock-name">{p.name}</span>
                    <span className="ph-stock-shares">{p.shares} 股 · {p.symbol}</span>
                  </div>
                </div>
                <div className="ph-stock-right">
                  <span className="ph-stock-price">¥{p.price.toFixed(2)}</span>
                  <span className={`ph-stock-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '+' : ''}{p.changePercent.toFixed(2)}%
                    <span className="ph-stock-pnl">{isUp ? '+' : ''}¥{positionGain.toFixed(0)}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="ph-bar">
          {card.portfolio.map((p) => (
            <div key={p.symbol} className="ph-bar-seg" style={{ width: `${(p.shares * p.price / total) * 100}%`, background: p.color }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========== Learn Detail ========== */

function LearnDetail({ cards }: { cards: FeedCard[] }) {
  return (
    <div className="detail-learn">
      {cards.map((card) => (
        <div key={card.id} className={`fc-card accent-${card.accent}`} style={{ marginBottom: 10 }}>
          <h3 className="fc-title">{card.title}</h3>
          {card.body && <p className="fc-body">{card.body}</p>}
          {card.tags && (
            <div className="fc-tags" style={{ marginTop: 6 }}>
              {card.tags.map((t) => <span key={t} className="fc-tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ========== Data Detail ========== */

function DataDetail({ cards }: { cards: FeedCard[] }) {
  return (
    <div className="detail-data">
      {cards.map((card) => (
        <div key={card.id} className={`fc-card accent-${card.accent}`} style={{ marginBottom: 10 }}>
          <h3 className="fc-title">{card.title}</h3>
          {card.body && <p className="fc-body">{card.body}</p>}
          {card.dataPoints && card.dataPoints.length > 0 && (
            <div className="fc-data-row" style={{ marginTop: 6 }}>
              {card.dataPoints.map((dp, i) => (
                <div key={i} className={`fc-dp tone-${dp.tone}`}>
                  <span className="fc-dp-label">{dp.label}</span>
                  <strong>{dp.value}</strong>
                </div>
              ))}
            </div>
          )}
          {card.tags && (
            <div className="fc-tags" style={{ marginTop: 6 }}>
              {card.tags.map((t) => <span key={t} className="fc-tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ========== Calculator ========== */

type CalcScenario = 'fund-buy' | 'fund-redeem' | 'dca' | 'early-repay' | 'dividend-tax'

const CALC_SCENARIOS: { key: CalcScenario; label: string }[] = [
  { key: 'fund-buy', label: '申购成本' },
  { key: 'fund-redeem', label: '赎回费用' },
  { key: 'dca', label: '定投测算' },
  { key: 'early-repay', label: '提前还贷' },
  { key: 'dividend-tax', label: '分红税费' },
]

function CalcInput({ label, value, onChange, suffix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string
}) {
  return (
    <div className="calc-field">
      <label className="calc-label">{label}</label>
      <div className="calc-input-wrap">
        <input type="number" className="calc-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || '0'} />
        {suffix && <span className="calc-suffix">{suffix}</span>}
      </div>
    </div>
  )
}

function CalcResult({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`calc-result-item ${highlight ? 'highlight' : ''}`}>
      <span className="calc-result-label">{label}</span>
      <span className="calc-result-value">{value}</span>
    </div>
  )
}

function FundBuyCalc() {
  const [amount, setAmount] = useState('100000')
  const [subFee, setSubFee] = useState('0.15')
  const [mgmtFee, setMgmtFee] = useState('1.2')
  const [custFee, setCustFee] = useState('0.1')
  const a = parseFloat(amount) || 0, sf = parseFloat(subFee) || 0, mf = parseFloat(mgmtFee) || 0, cf = parseFloat(custFee) || 0
  const subCost = a * sf / 100, annualMgmt = a * mf / 100, annualCust = a * cf / 100
  return (
    <>
      <div className="calc-inputs">
        <CalcInput label="投资金额" value={amount} onChange={setAmount} suffix="元" />
        <CalcInput label="申购费率" value={subFee} onChange={setSubFee} suffix="%" />
        <CalcInput label="管理费率(年)" value={mgmtFee} onChange={setMgmtFee} suffix="%" />
        <CalcInput label="托管费率(年)" value={custFee} onChange={setCustFee} suffix="%" />
      </div>
      <div className="calc-results">
        <div className="calc-formula">申购费 {sf}% + 管理费 {mf}%/年 + 托管费 {cf}%/年</div>
        <CalcResult label="申购费" value={`¥${fmt(subCost)}`} />
        <CalcResult label="年管理费" value={`¥${fmt(annualMgmt)}`} />
        <CalcResult label="首年总成本" value={`¥${fmt(subCost + annualMgmt + annualCust)}`} highlight />
      </div>
      <div className="calc-tip"><span className="calc-tip-icon">💡</span><span>选择 C 类份额可免申购费，部分渠道申购费可打一折</span></div>
    </>
  )
}

function FundRedeemCalc() {
  const [amount, setAmount] = useState('100000')
  const [days, setDays] = useState('30')
  const a = parseFloat(amount) || 0, d = parseInt(days) || 0
  let rate = 0, tier = ''
  if (d < 7) { rate = 1.5; tier = '< 7 天' } else if (d < 365) { rate = 0.5; tier = '7–365 天' } else if (d < 730) { rate = 0.25; tier = '1–2 年' } else { rate = 0; tier = '≥ 2 年' }
  return (
    <>
      <div className="calc-inputs">
        <CalcInput label="赎回金额" value={amount} onChange={setAmount} suffix="元" />
        <CalcInput label="持有天数" value={days} onChange={setDays} suffix="天" />
      </div>
      <div className="calc-results">
        <CalcResult label="费率档位" value={`${tier}（${rate}%）`} />
        <CalcResult label="赎回费用" value={`¥${fmt(a * rate / 100)}`} highlight />
      </div>
      <div className="calc-tiers">
        <div className="calc-tier-title">费率阶梯</div>
        {[{ range: '< 7 天', r: '1.50%', warn: true }, { range: '7–365 天', r: '0.50%' }, { range: '1–2 年', r: '0.25%' }, { range: '≥ 2 年', r: '0.00%', good: true }].map((t) => (
          <div key={t.range} className={`calc-tier-row ${t.range === tier ? 'active' : ''}`}>
            <span>{t.range}</span>
            <span style={{ color: t.warn ? '#EF4444' : t.good ? '#10B981' : undefined, fontWeight: 800 }}>{t.r}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function DcaCalc() {
  const [monthly, setMonthly] = useState('2000')
  const [rate, setRate] = useState('8')
  const [years, setYears] = useState('5')
  const m = parseFloat(monthly) || 0, r = (parseFloat(rate) || 0) / 100, y = parseInt(years) || 0
  const n = y * 12, mr = r / 12, totalIn = m * n
  const fv = mr > 0 ? m * ((Math.pow(1 + mr, n) - 1) / mr) * (1 + mr) : totalIn
  return (
    <>
      <div className="calc-inputs">
        <CalcInput label="每月定投" value={monthly} onChange={setMonthly} suffix="元" />
        <CalcInput label="预期年化" value={rate} onChange={setRate} suffix="%" />
        <CalcInput label="投资年数" value={years} onChange={setYears} suffix="年" />
      </div>
      <div className="calc-results">
        <CalcResult label="总投入" value={`¥${fmt(totalIn)}`} />
        <CalcResult label="预期终值" value={`¥${fmt(fv)}`} highlight />
        <CalcResult label="预期收益" value={`¥${fmt(fv - totalIn)}`} />
        <CalcResult label="收益率" value={`${totalIn > 0 ? ((fv - totalIn) / totalIn * 100).toFixed(1) : '0'}%`} />
      </div>
      <div className="calc-tip"><span className="calc-tip-icon">💡</span><span>定投摊平成本，适合长期持有。实际收益受市场波动影响</span></div>
    </>
  )
}

function EarlyRepayCalc() {
  const [principal, setPrincipal] = useState('500000')
  const [rate, setRate] = useState('4.2')
  const [months, setMonths] = useState('240')
  const [prepay, setPrepay] = useState('100000')
  const p = parseFloat(principal) || 0, r = (parseFloat(rate) || 0) / 100 / 12, n = parseInt(months) || 0, pp = parseFloat(prepay) || 0
  let mBefore = 0, mAfter = 0
  if (r > 0 && n > 0) mBefore = p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  const np = Math.max(p - pp, 0)
  if (r > 0 && n > 0 && np > 0) mAfter = np * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  const saved = (mBefore * n - p) - (mAfter * n - np)
  return (
    <>
      <div className="calc-inputs">
        <CalcInput label="贷款余额" value={principal} onChange={setPrincipal} suffix="元" />
        <CalcInput label="年利率" value={rate} onChange={setRate} suffix="%" />
        <CalcInput label="剩余月数" value={months} onChange={setMonths} suffix="月" />
        <CalcInput label="提前还款" value={prepay} onChange={setPrepay} suffix="元" />
      </div>
      <div className="calc-results">
        <CalcResult label="当前月供" value={`¥${fmt(mBefore)}`} />
        <CalcResult label="还款后月供" value={`¥${fmt(mAfter)}`} />
        <CalcResult label="节省利息" value={`¥${fmt(saved)}`} highlight />
      </div>
      <div className="calc-tip"><span className="calc-tip-icon">💡</span><span>等额本息前期利息占比高，越早还越省利息</span></div>
    </>
  )
}

function DividendTaxCalc() {
  const [shares, setShares] = useState('1000')
  const [div, setDiv] = useState('30.26')
  const [holdM, setHoldM] = useState('6')
  const [price, setPrice] = useState('1680')
  const s = parseInt(shares) || 0, d = parseFloat(div) || 0, h = parseInt(holdM) || 0, sp = parseFloat(price) || 0
  let taxRate = 0, label = ''
  if (h < 1) { taxRate = 20; label = '< 1 月' } else if (h <= 12) { taxRate = 10; label = '1–12 月' } else { taxRate = 0; label = '> 12 月' }
  const gross = s * d, tax = gross * taxRate / 100
  return (
    <>
      <div className="calc-inputs">
        <CalcInput label="持股数量" value={shares} onChange={setShares} suffix="股" />
        <CalcInput label="每股分红" value={div} onChange={setDiv} suffix="元" />
        <CalcInput label="持有月数" value={holdM} onChange={setHoldM} suffix="月" />
        <CalcInput label="当前股价" value={price} onChange={setPrice} suffix="元" />
      </div>
      <div className="calc-results">
        <CalcResult label="税前分红" value={`¥${fmt(gross)}`} />
        <CalcResult label={`个税(${label} ${taxRate}%)`} value={`-¥${fmt(tax)}`} />
        <CalcResult label="税后到手" value={`¥${fmt(gross - tax)}`} highlight />
        <CalcResult label="股息率" value={`${sp > 0 ? (d / sp * 100).toFixed(2) : '0'}%`} />
      </div>
      <div className="calc-tiers">
        <div className="calc-tier-title">持有时间与税率</div>
        {[{ range: '< 1 月', r: '20%', warn: true }, { range: '1–12 月', r: '10%' }, { range: '> 12 月', r: '0%', good: true }].map((t) => (
          <div key={t.range} className={`calc-tier-row ${t.range === label ? 'active' : ''}`}>
            <span>{t.range}</span>
            <span style={{ color: t.warn ? '#EF4444' : t.good ? '#10B981' : undefined, fontWeight: 800 }}>{t.r}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function CalculatorDetail() {
  const [scenario, setScenario] = useState<CalcScenario>('fund-buy')
  return (
    <div className="calc-card">
      <div className="calc-tabs">
        {CALC_SCENARIOS.map((s) => (
          <button key={s.key} className={`calc-tab ${scenario === s.key ? 'active' : ''}`} onClick={() => setScenario(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="calc-body">
        {scenario === 'fund-buy' && <FundBuyCalc />}
        {scenario === 'fund-redeem' && <FundRedeemCalc />}
        {scenario === 'dca' && <DcaCalc />}
        {scenario === 'early-repay' && <EarlyRepayCalc />}
        {scenario === 'dividend-tax' && <DividendTaxCalc />}
      </div>
    </div>
  )
}

/* ========== Main TopicSpace ========== */

type DetailView = 'news' | 'market' | 'learn' | 'portfolio' | 'data' | 'calculator' | null

export default function TopicSpace() {
  const [activeDetail, setActiveDetail] = useState<DetailView>(null)

  const newsGroup = CATEGORY_GROUPS.find((g) => g.key === 'news')
  const dataGroup = CATEGORY_GROUPS.find((g) => g.key === 'data')
  const learnGroup = CATEGORY_GROUPS.find((g) => g.key === 'learn')
  const sectorsGroup = CATEGORY_GROUPS.find((g) => g.key === 'sectors')
  const portfolioGroup = CATEGORY_GROUPS.find((g) => g.key === 'portfolio')

  const marketCard = portfolioGroup?.cards.find((c) => c.type === 'market-overview')
  const holdingsCard = portfolioGroup?.cards.find((c) => c.type === 'portfolio-summary')

  // Portfolio preview data
  const total = holdingsCard?.portfolio?.reduce((s, p) => s + p.shares * p.price, 0) || 0
  const totalGain = holdingsCard?.portfolio?.reduce((s, p) => s + p.shares * p.change, 0) || 0
  const pieData = holdingsCard?.portfolio?.map((p) => ({ value: p.shares * p.price, color: p.color })) || []

  // Market preview — top 2 indices
  const topIndices = marketCard?.indices?.slice(0, 2) || []

  // Sectors preview — top 3
  const sectorCard = sectorsGroup?.cards.find((c) => c.type === 'sector-heat')
  const topSectors = sectorCard?.sectors?.slice(0, 3) || []

  const detailTitle: Record<string, string> = {
    news: '资讯', market: '行情板块', learn: '科普',
    portfolio: '持仓', data: '数据', calculator: '成本计算器',
  }

  const detailIcons: Record<string, React.ReactNode> = {
    news: <Newspaper size={16} />, market: <TrendingUp size={16} />,
    learn: <GraduationCap size={16} />,
    portfolio: <Zap size={16} />, data: <Database size={16} />,
    calculator: <Calculator size={16} />,
  }

  return (
    <div className="topic-space">
      <BlurFade delay={0.05} direction="down" offset={10}>
        <div className="ts-header">
          <h2 className="ts-title">话题空间</h2>
          <span className="ts-subtitle">我帮你整理了今天的信息</span>
        </div>
      </BlurFade>

      <div className="ts-content">
        <div className="ts-grid">
          {/* Calendar — 2col, inline interactive */}
          <BlurFade delay={0.08} offset={10} className="span-2">
            <CalendarCard />
          </BlurFade>

          {/* Portfolio — 2col, right after calendar */}
          <BlurFade delay={0.12} offset={10} className="span-2">
            <div className="prev-card span-2" onClick={() => setActiveDetail('portfolio')}>
              <div className="prev-card-head">
                <Zap size={14} />
                <span>持仓</span>
              </div>
              <div className="prev-portfolio-row">
                <div className="prev-pf-numbers">
                  <div className={`prev-pf-gain ${totalGain >= 0 ? 'up' : 'down'}`}>
                    {totalGain >= 0 ? '+' : ''}¥{totalGain.toFixed(2)}
                  </div>
                  <div className="prev-pf-total">总市值 ¥{fmt(total)}</div>
                </div>
                <MiniPie data={pieData} size={52} />
              </div>
              <div className="prev-more">查看详情 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>

          {/* News — 1col */}
          <BlurFade delay={0.16} offset={10}>
            <div className="prev-card" onClick={() => setActiveDetail('news')}>
              <div className="prev-card-head">
                <Newspaper size={14} />
                <span>资讯</span>
              </div>
              <div className="prev-summary">我看你关注了不少领域，帮你搜集了 {newsGroup?.cards.length || 0} 条相关新闻</div>
              {newsGroup?.cards[0] && (
                <div className="prev-headline">{newsGroup.cards[0].title}</div>
              )}
              <div className="prev-more">查看全部 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>

          {/* Market + Sectors — 1col */}
          <BlurFade delay={0.20} offset={10}>
            <div className="prev-card" onClick={() => setActiveDetail('market')}>
              <div className="prev-card-head">
                <TrendingUp size={14} />
                <span>行情</span>
              </div>
              {topIndices.map((idx) => {
                const isUp = idx.change >= 0
                return (
                  <div key={idx.code} className="prev-index-row">
                    <span className="prev-idx-name">{idx.name}</span>
                    <span className="prev-idx-chg" style={{ color: isUp ? '#10B981' : '#EF4444' }}>
                      {isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%
                    </span>
                  </div>
                )
              })}
              {topSectors.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(139,92,246,.06)', marginTop: 4, paddingTop: 4 }}>
                  <div className="prev-card-head" style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                    <BarChart3 size={12} />
                    <span>板块</span>
                  </div>
                  {topSectors.map((s) => {
                    const isUp = s.change >= 0
                    return (
                      <div key={s.name} className="prev-index-row">
                        <span className="prev-idx-name">{s.name}</span>
                        <span className="prev-idx-chg" style={{ color: isUp ? '#10B981' : '#EF4444' }}>
                          {isUp ? '+' : ''}{s.change.toFixed(2)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="prev-more">查看全部 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>

          {/* Learn — 1col */}
          <BlurFade delay={0.24} offset={10}>
            <div className="prev-card" onClick={() => setActiveDetail('learn')}>
              <div className="prev-card-head">
                <GraduationCap size={14} />
                <span>科普</span>
              </div>
              <div className="prev-summary">你关注的话题有新科普，我整理了 {learnGroup?.cards.length || 0} 篇</div>
              {learnGroup?.cards[0] && (
                <div className="prev-headline">{learnGroup.cards[0].title}</div>
              )}
              <div className="prev-more">查看全部 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>

          {/* Data — 1col */}
          <BlurFade delay={0.28} offset={10}>
            <div className="prev-card" onClick={() => setActiveDetail('data')}>
              <div className="prev-card-head">
                <Database size={14} />
                <span>数据</span>
              </div>
              <div className="prev-summary">我帮你追踪了 {dataGroup?.cards.length || 0} 条数据变化</div>
              <div className="prev-more">查看全部 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>

          {/* Calculator — 1col */}
          <BlurFade delay={0.32} offset={10}>
            <div className="prev-card prev-card-amber" onClick={() => setActiveDetail('calculator')}>
              <div className="prev-card-head" style={{ color: '#D97706' }}>
                <Calculator size={14} />
                <span>计算器</span>
              </div>
              <div className="prev-summary">帮你快速算清投资账</div>
              <div className="prev-more" style={{ color: '#D97706' }}>打开计算器 <ChevronRight size={12} /></div>
            </div>
          </BlurFade>
        </div>
      </div>

      {/* Detail Popup */}
      <DetailPopup
        open={activeDetail !== null}
        title={activeDetail ? detailTitle[activeDetail] : ''}
        icon={activeDetail ? detailIcons[activeDetail] : undefined}
        onClose={() => setActiveDetail(null)}
      >
        {activeDetail === 'news' && newsGroup && <NewsDetail cards={newsGroup.cards} />}
        {activeDetail === 'market' && portfolioGroup && <MarketDetail cards={portfolioGroup.cards} sectorCards={sectorsGroup?.cards} />}
        {activeDetail === 'learn' && learnGroup && <LearnDetail cards={learnGroup.cards} />}
        {activeDetail === 'portfolio' && holdingsCard && <PortfolioDetail card={holdingsCard} />}
        {activeDetail === 'data' && dataGroup && <DataDetail cards={dataGroup.cards} />}
        {activeDetail === 'calculator' && <CalculatorDetail />}
      </DetailPopup>
    </div>
  )
}
