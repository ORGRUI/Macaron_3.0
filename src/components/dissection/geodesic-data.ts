// Star map graph generator — variable node count with non-equidistant spacing

export interface GeoNode {
  id: string
  group: 'core' | 'secondary'
  x: number
  y: number
  z: number
}

export interface GeoLink {
  source: string
  target: string
}

export interface GeoGraph {
  nodes: GeoNode[]
  links: GeoLink[]
}

// Golden ratio
const PHI = (1 + Math.sqrt(5)) / 2

// 12 vertices of a regular icosahedron (unit sphere)
const ICO_VERTICES: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]

// 20 triangular faces (vertex index triples)
const ICO_FACES: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  return [v[0] / len, v[1] / len, v[2] / len]
}

function midpoint(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
}

function vertexKey(v: [number, number, number]): string {
  return v.map((n) => n.toFixed(6)).join(',')
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

// Seeded PRNG
function createRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

// Generate base geodesic vertices via icosahedron subdivision
function generateGeodesicVertices(): { vertices: [number, number, number][]; coreCount: number; edges: Set<string> } {
  const vertices: [number, number, number][] = ICO_VERTICES.map(normalize)
  const coreCount = vertices.length // 12

  const vertexMap = new Map<string, number>()
  vertices.forEach((v, i) => vertexMap.set(vertexKey(v), i))

  const edges = new Set<string>()
  const midpointCache = new Map<string, number>()

  function getOrCreateMidpoint(ai: number, bi: number): number {
    const ek = edgeKey(ai, bi)
    if (midpointCache.has(ek)) return midpointCache.get(ek)!
    const mp = midpoint(vertices[ai], vertices[bi])
    const key = vertexKey(mp)
    let idx = vertexMap.get(key)
    if (idx === undefined) {
      idx = vertices.length
      vertices.push(mp)
      vertexMap.set(key, idx)
    }
    midpointCache.set(ek, idx)
    return idx
  }

  for (const [a, b, c] of ICO_FACES) {
    const ab = getOrCreateMidpoint(a, b)
    const bc = getOrCreateMidpoint(b, c)
    const ca = getOrCreateMidpoint(c, a)

    const subFaces: [number, number, number][] = [
      [a, ab, ca],
      [b, bc, ab],
      [c, ca, bc],
      [ab, bc, ca],
    ]
    for (const [x, y, z] of subFaces) {
      edges.add(edgeKey(x, y))
      edges.add(edgeKey(y, z))
      edges.add(edgeKey(z, x))
    }
  }

  return { vertices, coreCount, edges }
}

// Generate extra random points on unit sphere using Fibonacci spiral
function fibonacciSphere(count: number, rng: () => number): [number, number, number][] {
  const points: [number, number, number][] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * i) / (count - 1 || 1)
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = goldenAngle * i + rng() * 0.3 // slight jitter
    points.push([
      Math.cos(theta) * radiusAtY,
      y,
      Math.sin(theta) * radiusAtY,
    ])
  }
  return points
}

export function generateGeodesicGraph(
  radius = 80,
  openRatio = 0.25,
  seed = 42,
  nodeCount = 42,
): GeoGraph {
  const rng = createRng(seed)

  const { vertices: geoVerts, coreCount, edges: geoEdges } = generateGeodesicVertices()
  // Total geodesic vertices is ~42

  let unitVerts: [number, number, number][]
  let coreBound: number

  if (nodeCount <= geoVerts.length) {
    // Use subset: always keep all 12 core + random secondary
    const secondaryIndices = Array.from({ length: geoVerts.length - coreCount }, (_, i) => i + coreCount)
    // Shuffle secondary
    for (let i = secondaryIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [secondaryIndices[i], secondaryIndices[j]] = [secondaryIndices[j], secondaryIndices[i]]
    }
    const keepSecondary = secondaryIndices.slice(0, Math.max(0, nodeCount - coreCount))
    const keepSet = new Set([...Array.from({ length: coreCount }, (_, i) => i), ...keepSecondary])

    // Remap indices
    const indexMap = new Map<number, number>()
    unitVerts = []
    for (const oldIdx of [...keepSet].sort((a, b) => a - b)) {
      indexMap.set(oldIdx, unitVerts.length)
      unitVerts.push(geoVerts[oldIdx])
    }
    coreBound = coreCount

    // Rebuild edges with remapped indices, only keeping edges where both ends exist
    geoEdges.clear()
    const { edges: fullEdges } = generateGeodesicVertices()
    for (const ek of fullEdges) {
      const [a, b] = ek.split('-').map(Number)
      if (indexMap.has(a) && indexMap.has(b)) {
        geoEdges.add(edgeKey(indexMap.get(a)!, indexMap.get(b)!))
      }
    }
    // Replace geoEdges content
    const remappedEdges = new Set<string>()
    for (const ek of fullEdges) {
      const [a, b] = ek.split('-').map(Number)
      if (indexMap.has(a) && indexMap.has(b)) {
        remappedEdges.add(edgeKey(indexMap.get(a)!, indexMap.get(b)!))
      }
    }
    geoEdges.clear()
    for (const e of remappedEdges) geoEdges.add(e)

  } else {
    // nodeCount > geodesic count: use all geodesic + add Fibonacci extra points
    unitVerts = [...geoVerts]
    coreBound = coreCount
    const extraCount = nodeCount - geoVerts.length
    const extras = fibonacciSphere(extraCount, rng)
    unitVerts.push(...extras)

    // Connect extra nodes to nearest existing nodes
    for (let i = geoVerts.length; i < unitVerts.length; i++) {
      const p = unitVerts[i]
      // Find 2-3 nearest existing nodes
      const dists: { idx: number; d: number }[] = []
      for (let j = 0; j < i; j++) {
        const q = unitVerts[j]
        const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]
        dists.push({ idx: j, d: dx * dx + dy * dy + dz * dz })
      }
      dists.sort((a, b) => a.d - b.d)
      const connectCount = 2 + Math.floor(rng() * 2) // 2 or 3 connections
      for (let k = 0; k < Math.min(connectCount, dists.length); k++) {
        geoEdges.add(edgeKey(i, dists[k].idx))
      }
    }
  }

  // Remove ~openRatio of edges to create gaps
  const edgeList = Array.from(geoEdges)
  const removedCount = Math.floor(edgeList.length * openRatio)
  const shuffled = edgeList.slice().sort(() => rng() - 0.5)
  const removed = new Set(shuffled.slice(0, removedCount))

  // Build nodes with NON-EQUIDISTANT radii: each node gets radius * random(0.5, 2.0)
  const nodes: GeoNode[] = unitVerts.map((v, i) => {
    const distFactor = 0.5 + rng() * 1.5 // range [0.5, 2.0]
    const r = radius * distFactor
    return {
      id: `n${i}`,
      group: (i < coreBound ? 'core' : 'secondary') as const,
      x: v[0] * r + (rng() - 0.5) * 4,
      y: v[1] * r + (rng() - 0.5) * 4,
      z: v[2] * r + (rng() - 0.5) * 4,
    }
  })

  // Build links (skip removed edges)
  const links: GeoLink[] = []
  for (const ek of edgeList) {
    if (removed.has(ek)) continue
    const [a, b] = ek.split('-').map(Number)
    if (a < nodes.length && b < nodes.length) {
      links.push({ source: `n${a}`, target: `n${b}` })
    }
  }

  return { nodes, links }
}
