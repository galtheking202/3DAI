/**
 * Minimal ISO-BMFF (MP4 / QuickTime .mov) header reader: just enough to learn a
 * video's display size and duration before paying a provider to process it.
 * No dependency, no decoding — it walks the box tree to `moov/mvhd` (duration)
 * and the video track's `tkhd` (width/height).
 */

export type VideoInfo = {
  width: number;
  height: number;
  durationSec: number;
};

type Box = { type: string; start: number; end: number };

/** The direct child boxes of [start, end). Stops quietly on a malformed size. */
function children(buf: Buffer, start: number, end: number): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) break;
    out.push({ type, start: p + header, end: p + size });
    p += size;
  }
  return out;
}

function find(buf: Buffer, start: number, end: number, type: string): Box | undefined {
  return children(buf, start, end).find((b) => b.type === type);
}

/**
 * Width, height and duration of an MP4/MOV, or null if the header can't be
 * read (not ISO-BMFF, or truncated). Width/height are the track's display
 * size before any rotation matrix, so a portrait phone video reports e.g.
 * 1920x1080 — compare with the larger and smaller sides, not w and h.
 */
export function readVideoInfo(buf: Buffer): VideoInfo | null {
  const moov = find(buf, 0, buf.length, "moov");
  if (!moov) return null;

  const mvhd = find(buf, moov.start, moov.end, "mvhd");
  if (!mvhd) return null;
  const v = buf.readUInt8(mvhd.start);
  let timescale: number;
  let duration: number;
  if (v === 1) {
    timescale = buf.readUInt32BE(mvhd.start + 20);
    duration = Number(buf.readBigUInt64BE(mvhd.start + 24));
  } else {
    timescale = buf.readUInt32BE(mvhd.start + 12);
    duration = buf.readUInt32BE(mvhd.start + 16);
  }
  if (!timescale) return null;

  for (const trak of children(buf, moov.start, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = find(buf, trak.start, trak.end, "mdia");
    const hdlr = mdia && find(buf, mdia.start, mdia.end, "hdlr");
    if (!hdlr || buf.toString("latin1", hdlr.start + 8, hdlr.start + 12) !== "vide") {
      continue;
    }
    const tkhd = find(buf, trak.start, trak.end, "tkhd");
    if (!tkhd || tkhd.end - tkhd.start < 84) continue;
    // width/height are the box's last two 16.16 fixed-point fields.
    const width = buf.readUInt32BE(tkhd.end - 8) / 65536;
    const height = buf.readUInt32BE(tkhd.end - 4) / 65536;
    return { width, height, durationSec: duration / timescale };
  }
  return null;
}
