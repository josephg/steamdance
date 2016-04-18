const assert = require('assert');

import {Jit, Map2, Map3, Set2, Set3, util, Watcher} from 'boilerplate-jit';
const DIRS = util.DIRS;

import {letsShuttleThrough, lerp, clamp} from './util';
import View from './view';

import GLRenderer from './gl';

//var , Boilerplate, , , , , PrevState, , Set2, Set3, View, Watcher, addModules, assert, clamp, fl, layerOf, lerp, letsShuttleThrough, line, ref, ref1, util;

const SHUTTLE = 0x40, THINSHUTTLE = 0x80;

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

const fl = Math.floor;

const KEY = {
  up:    1 << 0,
  right: 1 << 1,
  down:  1 << 2,
  left:  1 << 3,
  shift: 1 << 4
};

const svStr = (sv) =>
  (typeof sv === 'string') ? sv
    : sv == null ? 'null'
    : (sv & SHUTTLE ? 'S' : 'A') +
      Array.prototype.map.call('urdl', (s, i) => (sv & (1<<i) ? s : '_')).join('');

// We have some additional modules to chain to the jit.

function BlobBounds(blobFiller) {
  // This calculates the bounds of all shuttles and engines.

  blobFiller.addWatch.on(blob => {
    // I'm lazy. I'll just dump it on the blob itself.
    var bottom = -1<<30, right = -1<<30,
      left = 1<<30, top = 1<<30;

    var points = blob.points, edges = blob.edges;
    (points.size < edges.size ? points : edges).forEach((x, y) => {
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    });

    blob.bounds = {left, top, right, bottom};
  });
}

function PrevState(shuttles, currentStates, stepWatch) {
  // Here we store enough information to know what the state of every shuttle
  // was before the most recent call to step().

  // I'd use a WeakMap here but apparently in chrome weakmaps don't support
  // .clear().
  var prevState = new Map;
  shuttles.deleteWatch.on(shuttle => prevState.delete(shuttle));

  currentStates.watch.on((shuttle, prev) => {
    if (!prev) return; // This will fire when the shuttle is first created
    prevState.set(shuttle, prev);
  });

  stepWatch.on(time => {
    if (time !== 'before') return;

    prevState.clear();
  });

  return {
    get(shuttle) { return prevState.get(shuttle); }
  };
}

function addModules(jit) {
  const stepWatch = jit.modules.stepWatch = new Watcher;
  const {shuttles, engines, currentStates} = jit.modules;

  BlobBounds(shuttles);
  BlobBounds(engines);

  const prevState = PrevState(shuttles, currentStates, stepWatch);

  jit.modules.prevState = prevState;
}

function line(x0, y0, x1, y1, f) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const ix = x0 < x1 ? 1 : -1;
  const iy = y0 < y1 ? 1 : -1;
  var e = 0;
  for (var i = 0; i <= dx+dy; i++) {
    f(x0, y0);
    var e1 = e + dy;
    var e2 = e - dx;
    if (Math.abs(e1) < Math.abs(e2)) {
      x0 += ix;
      e = e1;
    } else {
      y0 += iy;
      e = e2;
    }
  }
}

function enclosingRect(a, b) {
  return {
    tx: Math.min(a.tx, b.tx),
    ty: Math.min(a.ty, b.ty),
    tw: Math.abs(b.tx - a.tx) + 1,
    th: Math.abs(b.ty - a.ty) + 1
  };
}

const COLORS = {
  bridge: 'rgb(26, 126, 213)',
  // bridge: 'hsl(216, 92%, 33%)'
  // thinbridge: 'hsl(203, 67%, 51%)'
  negative: 'hsl(16, 68%, 50%)',
  nothing: 'hsl(0, 0%, 100%)',
  positive: 'hsl(120, 52%, 58%)',
  shuttle: 'hsl(283, 65%, 45%)',
  solid: 'hsl(184, 49%, 7%)',
  thinshuttle: 'hsl(283, 89%, 75%)',
  thinsolid: 'hsl(0, 0%, 71%)',
  //interface: 'hsl(44, 87%, 52%)',
  ribbon: 'rgb(185, 60, 174)',
  ribbonbridge: 'rgb(108, 30, 217)'
};

// These colors are pretty ugly but they'll do for now. Maybe just 1 color but
// with numbers drawn on the cell?
(() => {
  for (var i = 1; i <= 8; i++) {
    COLORS[`ins${i}`] = `hsl(188, ${24 + 6 * i}%, ${43 - 2*i}%)`;
    COLORS[`ins${i+8}`] = `hsl(44, #{24 + 6 * i}%, #{43 - 2*i}%)`;
  }
})();


class Boilerplate {

  changeTool(newTool) {
    this.activeTool = (newTool === 'solid') ? null : newTool;

    this.onToolChanged && this.onToolChanged(this.activeTool);
    this.updateCursor();
  }

