
export function letsShuttleThrough(v) {
  return v==='nothing' || v==='bridge' || v==='ribbon' || v==='ribbonbridge';
}

export function layerOf(v) {
  return v==='shuttle' || v==='thinshuttle' ? 'shuttles' : 'base';
}

// t=0 -> x, t=1 -> y
export function lerp(t, x, y) { return (1 - t)*x + t*y; }

export function clamp(x, min, max) { return Math.max(Math.min(x, max), min); }

