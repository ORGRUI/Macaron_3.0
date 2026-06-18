'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { useAppStore } from '../../store/app-store'
import GeodesicNetwork from './GeodesicNetwork'
import NodeDetailPanel from './NodeDetailPanel'
import './dissection.css'

export default function DissectionOverlay() {
  const close = useAppStore((s) => s.closeDissection)
  const selectedNode = useAppStore((s) => s.dissectionSelectedNode)

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  return (
    <motion.div
      className="dissect-panel"
      initial={{ opacity: 0, x: '10%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '10%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {/* Close button */}
      <button className="dissect-close-btn" onClick={close} aria-label="关闭剖析">
        <X size={18} />
      </button>

      {/* Star map */}
      <div className="dissect-graph-area">
        <GeodesicNetwork />
      </div>

      {/* Bottom drawer when node selected */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            className="dissect-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <NodeDetailPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="dissect-stats-bar">
        <span className="dissect-stats-bar-title">Geodesic Network</span>
        <span className="dissect-stats-bar-hint">点击节点查看</span>
      </div>
    </motion.div>
  )
}
