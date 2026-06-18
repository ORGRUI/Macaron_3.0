import type { StockIndex, PortfolioItem, FinancialEvent, MarketSector } from './types'

export const STOCK_INDICES: StockIndex[] = [
  {
    name: '上证指数',
    code: 'SH000001',
    value: 3287.45,
    change: 32.18,
    changePercent: 0.99,
    sparkline: [3240, 3255, 3248, 3260, 3272, 3265, 3280, 3275, 3290, 3287],
  },
  {
    name: '深证成指',
    code: 'SZ399001',
    value: 10856.32,
    change: -45.67,
    changePercent: -0.42,
    sparkline: [10920, 10900, 10880, 10870, 10890, 10860, 10840, 10850, 10830, 10856],
  },
  {
    name: '创业板指',
    code: 'SZ399006',
    value: 2178.90,
    change: 18.45,
    changePercent: 0.85,
    sparkline: [2150, 2155, 2160, 2158, 2165, 2170, 2168, 2175, 2180, 2178],
  },
  {
    name: '科创50',
    code: 'SH000688',
    value: 1045.67,
    change: 12.34,
    changePercent: 1.19,
    sparkline: [1025, 1030, 1028, 1035, 1038, 1040, 1042, 1048, 1050, 1045],
  },
]

export const PORTFOLIO: PortfolioItem[] = [
  { name: '贵州茅台', symbol: '600519', shares: 10, price: 1688.00, change: 15.50, changePercent: 0.93, color: '#8B5CF6' },
  { name: '宁德时代', symbol: '300750', shares: 50, price: 218.40, change: -3.20, changePercent: -1.44, color: '#06B6D4' },
  { name: '比亚迪', symbol: '002594', shares: 100, price: 267.80, change: 8.60, changePercent: 3.32, color: '#10B981' },
  { name: '中国平安', symbol: '601318', shares: 200, price: 52.35, change: 0.85, changePercent: 1.65, color: '#F59E0B' },
  { name: '招商银行', symbol: '600036', shares: 300, price: 36.72, change: -0.28, changePercent: -0.76, color: '#EF4444' },
]

export const FINANCIAL_EVENTS: FinancialEvent[] = [
  {
    date: '06/18',
    title: '美联储议息会议',
    tag: '央行政策',
    impact: 'neutral',
    description: '市场预期维持利率不变，关注点阵图指引',
  },
  {
    date: '06/20',
    title: 'A股期指交割日',
    tag: '市场事件',
    impact: 'negative',
    description: '股指期货合约到期，注意交割日效应',
  },
  {
    date: '06/22',
    title: '5月经济数据公布',
    tag: '数据发布',
    impact: 'positive',
    description: 'PMI、CPI等宏观数据集中公布',
  },
  {
    date: '06/25',
    title: '科创板新股申购',
    tag: '新股',
    impact: 'neutral',
    description: '半导体设备龙头企业IPO申购',
  },
  {
    date: '06/28',
    title: '半年报预告截止',
    tag: '财报季',
    impact: 'positive',
    description: '上市公司中报业绩预告密集期',
  },
]

export const MARKET_SECTORS: MarketSector[] = [
  { name: '半导体', change: 3.25, volume: '182亿' },
  { name: '新能源', change: 1.87, volume: '156亿' },
  { name: '消费电子', change: -0.92, volume: '98亿' },
  { name: '医药生物', change: 0.45, volume: '134亿' },
  { name: '白酒', change: 1.12, volume: '87亿' },
  { name: '银行', change: -0.33, volume: '210亿' },
  { name: '房地产', change: -2.15, volume: '65亿' },
  { name: '人工智能', change: 4.58, volume: '245亿' },
]

export const CHAT_RESPONSES: Record<string, string[]> = {
  greeting: [
    '你好呀！今天想聊点什么？',
    '嗨～今天心情怎么样？',
    '欢迎回来！有什么我能帮你的吗？',
  ],
  stock: [
    '今天大盘走势还不错，上证涨了近1%。你有关注哪些板块吗？',
    '最近半导体和AI板块比较活跃，可以关注下。',
    '投资要注意风险分散，不要把鸡蛋放在一个篮子里哦～',
  ],
  market: [
    '目前市场情绪偏暖，成交量有所放大。',
    '这周有几个重要事件要关注，特别是美联储议息会议。',
    '从技术面看，大盘短期有望继续向上突破。',
  ],
  fallback: [
    '嗯嗯，我听到了～还有什么想说的吗？',
    '有意思！你可以跟我多聊聊这个话题。',
    '好的，我记住了。随时找我聊天哦～',
    '这个问题很好，让我想想……',
    '我觉得你说得很有道理呢！',
  ],
}

export const CHAT_TRIGGERS: Record<string, string[]> = {
  greeting: ['你好', '嗨', 'hi', 'hello', '早上好', '晚上好', '下午好'],
  stock: ['股票', '大盘', '涨', '跌', '板块', '买入', '卖出', '仓位', '茅台', '宁德'],
  market: ['行情', '市场', '指数', '成交量', '牛市', '熊市', '趋势'],
}
