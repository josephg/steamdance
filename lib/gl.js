// GL renderer for the grid

import {Map2, Map3, Set2, Set3, Jit, Watcher, util as jitutil} from 'boilerplate-jit'
const {DIRS} = jitutil;
const glify = require('glify');
const assert = require('assert');
import {compileProgram} from './glutil'

// The value here doesn't matter much - and won't until I make a bunch more
// performance tweaks.
const TILE_SIZE = 16;

const TEXMAP = {};

(() => {
  const VALS = [
    'solid',
    'nothing', 'thinsolid',
    'positive', 'negative',
    'bridge',
    'ribbon', 'ribbonbridge'
  ];
  for (let i = 1; i <= 16; i++) {
    VALS.push("ins" + i);
  }
  VALS.forEach((v, i) => {TEXMAP[v] = i;});
})();


function nearestPowerOf2(v) {
  v--;
  v|=v>>1; v|=v>>2; v|=v>>4; v|=v>>8; v|=v>>16;
  return v + 1;
}
assert.equal(TILE_SIZE, nearestPowerOf2(TILE_SIZE));
const TILE_OFFSET_MASK = TILE_SIZE-1; // hax :D

// Awesome bittweaking is awesome, but it has an off-by-1 error for negative
// numbers.
//const T = x => (x & ~TILE_OFFSET_MASK)/TILE_SIZE;
const T = x => Math.floor(x/TILE_SIZE);
const O = x => x & TILE_OFFSET_MASK;
const P = p => (p > 0) ? 0x40 : (p < 0) ? 0x80 : 0;

function FrameTimer(currentStates, shuttles, stepWatch) {
  let time = 1;
  let watch = new Watcher(() => time);

  let inFrame = false;

  stepWatch.on(when => {
    if (when === 'before') {
      inFrame = true;
    } else if (when === 'after') {
      inFrame = false;
      watch.signal(++time);
    }
  });

  function edit() {
    // console.log('edit');
    if (!inFrame) watch.signal(++time);
  }
  // If the user manually moves a shuttle, we'll need to recalculate.
  currentStates.watch.on(edit);

  // Or if the user adds or removes a shuttle...
  shuttles.addWatch.on(edit);
  shuttles.deleteWatch.on(edit);

  return {
    watch,
    get() { return time; }
  };
}

