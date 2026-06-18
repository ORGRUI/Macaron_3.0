import type { TopicTone, StockIndex, PortfolioItem, MarketSector, FeedCategory } from './types'
import { STOCK_INDICES, PORTFOLIO, FINANCIAL_EVENTS, MARKET_SECTORS } from './finance'

// Calendar event types for the interactive calendar
export interface CalendarEvent {
  id: string
  date: string // 'MM/DD' format
  title: string
  time?: string
  type: 'action' | 'market' | 'risk' | 'data'
  description: string
  impact: TopicTone
  tags?: string[]
  relatedEntries?: string[]
}

export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ce-fed',
    date: '06/18',
    title: '美联储议息结果公布',
    time: '凌晨 2:00',
    type: 'market',
    description: '市场预期维持利率不变，关注点阵图指引。若表态偏鸽，有利于全球风险资产。',
    impact: 'neutral',
    tags: ['美联储', '利率'],
    relatedEntries: ['中国平安', '招商银行'],
  },
  {
    id: 'ce-mt-reg',
    date: '06/20',
    title: '茅台股权登记日',
    type: 'action',
    description: '每股派发现金红利 30.26 元，需在今日收盘前持有才有分红资格。',
    impact: 'positive',
    tags: ['分红', '登记日'],
    relatedEntries: ['贵州茅台'],
  },
  {
    id: 'ce-tariff',
    date: '06/20',
    title: '欧盟对华电动车关税二审公布',
    type: 'risk',
    description: '市场预期三种情景：维持、上调、或豁免降低。对新能源出口企业有直接影响。',
    impact: 'negative',
    tags: ['关税', '出口'],
    relatedEntries: ['比亚迪'],
  },
  {
    id: 'ce-expiry',
    date: '06/20',
    title: 'A 股期指交割日',
    type: 'risk',
    description: '股指期货合约到期，历史上交割周前两天市场波动率平均放大 15%。',
    impact: 'negative',
    tags: ['期指', '交割'],
  },
  {
    id: 'ce-mt-ex',
    date: '06/21',
    title: '茅台除权除息日',
    type: 'action',
    description: '除权后股价等额下调，长期优质公司通常能"填权"。',
    impact: 'neutral',
    tags: ['除权', '分红'],
    relatedEntries: ['贵州茅台'],
  },
  {
    id: 'ce-pa-reg',
    date: '06/22',
    title: '平安股权登记日',
    type: 'action',
    description: '每股派 0.93 元，需在今日收盘前持有才有分红资格。',
    impact: 'positive',
    tags: ['分红', '登记日'],
    relatedEntries: ['中国平安'],
  },
  {
    id: 'ce-macro',
    date: '06/22',
    title: '5 月经济数据集中公布',
    type: 'data',
    description: 'PMI、CPI 等宏观数据集中公布，多家券商预测 PMI 回升至 50.2-50.5。',
    impact: 'positive',
    tags: ['PMI', 'CPI'],
  },
  {
    id: 'ce-byd-meet',
    date: '06/25',
    title: '比亚迪股东大会',
    type: 'action',
    description: '关注业绩展望和海外扩张计划。',
    impact: 'neutral',
    tags: ['股东大会'],
    relatedEntries: ['比亚迪'],
  },
  {
    id: 'ce-ipo',
    date: '06/25',
    title: '科创板新股申购',
    type: 'market',
    description: '半导体设备龙头企业 IPO，发行价区间 45-52 元。',
    impact: 'neutral',
    tags: ['IPO', '半导体'],
  },
  {
    id: 'ce-report',
    date: '06/28',
    title: '半年报预告截止',
    type: 'data',
    description: '上市公司中报业绩预告密集期，我会帮你留意你持仓个股的表现。',
    impact: 'positive',
    tags: ['财报', '业绩'],
  },
]

// Event type color mapping
export const EVENT_TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  action: '#7C3AED',  // violet — things you need to do
  market: '#0EA5E9',  // sky blue — market events
  risk: '#EF4444',    // red — risk/warning
  data: '#F59E0B',    // amber — data releases
}

export const EVENT_TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  action: '需操作',
  market: '市场',
  risk: '风险',
  data: '数据',
}

export type FeedCardType =
  | 'market-overview'
  | 'sector-heat'
  | 'portfolio-summary'
  | 'stock-highlight'
  | 'calendar-event'
  | 'news'
  | 'concept'
  | 'data-insight'
  | 'topic-brief'
  | 'timing'