  addKeyListener(el) {
    el.addEventListener('keydown', e => {
      const kc = e.keyCode;
      // console.log(kc);

      var newTool = {
        // 1-9
        49: 'nothing',
        50: 'thinsolid',
        51: 'solid',
        52: 'positive',
        53: 'negative',
        54: 'shuttle',
        55: 'thinshuttle',
        56: 'bridge',
        57: 'ribbon',

        80: 'positive', // p
        78: 'negative', // n
        83: 'shuttle', // s
        65: 'thinshuttle', // a
        69: 'nothing', // e
        71: 'thinsolid', // g
        68: 'solid', // d
        66: 'bridge', // b
        82: 'ribbon' // r
      }[kc];

      if (e.ctrlKey) {
        const a = e.shiftKey ? 8 : 0;
        // ins1 to ins16.
        if (49 <= kc && kc <= 57) newTool = `ins${kc - 48 + a}`;
        if (newTool === 'nothing') newTool = 'bridge';
        if (newTool === 'ribbon') newTool = 'ribbonbridge';
      }

      //console.log('newTool', newTool);

      if (newTool) {
        if (this.selection) {
          // Fill the entire selection with the new brush
          for (var x = 0; x < this.selection.tw; x++) {
            for (var y = 0; y < this.selection.th; y++) {
              if (newTool === 'solid') {
                this.selection.base.delete(x, y);
                this.selection.shuttles.delete(x, y);
              } else if (newTool === 'shuttle' || newTool === 'thinshuttle') {
                if (!letsShuttleThrough(this.selection.base.get(x, y))) {
                  this.selection.base.set(x, y, 'nothing');
                }
                this.selection.shuttles.set(x, y, newTool);
              } else {
                this.selection.base.set(x, y, newTool);
                this.selection.shuttles.delete(x, y);
              }
            }
          }
        } else {
          // No selection. Just change the tool.
          this.changeTool(newTool);
        }
      }

      if (37 <= e.keyCode && e.keyCode <= 40) {
        this.lastKeyScroll = Date.now();
      }

      switch (kc) {
        // Left, right, up, down.
        case 37: this.keysPressed |= KEY.left; break;
        case 39: this.keysPressed |= KEY.right; break;
        case 38: this.keysPressed |= KEY.up; break;
        case 40: this.keysPressed |= KEY.down; break;

        case 16: // Shift
          this.keysPressed |= KEY.shift;
          this.imminentSelect = true;
          break;

        case 27: case 192: // Escape.
          if (this.selection)
            this.clearSelection();
          else
            this.changeTool('move');
          break;

        case 190: // '.'
          this.view.snap(this.mouse);
          this.drawAll();
          break;

        case 88: // 'x'
          if (this.selection) this.flip('x');
          break;
        case 89: // 'y'
          if (this.selection) this.flip('y');
          break;
        case 77: // 'm'
          if (this.selection) this.mirror();
          break;

        case 187: case 189: // plus, minus.
          var amt = Math.max(1, this.view.size / 8) / 20;
          if (kc === 189) amt *= -1; // minus key
          if (this.keysPressed & KEY.shift) amt *= 3;
          this.view.zoomBy(amt, {x: this.width/2, y: this.height/2});
          break;
      }

      if ((e.ctrlKey || e.metaKey) && kc === 90) { // Ctrl+Z or Cmd+Z
        if (e.shiftKey) this.redo(); else this.undo();
        e.preventDefault();
      } else if (e.ctrlKey && kc === 89) { // Ctrl+Y for windows
        this.redo();
        e.preventDefault();
      }

      this.draw();
    });

    el.addEventListener('keyup', e => {
      if (37 <= e.keyCode && e.keyCode <= 40)
        this.lastKeyScroll = Date.now();

      switch (e.keyCode) {
        case 16: // Shift
          this.keysPressed &= ~KEY.shift;
          this.imminentSelect = false;
          this.draw();
          break;

        // Left, right, up, down.
        case 37: this.keysPressed &= ~KEY.left; break;
        case 39: this.keysPressed &= ~KEY.right; break;
        case 38: this.keysPressed &= ~KEY.up; break;
        case 40: this.keysPressed &= ~KEY.down; break;
      }
    });

    el.addEventListener('blur', () => {
      this.mouse.mode = null;
      this.imminentSelect = false;
      this.editStop();
      this.draw();
    });

    el.addEventListener('copy', e => this.copy(e));
    el.addEventListener('paste', e => this.paste(e));
  }




  set(x, y, bv, sv) {
    const bp = this.jit.get('base', x, y) || null;
    var sp = this.jit.get('shuttles', x, y) || null;
    if (bv == bp && sp == sv) return false;

    this.onEdit(x, y, bp, sp); // Add to the undo stack
    this.jit.set(x, y, bv, sv);
    return true;
  }

  resetView() { this.view.reset(this.options); }

  setJSONGrid(json) {
    this.jit = Jit(json);
    addModules(this.jit);
    this.gridRenderer.addModules(this.jit);

    // Stop dragging a shuttle if it gets wiped out. This might not be an issue
    // now that shuttles don't automerge, but its *more correct*.
    this.jit.modules.shuttles.deleteWatch.on(s => {
      if (this.draggedShuttle && s === this.draggedShuttle.shuttle)
        this.draggedShuttle = null;
    });

    this.currentEdit = null;
    this.undoStack.length = this.redoStack.length = 0;
    this.drawAll();
  }

  getJSONGrid() { return this.jit.toJSON(); }

