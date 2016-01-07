import {util} from 'boilerplate-jit';
import assert from 'assert'

export function fromString(str) {
  let grid;

  if (str != '') try {
    grid = JSON.parse(str);
    if (grid) console.log('loaded');
  } catch(e) {
    console.error("Error reading JSON:", e);
    return Promise.reject(e);
  }

  if (grid && grid.img) {
    // Its an image!
    console.log('Woo! Got an image to load!');
    return imageToJSON(grid);
  }

  return Promise.resolve(grid || {base:{}, shuttles:{}});
}

export function toString(grid) {
  checkConversion(grid);

  const result = JSON.stringify(JSONToImage(grid));
  // const result = JSON.stringify(grid);
  console.log("saving " + result.length + " bytes");
  return result;
}

function isEmpty(obj) {
  for (var k in obj) return false;
  return true;
};

const VTOI = {};
const ITOV = [
  'solid',
  'nothing', 'thinsolid',
  'positive', 'negative',
  'bridge',
  'ribbon', 'ribbonbridge'
];
ITOV[64] = 'shuttle';
ITOV[128] = 'thinshuttle';

(() => {
  for (let i = 0; i < 16; i++) {
    ITOV[i + 32] = "ins" + (i+1); // 32 -> 63.
  }
  ITOV.forEach((v, i) => {VTOI[v] = i;});
})();

function toByte(v, sv) {
  return VTOI[v] | (sv != null ? VTOI[sv] : 0);
};

function JSONToImage(grid) {
  if (isEmpty(grid.base)) {
    return {base:{}, shuttles:{}};
  }

  const MAX = Number.MAX_SAFE_INTEGER;
  let l = MAX, r = -MAX, t = MAX, b = -MAX;
  for (let k in grid.base) {
    const v = grid.base[k];
    const xy = util.parseXY(k), x = xy.x, y = xy.y;
    if (x < l) l = x;
    if (x > r) r = x;
    if (y < t) t = y;
    if (y > b) b = y;
  }

  let w = r - l;
  w = w - (w % 3) + 3; // Round up to the nearest multiple of 3.
  const h = b - t + 1;

  // console.log(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = w / 3; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w / 3, h);

  const data = imageData.data;
  // Set the image to be opaque.
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  for (let k in grid.base) {
    const v = grid.base[k];
    const sv = grid.shuttles[k];

    const xy = util.parseXY(k)
    const x = xy.x - l, y = xy.y - t;

    const offs = x + (x - (x % 3)) / 3 + y * w / 3 * 4;
    data[offs] = toByte(v, sv);
  }

  // console.log(imageData.data);
  ctx.putImageData(imageData, 0, 0);

  return {
    offx: l,
    offy: t,
    img: canvas.toDataURL()
  };
}

// Convert back from a byte to [value, shuttle value].
function fromByte(b) {
  const sv = (b & VTOI.shuttle) ? 'shuttle' :
    (b & VTOI.thinshuttle) ? 'thinshuttle' : null;
  const v = ITOV[b & 0x3f];

  assert(v != null);
  return [v, sv];
};

function imageToJSON({img, offx, offy}) {
  return new Promise((resolve, reject) => {
    const image = new Image;
    image.src = img;

    image.onload = function() {
      // var b, canvas, ctx, data, h, i, imageData, j, k, len, ref, ref1, sv, v, w, x, x0, y;
      console.log('loaded');
      const canvas = document.createElement('canvas');
      const w = canvas.width = image.width;
      const h = canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      // console.log(imageData.data);

      // console.log(w * 3, h, offx, offy);

      const grid = {
        base: {},
        shuttles: {}
      };

      for (let i = 0; i < data.length; i++) {
        if (i % 4 === 3) continue; // The image is opaque. No data there.

        const b = data[i];
        // Unpack the index.
        // Past-me is a mystical space wizard.
        const x0 = i % (w * 4);
        const x = x0 - (x0 - (x0 % 4)) / 4;
        const y = (i / (w * 4)) | 0;

        const _ = fromByte(b), v = _[0], sv = _[1];
        if (v !== 'solid') {
          const k = (x + offx) + "," + (y + offy);
          grid.base[k] = v;
          if (sv) {
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
};


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
    assert.deepEqual(grid, result);
  }).catch(e => {
    throw e;
  });
}
