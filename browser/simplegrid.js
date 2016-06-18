const yo = require('yo-yo');
const util = require('boilerplate-jit/util');
const db = require('./db');

const COLORS = require('../lib/colors');

const renderQueue = [];

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
    const px = x * size;
    const py = y * size;
    var sv = grid.shuttles.get(x, y);
    if (sv) sv = util.shuttleStr(sv);

    ctx.fillStyle = COLORS[sv || bv];
    ctx.fillRect(px, py, size, size);
  });

}

const fl = Math.floor;
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