  constructor(el, options) {
    this.el = el;
    this.options = options || {};

    this.keysPressed = 0; // bitmask. up=1, right=2, down=4, left=8.
    this.lastKeyScroll = 0; // epoch time

    this.activeTool = 'move';

    // A list of patches
    this.currentEdit = null;
    this.undoStack = [];
    this.redoStack = [];

    this.view = new View(this.el.offsetWidth, this.el.offsetHeight, this.options);

    this.canScroll = this.options.canScroll != null ? this.options.canScroll : true;
    this.animTime = this.options.animTime || 0;

    if (this.el.tabIndex === -1) this.el.tabIndex = 0; // Allow keyboard events.

    this.gridCanvas = this.el.appendChild(document.createElement('canvas'));
    this.gridCanvas.className = 'draw';
    this.gridCanvas.style.backgroundColor = COLORS.solid;

    this.dynCanvas = this.el.appendChild(document.createElement('canvas'));
    this.dynCanvas.className = 'draw';

    this.el.boilerplate = this;

    this.gridRenderer = new GLRenderer(this.gridCanvas, this.view);

    this.setJSONGrid(this.options.grid);

    this.mouse = {x: null, y: null, mode: null};
    this.imminentSelect = false;
    this.selectedA = this.selectedB = null;
    this.selectOffset = null;
    this.selection = null;

    this.drawAll();


    // ------- Event handlers

    this.view.watch.forward(d => {
      this.width = d.width; this.height = d.height;

      this.dynCanvas.width = d.width * devicePixelRatio;
      this.dynCanvas.height = d.height * devicePixelRatio;

      // I'm not sure why this is needed?
      //@dynCanvas.style.width = @gridCanvas.style.width = @width + 'px'
      //@dynCanvas.style.height = @gridCanvas.style.height = @height + 'px'

      this.dctx = this.dynCanvas.getContext('2d');
      this.dctx.scale(devicePixelRatio, devicePixelRatio);

      this.drawAll();
    });

    this.el.onmousemove = e => {
      this.imminentSelect = !!e.shiftKey;

      // If the mouse is released / pressed while not in the box, handle that correctly
      // (although this is still a little janky with dragging I think)
      if (e.button && !this.mouse.mode) this.el.onmousedown(e);
      if (this.updateMousePos(e)) this.cursorMoved();

      if (this.mouse && this.jit.get('base', this.mouse.tx, this.mouse.ty)) {
        this.draw();
      }
    };

    this.el.onmousedown = e => {
      this.updateMousePos(e);

      if (e.shiftKey) {
        this.mouse.mode = 'select';
        this.clearSelection();
        this.selectedA = this.view.screenToWorld(this.mouse.x, this.mouse.y);
        this.selectedB = this.selectedA;
      } else if (this.selection) {
        this.stamp();
      } else {
        if (this.activeTool === 'move') {
          const shuttle = this.jit.modules.shuttleGrid.getShuttle(this.mouse.tx, this.mouse.ty);
          if (shuttle) {
            // Grab that sucka!
            const dx = shuttle.currentState.dx, dy = shuttle.currentState.dy;
            this.draggedShuttle = {
              shuttle: shuttle,
              heldPoint: {x:this.mouse.tx - dx, y:this.mouse.ty - dy}
            };
            shuttle.held = true;
          }
        } else {
          this.mouse.mode = 'paint';
          this.mouse.from = {tx: this.mouse.tx, ty: this.mouse.ty};
          this.mouse.direction = null;
          this.editStart();
          this.paint();
        }
      }
      this.updateCursor();
      this.draw();
    };

    this.el.onmouseup = () => {
      if (this.draggedShuttle) {
        this.draggedShuttle.shuttle.held = false;
        this.draggedShuttle = null;
      }

      if (this.mouse.mode === 'select') {
        this.selection = this.copySubgrid(enclosingRect(this.selectedA, this.selectedB));
        this.selectOffset = {
          tx: this.selectedB.tx - Math.min(this.selectedA.tx, this.selectedB.tx),
          ty: this.selectedB.ty - Math.min(this.selectedA.ty, this.selectedB.ty)
        };
        this.onSelection && this.onSelection(this.selection);
      } else if (this.mouse.mode === 'paint') {
        this.editStop();
        // Its dangerous firing this event here - it should be in a nextTick or
        // something, but I'm lazy. (Sorry future me)
        this.onEditFinish && this.onEditFinish();
      }

      this.mouse.mode = null;
      this.mouse.direction = null;
      this.imminentSelect = false;
      this.updateCursor();
      this.draw();
    };

    this.el.onmouseout = e => {
      // Pretend the mouse just went up at the edge of the boilerplate instance then went away.
      this.el.onmousemove(e);
      this.mouse.x = this.mouse.y = this.mouse.from = this.mouse.tx = this.mouse.ty = null;
      // ... But if we're drawing, stay in drawing mode.
      this.mouse.mode = null;
      this.draw();
    };

    this.el.onmouseenter = e => {
      if (e.button) {
        this.el.onmousemove(e);
        this.el.onmousedown(e);
      }
    };

    this.el.onwheel = e => {
      if (!this.canScroll) return;
      this.updateMousePos(e);

      if (e.shiftKey || e.ctrlKey) {
        this.view.zoomBy(-e.deltaY / 400, this.mouse);
      } else {
        this.view.scrollBy(e.deltaX, e.deltaY);
      }
      const d = this.view.screenToWorld(this.mouse.x, this.mouse.y);
      this.mouse.tx = d.tx; this.mouse.ty = d.ty;

      e.preventDefault();
      this.cursorMoved();
    };
  }


  updateMousePos(e) {
    this.mouse.from = {tx: this.mouse.tx, ty: this.mouse.ty};

    if (e) {
      this.mouse.x = clamp(e.offsetX, 0, this.el.offsetWidth - 1);
      this.mouse.y = clamp(e.offsetY, 0, this.el.offsetHeight - 1);
    }
    const {tx, ty, tc} = this.view.screenToWorldCell(this.mouse.x, this.mouse.y, this.jit);

    if (tx !== this.mouse.tx || ty !== this.mouse.ty || tc !== this.mouse.tc) {
      this.mouse.tx = tx;
      this.mouse.ty = ty;
      this.mouse.tc = tc;
      return true;
    } else {
      return false;
    }
  }