// Keep track of the set of groups which have pressure.
// This module is eager - it'll push out pressure changes across the entire map
// whenever a step happens.
//
// It relies on engines being flush()'ed.
function GroupsWithPressure(engines, groups, regions, zones, currentStates) {
  // Groups start off in dirtySeeds. On flush() we create pressure objects and
  // they move to activePressure. When their zone is destroyed they go to
  // dirtyPressure and on the next flush call we tell our watchers about them.
  // Then dirtyPressure is cleared.
  const pendingSeedPoints = [];
  const dirtySeeds = new Set;
  const activePressure = new Set; // for cold start
  const dirtyPressure = [];

  // const pressureForSeed = new Map; // seed -> pressure
  const pressureForZone = new WeakMap; // zone -> current pressure object.

  // const seedPoints = new WeakMap; // group -> list of {x,y,c}.
  // seedPoints.default = () => [];

  const watch = new Watcher(fn => {
    const all = [];
    activePressure.forEach((p) => all.add(pressure));
    fn([], all);
  })


  // This module keeps track of which groups have pressure. We'll be eager about
  // fetching groups. This relies on calling engines.flush() at the right times.
  engines.addWatch.forward(e => {
    e.edges.forEach((x, y, dir) => {
      pendingSeedPoints.push({x, y, c:dir});
      // addSeed(e, x, y, dir);
    });
  });

  engines.deleteWatch.on(e => {
    // console.log('engine delete', e);
    for (let i = 0; i < pendingSeedPoints.length; i++) {
      const {x, y, c} = pendingSeedPoints[i];
      if (e.points.has(x, y)) {
        // console.log('removing', x, y);
        pendingSeedPoints[i] = pendingSeedPoints[pendingSeedPoints.length - 1];
        i--;
        pendingSeedPoints.length--;
      }
    }
  });

  function makePressurized(seed) { // seed is a group.
    const pressure = {
      regions: new Set,
      // groups: new Set,
      pressure: 0,
      seeds: [] // almost always just 1 item.
    };

    // Flood fill to find all the regions.
    const r0 = regions.get(seed, currentStates.map);
    assert(r0);
    jitutil.fillGraph(r0, (r, hmm) => {
      pressure.regions.add(r);
      r.groups.forEach(g => {
        // pressure.groups.add(g)
        if (dirtySeeds.has(g)) {
          // assert(!pressureForSeed.has(g));

          pressure.seeds.push(g);
          dirtySeeds.delete(g);
          // pressureForSeed.set(g, pressure);
        }
      });
      // pressure.regions.add(r);
      r.edges.forEach(g => {
        assert(g.used);
        const r2 = regions.get(g, currentStates.map);
        if (r2) hmm(r2);
      });
    });

    // We could calculate the pressure here, but the zone will need be generated
    //  anyway. We may as well just reuse its pressure calculation.
    const zone = zones.getZoneForRegion(r0);
    pressure.pressure = zone.pressure;
    pressureForZone.set(zone, pressure);
    activePressure.add(pressure);

    return pressure;
  }


  function deleteSeed(group) {
    // console.log('ds', group);
    assert(!dirtySeeds.has(group));
    group.engines.forEach(e => {
      if (e.used) e.edges.forEach((x, y, dir) => {
        if (group.points.has(x, y, dir)) {
          // console.log('pushing point back', x, y, dir, e, e.used);
          pendingSeedPoints.push({x, y, c:dir});
        }
      });
    });
  }

  // If an engine gets deleted, the groups and zones will get deleted too.
  // The only thing we need to clean up is the dirty groups.
  groups.deleteWatch.on(g => {
    // The pressure object will be removed anyway because the zone will get destroyed.
    if (dirtySeeds.delete(g)) {
      // console.log('deleting seed', g);
      deleteSeed(g);
    }
  });

  zones.watch.on(z => {
    const p = pressureForZone.get(z);
    if (!p) return;
    // console.log('dirty pressure', p);
    dirtyPressure.push(p);
    for (var i = 0; i < p.seeds.length; i++) {
      const s = p.seeds[i];
      if (s.used)
        dirtySeeds.add(s);
      else
        deleteSeed(s);
    }
    // pressureForZone.delete(z); // its a weak map. not needed.
    activePressure.delete(p);
  });

  return {
    watch,
    flush() {
      engines.flush();
      if (pendingSeedPoints.length) {
        for (var i = 0; i < pendingSeedPoints.length; i++) {
          const {x, y, c} = pendingSeedPoints[i];
          const g = groups.get(x, y, c);
          if (g) {
            // console.log('addSeed', x, y, c, g);
            dirtySeeds.add(g);
          }
        }
        pendingSeedPoints.length = 0;
      }

      const newPressure = [];
      // console.log('flush', dirtySeeds);
      dirtySeeds.forEach(s => {
        // console.log('dirty seed', s);
        newPressure.push(makePressurized(s));
      });
      assert.equal(dirtySeeds.size, 0);

      watch.signal(dirtyPressure, newPressure);
      dirtyPressure.length = 0;
    }
  };
}

function Tiles(gl, baseGrid, groups, zones, frameTimer) {
  const tiles = new Map2(makeTile);

  function makeTile(tx, ty) {
    return {
      lastFlush: -1,
      count: 0,

      // One channel. High 2 bits for pressure, low 6 bits for value.
      data: new Uint8Array(TILE_SIZE * TILE_SIZE),
      dirty: false,
      tex: -1,
      bind() {
        if (this.tex == -1) {
          this.tex = gl.createTexture();
          // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          this.dirty = true;
        } else {
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
        }

        if (this.dirty) {
          // console.log('dirty', tx, ty);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, TILE_SIZE, TILE_SIZE, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.data);
          this.dirty = false;
        }
      }
    };
  }

  baseGrid.afterWatch.forward((x, y, oldv, v) => {
    const tx = T(x), ty = T(y);
    const ox = O(x), oy = O(y);

    const t = tiles.getDef(tx, ty);
    if (oldv != null) t.count--;
    if (v != null) t.count++;
    t.dirty = true;
    t.data[(ox + oy * TILE_SIZE)] = TEXMAP[v];
    // t.data[(ox + (TILE_SIZE - oy - 1) * TILE_SIZE)] = TEXMAP[v];

    if (t.count == 0) {
      // console.log('deleting tile', tx, ty);
      tiles.delete(tx, ty);
      if (t.tex != -1) gl.deleteTexture(t.tex);
    }
  });

  return {
    data: tiles,
    get(x, y) { return tiles.get(T(x), T(y)); },
    cleanup() {
      tiles.forEach(t => {
        if (t.tex != -1) { gl.deleteTexture(t.tex); }
      })
    },
    setPressure(group, pressure) {
      let _tx = 0, _ty = 0;
      let t = null;
      group.points.forEach((x, y, c, v) => {
        if (v === 'nothing' || v === 'thinsolid') {
          const tx = T(x), ty = T(y);
          const ox = O(x), oy = O(y);

          if (t === null || tx !== _tx || ty !== _ty) {
            t = tiles.get(tx, ty);
            _tx = tx; _ty = ty;
          }

          if (t === undefined) {
            assert(pressure === 0);
            return;
          }

          const offset = ox + oy * TILE_SIZE;
          const oldv = t.data[offset];
          // assert(oldv === 1 || oldv === 2);
          t.data[offset] = (oldv & 0x3f) | pressure;
          t.dirty = true;
        }
      });
    }
  };
}

