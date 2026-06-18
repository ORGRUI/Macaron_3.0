'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as ReactJSXRuntime from 'react/jsx-runtime'
import { useStyleScope } from '@genui/unocss'

interface GenUICardProps {
  code: string
  streaming: boolean
}

type RendererInstance = {
  pushCode: (code: string) => void
  render: (code: string) => void
  finish: (code?: string) => void
  clear: (options?: { preserveVisualState?: boolean }) => void
  detach: () => void
  setImportMap: (map: { imports?: Record<string, string>; scopes?: Record<string, Record<string, string>> }) => void
}

// ── React shim: re-export page's React via blob URLs so generated TSX uses the same instance ──
// Without this, esm.sh would load a separate React → null dispatcher → useState crash.
let _reactShimUrls: { react: string; jsxRuntime: string } | null = null

function getReactShimUrls() {
  if (_reactShimUrls) return _reactShimUrls

  // Expose page's React on window for blob module access
  ;(window as any).__GENUI_REACT__ = React
  ;(window as any).__GENUI_REACT_JSX__ = ReactJSXRuntime

  const reactUrl = URL.createObjectURL(
    new Blob(
      [
        `const R = window.__GENUI_REACT__;
export default R;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createRef, forwardRef, isValidElement,
  lazy, memo, startTransition, cache, use, act,
  useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId,
  useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useOptimistic,
  useReducer, useRef, useState, useSyncExternalStore, useTransition, version
} = R;`,
      ],
      { type: 'text/javascript' }
    )
  )

  const jsxRuntimeUrl = URL.createObjectURL(
    new Blob(
      [
        `const J = window.__GENUI_REACT_JSX__;
export const { jsx, jsxs, jsxDEV, Fragment } = J;`,
      ],
      { type: 'text/javascript' }
    )
  )

  _reactShimUrls = { react: reactUrl, jsxRuntime: jsxRuntimeUrl }
  return _reactShimUrls
}

export default function GenUICard({ code, streaming }: GenUICardProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<RendererInstance | null>(null)
  const prevCodeRef = useRef('')
  const initRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const styleScope = useStyleScope()

  // Prime UnoCSS styles whenever code changes
  useEffect(() => {
    if (code) {
      styleScope?.prime(code)
    }
  }, [code, styleScope])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let destroyed = false

    const init = async () => {
      if (!hostRef.current) return

      try {
        const { GenUIRenderer } = await import('partial-react')
        const { createImportMapResolver, esmShFallback, literalImportMap } = await import('@genui/importmap')

        const shims = getReactShimUrls()

        const resolver = createImportMapResolver([
          literalImportMap({
            imports: {
              'react': shims.react,
              'react/jsx-runtime': shims.jsxRuntime,
              'react/jsx-dev-runtime': shims.jsxRuntime,
              'react-dom': shims.react,
              'react-dom/client': shims.react,
            },
          }),
          esmShFallback(),
        ])

        const importmap = await resolver.resolve({ code })
        if (destroyed) return

        const renderer = await GenUIRenderer.create(hostRef.current, {
          importmap,
          preserveStateOnUpdate: true,
          flushMode: 'microtask',
          callbacks: {
            onError: (err: Error) => {
              console.error('[GenUICard] Render error:', err.message)
              if (!streaming) setError(err.message)
            },
            onRendered: () => {
              setError(null)
              setLoading(false)
            },
          },
        })

        if (destroyed) {
          renderer.detach()
          return
        }

        rendererRef.current = renderer
        setLoading(false)

        // Render the initial code
        if (code) {
          if (streaming) {
            renderer.pushCode(code)
          } else {
            renderer.render(code)
          }
          prevCodeRef.current = code
        }
      } catch (err: any) {
        console.error('[GenUICard] Init error:', err)
        setError(err.message || 'Failed to initialize renderer')
        setLoading(false)
      }
    }

    init()

    return () => {
      destroyed = true
      rendererRef.current?.detach()
      rendererRef.current = null
    }
  }, [])

  // Update code when it changes (after initialization)
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !code) return
    if (code === prevCodeRef.current) return

    const prev = prevCodeRef.current
    if (streaming && code.startsWith(prev) && prev.length > 0) {
      // Append-only streaming: push the delta
      renderer.pushCode(code.slice(prev.length))
    } else if (streaming) {
      // Non-append streaming: clear and re-push
      renderer.clear({ preserveVisualState: true })
      renderer.pushCode(code)
    } else {
      // Final render
      renderer.finish(code)
    }
    prevCodeRef.current = code
  }, [code, streaming])

  return (
    <div className="genui-card-wrapper">
      {loading && (
        <div className="genui-loading">
          <svg className="genui-loading-spinner" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
          <span>生成卡片中...</span>
        </div>
      )}
      {error && <div className="genui-error">{error}</div>}
      <div ref={hostRef} className="genui-host" />
    </div>
  )
}
