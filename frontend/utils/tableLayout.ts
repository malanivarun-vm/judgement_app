// Pure geometry for the oval game table. Opponent seats are placed on an
// ellipse hugging the stage bounds. The bottom of the ellipse (90° in
// screen coordinates, y-down) is reserved for the local player's dock, so
// opponents span the arc from lower-left, over the top, to lower-right.

export interface SeatPos {
  left: number;
  top: number;
}

const ARC_START_DEG = 148; // lower-left
const ARC_END_DEG = 392;   // lower-right (32° past 360)

export function seatSize(count: number, stageW: number): { width: number; height: number } {
  // Narrower seats when the top arc gets crowded (5-6 opponents).
  const width = count >= 5 ? Math.min(104, Math.max(88, Math.floor(stageW / 3.6))) : Math.min(120, Math.max(96, Math.floor(stageW / 3.2)));
  return { width, height: 64 };
}

export function seatPositions(
  count: number,
  stageW: number,
  stageH: number,
  seatW: number,
  seatH: number,
): SeatPos[] {
  if (count <= 0) return [];
  const cx = stageW / 2;
  const cy = stageH / 2;
  const rx = Math.max(60, stageW / 2 - seatW / 2 - 2);
  const ry = Math.max(60, stageH / 2 - seatH / 2 - 2);
  const span = ARC_END_DEG - ARC_START_DEG;

  const positions: SeatPos[] = [];
  for (let i = 0; i < count; i++) {
    const deg = count === 1 ? 270 : ARC_START_DEG + (span * i) / (count - 1);
    const rad = (deg * Math.PI) / 180;
    positions.push({
      left: cx + rx * Math.cos(rad) - seatW / 2,
      top: cy + ry * Math.sin(rad) - seatH / 2,
    });
  }
  return positions;
}
