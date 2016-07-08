const yo = require('yo-yo');
const util = require('boilerplate-jit/util');
const db = require('./db');
const {shuttleConnects} = require('../lib/util');

const COLORS = require('../lib/colors');

const renderQueue = [];

const UP=0, RIGHT=1, DOWN=2, LEFT=3;

var renderPending = false;
const pumpRenderQueue = () => {
  if (renderPending) return;
  renderPending = true;
  setTimeout(() => {
    renderPending = false;
    if (renderQueue.length === 0) return;
    const args = renderQueue.shift();
    doRender.apply(null, args);
    setTimeout(pumpRenderQueue, 10);
  }, 10)
}

const fl = Math.floor;
const doRender = (canvas, width, height, data) => {
  const grid = util.deserializeRegion(data);
  // const size = fl(Math.min(width / tw, height / th));

  const {tw, th} = grid;
  const size = fl(Math.min(width / tw, height / th)) || 1;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.solid;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(fl((width - size * tw) / 2), fl((height - size * th) / 2));

  grid.base.forEach((x, y, bv) => {
    let px = x * size;
    let py = y * size;
    let sv = grid.shuttles.get(x, y);

    ctx.fillStyle = COLORS[bv];
    ctx.fillRect(px, py, size, size);

    if (sv) {
      const svStr = util.shuttleStr(sv);
      ctx.fillStyle = COLORS[svStr];
      let l=px, t=py, r=px+size, b=py+size;
      if (typeof sv === 'number' && size > 3) {
        const amt = svStr === 'shuttle' ? 1 : (size/4)|0;
        if (!shuttleConnects(sv, LEFT)) l += amt;
        if (!shuttleConnects(sv, RIGHT)) r -= amt;
        if (!shuttleConnects(sv, UP)) t += amt;
        if (!shuttleConnects(sv, DOWN)) b -= amt;
      }
      ctx.fillRect(l, t, r-l, b-t);
    }
  });
}

const renderInto = (canvas, width, height, data) => {
  // if (!canvas) return;
  renderQueue.push([canvas, width, height, data])
  pumpRenderQueue();
};

// This isn't interactable or anything. Its just a simple rendered-once grid of
// the world on a canvas.
module.exports = ({width, height, data}) => {
  // width={width} height={height}
  const canvas = yo`<canvas />`;
  db.fromData(data).then(decoded => renderInto(canvas, width, height, decoded));
  return canvas;
  // <canvas width={width} height={height} ref={renderInto(width, height, data)} />
};
