// GL renderer for the grid

import {Map2, Map3, Set2, Set3, Jit, Watcher} from 'boilerplate-jit'
const glify = require('glify');
const assert = require('assert');
import {compileProgram} from './glutil'

// The value here doesn't matter much - and won't until I make a bunch more
// performance tweaks.
const TILE_SIZE = 64;

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

const T = x => Math.floor(x/TILE_SIZE);
const O = x => x - TILE_SIZE * Math.floor(x/TILE_SIZE);

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
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          this.dirty = true;
        } else {
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
        }

        let now = frameTimer.get();
        if (this.dirty || now > this.lastFlush) {
          for (var x = 0; x < TILE_SIZE; x++) {
            for (var y = 0; y < TILE_SIZE; y++) {
              const d = this.data[x + y * TILE_SIZE];
              const v = d & 0x3f;
              if (v === 1 || v === 2 || v === 5) {
                 // Nothing, thinsolid, bridge
                const group = groups.get(x + tx*TILE_SIZE, y + ty*TILE_SIZE, 0);
                const zone = zones.getZoneForGroup(group);
                const p = (zone == null || zone.pressure === 0) ? 0 : (zone.pressure < 0 ? 0x80 : 0x40);
                if ((d & 0xc0) !== p) {
                  // console.log('xx', d & 0xc0, p);
                  this.data[x + y * TILE_SIZE] = v | p;
                  this.dirty = true;
                }
              }
            }
          }
          this.lastFlush = now;
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
    t.data[(ox + TILE_SIZE*oy)] = TEXMAP[v];

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
    }
  };
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
    const {baseGrid, shuttles, groups, zones, currentStates, stepWatch} = modules;

    // Delete old textures so we don't leak.
    if (this.tiles) this.tiles.cleanup();

    this.frameTimer = modules.frameTimer = FrameTimer(currentStates, shuttles, stepWatch);
    this.tiles = modules.tiles = Tiles(this.gl, baseGrid, groups, zones, this.frameTimer);
  }

  draw() {
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
        proj[4] = 2*TWS/view.height;

        proj[2] = 2 * (x * TILE_SIZE * view.size - sx) / view.width - 1;
        proj[5] = 1 - 2 * ((y+1) * TILE_SIZE * view.size - sy) / view.height;
        proj[8] = 1;

        // console.log(proj);

        gl.uniformMatrix3fv(shader.uniforms.proj, false, proj);

        // DRAW!
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

}
