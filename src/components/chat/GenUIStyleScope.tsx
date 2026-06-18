'use client'

import { createStyleScope } from '@genui/unocss'
import type { Theme } from '@unocss/preset-wind3'

const genUITheme: Theme = {
  colors: {
    cream: { DEFAULT: '#F8F5FC', 2: '#EDE6F5' },
    pink: { DEFAULT: '#8B5CF6', soft: '#DDD6FE' },
    ink: { DEFAULT: '#3A3038', soft: '#8B8088' },
    green: '#4CAF7D',
    red: '#E8607A',
  },
  fontFamily: {
    sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
  },
}

export default createStyleScope({
  scopeClass: 'genui-scope',
  theme: genUITheme,
})
