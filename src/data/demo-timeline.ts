import type { DemoDay, GenUITopicCard, GenUIStat, TopicTone } from './types'

export const DEMO_DAYS: DemoDay[] = [
  {
    id: 'demo-day-1',
    dayIndex: 0,
    isoDate: '2026-06-16',
    dateLabel: '06/16',
    weekday: '周二',
    headline: 'AI 算力链回暖，沪深成交额温和放大',
    marketCue: '半导体设备、云服务和机器人板块出现轮动',
    chatSeed: '用户连续问了英伟达供应链、A股算力租赁和仓位控制。',
    news: ['国产 GPU 订单传闻升温', '券商上调云基础设施资本开支预期', '港股科技股午后拉升'],
    fun: ['独立书店发起夜读市集', '城市露台观星活动开放预约'],
    signalLabel: '关注热度',
    signalValue: '82',
    signalTone: 'positive',
    genuiKind: 'market-brief',
    accent: 'slate',
  },
  {
    id: 'demo-day-2',
    dayIndex: 1,
    isoDate: '2026-06-17',
    dateLabel: '06/17',
    weekday: '周三',
    headline: '新能源车价格战降温，电池材料情绪修复',
    marketCue: '整车、锂电材料和充电桩走出分化行情',
    chatSeed: '用户聊到通勤、换车预算和新能源 ETF 是否适合定投。',
    news: ['两家车企宣布减少短期促销', '钠电池试点项目披露新进展', '充电桩运营商订单增长'],
    fun: ['周末城市骑行路线更新', '咖啡节推出低因限定菜单'],
    signalLabel: '情绪修复',
    signalValue: '+14%',
    signalTone: 'positive',
    genuiKind: 'portfolio-check',
    accent: 'sage',
  },
  {
    id: 'demo-day-3',
    dayIndex: 2,
    isoDate: '2026-06-18',
    dateLabel: '06/18',
    weekday: '周四',
    headline: '演唱会门票二开，文旅消费话题升温',
    marketCue: '旅游酒店、票务平台和线下零售出现短线关注',
    chatSeed: '用户问了周末约会安排、预算和附近演唱会行程。',
    news: ['大型演唱会加开视线受限座', '酒店预订量环比抬升', '夜经济消费券开始发放'],
    fun: ['流行乐队巡演到站', '美术馆夜场延长到 22 点'],
    signalLabel: '票务热度',
    signalValue: '9.1',
    signalTone: 'positive',
    genuiKind: 'concert-plan',
    accent: 'rose',
  },
  {
    id: 'demo-day-4',
    dayIndex: 3,
    isoDate: '2026-06-19',
    dateLabel: '06/19',
    weekday: '周五',
    headline: '海外利率预期摇摆，避险资产短线占优',
    marketCue: '黄金、红利资产和高股息方向相对抗跌',
    chatSeed: '用户担心周末前波动，问了止盈、止损和现金比例。',
    news: ['美元指数震荡走强', '黄金 ETF 获得小幅净申购', '高股息指数逆势翻红'],
    fun: ['老电影露天放映回归', '城市夜跑团开放新人名额'],
    signalLabel: '波动警报',
    signalValue: '中',
    signalTone: 'negative',
    genuiKind: 'market-brief',
    accent: 'amber',
  },
  {
    id: 'demo-day-5',
    dayIndex: 4,
    isoDate: '2026-06-20',
    dateLabel: '06/20',
    weekday: '周六',
    headline: '周末消费数据亮眼，轻户外和亲子活动爆发',
    marketCue: '体育用品、本地生活和餐饮链条值得观察',
    chatSeed: '用户聊了周末去哪玩、预算有限和朋友聚会偏好。',
    news: ['城市公园露营预约满额', '商圈夜间客流提升', '运动品牌发布夏季新品'],
    fun: ['天台爵士夜开票', '亲子科学展推出夜场'],
    signalLabel: '周末能量',
    signalValue: '高',
    signalTone: 'positive',
    genuiKind: 'weekend-pulse',
    accent: 'cyan',
  },
  {
    id: 'demo-day-6',
    dayIndex: 5,
    isoDate: '2026-06-21',
    dateLabel: '06/21',
    weekday: '周日',
    headline: '端侧 AI 应用刷屏，手机和可穿戴设备讨论升温',
    marketCue: '消费电子、传感器和端侧模型应用形成联动',
    chatSeed: '用户问了 AI 手机、智能眼镜和是否值得等新品。',
    news: ['手机厂商预热视频强调端侧智能', '智能眼镜体验店排队', '应用商店 AI 工具下载量提升'],
    fun: ['二次元快闪店补货', '城市影像挑战赛开始征稿'],
    signalLabel: '新品期待',
    signalValue: '76',
    signalTone: 'neutral',
    genuiKind: 'city-life',
    accent: 'slate',
  },
  {
    id: 'demo-day-7',
    dayIndex: 6,
    isoDate: '2026-06-22',
    dateLabel: '06/22',
    weekday: '周一',
    headline: '新一周财报预告密集，组合复盘需求增加',
    marketCue: '业绩预告、消费复苏和出口链成为开盘前焦点',
    chatSeed: '用户回顾了一周聊天，想知道哪些话题值得沉淀。',
    news: ['多家公司预告中报改善', '出口链订单数据边际修复', '食品饮料渠道反馈稳定'],
    fun: ['音乐剧二轮巡演公布', '城市早餐地图更新'],
    signalLabel: '复盘优先级',
    signalValue: 'A',
    signalTone: 'positive',
    genuiKind: 'portfolio-check',
    accent: 'sage',
  },
]