  cursorMoved() {
    switch (this.mouse.mode) {
      case 'paint':
        this.paint(); break;
      case 'select':
        this.selectedB = this.view.screenToWorld(this.mouse.x, this.mouse.y); break;
    }

    if (this.draggedShuttle != null) this.dragShuttleTo(this.mouse.tx, this.mouse.ty);

    this.draw();
    this.updateCursor();
  }

  updateCursor() {
    var c;
    if (this.activeTool === 'move' && !this.imminentSelect) {
      if (this.draggedShuttle) {
        c = '-webkit-grabbing';
      } else if (this.jit.modules.shuttleGrid.getShuttle(this.mouse.tx, this.mouse.ty)) {
        c = '-webkit-grab';
      } else {
        c = 'default';
      }
    } else {
      switch (this.mouse.direction) {
        case 'x':
          c = 'ew-resize'; break;
        case 'y':
          c = 'ns-resize'; break;
        default:
          c = 'crosshair';
      }
    }
    this.dynCanvas.style.cursor = c;
  }

  resizeTo(w, h) {
    this.view.resizeTo(w, h);
  }

  paint() {
    if (this.activeTool === 'move') throw Error('Invalid placing');

    const {tx, ty} = this.mouse;
    var {tx:fromtx, ty:fromty} = this.mouse.from;
    if (fromtx == null) fromtx = tx;
    if (fromty == null) fromty = ty;

    line(fromtx, fromty, tx, ty, (x, y) => {
      // this.activeTool is null for solid.
      if (this.activeTool === 'shuttle' || this.activeTool === 'thinshuttle') {
        var bv = this.jit.get('base', x, y);
        if (!letsShuttleThrough(bv)) bv = 'nothing';

        // Figure out connectivity.
        var sv = (this.activeTool === 'shuttle') ? SHUTTLE : THINSHUTTLE;

        const oldsv = this.jit.get('shuttles', x, y);
        if (oldsv != null) sv |= oldsv & 0b1111;

        if (fromtx < x) sv |= (1<<LEFT);
        else if (fromtx > x) sv |= (1<<RIGHT);
        if (fromty < y) sv |= (1<<UP);
        else if (fromty > y) sv |= (1<<DOWN);

        this.set(x, y, bv, sv);
      } else {
        this.set(x, y, this.activeTool, null);
      }
      fromtx = x; fromty = y;
    });

    this.drawAll();
  }

  step() {
    this.jit.modules.stepWatch.signal('before');
    if (this.jit.step()) {
      this.lastStepAt = Date.now();
      this.drawAll();
      this.updateCursor();
    }
    this.jit.modules.stepWatch.signal('after');
  }

  dragShuttleTo(tx, ty) {
    if (this.draggedShuttle == null) return;

    const {shuttle, heldPoint} = this.draggedShuttle;

    // This is a bit awkward - we don't generate all states.
    const wantedDx = tx - heldPoint.x;
    const wantedDy = ty - heldPoint.y;

    // First find the closest existing state to the mouse.
    var bestState = shuttle.currentState;

    // We'll just do a dumb beam search here. Previously we scanned all the
    // shuttle's states to find a good one but with that its possible to make
    // one shuttle hop over another one by dragging.
    const {shuttleStates, shuttleOverlap} = this.jit.modules;

    var next;
    const tryMove = (dir) => {
      if (next) return;

      next = shuttleStates.getStateNear(bestState, dir);
      if (shuttleOverlap.willOverlap(shuttle, next)) next = null;
    };

    while (bestState.dx !== wantedDx || bestState.dy !== wantedDy) {
      const distX = wantedDx - bestState.dx;
      const distY = wantedDy - bestState.dy;

      next = null;
      if (distX < 0) tryMove(LEFT); else if (distX > 0) tryMove(RIGHT);
      if (distY < 0) tryMove(UP); else if (distY > 0) tryMove(DOWN);

      if (next) {
        bestState = next;
      } else {
        break;
      }
    }

    if (shuttle.currentState !== bestState) {
      this.jit.moveShuttle(shuttle, bestState);
      this.drawAll();
    }
  }


  // --------- UNDO STACK

  editStart() {
    this.editStop();
    this.currentEdit = {
      base: new Map2,
      shuttles: new Map2
    };
  }

  onEdit(x, y, bp, sp) {
    // Called from set() with old base and shuttle values.
    // console.log('set', x, y, bv, svStr(sv), sp, svStr(sp));
    if (this.currentEdit && !this.currentEdit.base.has(x, y)) {
      this.currentEdit.base.set(x, y, bp);

      if (sp != null) {
        // This ungodly mess is needed because if you're drawing over
        // some adjacent shuttles, when we call this.jit.set() it'll
        // unhelpfully clean up subsequent adjancency values.

        // So we'll use adjacency values from previously slurped up items
        // in the currentEdit set.

        // Priority: The old value's adjacency, but use currentEdit's
        // adjacency values if currentEdit contains the adjacent cell.
        DIRS.forEach((d, i) => {
          const _adj = this.currentEdit.shuttles.get(x+d.dx, y+d.dy);
          if (_adj != null) {
            if (_adj&(1<<util.oppositeDir(i))) {
              sp |= 1<<i;
            } else {
              sp &= ~(1<<i);
            }
          }
        });
      }
      // console.log('->t', svStr(sp));
      this.currentEdit.shuttles.set(x, y, sp);
    }
  }

