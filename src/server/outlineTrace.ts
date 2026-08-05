import sharp from 'sharp';
import * as potrace from 'potrace';

export type OutlinePoint = [number, number];

export type TracedOutline = {
  points: OutlinePoint[];
  width: number;
  height: number;
  complex: boolean;
  svg: string;
};

const SIMPLIFY_TOLERANCE_PX = 0.5;
const COMPLEX_POINT_THRESHOLD = 300;
const MIN_SPECKLE_SIZE = 4;
const CURVE_COMMANDS = new Set(['C', 'S', 'Q', 'T', 'A']);

export async function traceOutline(
  imageBytes: Uint8Array,
): Promise<TracedOutline> {
  const source = sharp(Buffer.from(imageBytes)).ensureAlpha();
  const meta = await source.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Could not read image dimensions');
  }

  // Composite transparent regions onto black first — silhouette exports
  // often use alpha instead of a solid background, and potrace only
  // understands opaque pixels.
  const flattened = await source
    .clone()
    .flatten({ background: '#000000' })
    .grayscale()
    .png()
    .toBuffer();

  const blackOnWhite = await borderIsLight(flattened, width, height);

  const svg = await new Promise<string>((resolve, reject) => {
    potrace.trace(
      flattened,
      {
        threshold: 128,
        blackOnWhite,
        turdSize: MIN_SPECKLE_SIZE,
        optCurve: false,
        alphaMax: 0,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });

  const subpaths = parseSvgPathSubpaths(svg);
  if (!subpaths.length) {
    throw new Error('No shape found in image');
  }

  // Single-outer-boundary scope: keep only the largest-area loop and drop
  // any smaller subpaths (holes, speckles) potrace's decomposition emits.
  const largest = subpaths.reduce((a, b) =>
    polygonArea(a) >= polygonArea(b) ? a : b,
  );

  const normalized = dedupeClosingPoint(normalize(largest, height));
  const simplified = simplify(normalized, SIMPLIFY_TOLERANCE_PX);
  const bbox = boundingBox(simplified);

  return {
    points: simplified,
    width: bbox.width,
    height: bbox.height,
    complex: simplified.length > COMPLEX_POINT_THRESHOLD,
    svg: toSvg(simplified, bbox),
  };
}

async function borderIsLight(
  grayscalePng: Buffer,
  width: number,
  height: number,
): Promise<boolean> {
  const { data } = await sharp(grayscalePng)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  let sum = 0;
  let count = 0;
  for (let x = 0; x < width; x += step) {
    sum += data[x];
    sum += data[(height - 1) * width + x];
    count += 2;
  }
  for (let y = 0; y < height; y += step) {
    sum += data[y * width];
    sum += data[y * width + (width - 1)];
    count += 2;
  }
  return count > 0 && sum / count > 128;
}

function parseSvgPathSubpaths(svg: string): OutlinePoint[][] {
  const match = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!match) return [];
  const tokens = match[1].match(/[MLZCSQTAmlzcsqta]|-?\d+(?:\.\d+)?/g) ?? [];

  const subpaths: OutlinePoint[][] = [];
  let current: OutlinePoint[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (CURVE_COMMANDS.has(token.toUpperCase())) {
      throw new Error(
        'Traced path contains curves — expected straight-line polygon output',
      );
    }
    if (token === 'M') {
      if (current.length) subpaths.push(current);
      current = [];
      i++;
      continue;
    }
    if (token === 'L' || token === 'Z') {
      i++;
      continue;
    }
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new Error('Malformed traced path data');
    }
    current.push([x, y]);
    i += 2;
  }
  if (current.length) subpaths.push(current);
  return subpaths.filter((p) => p.length >= 3);
}

function polygonArea(points: OutlinePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

// Raster space is Y-down; CAD/OpenSCAD space is Y-up. Flip once, here, and
// shift the bounding-box min corner to the origin — every downstream
// consumer (visible patch body, needle containment check) reads these same
// normalized points, so there is no transform left for the model to get
// wrong.
function normalize(
  points: OutlinePoint[],
  imageHeight: number,
): OutlinePoint[] {
  const flipped: OutlinePoint[] = points.map(([x, y]) => [x, imageHeight - y]);
  const minX = Math.min(...flipped.map((p) => p[0]));
  const minY = Math.min(...flipped.map((p) => p[1]));
  return flipped.map(([x, y]) => [x - minX, y - minY]);
}

function dedupeClosingPoint(points: OutlinePoint[]): OutlinePoint[] {
  if (points.length < 2) return points;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  return Math.hypot(x1 - x2, y1 - y2) < 1e-6 ? points.slice(0, -1) : points;
}

function simplify(points: OutlinePoint[], tolerance: number): OutlinePoint[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, index + 1), tolerance);
    const right = simplify(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpendicularDistance(
  point: OutlinePoint,
  lineStart: OutlinePoint,
  lineEnd: OutlinePoint,
): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

function boundingBox(points: OutlinePoint[]): {
  width: number;
  height: number;
} {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

// Regenerated from the exact same normalized/simplified point list returned
// to the caller, so this SVG and the `points` array can never drift apart.
// NOTE: this SVG is only ever consumed by the fallback (complex-outline)
// OpenSCAD `import()` path — verify empirically (an asymmetric test shape)
// that OpenSCAD's SVG importer doesn't apply its own Y-flip relative to
// these already Y-up-normalized points before relying on this path.
function toSvg(
  points: OutlinePoint[],
  bbox: { width: number; height: number },
): string {
  const d = `M ${points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ')} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bbox.width.toFixed(3)} ${bbox.height.toFixed(3)}"><path d="${d}" fill="black"/></svg>`;
}
