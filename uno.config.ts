import { defineConfig, presetWind3, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({ scale: 1.2 }),
  ],
  theme: {
    colors: {
      cream: { DEFAULT: '#F8F5FC', 2: '#EDE6F5' },
      pink: { DEFAULT: '#8B5CF6', soft: '#DDD6FE' },
      ink: { DEFAULT: '#3A3038', soft: '#8B8088' },
      green: '#4CAF7D',
      red: '#E8607A',
      night: { 1: '#2A2545', 2: '#3D3566' },
    },
    borderRadius: {
      card: '20px',
    },
    boxShadow: {
      card: '0 8px 24px rgba(100,70,140,.12)',
      'card-lg': '0 18px 50px rgba(100,60,140,.22)',
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
    },
  },
  shortcuts: {
    'btn': 'border-none rounded-[14px] px-[18px] py-[13px] text-sm font-bold cursor-pointer transition-transform duration-120',
    'btn-pink': 'bg-pink text-white shadow-[0_6px_16px_rgba(139,92,246,.35)]',
    'btn-ghost': 'bg-black/5 text-ink',
    'scroll-hide': 'overflow-y-auto [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden',
  },
})
