'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'
import type { Expression } from '../../data/types'

// Register PIXI to the global scope for pixi-live2d-display
;(window as any).PIXI = PIXI

const CANVAS_W = 350
const CANVAS_H = 400

interface Live2DAvatarProps {
  modelPath: string
  expression: Expression
  isTalking: boolean
  onExpressionChange?: (exp: Expression) => void
}

export default function Live2DAvatar({ modelPath, expression, isTalking, onExpressionChange }: Live2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const modelRef = useRef<any>(null)
  const currentPathRef = useRef<string | null>(null)

  const destroyApp = useCallback(() => {
    if (appRef.current) {
      appRef.current.destroy(false, { children: true })
      appRef.current = null
    }
    modelRef.current = null
    currentPathRef.current = null
  }, [])

  const initLive2D = useCallback(async (path: string) => {
    if (!canvasRef.current) return

    // Destroy previous instance if exists
    destroyApp()

    try {
      const app = new PIXI.Application({
        view: canvasRef.current,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      })
      appRef.current = app

      const model = await Live2DModel.from(path, {
        autoInteract: false,
      })
      modelRef.current = model
      currentPathRef.current = path

      // Auto-fit: scale model to fit canvas with some padding
      const padding = 20
      const targetW = CANVAS_W - padding * 2
      const targetH = CANVAS_H - padding * 2
      const scaleX = targetW / model.width
      const scaleY = targetH / model.height
      const fitScale = Math.min(scaleX, scaleY)

      model.scale.set(fitScale)
      model.anchor.set(0.5, 0.5)
      model.x = CANVAS_W / 2
      model.y = CANVAS_H / 2

      if (model.internalModel?.eyeBlink) {
        model.internalModel.eyeBlink.blinkIntervalSeconds = 4
      }

      app.stage.addChild(model)
      model.motion('Idle', 0)
    } catch (err) {
      console.error('Failed to load Live2D model:', err)
    }
  }, [destroyApp])

  useEffect(() => {
    if (currentPathRef.current !== modelPath) {
      initLive2D(modelPath)
    }
    return () => {
      destroyApp()
    }
  }, [modelPath, initLive2D, destroyApp])

  // Handle expression changes
  useEffect(() => {
    const model = modelRef.current
    if (!model) return
    // Try to trigger expression by name — Live2D models may or may not have these
    const expMap: Partial<Record<Expression, string[]>> = {
      happy: ['Exp1', 'happy'],
      surprised: ['Exp2', 'surprised'],
      wink: ['Exp3', 'wink'],
    }
    const candidates = expMap[expression]
    if (candidates) {
      for (const name of candidates) {
        try { model.expression(name); break } catch { /* skip */ }
      }
    }
  }, [expression])

  // Handle talking (simulate lip sync by pulsing mouth parameter)
  useEffect(() => {
    const model = modelRef.current
    if (!model) return

    let talkInterval: ReturnType<typeof setInterval> | null = null

    if (isTalking) {
      talkInterval = setInterval(() => {
        const coreModel = model.internalModel?.coreModel
        if (coreModel) {
          const val = 0.3 + Math.random() * 0.7
          const paramIndex = coreModel.getParameterIndex('ParamMouthOpenY')
          if (paramIndex >= 0) {
            coreModel.setParameterValueByIndex(paramIndex, val)
          }
        }
      }, 100)
    } else {
      const coreModel = model.internalModel?.coreModel
      if (coreModel) {
        const paramIndex = coreModel.getParameterIndex('ParamMouthOpenY')
        if (paramIndex >= 0) {
          coreModel.setParameterValueByIndex(paramIndex, 0)
        }
      }
    }

    return () => {
      if (talkInterval) clearInterval(talkInterval)
    }
  }, [isTalking])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${CANVAS_W}px`,
        height: `${CANVAS_H}px`,
        touchAction: 'none',
        pointerEvents: 'none',
      }}
    />
  )
}
