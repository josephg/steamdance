import {Watcher} from 'boilerplate-jit';
import {clamp} from './util';

const UP=0, RIGHT=1, DOWN=2, LEFT=3;

// For now using old export syntax to make require() easier.
module.exports = class View {
  constructor(width, height, options) {
    this.width = width;
    this.height = height;
    this.watch = new Watcher(fn => {fn(this)});
    this.reset(options);
  }

  reset(options = {}) {
    this.zoomLevel = options.initialZoom || 1;
    this.zoomBy(0); // set this.size.

    // In tile coordinates.
    this.scrollX = options.initialX || 0;
    this.scrollY = options.initialY || 0;
    this.watch.signal(this);
  }

  fit(w, h, offx, offy) {
    // Put a 1 tile border in.
    offx -= 1; offy -= 1;
    w += 2; h += 2;

    this.scrollX = offx;
    this.scrollY = offy;
    const sizeW = this.width / w, sizeH = this.height / h;
    let tileSize;
    if (sizeW > sizeH) {
      tileSize = sizeH;
      this.scrollX -= (this.width/tileSize - w)/2;
    } else {
      tileSize = sizeW;
      this.scrollY -= (this.height/tileSize - h)/2;
    }
    this.zoomLevel = tileSize / 20;
    this.zoomBy(0);
  }

  zoomBy(diff, center) { // Center is {x, y}
    const oldsize = this.size;
    this.zoomLevel += diff;
    this.zoomLevel = clamp(this.zoomLevel, 1/20, 5);

    // this.size = Math.floor(20 * this.zoomLevel);
    this.size = 20 * this.zoomLevel;

    // Recenter
    if (center != null) {
      this.scrollX += center.x / oldsize - center.x / this.size;
      this.scrollY += center.y / oldsize - center.y / this.size;
    }
    this.watch.signal(this);
  }

  snap(center) {
    const fl = Math.floor(this.size);
    // const AMT = 0.05;
    if (this.size != fl) {
      const oldsize = this.size;
      this.size = fl;//(oldsize - fl < AMT) ? fl : oldsize - AMT;

      if (center != null) {
        this.scrollX += center.x / oldsize - center.x / this.size;
        this.scrollY += center.y / oldsize - center.y / this.size;
      }
      return true;
    } else return false;
  }

  scrollBy(dx, dy) {
    this.scrollX += dx / this.size;
    this.scrollY += dy / this.size;
    this.watch.signal(this);
  }

  resizeTo(width, height) {
    this.width = width;
    this.height = height;
    this.watch.signal(this);
  }

  // **** Utility methods

  // given pixel x,y returns tile x,y
  screenToWorld(px, py) {
    if (px == null) return {tx:null, ty:null};
    // first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
    px += Math.floor(this.scrollX * this.size);
    py += Math.floor(this.scrollY * this.size);
    // now we can simply divide and floor to find the tile
    const tx = Math.floor(px / this.size);
    const ty = Math.floor(py / this.size);
    return {tx, ty};
  }

  // Same as screenToWorld, but also returns which cell in the result.
  screenToWorldCell(px, py, jit) {
    if (px == null) return {tx:null, ty:null};
    // This logic is adapted from screenToWorld above.
    px += Math.floor(this.scrollX * this.size);
    py += Math.floor(this.scrollY * this.size);
    const tx_ = px / this.size, ty_ = py / this.size;
    const tx = Math.floor(tx_), ty = Math.floor(ty_);

    // There's no cell for solid (null) cells.
    const v = jit.get('base', tx, ty);
    if (!v) return {tx, ty, tc:null};

    const offX = tx_ - tx, offY = ty_ - ty;
    const upRight = offX > offY;
    const downRight = offX + offY > 1;

    var tc;
    switch (v) {
      case 'bridge': // The only cells are UP and RIGHT.
        tc = (upRight !== downRight) ? UP : RIGHT;
        break;
      case 'ribbon': case 'ribbonbridge':
        tc = Math.floor(offY * util.NUMINS);
        break;
      case 'negative': case 'positive':
        tc = upRight ? (downRight ? RIGHT : UP) : (downRight ? DOWN : LEFT);
        break;
      default:
        tc = 0;
    }

    return {tx, ty, tc};
  }

  worldToScreen(tx, ty) {
    if (tx == null) return {px:null, py:null};
    return {
      px: tx * this.size - Math.floor(this.scrollX * this.size),
      py: ty * this.size - Math.floor(this.scrollY * this.size)
    };
  }
};