  editStop(stack) {
    if (stack == null) stack = this.undoStack;

    // ... also clear the redo stack for real edits.
    if (this.currentEdit) {
      if (this.currentEdit.base.size || this.currentEdit.shuttles.size) {
        stack.push(this.currentEdit);
      }
      this.currentEdit = null;
    }
  }

  _popStack(from, to) {
    this.editStop();
    var edit = from.pop();
    if (edit) {
      this.editStart();
      // edit.shuttles.forEach((x, y, v) => console.log(x, y, svStr(v)));
      edit.base.forEach((x, y, v) =>
        this.set(x, y, v, edit.shuttles.get(x, y)));
    }
    this.editStop(to);
    this.drawAll();
  }

  redo() { this._popStack(this.redoStack, this.undoStack); }
  undo() { this._popStack(this.undoStack, this.redoStack); }


  // ---------- SELECTION

  copySubgrid(rect) {
    const {tx, ty, tw, th} = rect;
    const subgrid = {
      tw: tw,
      th: th,
      base: new Map2,
      shuttles: new Map2
    };

    for (var y = ty; y < ty + th; y++) {
      for (var x = tx; x < tx + tw; x++) {
        const bv = this.jit.get('base', x, y);
        const sv = this.jit.get('shuttles', x, y);

        if (bv) subgrid.base.set(x - tx, y - ty, bv);
        if (sv) subgrid.shuttles.set(x - tx, y - ty, sv);
      }
    }
    return subgrid;
  }

  _transformSelection(tw, th, shuttlexf, copyfn) {
    if (!this.selection) return;

    const newSelection = {
      tw: tw,
      th: th,
      base: new Map2,
      shuttles: new Map2
    };

    this.selection.base.forEach(copyfn(newSelection.base));

    const copyToShuttles = copyfn(newSelection.shuttles);
    this.selection.shuttles.forEach((x, y, v) => copyToShuttles(x, y, shuttlexf(v)));

    return this.selection = newSelection;
  }

  flip(dir) {
    if (!this.selection) return;

    const {tw, th} = this.selection;

    // UP=0; RIGHT=1; DOWN=2; LEFT=3
    const flipSV = (sv) => (sv & 0xf0) | (
      (dir === 'x') ?
        ((sv&0b0101) | ((sv&0b10)<<2) | ((sv&0b1000) >> 2))
      : ((sv&0b1010) | ((sv&0b1)<<2)  | ((sv&0b100) >> 2))
    );

    this._transformSelection(tw, th, flipSV, dest => (x, y, v) => {
      const x_ = dir === 'x' ? tw - 1 - x : x;
      const y_ = dir === 'y' ? th - 1 - y : y;
      dest.set(x_, y_, v);
    });
  }

  mirror() {
    if (!this.selection) return;

    // UP=0; RIGHT=1; DOWN=2; LEFT=3. Up<=>left, right<=>down.
    const mirrorSV = (sv) => (sv & 0xf0) |
      ((sv&0b1000)>>3) | ((sv&0b1)<<3) | ((sv&0b100)>>1) | ((sv&0b10)<<1);

    // Width and height swapped! So tricky.
    this._transformSelection(this.selection.th, this.selection.tw, mirrorSV,
        dest => (x, y, v) => dest.set(y, x, v));
  }

  stamp() {
    if (!this.selection) throw new Error('tried to stamp without a selection');

    var {tx:mtx, ty:mty} = this.view.screenToWorld(this.mouse.x, this.mouse.y);
    mtx -= this.selectOffset.tx;
    mty -= this.selectOffset.ty;

    var changed = false;
    // We need to set all values, even the nulls.
    this.editStart();

    for (var y = 0; y < this.selection.th; y++) {
      for (var x = 0; x < this.selection.tw; x++) {
        const bv = this.selection.base.get(x, y);
        const sv = this.selection.shuttles.get(x, y);
        if (this.set(mtx + x, mty + y, bv, sv)) changed = true;
      }
    }

    this.editStop();
    this.onEditFinish && this.onEditFinish();

    if (changed) this.drawAll();
  }

  clearSelection() {
    if (this.selection) {
      this.selection = this.selectOffset = null;
      this.onSelectionClear && this.onSelectionClear();
    }
  }

  setSelection(data) {
    this.clearSelection();
    if (data == null) return;
    assert(data.tw != null);
    this.selection = data;
    this.selectOffset = {tx: 0, ty: 0};
    this.onSelection && this.onSelection(this.selection);
  }

  copy(e) {
    var json;
    if (this.selection) {
      json = {tw:this.selection.tw, th:this.selection.th, base:{}, shuttles:{}};
      this.selection.base.forEach((x, y, v) => {
        if (v != null) json.base[`${x},${y}`] = v;
      });
      this.selection.shuttles.forEach((x, y, v) => {
        if (v != null) json.shuttles[`${x},${y}`] = v;
      });
    } else {
      json = this.getJSONGrid();
    }

    e.clipboardData.setData('text', JSON.stringify(json));
    // console.log(JSON.stringify(json));

    e.preventDefault();
  }

  paste(e) {
    const json = e.clipboardData.getData('text');
    if (json) {
      try {
        this.selection = util.deserializeRegion(json);
        this.selectOffset = {tx:0, ty:0};
        this.onSelection && this.onSelection(this.selection);
      } catch (err) {
        this.selection = null;
        console.error('Error parsing data in clipboard:', err.stack);
      }
    }
  }


