// GL renderer for the grid

import {Map2, Map3, Set2, Set3, Jit} from 'boilerplate-jit'
const glify = require('glify');
const assert = require('assert');
import {compileProgram} from './glutil'

const TILE_SIZE = 256;

const TEXMAP = {};
['solid', 'nothing', 'thinsolid', 'positive', 'negative', 'bridge', 'shuttle', 'thinshuttle'].forEach((v, i) => {TEXMAP[v] = i;});

function nearestPowerOf2(v) {
  v--;
  v|=v>>1; v|=v>>2; v|=v>>4; v|=v>>8; v|=v>>16;
  return v + 1;
}

const T = x => Math.floor(x/TILE_SIZE);
const O = x => x - TILE_SIZE * Math.floor(x/TILE_SIZE);

function Tiles(gl, baseGrid) {
  const tiles = new Map2();

  function makeTile() {
    return {
      count: 0,

      // RGB. R channel for tiles, GB for group ID.
      data: new Uint8Array(TILE_SIZE * TILE_SIZE * 3),
      dirty: false,
      tex: -1,
      groups: new Set(),
      bind() {
        if (this.tex == -1) {
          this.tex = gl.createTexture();
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
        }

        if (this.dirty) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, TILE_SIZE, TILE_SIZE, 0, gl.RGB, gl.UNSIGNED_BYTE, this.data);
        }
      }
    };
  }

  tiles.default = makeTile;

  baseGrid.afterWatch.forward((x, y, oldv, v) => {
    const tx = T(x), ty = T(y);
    const ox = O(x), oy = O(y);

    const t = tiles.getDef(tx, ty);
    if (oldv != null) t.count--;
    if (v != null) t.count++;
    t.dirty = true;
    t.data[(ox + TILE_SIZE*oy) * 3] = TEXMAP[v];

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

function TileGroups(tiles, groups) {
  const pids = [];
  let maxPid = 0; // Pressure ids number from 1.

  function setAll(group, value) {
    group.points.forEach((x, y, c, v) => {
      if (c != 0) return;
      if (v === 'positive' || v === 'negative') return;

      const t = tiles.get(x, y);
      assert(t);
      t.dirty = true;

      const vh = value >> 8;
      const vl = value & 0xff;
      const ox = O(x), oy = O(y);
      const offset = (ox + TILE_SIZE*oy)*3;
      t.data[offset + 1] = vh;
      t.data[offset + 2] = vl;
      // console.log(offset, vh, vl);

      if (value)
        t.groups.add(group);
      else
        t.groups.delete(group);
    });
  }

  groups.addWatch.on(group => {
    group.pid = pids.length ? pids.pop() : ++maxPid;
    setAll(group, group.pid);
  });

  groups.deleteWatch.on(group => {
    pids.push(group.pid);
    setAll(group, 0);
  });

  return {
    flush() {
      groups.flush();
    },
    maxId() { return maxPid; }
  };
}

function PressureMap(gl, tileGroups, zones) {
  const dependantZones = new Set();
  // let dirty = true;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // zones.watch.on(z => {
  //   if (dependantZones.has(z)) {
  //     dependantZones.clear();
  //     dirty = true;
  //   }
  // });

  let arr = null;

  return {
    size: 0,
    bind(groups) {
      let dirty = false;
      if (!arr || arr.length < tileGroups.maxId()) {
        arr = new Uint8Array(nearestPowerOf2(tileGroups.maxId()));
        this.size = arr.length;
        dirty = true;
      }

      groups.forEach(g => {
        const z = zones.getZoneForGroup(g);
        const p = !z ? 0 : z.pressure < 0 ? 1 : z.pressure > 0 ? 2 : 0;
        if (arr[g.pid] != p) {
          dirty = true;
          arr[g.pid] = p;
        }
      });

      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (dirty) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, arr.length, 1, 0,
           gl.LUMINANCE, gl.UNSIGNED_BYTE, arr);
        // console.log('so dirty', arr, tileGroups.maxId());
      }
    },
    cleanup() {
      gl.deleteTexture(tex);
    }
  }
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

    this.shader = compileProgram(gl, glify('./grid.*.glsl'), ['proj', 'psize', 'tile', 'pressure'], ['pos']);

    this.verts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    const tverts = new Float32Array([0,0, 0,1, 1,0, 1,1]);
    gl.bufferData(gl.ARRAY_BUFFER, tverts, gl.STATIC_DRAW);
  }

  addModules(jit) {
    const modules = jit.modules;
    const {baseGrid, groups, zones} = modules;

    // Delete old textures so we don't leak.
    if (this.tiles) this.tiles.cleanup();
    if (this.pressureMap) this.pressureMap.cleanup();

    this.tiles = modules.tiles = Tiles(this.gl, baseGrid);
    this.tileGroups = modules.tileGroups = TileGroups(this.tiles, groups);
    this.pressureMap = modules.pressureMap = PressureMap(this.gl, this.tileGroups, zones);
  }

  draw() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.tileGroups.flush();

    const shader = this.shader;
    gl.useProgram(shader.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    // index, size, type, normalized, stride, offset from the buffer
    gl.vertexAttribPointer(shader.attrs.pos, 4, gl.FLOAT, false, 8, 0);

    const view = this.view;
    const maxtx = T(view.scrollX + view.width / view.size);
    const maxty = T(view.scrollY + view.height / view.size);

    // const groups = new Set();
    // for (let x = T(view.scrollX); x <= maxtx; x++) {
    //   for (let y = T(view.scrollY); y <= maxty; y++) {
    //     const t = this.tiles.data.get(x, y);
    //     if (!t) continue;
    //     t.groups.forEach(g => {groups.add(g);});
    //     // t.bind();
    //   }
    // }

    // Texture 0 == tile.
    // Texture 1 == pressure map
    // gl.activeTexture(gl.TEXTURE1);
    // gl.uniform1i(shader.uniforms.pressure, 1);
    // this.pressureMap.bind(groups);
    // gl.uniform1i(shader.uniforms.psize, this.pressureMap.size);
    // console.log('s', this.pressureMap.size);

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
