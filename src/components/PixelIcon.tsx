/* Pixel-art icons drawn from tiny character grids ('#' = a pixel), in currentColor. */

const GRIDS = {
  arrow: [
    '...#....',
    '...##...',
    '#######.',
    '########',
    '#######.',
    '...##...',
    '...#....',
  ],
  close: [
    '##...##',
    '###.###',
    '.#####.',
    '..###..',
    '.#####.',
    '###.###',
    '##...##',
  ],
  gear: [
    '....#....',
    '.#.###.#.',
    '..#####..',
    '.##...##.',
    '###...###',
    '.##...##.',
    '..#####..',
    '.#.###.#.',
    '....#....',
  ],
  skip: [
    '#...#...',
    '##..##..',
    '###.###.',
    '########',
    '###.###.',
    '##..##..',
    '#...#...',
  ],
} as const;

export type PixelIconName = keyof typeof GRIDS;

export function PixelIcon({ name, size = 14, className = '' }: { name: PixelIconName; size?: number; className?: string }) {
  const g = GRIDS[name];
  const w = g[0].length, h = g.length;
  const rects: JSX.Element[] = [];
  g.forEach((row, y) => {
    // merge runs of pixels into one rect per run
    let x = 0;
    while (x < w) {
      if (row[x] !== '#') { x++; continue; }
      const start = x;
      while (x < w && row[x] === '#') x++;
      rects.push(<rect key={`${y}-${start}`} x={start} y={y} width={x - start} height={1} />);
    }
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={(size * w) / Math.max(w, h)} height={(size * h) / Math.max(w, h)} fill="currentColor" shapeRendering="crispEdges" className={className} aria-hidden>
      {rects}
    </svg>
  );
}
