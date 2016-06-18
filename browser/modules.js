// This manages the stored modules in the dropdown in the top right.

const util = require('boilerplate-jit').util;
const Boilerplate = require('../lib/boilerplate');

const fl = Math.floor;

const moduleData = [];
var selectedModule = null;
const elementForModuleData = new Map;

const addModElem = document.getElementById('addmod');

const selectModule = m => {
  if (m === selectedModule) return;

  if (selectedModule) {
    selectedModule.classList.remove('selected');
    selectedModule = null;
  }
  if (m) {
    m.classList.add('selected');
    addModElem.style.display = 'none';
    selectedModule = m;
  }
};
addModElem.style.display = 'none';

// Helper to draw a boilerplate grid to a canvas.
// This is used to draw the modules.
const drawTo = (data, size, ctx) => {
  data.base.forEach((x, y, v) => {
    const px = x * size;
    const py = y * size;
    v = util.shuttleStr(data.shuttles.get(x, y)) || v;
    ctx.fillStyle = Boilerplate.colors[v];
    ctx.fillRect(px, py, size, size);
  });
};

const save = () => {
  const json = moduleData.map(data => {
    const result = {base: {}, shuttles: {}};
    result.tw = data.tw;
    result.th = data.th;
    data.base.forEach((x, y, v) => result.base[[x, y]] = v);
    data.shuttles.forEach((x, y, v) => result.shuttles[[x, y]] = v);
    return result;
  });

  localStorage.setItem('bp modules', JSON.stringify(json));
};

const addModule = exports.addModule = (data, bp) => {
  // Might be worth converting this to yo-yo.

  // var canvas, container, ctx, height, moduleElem, rm, size, th, tw, width;
  const container = document.getElementById('moduleList');
  moduleData.push(data);

  const moduleElem = document.createElement('div');
  moduleElem.className = 'module';
  elementForModuleData.set(data, moduleElem);
  container.insertBefore(moduleElem, addModElem.nextSibling);

  const canvas = document.createElement('canvas');
  moduleElem.appendChild(canvas);

  // I did all this with a pseudo-selector (:after) but it didn't work because
  // you can't register onclick on them. Poo.
  const rm = document.createElement('div');
  rm.classList.add('rm');
  rm.textContent = '\u232B';
  moduleElem.appendChild(rm);

  if (data.tw == null) throw Error('need w/h');

  // TODO: Add devicePixelRatio to this.
  const tw = data.tw, th = data.th;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const size = fl(Math.min(width / tw, height / th));

  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;

  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(fl((width - size * tw) / 2), fl((height - size * th) / 2));

  drawTo(data, size, ctx);
  ctx.strokeStyle = 'rgba(0,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, size*tw - 2, size*th - 2);

  moduleElem.onclick = () => {
    selectModule(moduleElem);
    bp.setSelection(data);
  };

  rm.onclick = (e) => { // KAPOW!
    if (selectedModule === moduleElem) {
      selectModule(null);
      addModElem.style.display = 'inherit';
    }
    delete rm.onclick;
    delete moduleElem.onclick;
    container.removeChild(moduleElem);

    elementForModuleData.delete(data);
    const idx = moduleData.indexOf(data);
    moduleData.splice(idx, 1);

    e.stopPropagation();
    save();
  };
  save();

  return moduleElem;
};

exports.load = bp => {
  const modules = JSON.parse(localStorage.getItem('bp modules') || '[]');

  for (var i = 0; i < modules.length; i++) {
    addModule(util.deserializeRegion(modules[i]), bp);
  }

  bp.onSelection = data => {
    var e = elementForModuleData.get(data);
    if (e) {
      selectModule(e);
    } else {
      selectModule(null);
      addModElem.style.display = 'inherit';
    }
  };

  (bp.onSelectionClear = () => {
    selectModule(null);
    addModElem.style.display = 'none'
  })();

  addModElem.onclick = () => {
    const s = bp.selection;
    if (s) {
      const m = addModule(s, bp);
      selectModule(m);
    }
  };
};
