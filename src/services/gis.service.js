/**
 * GIS Service — A* pathfinding over NER (North Eastern Region) waypoint graph.
 *
 * The graph encodes major relief corridor nodes as [lat, lng] with weighted
 * edges. Edge weights = Haversine distance km × risk multiplier (1.0 by default,
 * elevated for known high-risk segments).
 */

const { haversineDistance } = require('../utils/geoHelpers');

// ── NER Relief Corridor Graph ──────────────────────────────────────────────
// Each key is a city slug; value has coordinates and neighbours with optional
// risk multipliers (1.0 = normal, 2.0 = route avoidance due to risk).
const GRAPH = {
  guwahati:   { coord: [26.1445, 91.7362], edges: { shillong: 1.0, silchar: 1.2, dibrugarh: 1.0 } },
  shillong:   { coord: [25.5788, 91.8933], edges: { guwahati: 1.0, silchar: 1.1, imphal: 1.3 } },
  silchar:    { coord: [24.8333, 92.7789], edges: { guwahati: 1.2, shillong: 1.1, agartala: 1.0, aizawl: 1.2 } },
  agartala:   { coord: [23.8315, 91.2868], edges: { silchar: 1.0 } },
  aizawl:     { coord: [23.7271, 92.7176], edges: { silchar: 1.2, imphal: 1.1 } },
  imphal:     { coord: [24.817,  93.9368], edges: { shillong: 1.3, aizawl: 1.1, kohima: 1.0 } },
  kohima:     { coord: [25.6751, 94.1086], edges: { imphal: 1.0, itanagar: 1.4 } },
  itanagar:   { coord: [27.0844, 93.6053], edges: { guwahati: 1.1, kohima: 1.4, dibrugarh: 1.2 } },
  dibrugarh:  { coord: [27.4728, 94.912],  edges: { guwahati: 1.0, itanagar: 1.2 } },
  gangtok:    { coord: [27.3389, 88.6065], edges: { guwahati: 1.3 } },
};

// ── Heuristic: straight-line Haversine distance ────────────────────────────
const heuristic = (nodeKey, goalKey) =>
  haversineDistance(GRAPH[nodeKey].coord, GRAPH[goalKey].coord);

/**
 * A* search over the NER graph.
 *
 * @param {string} startKey  - Origin city slug (e.g. 'guwahati')
 * @param {string} goalKey   - Destination city slug (e.g. 'imphal')
 * @param {Set<string>} [blockedEdges] - Set of 'from:to' slugs to avoid
 * @returns {{ path: string[], totalKm: number } | null}
 */
const aStarRoute = (startKey, goalKey, blockedEdges = new Set()) => {
  if (!GRAPH[startKey] || !GRAPH[goalKey]) return null;
  if (startKey === goalKey) return { path: [startKey], totalKm: 0 };

  // openSet is a min-heap modelled as sorted array for simplicity (graph is small)
  const openSet = new Map(); // key → { g, f, parent }
  const closedSet = new Set();

  openSet.set(startKey, { g: 0, f: heuristic(startKey, goalKey), parent: null });

  while (openSet.size > 0) {
    // Pick node with lowest f
    let current = null;
    let bestF = Infinity;
    for (const [key, state] of openSet) {
      if (state.f < bestF) { bestF = state.f; current = key; }
    }

    if (current === goalKey) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node) {
        path.unshift(node);
        node = openSet.get(node)?.parent ?? (closedSet.has(node) ? closedSet.get(node) : null);
      }
      // Recalculate totalKm along path
      let totalKm = 0;
      for (let i = 0; i < path.length - 1; i++) {
        totalKm += haversineDistance(GRAPH[path[i]].coord, GRAPH[path[i + 1]].coord);
      }
      return { path, totalKm: Number(totalKm.toFixed(2)) };
    }

    const currentState = openSet.get(current);
    closedSet.set(current, currentState.parent);
    openSet.delete(current);

    const neighbours = GRAPH[current].edges || {};
    for (const [neighbour, riskMultiplier] of Object.entries(neighbours)) {
      if (closedSet.has(neighbour)) continue;
      if (blockedEdges.has(`${current}:${neighbour}`)) continue;

      const edgeKm = haversineDistance(GRAPH[current].coord, GRAPH[neighbour].coord);
      const tentativeG = currentState.g + edgeKm * riskMultiplier;
      const existing = openSet.get(neighbour);

      if (!existing || tentativeG < existing.g) {
        openSet.set(neighbour, {
          g: tentativeG,
          f: tentativeG + heuristic(neighbour, goalKey),
          parent: current,
        });
      }
    }
  }

  return null; // No path found
};

/**
 * Convert a city-slug path to [lat, lng] coordinate array.
 * @param {string[]} path
 * @returns {[number, number][]}
 */
const pathToCoordinates = (path) => path.map((key) => GRAPH[key]?.coord).filter(Boolean);

/**
 * Find the nearest graph node to a given [lat, lng] coordinate.
 * @param {[number, number]} coord
 * @returns {string} City slug
 */
const nearestNode = (coord) => {
  let best = null;
  let bestDist = Infinity;
  for (const [key, node] of Object.entries(GRAPH)) {
    const d = haversineDistance(coord, node.coord);
    if (d < bestDist) { bestDist = d; best = key; }
  }
  return best;
};

module.exports = { aStarRoute, pathToCoordinates, nearestNode, GRAPH };