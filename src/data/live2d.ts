import type { Expression } from './types'

export interface Live2DModelConfig {
  name: string
  modelPath: string
  expressionMap: Record<Expression, string>
}

export const CURRENT_LIVE2D_MODEL: Live2DModelConfig = {
  name: 'MacaronKeseran',
  modelPath: '/live2d-models/MacaronKeseran/keserannpasarann.model3.json',
  expressionMap: {
    neutral: '',
    happy: '',
    surprised: '',
    thinking: '',
    talking: '',
    wink: '',
  },
}