  // --------- DRAWING

  drawAll() {
    this.needsDrawAll = true;
    this.draw();
  }

  draw() {
    if (this.needsDraw) return;
    this.needsDraw = true;

    requestAnimationFrame(() => {
      this.needsDraw = false;

      if (this.needsDrawAll) {
        this.jit.modules.shuttles.flush();
        // this.gridRenderer.draw();
        this.needsDrawAll = false;
      }

      // This is a weird place to do keyboard scrolling, but if we do it in
      // step() it'll only happen once every few hundred ms.
      if ((this.keysPressed & 0xf) && this.canScroll) {
        const now = Date.now();
        var amt = 0.6 * Math.min(now - this.lastKeyScroll, 300);
        if (this.keysPressed & KEY.shift) amt *= 3;

        if (this.keysPressed & KEY.up) this.view.scrollBy(0, -amt);
        if (this.keysPressed & KEY.right) this.view.scrollBy(amt, 0);
        if (this.keysPressed & KEY.down) this.view.scrollBy(0, amt);
        if (this.keysPressed & KEY.left) this.view.scrollBy(-amt, 0);

        this.lastKeyScroll = now;

        if (this.updateMousePos())
          this.cursorMoved();

      }

      this.dctx.clearRect(0, 0, this.width, this.height);
      this.drawGrid();
      this.drawOverlay();
      if (this.keysPressed) this.draw();
    });
  }

  // Helper to draw blocky cells. Currently only used to draw hovered cells.
  // override is either a string css color or function.
  drawCells(ctx, points, override) {
    const size = this.view.size;
    points.forEach((tx, ty, v) => {
      const {px, py} = this.view.worldToScreen(tx, ty);

      if (px + size < 0 || px >= this.width || py + size < 0 || py >= this.height)
        return;

      const style = (typeof override === 'function') ? override(tx, ty, v)
        : override ? override
        : COLORS[v] || 'red';
      if (style == null) return;

      ctx.fillStyle = style;
      ctx.fillRect(px, py, size, size);
    });
  }

  // Draw a path around the specified blob edge. The edge should be a Set3 of (x,y,dir).
  __old_pathAroundEdge(ctx, edge, border, pos) {
    const sx = pos ? pos.sx : 0,
      sy = pos ? pos.sy : 0;

    // Ok, now for the actual shuttles themselves
    const lineTo = (x, y, dir, em, first) => {
      // Move to the right of the edge.
      //var dx, dy, ex, ey, px, py, ref2, ref3;
      var ex = dir === UP || dir === RIGHT ? x+1 : x;
      var ey = dir === RIGHT || dir === DOWN ? y+1 : y;
      ex += sx; ey += sy; // transform by shuttle state x,y

      var {px, py} = this.view.worldToScreen(ex, ey);
      const {dx, dy} = DIRS[dir];

      // Come in from the edge
      px += border * (-dx - dy * em);
      py += border * (-dy + dx * em);

      if (first) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    };

    const visited = new Set3;
    ctx.beginPath();

    // I can't simply draw from the first edge because the shuttle might have
    // holes (and hence multiple continuous edges).
    edge.forEach((x, y, dir) => {
      // Using pushEdges because I want to draw the outline around just the
      // solid shuttle cells.
      if (visited.has(x, y, dir)) return;

      var first = true; // For the first point we need to call moveTo() not lineTo().

      while (!visited.has(x, y, dir)) {
        visited.add(x, y, dir);
        const {dx, dy} = DIRS[dir];

        var x2, y2, dir2;
        if (edge.has(x2=x+dx-dy, y2=y+dy+dx, dir2=(dir+3)%4) && // up-right
            !edge.has(x, y, (dir + 1) % 4)) { // fix pincy corners
          // Curves in _|
          lineTo(x, y, dir, 1, first);
          x = x2; y = y2; dir = dir2;
          first = false;
        } else if (edge.has((x2=x-dy), (y2=y+dx), dir)) {
          // straight __
          x = x2; y = y2;
        } else {
          // curves down ^|
          // We could check for it, but there's no point.
          lineTo(x, y, dir, -1, first);
          dir = (dir+1) % 4;
          first = false;
        }
      }
      ctx.closePath();
    });
  }

