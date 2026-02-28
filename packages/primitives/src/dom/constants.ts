/**
 * Shared DOM constants — used by multiple rendering strategies.
 */

/**
 * SVG tags that require createElementNS for correct rendering.
 * Based on SVG 2 spec: https://www.w3.org/TR/SVG2/
 */
export const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'g', 'text', 'tspan', 'defs', 'use', 'symbol', 'clipPath', 'mask',
  'pattern', 'image', 'foreignObject', 'marker', 'linearGradient',
  'radialGradient', 'stop', 'filter', 'animate', 'animateTransform',
  'textPath', 'desc', 'title', 'metadata',
]);