const toneCopy: Record<TopicTone, { label: string; caption: string }> = {
  positive: { label: '偏积极', caption: '适合生成行动建议' },
  negative: { label: '需防守', caption: '适合提醒风险边界' },
  neutral: { label: '观察中', caption: '适合收集更多信号' },
}

function statSet(day: DemoDay, chatCount: number): GenUIStat[] {
  return [
    {
      id: `${day.id}-stat-signal`,
      label: day.signalLabel,
      value: day.signalValue,
      caption: toneCopy[day.signalTone].caption,
      tone: day.signalTone,
    },
    {
      id: `${day.id}-stat-chat`,
      label: '聊天线索',
      value: `${chatCount || day.chatSeed.length % 5 + 3} 条`,
      caption: chatCount ? '来自真实聊天摘要' : '来自模拟聊天摘要',
      tone: 'neutral',
    },
    {
      id: `${day.id}-stat-push`,
      label: '推荐动作',
      value: day.signalTone === 'negative' ? '降噪' : '追踪',
      caption: toneCopy[day.signalTone].label,
      tone: day.signalTone,
    },
  ]
}

function topicTitle(day: DemoDay): string {
  const titles: Record<DemoDay['genuiKind'], string> = {
    'market-brief': '今日市场雷达',
    'concert-plan': '周末演出计划',
    'weekend-pulse': '城市周末脉冲',
    'portfolio-check': '组合复盘提示',
    'city-life': '生活灵感小报',
  }
  return titles[day.genuiKind]
}

function sourceNote(day: DemoDay): string {
  return `由 ${day.weekday} 的聊天摘要、模拟新闻和兴趣事件合成`
}

export function buildDemoGenUICard(
  day: DemoDay,
  conversationSummary?: { text: string; messageCount: number }
): GenUITopicCard {
  const now = Date.now()
  const insight = conversationSummary?.text || day.chatSeed
  const chatCount = conversationSummary?.messageCount || 0

  return {
    id: `genui-${day.id}-${now}`,
    dayId: day.id,
    createdAt: now,
    dateLabel: `${day.dateLabel} ${day.weekday}`,
    title: topicTitle(day),
    eyebrow: day.headline,
    summary: `${day.marketCue}。Macaron 把你的聊天重点整理成一个可操作的话题卡。`,
    kind: day.genuiKind,
    accent: day.accent,
    sourceNote: conversationSummary?.messageCount
      ? `${sourceNote(day)}，并融合最近 ${conversationSummary.messageCount} 条真实聊天`
      : sourceNote(day),
    insight,
    chips: [day.news[0], day.fun[0], toneCopy[day.signalTone].label],
    timeline: [
      `新闻：${day.news[1] || day.news[0]}`,
      `兴趣：${day.fun[1] || day.fun[0]}`,
      `沉淀：${day.marketCue}`,
    ],
    stats: statSet(day, chatCount),
    primaryAction: {
      id: `${day.id}-action-track`,
      label: day.signalTone === 'negative' ? '加入风险观察' : '加入关注清单',
      activeLabel: day.signalTone === 'negative' ? '已加入观察' : '已关注',
    },
    secondaryAction: {
      id: `${day.id}-action-save`,
      label: '收藏话题',
      activeLabel: '已收藏',
    },
  }
}