  // Draw a path around the specified blob edge. The edge should be a Set3 of (x,y,dir).
  pathAroundEdge(ctx, points, border, pos) {
    const sx = pos ? pos.sx : 0,
      sy = pos ? pos.sy : 0;

    // Ok, now for the actual shuttles themselves
    const lineTo = (x, y, dir, em, first) => {
      // Move to the right of the edge.
      var ex = dir === UP || dir === RIGHT ? x+1 : x;
      var ey = dir === RIGHT || dir === DOWN ? y+1 : y;
      ex += sx; ey += sy; // transform by shuttle state x,y

      var {px, py} = this.view.worldToScreen(ex, ey);
      const {dx, dy} = DIRS[dir];

      // Come in from the edge
      px += border * (-dx - dy * em);
      py += border * (-dy + dx * em);

      // console.log('lineTo', px, py, x, y, dir, em, first);
      if (first) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    };

    const visited = new Set3;
    ctx.beginPath();

    // I can't simply draw from the first edge because the shuttle might have
    // holes (and hence multiple continuous edges).
    const each = fn => {
      points.forEach((x, y, v) => {
        if (v & THINSHUTTLE) return;
        if ((v & 0b1111) === 0b1111) return;

        for (var d = 0; d < 4; d++) {
          if (!(v & (1<<d))) fn(x, y, d, v);
        }
      });
    }

    const hasEdge = (x, y, dir) => {
      if (!(points.get(x, y) & (1<<dir))) return true;
      const {dx, dy} = DIRS[dir];
      return points.get(x+dx, y+dy) & THINSHUTTLE;
    }

    // console.log('----');
    each((x, y, dir, v) => {
      // console.log('v', x, y, dir);
      if (visited.has(x, y, dir)) return;

      var first = true; // For the first point we need to call moveTo() not lineTo().

      while (!visited.has(x, y, dir)) {
        visited.add(x, y, dir);
        // console.log('visiting', x, y, dir);
        const {dx, dy} = DIRS[dir];

        var x2, y2, dir2;
        // if (!(v & (1<<dir2)) || points.get(x2, y2) & THINSHUTTLE)
        if (hasEdge(x, y, dir2=(dir+1)%4)) {
          // curves down ^|
          lineTo(x, y, dir, -1, first);
          dir = dir2;
          first = false;
        } else if (hasEdge(x2=x-dy, y2=y+dx, dir)) {
          // straight __
          x = x2; y = y2;
        } else if (hasEdge(x2=x+dx-dy, y2=y+dy+dx, dir2=(dir+3)%4)) {
          // Curves in _|
          lineTo(x, y, dir, 1, first);
          x = x2; y = y2; dir = dir2;
          first = false;
        } else {
          // Loops back on itself immediately. =
          // console.log('loopy');
          lineTo(x, y, dir, 1, first);
          lineTo(x-dy, y+dx, (dir+3)%4, 1, false);
          first = false;
          x = x+dx; y = y+dy; dir = (dir+2)%4;
          // console.error('Confused by shuttle. at ', x, y, dir, svStr(v));
          // points.forEach((x, y, v) => console.log(x, y, svStr(v)));
          // debugger;
        }
      }
      ctx.closePath();
      // console.log('----- path closed');
    });

  }

  drawShuttle(shuttle, t, isHovered) {
    const prevState = this.jit.modules.prevState.get(shuttle);
    var sx, sy;
    if (prevState && (!this.draggedShuttle || shuttle !== this.draggedShuttle.shuttle)) {
      sx = lerp(t, prevState.dx, shuttle.currentState.dx);
      sy = lerp(t, prevState.dy, shuttle.currentState.dy);
    } else {
      sx = shuttle.currentState.dx; sy = shuttle.currentState.dy;
    }

    const bounds = shuttle.bounds;
    const topLeft = this.view.worldToScreen(bounds.left + sx, bounds.top + sy);
    const botRight = this.view.worldToScreen(bounds.right + sx + 1, bounds.bottom + sy + 1);
    // First get bounds - we might not even be able to display the shuttle.
    if (topLeft.px > this.width ||
        topLeft.py > this.height ||
        botRight.px < 0 ||
        botRight.py < 0)
      return false;

    // Maaaagiiiiicccc
    const border = this.view.size < 5 ? 0 : (this.view.size * 0.04 + 1)|0;

    // Thinshuttles first.
    this.dctx.strokeStyle = isHovered ? 'hsl(283, 89%, 65%)' : COLORS.thinshuttle;

    const size2 = (this.view.size / 2)|0;
    const size4 = (this.view.size / 4)|0;
    this.dctx.lineWidth = size4 * 2; // An even number.

    shuttle.points.forEach((x, y, v) => {
      //v = util.shuttleStr(v);
      if (v & SHUTTLE) return;

      // base x, y of the tile
      var {px, py} = this.view.worldToScreen(x+sx, y+sy);
      px += size2; py += size2;

      var numLines = 0;
      for (var i = 0; i < DIRS.length; i++) {
        if (!(v & (1<<i))) continue;
        // Draw a little line from here to there.
        const {dx, dy} = DIRS[i];
        this.dctx.beginPath();
        this.dctx.moveTo(px - size4 * dx, py - size4 * dy);
        this.dctx.lineTo(px + (this.view.size + size4) * dx, py + (this.view.size + size4) * dy);
        this.dctx.stroke();
        numLines++;
      }

      if (numLines === 0) {
        // Erk, the shuttle (with a single thinshuttle) would be invisible.
        // I'll draw a sympathy square.
        const _ = this.view.worldToScreen(x + sx, y + sy); px = _.px; py = _.py;

        this.dctx.fillStyle = this.dctx.strokeStyle;
        this.dctx.fillRect(px + size4, py + size4, size2, size2);
      }
    });

    // Now the proper shuttles.
    this.pathAroundEdge(this.dctx, shuttle.points, border, {sx, sy});
    this.dctx.fillStyle = COLORS.shuttle;
    this.dctx.fill();

    if (isHovered) {
      this.pathAroundEdge(this.dctx, shuttle.points, border*2, {sx, sy});
      this.dctx.lineWidth = border*4;
      this.dctx.strokeStyle = 'hsla(283, 65%, 25%, 0.5)';
      this.dctx.stroke();
    }

    return true;
  }

  drawEngine(engine, t) {
    this.__old_pathAroundEdge(this.dctx, engine.edges, 2);

    this.dctx.strokeStyle = engine.type === 'positive' ?
      'hsl(120, 52%, 26%)' : 'hsl(16, 68%, 20%)';

    this.dctx.lineWidth = 4;
    this.dctx.stroke();
  }

