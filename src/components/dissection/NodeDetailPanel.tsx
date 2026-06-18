'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { generateGeodesicGraph } from './geodesic-data'
import { useAppStore } from '../../store/app-store'

export default function NodeDetailPanel() {
  const selectedNodeId = useAppStore((s) => s.dissectionSelectedNode)
  const selectNode = useAppStore((s) => s.selectDissectionNode)

  const graphData = useMemo(() => generateGeodesicGraph(80, 0.25, 42), [])

  const selectedNode = selectedNodeId
    ? graphData.nodes.find((n) => n.id === selectedNodeId)
    : null

  const neighbors = useMemo(() => {
    if (!selectedNodeId) return []
    return graphData.links
      .filter((l) => l.source === selectedNodeId || l.target === selectedNodeId)
      .map((l) => (l.source === selectedNodeId ? l.target : l.source))
  }, [selectedNodeId, graphData.links])

  if (!selectedNode) return null

  return (
    <div className="dissect-detail">
      <div className="dissect-detail-header">
        <div className="dissect-node-info">
          <span className="dissect-node-id">{selectedNode.id}</span>
          <span className={`dissect-node-badge ${selectedNode.group}`}>
            {selectedNode.group === 'core' ? '核心' : '细分'}
          </span>
        </div>
        <button className="dissect-detail-close" onClick={() => selectNode(null)} aria-label="取消选中">
          <X size={14} />
        </button>
      </div>

      <div className="dissect-detail-body">
        <div className="dissect-coords">
          <h3>空间坐标</h3>
          <div className="dissect-coord-grid">
            <div><span className="dissect-coord-axis">X</span><span>{selectedNode.x.toFixed(2)}</span></div>
            <div><span className="dissect-coord-axis">Y</span><span>{selectedNode.y.toFixed(2)}</span></div>
            <div><span className="dissect-coord-axis">Z</span><span>{selectedNode.z.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="dissect-neighbors">
          <h3>邻居节点 ({neighbors.length})</h3>
          <div className="dissect-neighbor-list">
            {neighbors.map((nid) => {
              const n = graphData.nodes.find((node) => node.id === nid)
              return (
                <button
                  key={nid}
                  className="dissect-neighbor-btn"
                  onClick={() => selectNode(nid)}
                >
                  {nid}
                  <span className={`dissect-node-badge small ${n?.group}`}>
                    {n?.group === 'core' ? '核心' : '细分'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
