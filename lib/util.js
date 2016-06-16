
const letsShuttleThrough = (v) =>
  v==='nothing' || v==='bridge' || v==='ribbon' || v==='ribbonbridge';

const layerOf = v => v==='shuttle' || v==='thinshuttle' ? 'shuttles' : 'base';

// t=0 -> x, t=1 -> y
const lerp = (t, x, y) => (1 - t)*x + t*y;

const clamp = (x, min, max) => Math.max(Math.min(x, max), min);

module.exports = {letsShuttleThrough, layerOf, lerp, clamp};