  drawGrid() {
    // Will we need to draw again after?
    var needsRedraw = false;

    // For animating shuttle motion
    var t = 1;
    if (this.animTime && this.lastStepAt) {
      const now = Date.now();
      const exact = (now - this.lastStepAt) / this.animTime;

      // This makes the shuttles always draw at exact pixel boundaries
      t = Math.min(1, ((exact * this.view.size) | 0) / this.view.size);
    }

    if (this.gridRenderer.draw(t)) needsRedraw = true;

    // Mouse position.
    const mx = this.mouse.x, my = this.mouse.y;
    const {tx:mtx, ty:mty, tc:mtc} = this.view.screenToWorldCell(mx, my, this.jit);

    const hover = {};

    if (this.activeTool === 'move' && !this.selection && !this.imminentSelect) {
      const bv = this.jit.get('base', mtx, mty);
      const sv = util.shuttleStr(this.jit.get('shuttles', mtx, mty));

      // What is the mouse hovering over? For better or worse, this relies
      // heavily uses the parser internals.
      const modules = this.jit.modules;

      hover.shuttle = modules.shuttleGrid.getShuttle(mtx, mty);

      const engine = modules.engineGrid.get(mtx, mty);
      if (engine) this.drawEngine(engine, t);

      var contents;
      if (sv !== 'shuttle' && bv && (contents = this.jit.getZoneContents(mtx, mty, mtc))) {
        hover.points = contents.points;
        hover.pressure = 0;
        contents.engines.forEach(e => {
          hover.pressure += e.pressure;
          this.drawEngine(e, t);
        });
      }
    }

    // Draw the shuttles.
    // this.jit.modules.shuttles.forEach(shuttle => {
    //   if (this.drawShuttle(shuttle, t, hover.shuttle === shuttle)) {
    //     needsRedraw = true;
    //   }
    // });

    if (hover.points) {
      this.drawCells(this.dctx, hover.points, 'rgba(100,100,100,0.3)');
    }

    if (hover.pressure) {
      const px = mx, py = my + 20;

      const size = 23;
      var fontsize = size;
      const text = ''+hover.pressure;
      while (fontsize > 3) {
        this.dctx.font = `${fl(fontsize)}px sans-serif`;
        if (this.dctx.measureText(text).width < size - 3) break;
        fontsize--;
      }

      this.dctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.dctx.fillRect(px, py, size, size);

      this.dctx.fillStyle = hover.pressure < 0 ? COLORS.negative : COLORS.positive;
      this.dctx.textBaseline = 'middle';
      this.dctx.textAlign = 'center';
      this.dctx.fillText(text, px + size / 2, py + size / 2);
    }

    if (t !== 1 && needsRedraw) this.draw();
    // this.draw();
  }

  drawOverlay() {
    const mx = this.mouse.x, my = this.mouse.y;
    const {tx:mtx, ty:mty} = this.view.screenToWorld(mx, my);
    const {px:mpx, py:mpy} = this.view.worldToScreen(mtx, mty);

    var sa, sb;
    if (this.mouse.mode === 'select') {
      sa = this.selectedA;
      sb = this.selectedB;
    } else if (this.imminentSelect) {
      sa = sb = {tx:mtx, ty:mty};
    }

    this.dctx.lineWidth = 1;
    const size = this.view.size;

    // Draw the mouse hover state
    if (this.mouse.tx !== null) {
      if (sa) {
        // The user is dragging out a selection rectangle.
        const {tx, ty, tw, th} = enclosingRect(sa, sb);
        const {px, py} = this.view.worldToScreen(tx, ty);

        this.dctx.fillStyle = 'rgba(0,0,255,0.5)';
        this.dctx.fillRect(px, py, tw * size, th * size);

        this.dctx.strokeStyle = 'rgba(0,255,255,0.5)';
        this.dctx.strokeRect(px, py, tw * size, th * size);
      } else if (this.selection) { // mouse.tx is null when the mouse is outside the div.
        // The user is holding a selection stamp
        this.dctx.globalAlpha = 0.8;

        for (var y = 0; y < this.selection.th; y++) {
          for (var x = 0; x < this.selection.tw; x++) {
            // Ugh so wordy.
            const {px, py} = this.view.worldToScreen(
                x+mtx-this.selectOffset.tx,
                y+mty-this.selectOffset.ty);

            if (px+size >= 0 && px < this.width && py+size >= 0 && py < this.height) {
              var v = this.selection.shuttles.get(x, y) || this.selection.base.get(x, y);
              if (typeof v === 'number') v = util.shuttleStr(v);

              this.dctx.fillStyle = (v ? COLORS[v] : COLORS.solid) || 'red';
              this.dctx.fillRect(px, py, size, size);
            }
          }
        }
        this.dctx.strokeStyle = 'rgba(0,255,255,0.5)';
        this.dctx.strokeRect(mpx - this.selectOffset.tx * size,
            mpy - this.selectOffset.ty * size,
            this.selection.tw * size, this.selection.th * size);
        this.dctx.globalAlpha = 1;
      } else if (mpx != null) {
        if (this.activeTool !== 'move') {
          // The user is holding a paintbrush
          this.dctx.fillStyle = COLORS[this.activeTool || 'solid'] || 'red';
          this.dctx.fillRect(mpx + size/4, mpy + size/4, size/2, size/2);

          this.dctx.strokeStyle = this.jit.get('base', mtx, mty) ? 'black' : 'white';
          this.dctx.strokeRect(mpx + 1, mpy + 1, size - 2, size - 2);
        }
      }
    }
  }
}

module.exports = Boilerplate;
Boilerplate.colors = COLORS;