function GroupPressure(tiles, groupsWithPressure) {
  function set(group, pressure) {
    tiles.setPressure(group, pressure);
  }

  groupsWithPressure.watch.forward((oldp, newp) => {
    // old and new are lists. We need to figure out the set of groups to update.
    // Each group will appear zero or one times in old, and zero or one times in
    // new.

    const newGroups = new Map; // group -> pressure.
    for (let i = 0; i < newp.length; i++) {
      const p = newp[i];
      // console.log('newp', p);
      if (p.pressure === 0) continue;
      p.regions.forEach(r => r.groups.forEach(g => {
        newGroups.set(g, p.pressure);
      }));
    }
    for (let i = 0; i < oldp.length; i++) {
      const p = oldp[i];
      // console.log('oldp', p);
      if (p.pressure === 0) continue;
      const _p = P(p.pressure);
      p.regions.forEach(r => r.groups.forEach(g => {
        if (newGroups.has(g)) {
          if (_p === P(newGroups.get(g))) {
            newGroups.delete(g);
          }
        } else {
          set(g, 0);
        }
      }));
    }
    newGroups.forEach((p, g) => set(g, P(p)));
  });
}

export default class GLRenderer {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    //this.jit = jit;
    const opts = {antialias:true, depth:false};
    const gl = this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);

    view.watch.forward(({width, height}) => {
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;

      gl.viewport(0,0, canvas.width, canvas.height);
      //this.updateProjection();
      // this.draw();
    });

    this.shader = compileProgram(gl, glify('./grid.*.glsl'), ['proj', 'tile'], ['pos']);

    this.verts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    const tverts = new Float32Array([0,0, 0,1, 1,0, 1,1]);
    gl.bufferData(gl.ARRAY_BUFFER, tverts, gl.STATIC_DRAW);
  }

  addModules(jit) {
    const modules = jit.modules;
    const {
      baseGrid,
      shuttles, engines,
      groups, regions, zones,
      currentStates,
      stepWatch
    } = modules;

    // Delete old textures so we don't leak.
    if (this.tiles) this.tiles.cleanup();

    this.frameTimer = modules.frameTimer = FrameTimer(currentStates, shuttles, stepWatch);
    this.tiles = modules.tiles = Tiles(this.gl, baseGrid, groups, zones, this.frameTimer);
    this.groupWithPressure = modules.groupWithPressure = GroupsWithPressure(engines, groups, regions, zones, currentStates);
    this.groupPressure = GroupPressure(this.tiles, this.groupWithPressure);
  }

  draw() {
    this.groupWithPressure.flush();
    // console.log('draw base');
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const shader = this.shader;
    gl.useProgram(shader.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    // index, size, type, normalized, stride, offset from the buffer
    gl.vertexAttribPointer(shader.attrs.pos, 2, gl.FLOAT, false, 8, 0);

    const view = this.view;
    const maxtx = T(view.scrollX + view.width / view.size);
    const maxty = T(view.scrollY + view.height / view.size);

    // Might be better off with a 16 array - I hear 4x4 matricies are faster?
    const proj = new Float32Array(9);

    for (let x = T(view.scrollX); x <= maxtx; x++) {
      for (let y = T(view.scrollY); y <= maxty; y++) {
        const t = this.tiles.data.get(x, y);
        if (!t) continue;

        // console.log('rendering tile', x, y);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(shader.uniforms.tile, 0);
        t.bind();

        const view = this.view;
        // Tile width in pixels
        const TWS = TILE_SIZE * view.size;

        // Scroll size in pixels, rounded off to avoid weird glitching
        const sx = Math.floor(view.scrollX * view.size);
        const sy = Math.floor(view.scrollY * view.size);

        proj[0] = 2*TWS/view.width;
        proj[4] = -2*TWS/view.height;

        proj[2] = 2 * (x * TILE_SIZE * view.size - sx) / view.width - 1;
        proj[5] = 1 - 2 * (y * TILE_SIZE * view.size - sy) / view.height;
        proj[8] = 1;

        // console.log(proj);

        gl.uniformMatrix3fv(shader.uniforms.proj, false, proj);

        // DRAW!
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

}
