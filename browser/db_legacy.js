import assert from 'assert'

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

// Convert back from a byte to [value, shuttle value].
function fromByte(b) {
  const sv = (b & VTOI.shuttle) ? 'shuttle' :
    (b & VTOI.thinshuttle) ? 'thinshuttle' : null;
  const v = ITOV[b & 0x3f];

  assert(v != null);
  return [v, sv];
};

// Version 1 of the imageToJSON function.
export function imageToJSONv1({img, offx, offy}) {
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

      // console.log(w * 3, h, offx, offy);

      const grid = {
        base: {},
        shuttles: {},
        w, h, offx, offy
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
