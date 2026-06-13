const EWKB_POINT = 1;
const EWKB_LINESTRING = 2;
const EWKB_SRID_FLAG = 0x20000000;

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function readEwkb(hex: string): [number, number] | number[][] | null {
  const bytes = hexToBytes(hex);
  if (!bytes || bytes.length < 21) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = bytes[0] === 1;
  let offset = 1;

  const type = view.getUint32(offset, littleEndian);
  offset += 4;

  const geometryType = type & 0xff;
  if (type & EWKB_SRID_FLAG) {
    offset += 4;
  }

  if (geometryType === EWKB_POINT) {
    if (offset + 16 > bytes.length) return null;
    const lng = view.getFloat64(offset, littleEndian);
    offset += 8;
    const lat = view.getFloat64(offset, littleEndian);
    return [lng, lat];
  }

  if (geometryType === EWKB_LINESTRING) {
    if (offset + 4 > bytes.length) return null;
    const pointCount = view.getUint32(offset, littleEndian);
    offset += 4;
    const coordinates: number[][] = [];
    for (let i = 0; i < pointCount; i++) {
      if (offset + 16 > bytes.length) return null;
      const lng = view.getFloat64(offset, littleEndian);
      offset += 8;
      const lat = view.getFloat64(offset, littleEndian);
      offset += 8;
      coordinates.push([lng, lat]);
    }
    return coordinates;
  }

  return null;
}

function parseWktPoint(text: string): [number, number] | null {
  const match = text.match(/POINT\s*\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)/i);
  if (!match) return null;
  const lng = Number.parseFloat(match[1]);
  const lat = Number.parseFloat(match[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

export function parseGeoPoint(location: unknown): [number, number] | null {
  if (typeof location === "string") {
    if (/POINT\s*\(/i.test(location)) {
      return parseWktPoint(location);
    }
    const parsed = readEwkb(location);
    return Array.isArray(parsed) && typeof parsed[0] === "number" ? parsed : null;
  }

  if (location && typeof location === "object") {
    const geo = location as { type?: string; coordinates?: number[] };
    if (geo.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
      return [geo.coordinates[0], geo.coordinates[1]];
    }
  }

  return null;
}

export function parseGeoLineString(location: unknown): number[][] | null {
  if (typeof location === "string") {
    const parsed = readEwkb(location);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return Array.isArray(parsed[0]) ? (parsed as number[][]) : null;
  }

  if (location && typeof location === "object") {
    const geo = location as { type?: string; coordinates?: number[][] };
    if (geo.type === "LineString" && Array.isArray(geo.coordinates)) {
      return geo.coordinates;
    }
  }

  return null;
}
