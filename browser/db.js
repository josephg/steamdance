import {util} from 'boilerplate-jit';
import assert from 'assert';

export function fromData(grid) {
  if (grid && grid.img) {
    // Its an image!
    console.log('Woo! Got an image to load!');
    return imageToJSON(grid);
  }

  return Promise.resolve(grid || {base:{}, shuttles:{}});
}

export function toData(grid) {
  // checkConversion(grid);

  const json = JSONToImage(grid);
  // console.log("saving " + result.length + " bytes");
  return json;
}

function isEmpty(obj) {
  for (var k in obj) return false;
  return true;
};

const VTOI = {};
const ITOV = [
  'solid', // 0
  'nothing', 'thinsolid', // 1, 2
  'positive', 'negative', // 3, 4
  'bridge', // 5
  'ribbon', 'ribbonbridge' // 6, 7
];

ITOV[64] = 'shuttle';
ITOV[128] = 'thinshuttle';

(() => {
  for (let i = 0; i < 16; i++) {
    ITOV[i + 32] = "ins" + (i+1); // 32 to 63.
  }
  ITOV.forEach((v, i) => {VTOI[v] = i;});
})();

function normalizeShuttle(sv) {
  return sv == null ? 0 :
    typeof(sv) === 'string' ? VTOI[sv] :
    sv;
}

assert.equal(normalizeShuttle(null), 0);
assert.equal(normalizeShuttle(undefined), 0);
assert.equal(normalizeShuttle('shuttle'), 64);
assert.equal(normalizeShuttle('thinshuttle'), 128);
assert.equal(normalizeShuttle(128), 128);

function imageToJSON(data) {
  const legacy = require('./db_legacy');
  switch(data.v) {
    case null: case undefined:
      // Probably not needed except during migration from old data.
      return legacy.imageToJSONv1(data);
    case 2:
      return imageToJSONv2(data);
    default:
      throw Error(`Cannot parse v${data.v} world data with this version of boilerplate`);
  }
}

function imageToJSONv2({img, offx, offy}) {
  return new Promise((resolve, reject) => {
    const image = new Image;
    image.src = img;

    image.onload = function() {
      // var b, canvas, ctx, data, h, i, imageData, j, k, len, ref, ref1, sv, v, w, x, x0, y;
      // console.log('loaded');
      const canvas = document.createElement('canvas');
      const w = canvas.width = image.width;
      const h = canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      // console.log(imageData.data);

      // console.log(w, h, offx, offy);

      const grid = {
        base: {},
        shuttles: {}
      };

      for (let i = 0; i < data.length; i += 4) {
        // Unpack the index.
        const idx = i/4;
        const x = idx % w;
        const y = (idx / w)|0;

        const v = ITOV[data[i]];
        const sv = data[i+1];
        if (v !== 'solid') {
          const k = `${x+offx},${y+offy}`;
          grid.base[k] = v;
          if (sv !== 0) {
            grid.shuttles[k] = sv;
          }
        }
      }
      resolve(grid);
    };
    image.onerror = function(e) {
      reject(e);
    };
  });
}

function JSONToImage(grid) {
  if (isEmpty(grid.base)) {
    return {base:{}, shuttles:{}}; // Its a bit gross doing this here.
  }

  const MAX = Number.MAX_SAFE_INTEGER;
  let l = MAX, r = -MAX, t = MAX, b = -MAX;
  for (let k in grid.base) {
    const xy = util.parseXY(k), x = xy.x, y = xy.y;
    if (x < l) l = x;
    if (x > r) r = x;
    if (y < t) t = y;
    if (y > b) b = y;
  }

  const w = r - l + 1;
  const h = b - t + 1;

  // console.log(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);

  const data = imageData.data;
  // Make the image opaque.
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  for (let k in grid.base) {
    const v = grid.base[k];
    const sv = grid.shuttles[k];

    const xy = util.parseXY(k)
    const x = xy.x - l, y = xy.y - t;

    const offs = (x + y * w) * 4

    // Red channel for base, green channel for shuttles.
    data[offs] = VTOI[v];
    data[offs+1] = normalizeShuttle(sv);
  }

  // console.log(imageData.data);
  ctx.putImageData(imageData, 0, 0);

  // window.location = canvas.toDataURL();

  return {
    v: 2,
    offx: l,
    offy: t,
    img: canvas.toDataURL()
  };
}

function checkConversion(grid) {
  const data = JSONToImage(grid);
  imageToJSON(data).then((result) => {
    // console.log(grid);
    // console.log(result);

    for (let k in grid.base) {
      const v = grid.base[k], v2 = result.base[k];
      if (v2 !== v) console.log("WHOA! at " + k + " " + v + " " + v2);
    }
    for (let k in grid.shuttles) {
      const v = grid.shuttles[k], v2 = result.shuttles[k];
      if (v2 !== v) console.log("WHOA! at " + k + " " + v + " " + v2);
    }
    assert.deepEqual(grid.img, result.img);
  }).catch(e => {
    throw e;
  });
}