export interface FeedCard {
  id: string
  type: FeedCardType
  category: FeedCategory
  topic: string
  title: string
  accent: 'sage' | 'slate' | 'rose' | 'amber' | 'cyan' | 'violet'
  timestamp: string
  body?: string
  source?: string
  impact?: TopicTone
  tags?: string[]
  dataPoints?: { label: string; value: string; tone: TopicTone }[]
  indices?: StockIndex[]
  sectors?: MarketSector[]
  portfolio?: PortfolioItem[]
  eventDate?: string
  eventTag?: string
  relatedEntries?: string[]
  timelineItems?: string[]
}

export interface CategoryGroup {
  key: FeedCategory
  label: string
  icon: string
  cards: FeedCard[]
}

const ALL_CARDS: FeedCard[] = [
  // === NEWS category ===
  {
    id: 'fc-ai-brief',
    type: 'topic-brief',
    category: 'news',
    topic: '人工智能',
    title: '国产大模型竞赛加速：本周三家厂商发布新品',
    accent: 'violet',
    timestamp: '06/17 12:00',
    body: '百度文心、阿里通义、字节豆包在同一周密集发布新版模型。AI 板块整体涨 4.58%，算力需求推动 GPU 和光模块板块走强，AI 应用层的商业化落地成为下半年核心看点。',
    source: '综合整理',
    tags: ['大模型', '算力', '商业化'],
    relatedEntries: ['寒武纪', '中际旭创'],
  },
  {
    id: 'fc-news-ev',
    type: 'news',
    category: 'news',
    topic: '新能源汽车',
    title: '6 月上半月新能源车渗透率首破 52%',
    accent: 'sage',
    timestamp: '06/17 10:00',
    body: '中汽协数据显示，6 月上半月新能源乘用车零售渗透率达到 52.3%，创历史新高。比亚迪、吉利、长安位列销量前三。',
    source: '中汽协',
    impact: 'positive',
    tags: ['渗透率', '销量', '行业趋势'],
    relatedEntries: ['比亚迪', '宁德时代', '长安汽车'],
  },
  {
    id: 'fc-news-tariff',
    type: 'news',
    category: 'news',
    topic: '欧盟关税',
    title: '欧盟对华电动车关税二审结果将于 6/20 公布',
    accent: 'amber',
    timestamp: '06/17 07:30',
    body: '欧盟委员会将于 6 月 20 日公布对华电动车反补贴关税的二审结果。市场预期三种情景：维持、上调、或豁免降低。',
    source: '欧盟委员会',
    impact: 'negative',
    tags: ['关税', '出口', '贸易摩擦'],
    relatedEntries: ['比亚迪', '欧盟关税'],
  },
  {
    id: 'fc-news-flow',
    type: 'news',
    category: 'news',
    topic: '白酒',
    title: '白酒板块主力资金净流入 3.2 亿，连续 5 日流入',
    accent: 'sage',
    timestamp: '06/17 15:00',
    body: '白酒板块今日主力资金净流入 3.2 亿元，为连续第 5 个交易日净流入。分红季叠加消费旺季预期，机构资金持续加仓龙头。',
    source: '市场数据',
    impact: 'positive',
    tags: ['资金流', '主力', '白酒'],
    relatedEntries: ['贵州茅台', '五粮液', '泸州老窖'],
  },
  {
    id: 'fc-news-catl',
    type: 'news',
    category: 'news',
    topic: '宁德时代',
    title: '宁德时代获大众集团新一代电池平台订单',
    accent: 'sage',
    timestamp: '06/17 08:15',
    body: '财联社报道，宁德时代与大众集团达成新一代电池平台合作协议。订单涵盖 MEB+ 平台的 CTP 方案，预计 2026 年开始供货。',
    source: '财联社',
    impact: 'positive',
    tags: ['订单', '动力电池', '国际合作'],
    relatedEntries: ['宁德时代'],
  },
  {
    id: 'fc-news-mt-dividend',
    type: 'news',
    category: 'news',
    topic: '贵州茅台',
    title: '茅台 2025 年度分红方案落地：每股派 30.26 元',
    accent: 'amber',
    timestamp: '06/17 09:00',
    body: '贵州茅台公告 2025 年度分红方案，每股派发现金红利 30.26 元。股权登记日 6/20，除息日 6/21。机构分析认为分红率稳健，符合市场预期。',
    source: '贵州茅台公告',
    impact: 'positive',
    tags: ['分红', '白酒', '公告'],
    relatedEntries: ['贵州茅台'],
  },

  // === DATA category ===
  {
    id: 'fc-data-byd',
    type: 'data-insight',
    category: 'data',
    topic: '比亚迪',
    title: '比亚迪 6 月销量追踪',
    accent: 'sage',
    timestamp: '06/17 10:30',
    body: '中汽协数据。海外出口 2.1 万辆，创月度新高。',
    source: '中汽协',
    dataPoints: [
      { label: '月上半零售', value: '12.8万辆', tone: 'positive' },
      { label: '同比增速', value: '+18%', tone: 'positive' },
      { label: '海外出口', value: '2.1万辆', tone: 'positive' },
    ],
    tags: ['销量', '同比', '出口'],
    relatedEntries: ['比亚迪'],
  },
  {
    id: 'fc-data-mt-valuation',
    type: 'data-insight',
    category: 'data',
    topic: '贵州茅台',
    title: '茅台分红数据速览',
    accent: 'amber',
    timestamp: '06/17 09:00',
    source: '公告数据',
    dataPoints: [
      { label: '每股红利', value: '¥30.26', tone: 'positive' },
      { label: '股息率', value: '1.79%', tone: 'positive' },
      { label: '分红率', value: '52.3%', tone: 'neutral' },
    ],
    tags: ['分红', '股息率', '分红率'],
    relatedEntries: ['贵州茅台'],
  },
  {
    id: 'fc-data-pa',
    type: 'data-insight',
    category: 'data',
    topic: '中国平安',
    title: '平安分红数据速览',
    accent: 'slate',
    timestamp: '06/17 09:00',
    source: '公告数据',
    dataPoints: [
      { label: '每股红利', value: '¥0.93', tone: 'positive' },
      { label: '股息率', value: '1.78%', tone: 'positive' },
      { label: '分红率', value: '35.8%', tone: 'neutral' },
    ],
    tags: ['分红', '保险', '股息率'],
    relatedEntries: ['中国平安'],
  },
  {
    id: 'fc-data-bank',
    type: 'data-insight',
    category: 'data',
    topic: '银行板块',
    title: '银行板块估值与股息数据',
    accent: 'slate',
    timestamp: '06/17 09:30',
    source: 'Wind',
    body: '你关注的银行板块市净率处于近五年最低分位，股息率吸引力凸显。',
    dataPoints: [
      { label: '板块PB', value: '0.58x', tone: 'neutral' },
      { label: '平均股息率', value: '5.4%', tone: 'positive' },
      { label: 'PB分位', value: '近5年最低', tone: 'neutral' },
    ],
    tags: ['银行', '估值', '高股息'],
    relatedEntries: ['招商银行', '中国平安'],
  },
  {
    id: 'fc-data-macro',
    type: 'data-insight',
    category: 'data',
    topic: '宏观经济',
    title: '5 月宏观数据前瞻',
    accent: 'slate',
    timestamp: '06/17 08:30',
    body: '6/22 将集中公布。多家券商预测制造业 PMI 回升至 50.2-50.5。',
    source: '券商研报',
    dataPoints: [
      { label: 'PMI预期', value: '50.3', tone: 'positive' },
      { label: 'CPI预期', value: '+0.3%', tone: 'neutral' },
      { label: '基建投资', value: '+8.5%', tone: 'positive' },
    ],
    tags: ['PMI', 'CPI', '经济数据'],
    relatedEntries: ['中国平安', '招商银行'],
  },

  // === CALENDAR category ===
  {
    id: 'fc-timing-div',
    type: 'timing',
    category: 'calendar',
    topic: '分红',
    title: '本周关键时间节点',
    accent: 'amber',
    timestamp: '06/17',
    body: '你持仓的几只股票本周有重要时间节点，我帮你标好了提醒。',
    timelineItems: [
      '6/18 周三 · 美联储议息结果公布（北京时间凌晨2:00）',
      '6/20 周五 · 茅台股权登记日 / 欧盟关税二审公布 / 期指交割',
      '6/21 周六 · 茅台除权除息日',
      '6/22 周日 · 平安股权登记日',
      '6/25 周三 · 比亚迪股东大会 / 科创板新股申购',
    ],
    tags: ['时间线', '本周', '重要节点'],
  },
  {
    id: 'fc-event-fed',
    type: 'calendar-event',
    category: 'calendar',
    topic: '宏观经济',
    title: '美联储议息会议',
    accent: 'slate',
    timestamp: '06/17',
    eventDate: '06/18',
    eventTag: '央行政策',
    impact: 'neutral',
    body: '市场预期维持利率不变，关注点阵图指引。若表态偏鸽，有利于全球风险资产；若意外偏鹰，短期可能冲击 A 股情绪。',
    tags: ['美联储', '利率', '全球市场'],
    relatedEntries: ['中国平安', '招商银行'],
  },
  {
    id: 'fc-event-expiry',
    type: 'calendar-event',
    category: 'calendar',
    topic: '市场事件',
    title: 'A 股期指交割日',
    accent: 'rose',
    timestamp: '06/17',
    eventDate: '06/20',
    eventTag: '市场事件',
    impact: 'negative',
    body: '股指期货合约到期，提醒你留意交割日效应。历史上交割周前两天市场波动率平均放大 15%。',
    tags: ['期指', '交割', '波动'],
  },
  {
    id: 'fc-event-data',
    type: 'calendar-event',
    category: 'calendar',
    topic: '宏观经济',
    title: '5 月经济数据集中公布',
    accent: 'sage',
    timestamp: '06/17',
    eventDate: '06/22',
    eventTag: '数据发布',
    impact: 'positive',
    body: 'PMI、CPI 等宏观数据集中公布。若数据超预期，有利于提振市场信心和估值修复。',
    tags: ['PMI', 'CPI', '宏观'],
  },
  {
    id: 'fc-event-ipo',
    type: 'calendar-event',
    category: 'calendar',
    topic: '半导体',
    title: '科创板新股申购：半导体设备龙头 IPO',
    accent: 'cyan',
    timestamp: '06/17',
    eventDate: '06/25',
    eventTag: '新股',
    impact: 'neutral',
    body: '半导体设备龙头企业 IPO 申购，发行价区间 45-52 元。公司是国内光刻胶核心供应商。',
    tags: ['IPO', '半导体', '新股'],
  },

  // === LEARN category ===
  {
    id: 'fc-concept-solid',
    type: 'concept',
    category: 'learn',
    topic: '新能源汽车',
    title: '科普：固态电池 vs 液态电池，路线之争',
    accent: 'cyan',
    timestamp: '06/17 08:00',
    body: '固态电池用固态电解质替代液态电解质，理论上能量密度更高、更安全。但量产成本和工艺壁垒仍是挑战。\n\n关键看点：\n• 能量密度提升 30-50%\n• 安全性大幅改善\n• 量产成本是液态的 3-5 倍\n• 2027 年前难以大规模商用',
    source: '行业研报',
    tags: ['科普', '电池', '技术路线'],
    relatedEntries: ['宁德时代', '比亚迪'],
  },
  {
    id: 'fc-concept-div',
    type: 'concept',
    category: 'learn',
    topic: '分红',
    title: '科普：分红、除权与填权，看这一篇就够了',
    accent: 'cyan',
    timestamp: '06/16 20:00',
    body: '分红是上市公司将利润以现金形式分配给股东。除权日股价会等额下调，但长期来看优质公司通常能"填权"。\n\n要点：\n• 股权登记日收盘前持有才有分红资格\n• 持股超1年免征红利税\n• 持股不满1月，红利税率20%\n• "填权"指除权后股价回到原位',
    source: '投教中心',
    tags: ['科普', '分红', '除权填权'],
  },

  // === PORTFOLIO category ===
  {
    id: 'fc-market',
    type: 'market-overview',
    category: 'portfolio',
    topic: '大盘行情',
    title: '今日 A 股：沪指涨 0.99%，科创 50 领涨',
    accent: 'slate',
    timestamp: '06/17 15:00',
    body: '两市成交额 8,420 亿元，北向资金净买入 42 亿。市场情绪偏暖，科技板块活跃。',
    indices: STOCK_INDICES,
    tags: ['大盘', '成交量', '北向资金'],
  },
  {
    id: 'fc-portfolio',
    type: 'portfolio-summary',
    category: 'portfolio',
    topic: '我的持仓',
    title: '持仓总览：今日浮盈 ¥2,135',
    accent: 'violet',
    timestamp: '06/17 15:00',
    portfolio: PORTFOLIO,
    tags: ['持仓', '盈亏'],
  },

  // === SECTORS category ===
  {
    id: 'fc-sectors',
    type: 'sector-heat',
    category: 'sectors',
    topic: '板块轮动',
    title: '板块热度：AI 与半导体领涨，地产继续承压',
    accent: 'sage',
    timestamp: '06/17 15:00',
    sectors: MARKET_SECTORS,
    tags: ['板块热度', '资金流向'],
  },
]

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: 'news', label: '资讯', icon: 'newspaper', cards: ALL_CARDS.filter((c) => c.category === 'news') },
  { key: 'data', label: '数据', icon: 'database', cards: ALL_CARDS.filter((c) => c.category === 'data') },
  { key: 'calendar', label: '日历', icon: 'calendar', cards: ALL_CARDS.filter((c) => c.category === 'calendar') },
  { key: 'learn', label: '科普', icon: 'graduation', cards: ALL_CARDS.filter((c) => c.category === 'learn') },
  { key: 'portfolio', label: '行情', icon: 'trending', cards: ALL_CARDS.filter((c) => c.category === 'portfolio') },
  { key: 'sectors', label: '板块', icon: 'barchart', cards: ALL_CARDS.filter((c) => c.category === 'sectors') },
]

export { ALL_CARDS as FEED_CARDS }
