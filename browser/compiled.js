(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fromString = fromString;
exports.toString = toString;

var _boilerplateJit = require('boilerplate-jit');

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fromString(str) {
  var grid = undefined;

  if (str != '') try {
    grid = JSON.parse(str);
    if (grid) console.log('loaded ' + str.length + ' bytes');
  } catch (e) {
    console.error("Error reading JSON:", e);
    return Promise.reject(e);
  }

  if (grid && grid.img) {
    // Its an image!
    console.log('Woo! Got an image to load!');
    return imageToJSON(grid);
  }

  return Promise.resolve(grid || { base: {}, shuttles: {} });
}

function toString(grid) {
  checkConversion(grid);

  var result = JSON.stringify(JSONToImage(grid));
  // const result = JSON.stringify(grid);
  console.log("saving " + result.length + " bytes");
  return result;
}

function isEmpty(obj) {
  for (var k in obj) {
    return false;
  }return true;
};

var VTOI = {};
var ITOV = ['solid', // 0
'nothing', 'thinsolid', // 1, 2
'positive', 'negative', // 3, 4
'bridge', // 5
'ribbon', 'ribbonbridge' // 6, 7
];

ITOV[64] = 'shuttle';
ITOV[128] = 'thinshuttle';

(function () {
  for (var i = 0; i < 16; i++) {
    ITOV[i + 32] = "ins" + (i + 1); // 32 to 63.
  }
  ITOV.forEach(function (v, i) {
    VTOI[v] = i;
  });
})();

function normalizeShuttle(sv) {
  return sv == null ? 0 : typeof sv === 'string' ? VTOI[sv] : sv;
}

_assert2.default.equal(normalizeShuttle(null), 0);
_assert2.default.equal(normalizeShuttle(undefined), 0);
_assert2.default.equal(normalizeShuttle('shuttle'), 64);
_assert2.default.equal(normalizeShuttle('thinshuttle'), 128);
_assert2.default.equal(normalizeShuttle(128), 128);

function imageToJSON(data) {
  var legacy = require('./db_legacy');
  switch (data.v) {
    case null:case undefined:
      return legacy.imageToJSONv1(data);
    case 2:
      return imageToJSONv2(data);
    default:
      throw Error('Cannot parse v' + data.v + ' world data with this version of boilerplate');
  }
}

function imageToJSONv2(_ref) {
  var img = _ref.img;
  var offx = _ref.offx;
  var offy = _ref.offy;

  return new Promise(function (resolve, reject) {
    var image = new Image();
    image.src = img;

    image.onload = function () {
      // var b, canvas, ctx, data, h, i, imageData, j, k, len, ref, ref1, sv, v, w, x, x0, y;
      // console.log('loaded');
      var canvas = document.createElement('canvas');
      var w = canvas.width = image.width;
      var h = canvas.height = image.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h);
      var imageData = ctx.getImageData(0, 0, w, h);
      var data = imageData.data;
      // console.log(imageData.data);

      // console.log(w, h, offx, offy);

      var grid = {
        base: {},
        shuttles: {}
      };

      for (var i = 0; i < data.length; i += 4) {
        // Unpack the index.
        var idx = i / 4;
        var x = idx % w;
        var y = idx / w | 0;

        var v = ITOV[data[i]];
        var sv = data[i + 1];
        if (v !== 'solid') {
          var k = x + offx + ',' + (y + offy);
          grid.base[k] = v;
          if (sv !== 0) {
            grid.shuttles[k] = sv;
          }
        }
      }
      resolve(grid);
    };
    image.onerror = function (e) {
      reject(e);
    };
  });
}

function JSONToImage(grid) {
  if (isEmpty(grid.base)) {
    return { base: {}, shuttles: {} }; // Its a bit gross doing this here.
  }

  var MAX = Number.MAX_SAFE_INTEGER;
  var l = MAX,
      r = -MAX,
      t = MAX,
      b = -MAX;
  for (var k in grid.base) {
    var v = grid.base[k];
    var xy = _boilerplateJit.util.parseXY(k),
        x = xy.x,
        y = xy.y;
    if (x < l) l = x;
    if (x > r) r = x;
    if (y < t) t = y;
    if (y > b) b = y;
  }

  var w = r - l + 1;
  var h = b - t + 1;

  // console.log(w, h);

  var canvas = document.createElement('canvas');
  canvas.width = w;canvas.height = h;
  var ctx = canvas.getContext('2d');
  var imageData = ctx.createImageData(w, h);

  var data = imageData.data;
  // Make the image opaque.
  for (var i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }for (var k in grid.base) {
    var v = grid.base[k];
    var sv = grid.shuttles[k];

    var xy = _boilerplateJit.util.parseXY(k);
    var x = xy.x - l,
        y = xy.y - t;

    var offs = (x + y * w) * 4;

    // Red channel for base, green channel for shuttles.
    data[offs] = VTOI[v];
    data[offs + 1] = normalizeShuttle(sv);
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
  var data = JSONToImage(grid);
  imageToJSON(data).then(function (result) {
    // console.log(grid);
    // console.log(result);

    for (var k in grid.base) {
      var v = grid.base[k],
          v2 = result.base[k];
      if (v2 !== v) console.log("WHOA! at " + k + " " + v + " " + v2);
    }
    for (var k in grid.shuttles) {
      var v = grid.shuttles[k],
          v2 = result.shuttles[k];
      if (v2 !== v) console.log("WHOA! at " + k + " " + v + " " + v2);
    }
    _assert2.default.deepEqual(grid, result);
  }).catch(function (e) {
    throw e;
  });
}

},{"./db_legacy":2,"assert":19,"boilerplate-jit":11}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.imageToJSONv1 = imageToJSONv1;

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var VTOI = {};
var ITOV = ['solid', // 0
'nothing', 'thinsolid', // 1, 2
'positive', 'negative', // 3, 4
'bridge', // 5
'ribbon', 'ribbonbridge' // 6, 7
];

ITOV[64] = 'shuttle';
ITOV[128] = 'thinshuttle';

(function () {
  for (var i = 0; i < 16; i++) {
    ITOV[i + 32] = "ins" + (i + 1); // 32 to 63.
  }
  ITOV.forEach(function (v, i) {
    VTOI[v] = i;
  });
})();

// Convert back from a byte to [value, shuttle value].
function fromByte(b) {
  var sv = b & VTOI.shuttle ? 'shuttle' : b & VTOI.thinshuttle ? 'thinshuttle' : null;
  var v = ITOV[b & 0x3f];

  (0, _assert2.default)(v != null);
  return [v, sv];
};

// Version 1 of the imageToJSON function.
function imageToJSONv1(_ref) {
  var img = _ref.img;
  var offx = _ref.offx;
  var offy = _ref.offy;

  return new Promise(function (resolve, reject) {
    var image = new Image();
    image.src = img;

    image.onload = function () {
      // var b, canvas, ctx, data, h, i, imageData, j, k, len, ref, ref1, sv, v, w, x, x0, y;
      // console.log('loaded');
      var canvas = document.createElement('canvas');
      var w = canvas.width = image.width;
      var h = canvas.height = image.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h);
      var imageData = ctx.getImageData(0, 0, w, h);
      var data = imageData.data;
      // console.log(imageData.data);

      // console.log(w * 3, h, offx, offy);

      var grid = {
        base: {},
        shuttles: {}
      };

      for (var i = 0; i < data.length; i++) {
        if (i % 4 === 3) continue; // The image is opaque. No data there.

        var b = data[i];
        // Unpack the index.
        // Past-me is a mystical space wizard.
        var x0 = i % (w * 4);
        var x = x0 - (x0 - x0 % 4) / 4;
        var y = i / (w * 4) | 0;

        var _ = fromByte(b),
            v = _[0],
            sv = _[1];
        if (v !== 'solid') {
          var k = x + offx + "," + (y + offy);
          grid.base[k] = v;
          if (sv) {
            grid.shuttles[k] = sv;
          }
        }
      }
      resolve(grid);
    };
    image.onerror = function (e) {
      reject(e);
    };
  });
};

},{"assert":19}],3:[function(require,module,exports){
var Boilerplate, assert, bpromise, db, el, isEmpty, loadGrid, modules, playpausebutton, populate, ref, reset, running, save, setRunning, stepbutton, timer, util, worldLabel, worldList, worldName;

Boilerplate = require('../lib/boilerplate');

modules = require('./modules');

util = require('boilerplate-jit').util;

assert = require('assert');

db = require('./db');

window.util = util;

isEmpty = function(obj) {
  var k;
  for (k in obj) {
    return false;
  }
  return true;
};

el = document.getElementById('bp');

worldLabel = document.getElementById('worldlabel');

playpausebutton = document.getElementById('playpause');

stepbutton = document.getElementById('step');

worldList = document.getElementById('worldlist');

(populate = function() {
  var i, j, k, m, name, option, r, ref, results, worlds;
  while (worldList.firstChild) {
    worldList.removeChild(worldList.firstChild);
  }
  worlds = new Set;
  r = /^world(?:v2)? (.*)$/;
  results = [];
  for (i = j = 0, ref = localStorage.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
    k = localStorage.key(i);
    m = r.exec(k);
    if (!m) {
      continue;
    }
    name = m[1];
    if (worlds.has(name)) {
      continue;
    }
    worlds.add(name);
    option = document.createElement('option');
    option.value = name;
    results.push(worldList.appendChild(option));
  }
  return results;
})();

worldName = null;

loadGrid = function(name) {
  var gridStr;
  worldName = name;
  console.log("loading " + worldName);
  location.hash = "#" + worldName;
  worldLabel.value = worldName;
  populate();
  gridStr = localStorage.getItem("worldv2 " + worldName) || localStorage.getItem("world " + worldName);
  return db.fromString(gridStr);
};

bpromise = loadGrid(((ref = location.hash) != null ? ref.slice(1) : void 0) || 'boilerplate').then(function(grid) {
  var bp;
  bp = window.bp = new Boilerplate(el, {
    grid: grid,
    animTime: 200
  });
  el.focus();
  bp.addKeyListener(window);
  bp.draw();
  return bp;
});

running = false;

timer = null;

setRunning = function(v) {
  document.getElementById('playpanel').className = v ? 'running' : 'stopped';
  if (running !== v) {
    running = v;
    if (v) {
      playpausebutton.textContent = '||';
      return timer = setInterval((function(_this) {
        return function() {
          return bpromise.then(function(bp) {
            return bp.step();
          });
        };
      })(this), 200);
    } else {
      playpausebutton.textContent = '►';
      return clearInterval(timer);
    }
  }
};

setRunning(false);

reset = function(grid) {
  return bpromise.then(function(bp) {
    bp.setJSONGrid(grid);
    bp.resetView();
    return setRunning(true);
  });
};

save = function() {
  return bpromise.then(function(bp) {
    var grid;
    grid = bp.getJSONGrid();
    if (isEmpty(grid.base) && isEmpty(grid.shuttles)) {
      console.log('removing', worldName);
      return localStorage.removeItem("worldv2 " + worldName);
    } else {
      console.log('saving', worldName);
      return localStorage.setItem("worldv2 " + worldName, db.toString(grid));
    }
  });
};

bpromise.then(function(bp) {
  bp.onEditFinish = save;
  return setInterval(save, 15000);
});

window.addEventListener('keypress', function(e) {
  if (e.keyCode === 32 || e.which === 32) {
    setRunning(!running);
  }
  switch (e.keyCode) {
    case 13:
      return bpromise.then(function() {
        return bp.step();
      });
  }
});

worldLabel.onkeydown = function(e) {
  if (e.keyCode === 27) {
    worldLabel.value = worldName;
    return worldLabel.blur();
  }
};

worldLabel.onchange = function(e) {
  worldLabel.blur();
  return loadGrid(worldLabel.value).then(function(grid) {
    return reset(grid);
  });
};

worldLabel.onkeydown = function(e) {
  return e.cancelBubble = true;
};

window.onhashchange = function() {
  var hash, newWorld;
  hash = location.hash;
  if (hash) {
    newWorld = hash.slice(1);
  }
  if (newWorld !== worldName) {
    worldName = newWorld;
    return loadGrid(worldName).then(function(grid) {
      return reset(grid);
    });
  }
};

window.onresize = function() {
  return bpromise.then(function(bp) {
    return bp.resizeTo(window.innerWidth, window.innerHeight);
  });
};

playpausebutton.onclick = function(e) {
  return setRunning(!running);
};

stepbutton.onclick = function(e) {
  return bpromise.then(function(bp) {
    return bp.step();
  });
};

bpromise.then(function(bp) {
  var panel, selected;
  panel = document.getElementsByClassName('toolpanel')[0];
  selected = null;
  panel.onclick = function(e) {
    var element;
    element = e.target;
    if (element === panel) {
      return;
    }
    return bp.changeTool(element.id);
  };
  bp.onToolChanged = function(newTool) {
    var e;
    if (selected) {
      selected.className = '';
    }
    e = document.getElementById(newTool || 'solid');
    if (!e) {
      return;
    }
    e.className = 'selected';
    return selected = e;
  };
  bp.onToolChanged(bp.activeTool);
  return modules.load(bp);
});

window.backup = function() {
  var data, i, j, k, ref1, v;
  data = {};
  for (i = j = 0, ref1 = localStorage.length; 0 <= ref1 ? j < ref1 : j > ref1; i = 0 <= ref1 ? ++j : --j) {
    k = localStorage.key(i);
    v = JSON.parse(localStorage.getItem(k));
    data[k] = v;
  }
  return data;
};


},{"../lib/boilerplate":5,"./db":1,"./modules":4,"assert":19,"boilerplate-jit":11}],4:[function(require,module,exports){
var Boilerplate, addModElem, addModule, drawTo, elementForModuleData, fl, moduleData, save, selectModule, selectedModule, util;

util = require('boilerplate-jit').util;

Boilerplate = require('../lib/boilerplate');

fl = Math.floor;

moduleData = [];

selectedModule = null;

elementForModuleData = new Map;

addModElem = document.getElementById('addmod');

selectModule = function(m) {
  if (m === selectedModule) {
    return;
  }
  if (selectedModule) {
    selectedModule.classList.remove('selected');
    selectedModule = null;
  }
  if (m) {
    m.classList.add('selected');
    addModElem.style.display = 'none';
    return selectedModule = m;
  }
};

addModElem.style.display = 'none';

drawTo = function(data, size, ctx) {
  return data.base.forEach(function(x, y, v) {
    var px, py;
    px = x * size;
    py = y * size;
    v = data.shuttles.get(x, y) || v;
    ctx.fillStyle = Boilerplate.colors[v];
    return ctx.fillRect(px, py, size, size);
  });
};

save = function() {
  var json;
  json = moduleData.map(function(data) {
    var result;
    result = {
      base: {},
      shuttles: {}
    };
    result.tw = data.tw;
    result.th = data.th;
    data.base.forEach(function(x, y, v) {
      return result.base[[x, y]] = v;
    });
    data.shuttles.forEach(function(x, y, v) {
      return result.shuttles[[x, y]] = v;
    });
    return result;
  });
  return localStorage.setItem('bp modules', JSON.stringify(json));
};

exports.addModule = addModule = function(data) {
  var canvas, container, ctx, height, moduleElem, rm, size, th, tw, width;
  container = document.getElementById('moduleList');
  moduleData.push(data);
  moduleElem = document.createElement('div');
  moduleElem.className = 'module';
  elementForModuleData.set(data, moduleElem);
  container.insertBefore(moduleElem, addModElem.nextSibling);
  canvas = document.createElement('canvas');
  moduleElem.appendChild(canvas);
  rm = document.createElement('div');
  rm.classList.add('rm');
  rm.textContent = '\u232B';
  moduleElem.appendChild(rm);
  if (data.tw == null) {
    throw Error('need w/h');
  }
  tw = data.tw, th = data.th;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  size = fl(Math.min(width / tw, height / th));
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(fl((width - size * tw) / 2), fl((height - size * th) / 2));
  drawTo(data, size, ctx);
  ctx.strokeStyle = 'rgba(0,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, size * tw - 2, size * th - 2);
  moduleElem.onclick = function() {
    selectModule(moduleElem);
    return bp.setSelection(data);
  };
  rm.onclick = function(e) {
    var idx;
    if (selectedModule === moduleElem) {
      selectModule(null);
      addModElem.style.display = 'inherit';
    }
    delete rm.onclick;
    delete moduleElem.onclick;
    container.removeChild(moduleElem);
    elementForModuleData["delete"](data);
    idx = moduleData.indexOf(data);
    moduleData.splice(idx, 1);
    e.stopPropagation();
    return save();
  };
  save();
  return moduleElem;
};

exports.load = function(bp) {
  var i, len, modules, raw;
  modules = JSON.parse(localStorage.getItem('bp modules') || '[]');
  for (i = 0, len = modules.length; i < len; i++) {
    raw = modules[i];
    addModule(util.deserializeRegion(raw));
  }
  bp.onSelection = function(data) {
    var e;
    if ((e = elementForModuleData.get(data))) {
      return selectModule(e);
    } else {
      selectModule(null);
      return addModElem.style.display = 'inherit';
    }
  };
  (bp.onSelectionClear = function() {
    return selectModule(null);
  })();
  return addModElem.onclick = function() {
    var m, s;
    if ((s = bp.selection)) {
      m = addModule(s);
      return selectModule(m);
    }
  };
};


},{"../lib/boilerplate":5,"boilerplate-jit":11}],5:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _boilerplateJit = require('boilerplate-jit');

var _util = require('./util');

var _view = require('./view');

var _view2 = _interopRequireDefault(_view);

var _gl = require('./gl');

var _gl2 = _interopRequireDefault(_gl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var assert = require('assert');

var DIRS = _boilerplateJit.util.DIRS;

//var , Boilerplate, , , , , PrevState, , Set2, Set3, View, Watcher, addModules, assert, clamp, fl, layerOf, lerp, letsShuttleThrough, line, ref, ref1, util;

var SHUTTLE = 0x40,
    THINSHUTTLE = 0x80;

var UP = 0,
    RIGHT = 1,
    DOWN = 2,
    LEFT = 3;

var fl = Math.floor;

var KEY = {
  up: 1 << 0,
  right: 1 << 1,
  down: 1 << 2,
  left: 1 << 3,
  shift: 1 << 4
};

// We have some additional modules to chain to the jit.

function BlobBounds(blobFiller) {
  // This calculates the bounds of all shuttles and engines.

  blobFiller.addWatch.on(function (blob) {
    // I'm lazy. I'll just dump it on the blob itself.
    var bottom = -1 << 30,
        right = -1 << 30,
        left = 1 << 30,
        top = 1 << 30;

    var points = blob.points,
        edges = blob.edges;
    (points.size < edges.size ? points : edges).forEach(function (x, y) {
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    });

    blob.bounds = { left: left, top: top, right: right, bottom: bottom };
  });
}

function PrevState(shuttles, currentStates, stepWatch) {
  // Here we store enough information to know what the state of every shuttle
  // was before the most recent call to step().

  // I'd use a WeakMap here but apparently in chrome weakmaps don't support
  // .clear().
  var prevState = new Map();
  shuttles.deleteWatch.on(function (shuttle) {
    return prevState.delete(shuttle);
  });

  currentStates.watch.on(function (shuttle, prev) {
    if (!prev) return; // This will fire when the shuttle is first created
    prevState.set(shuttle, prev);
  });

  stepWatch.on(function (time) {
    if (time !== 'before') return;

    prevState.clear();
  });

  return {
    get: function get(shuttle) {
      return prevState.get(shuttle);
    }
  };
}

function addModules(jit) {
  var stepWatch = jit.modules.stepWatch = new _boilerplateJit.Watcher();
  var _jit$modules = jit.modules;
  var shuttles = _jit$modules.shuttles;
  var engines = _jit$modules.engines;
  var currentStates = _jit$modules.currentStates;

  BlobBounds(shuttles);
  BlobBounds(engines);

  var prevState = PrevState(shuttles, currentStates, stepWatch);

  jit.modules.prevState = prevState;
}

function line(x0, y0, x1, y1, f) {
  var dx = Math.abs(x1 - x0);
  var dy = Math.abs(y1 - y0);
  var ix = x0 < x1 ? 1 : -1;
  var iy = y0 < y1 ? 1 : -1;
  var e = 0;
  for (var i = 0; i <= dx + dy; i++) {
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

var COLORS = {
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
(function () {
  for (var i = 1; i <= 8; i++) {
    COLORS['ins' + i] = 'hsl(188, ' + (24 + 6 * i) + '%, ' + (43 - 2 * i) + '%)';
    COLORS['ins' + (i + 8)] = 'hsl(44, #{24 + 6 * i}%, #{43 - 2*i}%)';
  }
})();

var Boilerplate = (function () {
  _createClass(Boilerplate, [{
    key: 'changeTool',
    value: function changeTool(newTool) {
      this.activeTool = newTool === 'solid' ? null : newTool;

      this.onToolChanged && this.onToolChanged(this.activeTool);
      this.updateCursor();
    }
  }, {
    key: 'addKeyListener',
    value: function addKeyListener(el) {
      var _this = this;

      el.addEventListener('keydown', function (e) {
        var kc = e.keyCode;
        // console.log(kc);

        var newTool = ({
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
        })[kc];

        if (e.ctrlKey) {
          var a = e.shiftKey ? 8 : 0;
          // ins1 to ins16.
          if (49 <= kc && kc <= 57) newTool = 'ins' + (kc - 48 + a);
          if (newTool === 'nothing') newTool = 'bridge';
          if (newTool === 'ribbon') newTool = 'ribbonbridge';
        }

        //console.log('newTool', newTool);

        if (newTool) {
          if (_this.selection) {
            // Fill the entire selection with the new brush
            for (var x = 0; x < _this.selection.tw; x++) {
              for (var y = 0; y < _this.selection.th; y++) {
                if (newTool === 'solid') {
                  _this.selection.base.delete(x, y);
                  _this.selection.shuttles.delete(x, y);
                } else if (newTool === 'shuttle' || newTool === 'thinshuttle') {
                  if (!(0, _util.letsShuttleThrough)(_this.selection.base.get(x, y))) {
                    _this.selection.base.set(x, y, 'nothing');
                  }
                  _this.selection.shuttles.set(x, y, newTool);
                } else {
                  _this.selection.base.set(x, y, newTool);
                  _this.selection.shuttles.delete(x, y);
                }
              }
            }
          } else {
            // No selection. Just change the tool.
            _this.changeTool(newTool);
          }
        }

        if (37 <= e.keyCode && e.keyCode <= 40) {
          _this.lastKeyScroll = Date.now();
        }

        switch (kc) {
          // Left, right, up, down.
          case 37:
            _this.keysPressed |= KEY.left;break;
          case 39:
            _this.keysPressed |= KEY.right;break;
          case 38:
            _this.keysPressed |= KEY.up;break;
          case 40:
            _this.keysPressed |= KEY.down;break;

          case 16:
            // Shift
            _this.keysPressed |= KEY.shift;
            _this.imminentSelect = true;
            break;

          case 27:case 192:
            // Escape.
            if (_this.selection) _this.clearSelection();else _this.changeTool('move');
            break;

          case 190:
            // '.'
            _this.view.snap(_this.mouse);
            _this.drawAll();
            break;

          case 88:
            // 'x'
            if (_this.selection) _this.flip('x');
            break;
          case 89:
            // 'y'
            if (_this.selection) _this.flip('y');
            break;
          case 77:
            // 'm'
            if (_this.selection) _this.mirror();
            break;

          case 187:case 189:
            // plus, minus.
            var amt = Math.max(1, _this.view.size / 8) / 20;
            if (kc === 189) amt *= -1; // minus key
            if (_this.keysPressed & KEY.shift) amt *= 3;
            _this.view.zoomBy(amt, { x: _this.width / 2, y: _this.height / 2 });
            break;
        }

        if ((e.ctrlKey || e.metaKey) && kc === 90) {
          // Ctrl+Z or Cmd+Z
          if (e.shiftKey) _this.redo();else _this.undo();
          e.preventDefault();
        } else if (e.ctrlKey && kc === 89) {
          // Ctrl+Y for windows
          _this.redo();
          e.preventDefault();
        }

        _this.draw();
      });

      el.addEventListener('keyup', function (e) {
        if (37 <= e.keyCode && e.keyCode <= 40) _this.lastKeyScroll = Date.now();

        switch (e.keyCode) {
          case 16:
            // Shift
            _this.keysPressed &= ~KEY.shift;
            _this.imminentSelect = false;
            _this.draw();
            break;

          // Left, right, up, down.
          case 37:
            _this.keysPressed &= ~KEY.left;break;
          case 39:
            _this.keysPressed &= ~KEY.right;break;
          case 38:
            _this.keysPressed &= ~KEY.up;break;
          case 40:
            _this.keysPressed &= ~KEY.down;break;
        }
      });

      el.addEventListener('blur', function () {
        _this.mouse.mode = null;
        _this.imminentSelect = false;
        _this.editStop();
        _this.draw();
      });

      el.addEventListener('copy', function (e) {
        return _this.copy(e);
      });
      el.addEventListener('paste', function (e) {
        return _this.paste(e);
      });
    }
  }, {
    key: 'set',
    value: function set(x, y, bv, sv) {
      var bp = this.jit.get('base', x, y) || null;
      var sp = this.jit.get('shuttles', x, y) || null;
      if (bv == bp && sp == sv) return false;

      if (this.currentEdit && !this.currentEdit.base.has(x, y)) {
        this.currentEdit.base.set(x, y, bp);
        this.currentEdit.shuttles.set(x, y, sp);
      }

      this.jit.set(x, y, bv, sv);
      return true;
    }
  }, {
    key: 'resetView',
    value: function resetView() {
      this.view.reset(this.options);
    }
  }, {
    key: 'setJSONGrid',
    value: function setJSONGrid(json) {
      var _this2 = this;

      this.jit = (0, _boilerplateJit.Jit)(json);
      addModules(this.jit);
      this.gridRenderer.addModules(this.jit);

      // Stop dragging a shuttle if it gets wiped out. This might not be an issue
      // now that shuttles don't automerge, but its *more correct*.
      this.jit.modules.shuttles.deleteWatch.on(function (s) {
        if (_this2.draggedShuttle && s === _this2.draggedShuttle.shuttle) _this2.draggedShuttle = null;
      });

      this.currentEdit = null;
      this.undoStack.length = this.redoStack.length = 0;
      this.drawAll();
    }
  }, {
    key: 'getJSONGrid',
    value: function getJSONGrid() {
      return this.jit.toJSON();
    }
  }]);

  function Boilerplate(el, options) {
    var _this3 = this;

    _classCallCheck(this, Boilerplate);

    this.el = el;
    this.options = options || {};

    this.keysPressed = 0; // bitmask. up=1, right=2, down=4, left=8.
    this.lastKeyScroll = 0; // epoch time

    this.activeTool = 'move';

    // A list of patches
    this.currentEdit = null;
    this.undoStack = [];
    this.redoStack = [];

    this.view = new _view2.default(this.el.offsetWidth, this.el.offsetHeight, this.options);

    this.canScroll = this.options.canScroll != null ? this.options.canScroll : true;
    this.animTime = this.options.animTime || 0;

    if (this.el.tabIndex === -1) this.el.tabIndex = 0; // Allow keyboard events.

    this.gridCanvas = this.el.appendChild(document.createElement('canvas'));
    this.gridCanvas.className = 'draw';
    this.gridCanvas.style.backgroundColor = COLORS.solid;

    this.dynCanvas = this.el.appendChild(document.createElement('canvas'));
    this.dynCanvas.className = 'draw';

    this.el.boilerplate = this;

    this.gridRenderer = new _gl2.default(this.gridCanvas, this.view);

    this.setJSONGrid(this.options.grid);

    this.mouse = { x: null, y: null, mode: null };
    this.imminentSelect = false;
    this.selectedA = this.selectedB = null;
    this.selectOffset = null;
    this.selection = null;

    this.drawAll();

    // ------- Event handlers

    this.view.watch.forward(function (d) {
      _this3.width = d.width;_this3.height = d.height;

      _this3.dynCanvas.width = d.width * devicePixelRatio;
      _this3.dynCanvas.height = d.height * devicePixelRatio;

      // I'm not sure why this is needed?
      //@dynCanvas.style.width = @gridCanvas.style.width = @width + 'px'
      //@dynCanvas.style.height = @gridCanvas.style.height = @height + 'px'

      _this3.dctx = _this3.dynCanvas.getContext('2d');
      _this3.dctx.scale(devicePixelRatio, devicePixelRatio);

      _this3.drawAll();
    });

    this.el.onmousemove = function (e) {
      _this3.imminentSelect = !!e.shiftKey;

      // If the mouse is released / pressed while not in the box, handle that correctly
      // (although this is still a little janky with dragging I think)
      if (e.button && !_this3.mouse.mode) _this3.el.onmousedown(e);
      if (_this3.updateMousePos(e)) _this3.cursorMoved();

      if (_this3.mouse && _this3.jit.get('base', _this3.mouse.tx, _this3.mouse.ty)) {
        _this3.draw();
      }
    };

    this.el.onmousedown = function (e) {
      _this3.updateMousePos(e);

      if (e.shiftKey) {
        _this3.mouse.mode = 'select';
        _this3.clearSelection();
        _this3.selectedA = _this3.view.screenToWorld(_this3.mouse.x, _this3.mouse.y);
        _this3.selectedB = _this3.selectedA;
      } else if (_this3.selection) {
        _this3.stamp();
      } else {
        if (_this3.activeTool === 'move') {
          var shuttle = _this3.jit.modules.shuttleGrid.getShuttle(_this3.mouse.tx, _this3.mouse.ty);
          if (shuttle) {
            // Grab that sucka!
            var dx = shuttle.currentState.dx,
                dy = shuttle.currentState.dy;
            _this3.draggedShuttle = {
              shuttle: shuttle,
              heldPoint: { x: _this3.mouse.tx - dx, y: _this3.mouse.ty - dy }
            };
            shuttle.held = true;
          }
        } else {
          _this3.mouse.mode = 'paint';
          _this3.mouse.from = { tx: _this3.mouse.tx, ty: _this3.mouse.ty };
          _this3.mouse.direction = null;
          _this3.editStart();
          _this3.paint();
        }
      }
      _this3.updateCursor();
      _this3.draw();
    };

    this.el.onmouseup = function () {
      if (_this3.draggedShuttle) {
        _this3.draggedShuttle.shuttle.held = false;
        _this3.draggedShuttle = null;
      }

      if (_this3.mouse.mode === 'select') {
        _this3.selection = _this3.copySubgrid(enclosingRect(_this3.selectedA, _this3.selectedB));
        _this3.selectOffset = {
          tx: _this3.selectedB.tx - Math.min(_this3.selectedA.tx, _this3.selectedB.tx),
          ty: _this3.selectedB.ty - Math.min(_this3.selectedA.ty, _this3.selectedB.ty)
        };
        _this3.onSelection && _this3.onSelection(_this3.selection);
      } else if (_this3.mouse.mode === 'paint') {
        _this3.editStop();
        // Its dangerous firing this event here - it should be in a nextTick or
        // something, but I'm lazy. (Sorry future me)
        _this3.onEditFinish && _this3.onEditFinish();
      }

      _this3.mouse.mode = null;
      _this3.mouse.direction = null;
      _this3.imminentSelect = false;
      _this3.updateCursor();
      _this3.draw();
    };

    this.el.onmouseout = function (e) {
      // Pretend the mouse just went up at the edge of the boilerplate instance then went away.
      _this3.el.onmousemove(e);
      _this3.mouse.x = _this3.mouse.y = _this3.mouse.from = _this3.mouse.tx = _this3.mouse.ty = null;
      // ... But if we're drawing, stay in drawing mode.
      _this3.mouse.mode = null;
      _this3.draw();
    };

    this.el.onmouseenter = function (e) {
      if (e.button) {
        _this3.el.onmousemove(e);
        _this3.el.onmousedown(e);
      }
    };

    this.el.onwheel = function (e) {
      if (!_this3.canScroll) return;
      _this3.updateMousePos(e);

      if (e.shiftKey || e.ctrlKey) {
        _this3.view.zoomBy(-e.deltaY / 400, _this3.mouse);
      } else {
        _this3.view.scrollBy(e.deltaX, e.deltaY);
      }
      var d = _this3.view.screenToWorld(_this3.mouse.x, _this3.mouse.y);
      _this3.mouse.tx = d.tx;_this3.mouse.ty = d.ty;

      e.preventDefault();
      _this3.cursorMoved();
    };
  }

  _createClass(Boilerplate, [{
    key: 'updateMousePos',
    value: function updateMousePos(e) {
      this.mouse.from = { tx: this.mouse.tx, ty: this.mouse.ty };

      if (e) {
        this.mouse.x = (0, _util.clamp)(e.offsetX, 0, this.el.offsetWidth - 1);
        this.mouse.y = (0, _util.clamp)(e.offsetY, 0, this.el.offsetHeight - 1);
      }

      var _view$screenToWorldCe = this.view.screenToWorldCell(this.mouse.x, this.mouse.y, this.jit);

      var tx = _view$screenToWorldCe.tx;
      var ty = _view$screenToWorldCe.ty;
      var tc = _view$screenToWorldCe.tc;

      if (tx !== this.mouse.tx || ty !== this.mouse.ty || tc !== this.mouse.tc) {
        this.mouse.tx = tx;
        this.mouse.ty = ty;
        this.mouse.tc = tc;
        return true;
      } else {
        return false;
      }
    }
  }, {
    key: 'cursorMoved',
    value: function cursorMoved() {
      switch (this.mouse.mode) {
        case 'paint':
          this.paint();break;
        case 'select':
          this.selectedB = this.view.screenToWorld(this.mouse.x, this.mouse.y);break;
      }

      if (this.draggedShuttle != null) this.dragShuttleTo(this.mouse.tx, this.mouse.ty);

      this.draw();
      this.updateCursor();
    }
  }, {
    key: 'updateCursor',
    value: function updateCursor() {
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
            c = 'ew-resize';break;
          case 'y':
            c = 'ns-resize';break;
          default:
            c = 'crosshair';
        }
      }
      this.dynCanvas.style.cursor = c;
    }
  }, {
    key: 'resizeTo',
    value: function resizeTo(w, h) {
      this.view.resizeTo(w, h);
    }
  }, {
    key: 'paint',
    value: function paint() {
      var _this4 = this;

      if (this.activeTool === 'move') throw Error('Invalid placing');

      var _mouse = this.mouse;
      var tx = _mouse.tx;
      var ty = _mouse.ty;
      var _mouse$from = this.mouse.from;
      var fromtx = _mouse$from.tx;
      var fromty = _mouse$from.ty;

      if (fromtx == null) fromtx = tx;
      if (fromty == null) fromty = ty;

      line(fromtx, fromty, tx, ty, function (x, y) {
        // this.activeTool is null for solid.
        if (_this4.activeTool === 'shuttle' || _this4.activeTool === 'thinshuttle') {
          var bv = _this4.jit.get('base', x, y);
          if (!(0, _util.letsShuttleThrough)(bv)) bv = 'nothing';
          return _this4.set(x, y, bv, _this4.activeTool);
        } else {
          return _this4.set(x, y, _this4.activeTool, null);
        }
      });

      this.drawAll();
    }
  }, {
    key: 'step',
    value: function step() {
      this.jit.modules.stepWatch.signal('before');
      if (this.jit.step()) {
        this.lastStepAt = Date.now();
        this.drawAll();
        this.updateCursor();
      }
      this.jit.modules.stepWatch.signal('after');
    }
  }, {
    key: 'dragShuttleTo',
    value: function dragShuttleTo(tx, ty) {
      if (this.draggedShuttle == null) return;

      var _draggedShuttle = this.draggedShuttle;
      var shuttle = _draggedShuttle.shuttle;
      var heldPoint = _draggedShuttle.heldPoint;

      // This is a bit awkward - we don't generate all states.

      var wantedDx = tx - heldPoint.x;
      var wantedDy = ty - heldPoint.y;

      // First find the closest existing state to the mouse.
      var bestState = shuttle.currentState;

      // We'll just do a dumb beam search here. Previously we scanned all the
      // shuttle's states to find a good one but with that its possible to make
      // one shuttle hop over another one by dragging.
      var _jit$modules2 = this.jit.modules;
      var shuttleStates = _jit$modules2.shuttleStates;
      var shuttleOverlap = _jit$modules2.shuttleOverlap;

      var next;
      var tryMove = function tryMove(dir) {
        if (next) return;

        next = shuttleStates.getStateNear(bestState, dir);
        if (shuttleOverlap.willOverlap(shuttle, next)) next = null;
      };

      while (bestState.dx !== wantedDx || bestState.dy !== wantedDy) {
        var distX = wantedDx - bestState.dx;
        var distY = wantedDy - bestState.dy;

        next = null;
        if (distX < 0) tryMove(LEFT);else if (distX > 0) tryMove(RIGHT);
        if (distY < 0) tryMove(UP);else if (distY > 0) tryMove(DOWN);

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

  }, {
    key: 'editStart',
    value: function editStart() {
      this.editStop();
      this.currentEdit = {
        base: new _boilerplateJit.Map2(),
        shuttles: new _boilerplateJit.Map2()
      };
    }
  }, {
    key: 'editStop',
    value: function editStop(stack) {
      if (stack == null) stack = this.undoStack;

      // ... also clear the redo stack for real edits.
      if (this.currentEdit) {
        if (this.currentEdit.base.size || this.currentEdit.shuttles.size) {
          stack.push(this.currentEdit);
        }
        this.currentEdit = null;
      }
    }
  }, {
    key: '_popStack',
    value: function _popStack(from, to) {
      var _this5 = this;

      this.editStop();
      var edit;
      if (edit = from.pop()) {
        this.editStart();
        edit.base.forEach(function (x, y, v) {
          return _this5.set(x, y, v, edit.shuttles.get(x, y));
        });
      }
      this.editStop(to);
      this.drawAll();
    }
  }, {
    key: 'redo',
    value: function redo() {
      this._popStack(this.redoStack, this.undoStack);
    }
  }, {
    key: 'undo',
    value: function undo() {
      this._popStack(this.undoStack, this.redoStack);
    }

    // ---------- SELECTION

  }, {
    key: 'copySubgrid',
    value: function copySubgrid(rect) {
      var tx = rect.tx;
      var ty = rect.ty;
      var tw = rect.tw;
      var th = rect.th;

      var subgrid = {
        tw: tw,
        th: th,
        base: new _boilerplateJit.Map2(),
        shuttles: new _boilerplateJit.Map2()
      };

      for (var y = ty; y < ty + th; y++) {
        for (var x = tx; x < tx + tw; x++) {
          var bv = this.jit.get('base', x, y);
          var sv = this.jit.get('shuttles', x, y);

          if (bv) subgrid.base.set(x - tx, y - ty, bv);
          if (sv) subgrid.shuttles.set(x - tx, y - ty, sv);
        }
      }
      return subgrid;
    }
  }, {
    key: '_transformSelection',
    value: function _transformSelection(tw, th, copyfn) {
      if (!this.selection) return;

      var newSelection = {
        tw: tw,
        th: th,
        base: new _boilerplateJit.Map2(),
        shuttles: new _boilerplateJit.Map2()
      };

      this.selection.base.forEach(copyfn(newSelection.base));
      this.selection.shuttles.forEach(copyfn(newSelection.shuttles));
      return this.selection = newSelection;
    }
  }, {
    key: 'flip',
    value: function flip(dir) {
      if (!this.selection) return;

      var _selection = this.selection;
      var tw = _selection.tw;
      var th = _selection.th;

      this._transformSelection(tw, th, function (dest) {
        return function (x, y, v) {
          var x_ = dir === 'x' ? tw - 1 - x : x;
          var y_ = dir === 'y' ? th - 1 - y : y;
          dest.set(x_, y_, v);
        };
      });
    }
  }, {
    key: 'mirror',
    value: function mirror() {
      // Width and height swapped! So tricky.
      if (!this.selection) return;

      this._transformSelection(this.selection.th, this.selection.tw, function (dest) {
        return function (x, y, v) {
          return dest.set(y, x, v);
        };
      });
    }
  }, {
    key: 'stamp',
    value: function stamp() {
      if (!this.selection) throw new Error('tried to stamp without a selection');

      var _view$screenToWorld = this.view.screenToWorld(this.mouse.x, this.mouse.y);

      var mtx = _view$screenToWorld.tx;
      var mty = _view$screenToWorld.ty;

      mtx -= this.selectOffset.tx;
      mty -= this.selectOffset.ty;

      var changed = false;
      // We need to set all values, even the nulls.
      this.editStart();

      for (var y = 0; y < this.selection.th; y++) {
        for (var x = 0; x < this.selection.tw; x++) {
          var bv = this.selection.base.get(x, y);
          var sv = this.selection.shuttles.get(x, y);
          if (this.set(mtx + x, mty + y, bv, sv)) changed = true;
        }
      }

      this.editStop();
      this.onEditFinish && this.onEditFinish();

      if (changed) this.drawAll();
    }
  }, {
    key: 'clearSelection',
    value: function clearSelection() {
      if (this.selection) {
        this.selection = this.selectOffset = null;
        this.onSelectionClear && this.onSelectionClear();
      }
    }
  }, {
    key: 'setSelection',
    value: function setSelection(data) {
      this.clearSelection();
      if (data == null) return;
      assert(data.tw != null);
      this.selection = data;
      this.selectOffset = { tx: 0, ty: 0 };
      this.onSelection && this.onSelection(this.selection);
    }
  }, {
    key: 'copy',
    value: function copy(e) {
      var json;
      if (this.selection) {
        json = { tw: this.selection.tw, th: this.selection.th, base: {}, shuttles: {} };
        this.selection.base.forEach(function (x, y, v) {
          if (v != null) json.base[x + ',' + y] = v;
        });
        this.selection.shuttles.forEach(function (x, y, v) {
          if (v != null) json.shuttles[x + ',' + y] = v;
        });
      } else {
        json = this.getJSONGrid();
      }

      e.clipboardData.setData('text', JSON.stringify(json));
      // console.log(JSON.stringify(json));

      e.preventDefault();
    }
  }, {
    key: 'paste',
    value: function paste(e) {
      var json = e.clipboardData.getData('text');
      if (json) {
        try {
          this.selection = _boilerplateJit.util.deserializeRegion(json);
          this.selectOffset = { tx: 0, ty: 0 };
          this.onSelection && this.onSelection(this.selection);
        } catch (err) {
          this.selection = null;
          console.error('Error parsing data in clipboard:', err.stack);
        }
      }
    }

    // --------- DRAWING

  }, {
    key: 'drawAll',
    value: function drawAll() {
      this.needsDrawAll = true;
      this.draw();
    }
  }, {
    key: 'draw',
    value: function draw() {
      var _this6 = this;

      if (this.needsDraw) return;
      this.needsDraw = true;

      requestAnimationFrame(function () {
        _this6.needsDraw = false;

        if (_this6.needsDrawAll) {
          _this6.jit.modules.shuttles.flush();
          _this6.gridRenderer.draw();
          _this6.needsDrawAll = false;
        }

        // This is a weird place to do keyboard scrolling, but if we do it in
        // step() it'll only happen once every few hundred ms.
        if (_this6.keysPressed & 0xf && _this6.canScroll) {
          var now = Date.now();
          var amt = 0.6 * Math.min(now - _this6.lastKeyScroll, 300);
          if (_this6.keysPressed & KEY.shift) amt *= 3;

          if (_this6.keysPressed & KEY.up) _this6.view.scrollBy(0, -amt);
          if (_this6.keysPressed & KEY.right) _this6.view.scrollBy(amt, 0);
          if (_this6.keysPressed & KEY.down) _this6.view.scrollBy(0, amt);
          if (_this6.keysPressed & KEY.left) _this6.view.scrollBy(-amt, 0);

          _this6.lastKeyScroll = now;

          if (_this6.updateMousePos()) _this6.cursorMoved();
        }

        _this6.dctx.clearRect(0, 0, _this6.width, _this6.height);
        _this6.drawGrid();
        _this6.drawOverlay();
        if (_this6.keysPressed) _this6.draw();
      });
    }

    // Helper to draw blocky cells. Currently only used to draw hovered cells.
    // override is either a string css color or function.

  }, {
    key: 'drawCells',
    value: function drawCells(ctx, points, override) {
      var _this7 = this;

      var size = this.view.size;
      points.forEach(function (tx, ty, v) {
        var _view$worldToScreen = _this7.view.worldToScreen(tx, ty);

        var px = _view$worldToScreen.px;
        var py = _view$worldToScreen.py;

        if (px + size < 0 || px >= _this7.width || py + size < 0 || py >= _this7.height) return;

        var style = typeof override === 'function' ? override(tx, ty, v) : override ? override : COLORS[v] || 'red';
        if (style == null) return;

        ctx.fillStyle = style;
        ctx.fillRect(px, py, size, size);
      });
    }

    // Draw a path around the specified blob edge. The edge should be a Set3 of (x,y,dir).

  }, {
    key: 'pathAroundEdge',
    value: function pathAroundEdge(ctx, edge, border, pos) {
      var _this8 = this;

      var sx = pos ? pos.sx : 0,
          sy = pos ? pos.sy : 0;

      // Ok, now for the actual shuttles themselves
      var lineTo = function lineTo(x, y, dir, em, first) {
        // Move to the right of the edge.
        //var dx, dy, ex, ey, px, py, ref2, ref3;
        var ex = dir === UP || dir === RIGHT ? x + 1 : x;
        var ey = dir === RIGHT || dir === DOWN ? y + 1 : y;
        ex += sx;ey += sy; // transform by shuttle state x,y

        var _view$worldToScreen2 = _this8.view.worldToScreen(ex, ey);

        var px = _view$worldToScreen2.px;
        var py = _view$worldToScreen2.py;
        var _DIRS$dir = DIRS[dir];
        var dx = _DIRS$dir.dx;
        var dy = _DIRS$dir.dy;

        // Come in from the edge

        px += border * (-dx - dy * em);
        py += border * (-dy + dx * em);

        if (first) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      };

      var visited = new _boilerplateJit.Set3();
      ctx.beginPath();

      // I can't simply draw from the first edge because the shuttle might have
      // holes (and hence multiple continuous edges).
      edge.forEach(function (x, y, dir) {
        // Using pushEdges because I want to draw the outline around just the
        // solid shuttle cells.
        if (visited.has(x, y, dir)) return;

        var first = true; // For the first point we need to call moveTo() not lineTo().

        while (!visited.has(x, y, dir)) {
          visited.add(x, y, dir);
          var _DIRS$dir2 = DIRS[dir];
          var dx = _DIRS$dir2.dx;
          var dy = _DIRS$dir2.dy;

          var x2, y2, dir2;
          if (edge.has(x2 = x + dx - dy, y2 = y + dy + dx, dir2 = (dir + 3) % 4) && // up-right
          !edge.has(x, y, (dir + 1) % 4)) {
            // fix pincy corners
            // Curves in _|
            lineTo(x, y, dir, 1, first);
            x = x2;y = y2;dir = dir2;
            first = false;
          } else if (edge.has(x2 = x - dy, y2 = y + dx, dir)) {
            // straight __
            x = x2;y = y2;
          } else {
            // curves down ^|
            // We could check for it, but there's no point.
            lineTo(x, y, dir, -1, first);
            dir = (dir + 1) % 4;
            first = false;
          }
        }
        ctx.closePath();
      });
    }
  }, {
    key: 'drawShuttle',
    value: function drawShuttle(shuttle, t, isHovered) {
      var _this9 = this;

      var prevState = this.jit.modules.prevState.get(shuttle);
      var sx, sy;
      if (prevState && (!this.draggedShuttle || shuttle !== this.draggedShuttle.shuttle)) {
        sx = (0, _util.lerp)(t, prevState.dx, shuttle.currentState.dx);
        sy = (0, _util.lerp)(t, prevState.dy, shuttle.currentState.dy);
      } else {
        sx = shuttle.currentState.dx;sy = shuttle.currentState.dy;
      }

      var bounds = shuttle.bounds;
      var topLeft = this.view.worldToScreen(bounds.left + sx, bounds.top + sy);
      var botRight = this.view.worldToScreen(bounds.right + sx + 1, bounds.bottom + sy + 1);
      // First get bounds - we might not even be able to display the shuttle.
      if (topLeft.px > this.width || topLeft.py > this.height || botRight.px < 0 || botRight.py < 0) return false;

      // Maaaagiiiiicccc
      var border = this.view.size < 5 ? 0 : this.view.size * 0.04 + 1 | 0;

      // Thinshuttles first.
      this.dctx.strokeStyle = isHovered ? 'hsl(283, 89%, 65%)' : COLORS.thinshuttle;

      var size2 = this.view.size / 2 | 0;
      var size4 = this.view.size / 4 | 0;
      this.dctx.lineWidth = size4 * 2; // An even number.

      shuttle.points.forEach(function (x, y, v) {
        //v = util.shuttleStr(v);
        if (v & SHUTTLE) return;

        // base x, y of the tile

        var _view$worldToScreen3 = _this9.view.worldToScreen(x + sx, y + sy);

        var px = _view$worldToScreen3.px;
        var py = _view$worldToScreen3.py;

        px += size2;py += size2;

        var numLines = 0;
        for (var i = 0; i < DIRS.length; i++) {
          var _DIRS$i = DIRS[i];
          var dx = _DIRS$i.dx;
          var dy = _DIRS$i.dy;

          if (!shuttle.points.has(x + dx, y + dy)) continue;
          // Draw a little line from here to there.
          _this9.dctx.beginPath();
          _this9.dctx.moveTo(px - size4 * dx, py - size4 * dy);
          _this9.dctx.lineTo(px + (_this9.view.size + size4) * dx, py + (_this9.view.size + size4) * dy);
          _this9.dctx.stroke();
          numLines++;
        }

        if (numLines === 0) {
          // Erk, the shuttle (with a single thinshuttle) would be invisible.
          // I'll draw a sympathy square.
          var _ = _this9.view.worldToScreen(x + sx, y + sy);px = _.px;py = _.py;

          _this9.dctx.fillStyle = COLORS.thinshuttle;
          _this9.dctx.fillRect(px + size4, py + size4, size2, size2);
        }
      });

      this.pathAroundEdge(this.dctx, shuttle.pushEdges, border, { sx: sx, sy: sy });
      this.dctx.fillStyle = COLORS.shuttle;
      this.dctx.fill();

      if (isHovered) {
        this.pathAroundEdge(this.dctx, shuttle.pushEdges, border * 2, { sx: sx, sy: sy });
        this.dctx.lineWidth = border * 4;
        this.dctx.strokeStyle = 'hsla(283, 65%, 25%, 0.5)';
        this.dctx.stroke();
      }

      return true;
    }
  }, {
    key: 'drawEngine',
    value: function drawEngine(engine, t) {
      this.pathAroundEdge(this.dctx, engine.edges, 2);

      this.dctx.strokeStyle = engine.type === 'positive' ? 'hsl(120, 52%, 26%)' : 'hsl(16, 68%, 20%)';

      this.dctx.lineWidth = 4;
      this.dctx.stroke();
    }
  }, {
    key: 'drawGrid',
    value: function drawGrid() {
      var _this10 = this;

      // Will we need to draw again after?
      var needsRedraw = false;

      // For animating shuttle motion
      var t = 1;
      if (this.animTime && this.lastStepAt) {
        var now = Date.now();
        var exact = (now - this.lastStepAt) / this.animTime;

        // This makes the shuttles always draw at exact pixel boundaries
        t = Math.min(1, (exact * this.view.size | 0) / this.view.size);
      }

      // Mouse position.
      var mx = this.mouse.x,
          my = this.mouse.y;

      var _view$screenToWorldCe2 = this.view.screenToWorldCell(mx, my, this.jit);

      var mtx = _view$screenToWorldCe2.tx;
      var mty = _view$screenToWorldCe2.ty;
      var mtc = _view$screenToWorldCe2.tc;

      var hover = {};

      if (this.activeTool === 'move' && !this.selection && !this.imminentSelect) {
        var bv = this.jit.get('base', mtx, mty);
        var sv = _boilerplateJit.util.shuttleStr(this.jit.get('shuttles', mtx, mty));

        // What is the mouse hovering over? For better or worse, this relies
        // heavily uses the parser internals.
        var modules = this.jit.modules;

        hover.shuttle = modules.shuttleGrid.getShuttle(mtx, mty);

        var engine = modules.engineGrid.get(mtx, mty);
        if (engine) this.drawEngine(engine, t);

        var contents;
        if (sv !== 'shuttle' && bv && (contents = this.jit.getZoneContents(mtx, mty, mtc))) {
          hover.points = contents.points;
          hover.pressure = 0;
          contents.engines.forEach(function (e) {
            hover.pressure += e.pressure;
            _this10.drawEngine(e, t);
          });
        }
      }

      // Draw the shuttles.
      this.jit.modules.shuttles.forEach(function (shuttle) {
        if (_this10.drawShuttle(shuttle, t, hover.shuttle === shuttle)) {
          needsRedraw = true;
        }
      });

      if (hover.points) {
        this.drawCells(this.dctx, hover.points, 'rgba(100,100,100,0.3)');
      }

      if (hover.pressure) {
        var px = mx,
            py = my + 20;

        var size = 23;
        var fontsize = size;
        var text = '' + hover.pressure;
        while (fontsize > 3) {
          this.dctx.font = fl(fontsize) + 'px sans-serif';
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
    }
  }, {
    key: 'drawOverlay',
    value: function drawOverlay() {
      var mx = this.mouse.x,
          my = this.mouse.y;

      var _view$screenToWorld2 = this.view.screenToWorld(mx, my);

      var mtx = _view$screenToWorld2.tx;
      var mty = _view$screenToWorld2.ty;

      var _view$worldToScreen4 = this.view.worldToScreen(mtx, mty);

      var mpx = _view$worldToScreen4.px;
      var mpy = _view$worldToScreen4.py;

      var sa, sb;
      if (this.mouse.mode === 'select') {
        sa = this.selectedA;
        sb = this.selectedB;
      } else if (this.imminentSelect) {
        sa = sb = { tx: mtx, ty: mty };
      }

      this.dctx.lineWidth = 1;
      var size = this.view.size;

      // Draw the mouse hover state
      if (this.mouse.tx !== null) {
        if (sa) {
          // The user is dragging out a selection rectangle.

          var _enclosingRect = enclosingRect(sa, sb);

          var tx = _enclosingRect.tx;
          var ty = _enclosingRect.ty;
          var tw = _enclosingRect.tw;
          var th = _enclosingRect.th;

          var _view$worldToScreen5 = this.view.worldToScreen(tx, ty);

          var px = _view$worldToScreen5.px;
          var py = _view$worldToScreen5.py;

          this.dctx.fillStyle = 'rgba(0,0,255,0.5)';
          this.dctx.fillRect(px, py, tw * size, th * size);

          this.dctx.strokeStyle = 'rgba(0,255,255,0.5)';
          this.dctx.strokeRect(px, py, tw * size, th * size);
        } else if (this.selection) {
          // mouse.tx is null when the mouse is outside the div.
          // The user is holding a selection stamp
          this.dctx.globalAlpha = 0.8;

          for (var y = 0; y < this.selection.th; y++) {
            for (var x = 0; x < this.selection.tw; x++) {
              // Ugh so wordy.

              var _view$worldToScreen6 = this.view.worldToScreen(x + mtx - this.selectOffset.tx, y + mty - this.selectOffset.ty);

              var px = _view$worldToScreen6.px;
              var py = _view$worldToScreen6.py;

              if (px + size >= 0 && px < this.width && py + size >= 0 && py < this.height) {
                var v = this.selection.shuttles.get(x, y) || this.selection.base.get(x, y);
                if (typeof v === 'number') v = _boilerplateJit.util.shuttleStr(v);

                this.dctx.fillStyle = (v ? COLORS[v] : COLORS.solid) || 'red';
                this.dctx.fillRect(px, py, size, size);
              }
            }
          }
          this.dctx.strokeStyle = 'rgba(0,255,255,0.5)';
          this.dctx.strokeRect(mpx - this.selectOffset.tx * size, mpy - this.selectOffset.ty * size, this.selection.tw * size, this.selection.th * size);
          this.dctx.globalAlpha = 1;
        } else if (mpx != null) {
          if (this.activeTool !== 'move') {
            // The user is holding a paintbrush
            this.dctx.fillStyle = COLORS[this.activeTool || 'solid'] || 'red';
            this.dctx.fillRect(mpx + size / 4, mpy + size / 4, size / 2, size / 2);

            this.dctx.strokeStyle = this.jit.get('base', mtx, mty) ? 'black' : 'white';
            this.dctx.strokeRect(mpx + 1, mpy + 1, size - 2, size - 2);
          }
        }
      }
    }
  }]);

  return Boilerplate;
})();

module.exports = Boilerplate;
Boilerplate.colors = COLORS;

},{"./gl":6,"./util":8,"./view":9,"assert":19,"boilerplate-jit":11}],6:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })(); // GL renderer for the grid

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _boilerplateJit = require('boilerplate-jit');

var _glutil = require('./glutil');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DIRS = _boilerplateJit.util.DIRS;

var glify = undefined;
var assert = require('assert');

// The value here doesn't matter much - and won't until I make a bunch more
// performance tweaks.
var TILE_SIZE = 16;

var TEXMAP = {};

(function () {
  var VALS = ['solid', 'nothing', 'thinsolid', 'positive', 'negative', 'bridge', 'ribbon', 'ribbonbridge'];
  for (var i = 1; i <= 16; i++) {
    VALS.push("ins" + i);
  }
  VALS.forEach(function (v, i) {
    TEXMAP[v] = i;
  });
})();

function nearestPowerOf2(v) {
  v--;
  v |= v >> 1;v |= v >> 2;v |= v >> 4;v |= v >> 8;v |= v >> 16;
  return v + 1;
}
assert.equal(TILE_SIZE, nearestPowerOf2(TILE_SIZE));
var TILE_OFFSET_MASK = TILE_SIZE - 1; // hax :D

// Awesome bittweaking is awesome, but it has an off-by-1 error for negative
// numbers.
//const T = x => (x & ~TILE_OFFSET_MASK)/TILE_SIZE;
var T = function T(x) {
  return Math.floor(x / TILE_SIZE);
};
var O = function O(x) {
  return x & TILE_OFFSET_MASK;
};
var P = function P(p) {
  return p > 0 ? 0x40 : p < 0 ? 0x80 : 0;
};

function FrameTimer(currentStates, shuttles, stepWatch) {
  var time = 1;
  var watch = new _boilerplateJit.Watcher(function () {
    return time;
  });

  var inFrame = false;

  stepWatch.on(function (when) {
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
    watch: watch,
    get: function get() {
      return time;
    }
  };
}

// Keep track of the set of groups which have pressure.
// This module is eager - it'll push out pressure changes across the entire map
// whenever a step happens.
//
// It relies on engines being flush()'ed.
function GroupsWithPressure(engines, groups, regions, zones, currentStates) {
  // Groups start off in dirtySeeds. On flush() we create pressure objects and
  // they move to activePressure. When their zone is destroyed they go to
  // dirtyPressure and on the next flush call we tell our watchers about them.
  // Then dirtyPressure is cleared.
  var pendingSeedPoints = [];
  var dirtySeeds = new Set();
  var activePressure = new Set(); // for cold start
  var dirtyPressure = [];

  // const pressureForSeed = new Map; // seed -> pressure
  var pressureForZone = new WeakMap(); // zone -> current pressure object.

  // const seedPoints = new WeakMap; // group -> list of {x,y,c}.
  // seedPoints.default = () => [];

  var watch = new _boilerplateJit.Watcher(function (fn) {
    var all = [];
    activePressure.forEach(function (p) {
      return all.add(pressure);
    });
    fn([], all);
  });

  // This module keeps track of which groups have pressure. We'll be eager about
  // fetching groups. This relies on calling engines.flush() at the right times.
  engines.addWatch.forward(function (e) {
    e.edges.forEach(function (x, y, dir) {
      pendingSeedPoints.push({ x: x, y: y, c: dir });
      // addSeed(e, x, y, dir);
    });
  });

  engines.deleteWatch.on(function (e) {
    // console.log('engine delete', e);
    for (var i = 0; i < pendingSeedPoints.length; i++) {
      var _pendingSeedPoints$i = pendingSeedPoints[i];
      var x = _pendingSeedPoints$i.x;
      var y = _pendingSeedPoints$i.y;
      var c = _pendingSeedPoints$i.c;

      if (e.points.has(x, y)) {
        // console.log('removing', x, y);
        pendingSeedPoints[i] = pendingSeedPoints[pendingSeedPoints.length - 1];
        i--;
        pendingSeedPoints.length--;
      }
    }
  });

  function makePressurized(seed) {
    // seed is a group.
    var pressure = {
      regions: new Set(),
      // groups: new Set,
      pressure: 0,
      seeds: [] // almost always just 1 item.
    };

    // Flood fill to find all the regions.
    var r0 = regions.get(seed, currentStates.map);
    assert(r0);
    _boilerplateJit.util.fillGraph(r0, function (r, hmm) {
      pressure.regions.add(r);
      r.groups.forEach(function (g) {
        // pressure.groups.add(g)
        if (dirtySeeds.has(g)) {
          // assert(!pressureForSeed.has(g));

          pressure.seeds.push(g);
          dirtySeeds.delete(g);
          // pressureForSeed.set(g, pressure);
        }
      });
      // pressure.regions.add(r);
      r.edges.forEach(function (g) {
        assert(g.used);
        var r2 = regions.get(g, currentStates.map);
        if (r2) hmm(r2);
      });
    });

    // We could calculate the pressure here, but the zone will need be generated
    //  anyway. We may as well just reuse its pressure calculation.
    var zone = zones.getZoneForRegion(r0);
    pressure.pressure = zone.pressure;
    pressureForZone.set(zone, pressure);
    activePressure.add(pressure);

    return pressure;
  }

  function deleteSeed(group) {
    // console.log('ds', group);
    assert(!dirtySeeds.has(group));
    group.engines.forEach(function (e) {
      if (e.used) e.edges.forEach(function (x, y, dir) {
        if (group.points.has(x, y, dir)) {
          // console.log('pushing point back', x, y, dir, e, e.used);
          pendingSeedPoints.push({ x: x, y: y, c: dir });
        }
      });
    });
  }

  // If an engine gets deleted, the groups and zones will get deleted too.
  // The only thing we need to clean up is the dirty groups.
  groups.deleteWatch.on(function (g) {
    // The pressure object will be removed anyway because the zone will get destroyed.
    if (dirtySeeds.delete(g)) {
      // console.log('deleting seed', g);
      deleteSeed(g);
    }
  });

  zones.watch.on(function (z) {
    var p = pressureForZone.get(z);
    if (!p) return;
    // console.log('dirty pressure', p);
    dirtyPressure.push(p);
    for (var i = 0; i < p.seeds.length; i++) {
      var s = p.seeds[i];
      if (s.used) dirtySeeds.add(s);else deleteSeed(s);
    }
    // pressureForZone.delete(z); // its a weak map. not needed.
    activePressure.delete(p);
  });

  return {
    watch: watch,
    flush: function flush() {
      engines.flush();
      if (pendingSeedPoints.length) {
        for (var i = 0; i < pendingSeedPoints.length; i++) {
          var _pendingSeedPoints$i2 = pendingSeedPoints[i];
          var x = _pendingSeedPoints$i2.x;
          var y = _pendingSeedPoints$i2.y;
          var c = _pendingSeedPoints$i2.c;

          var g = groups.get(x, y, c);
          if (g) {
            // console.log('addSeed', x, y, c, g);
            dirtySeeds.add(g);
          }
        }
        pendingSeedPoints.length = 0;
      }

      var newPressure = [];
      // console.log('flush', dirtySeeds);
      dirtySeeds.forEach(function (s) {
        // console.log('dirty seed', s);
        newPressure.push(makePressurized(s));
      });
      assert.equal(dirtySeeds.size, 0);

      watch.signal(dirtyPressure, newPressure);
      dirtyPressure.length = 0;
    }
  };
}

function Tiles(gl, baseGrid, groups, zones, frameTimer) {
  var tiles = new _boilerplateJit.Map2(makeTile);

  function makeTile(tx, ty) {
    return {
      lastFlush: -1,
      count: 0,

      // One channel. High 2 bits for pressure, low 6 bits for value.
      data: new Uint8Array(TILE_SIZE * TILE_SIZE),
      dirty: false,
      tex: -1,
      bind: function bind() {
        if (this.tex == -1) {
          this.tex = gl.createTexture();
          // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          this.dirty = true;
        } else {
          gl.bindTexture(gl.TEXTURE_2D, this.tex);
        }

        if (this.dirty) {
          // console.log('dirty', tx, ty);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, TILE_SIZE, TILE_SIZE, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.data);
          this.dirty = false;
        }
      }
    };
  }

  baseGrid.afterWatch.forward(function (x, y, oldv, v) {
    var tx = T(x),
        ty = T(y);
    var ox = O(x),
        oy = O(y);

    var t = tiles.getDef(tx, ty);
    if (oldv != null) t.count--;
    if (v != null) t.count++;
    t.dirty = true;
    t.data[ox + oy * TILE_SIZE] = TEXMAP[v];
    // t.data[(ox + (TILE_SIZE - oy - 1) * TILE_SIZE)] = TEXMAP[v];

    if (t.count == 0) {
      // console.log('deleting tile', tx, ty);
      tiles.delete(tx, ty);
      if (t.tex != -1) gl.deleteTexture(t.tex);
    }
  });

  return {
    data: tiles,
    get: function get(x, y) {
      return tiles.get(T(x), T(y));
    },
    cleanup: function cleanup() {
      tiles.forEach(function (t) {
        if (t.tex != -1) {
          gl.deleteTexture(t.tex);
        }
      });
    },
    setPressure: function setPressure(group, pressure) {
      var _tx = 0,
          _ty = 0;
      var t = null;
      group.points.forEach(function (x, y, c, v) {
        if (v === 'nothing' || v === 'thinsolid') {
          var tx = T(x),
              ty = T(y);
          var ox = O(x),
              oy = O(y);

          if (t === null || tx !== _tx || ty !== _ty) {
            t = tiles.get(tx, ty);
            _tx = tx;_ty = ty;
          }

          if (t === undefined) {
            assert(pressure === 0);
            return;
          }

          var offset = ox + oy * TILE_SIZE;
          var oldv = t.data[offset];
          // assert(oldv === 1 || oldv === 2);
          t.data[offset] = oldv & 0x3f | pressure;
          t.dirty = true;
        }
      });
    }
  };
}

function GroupPressure(tiles, groupsWithPressure) {
  function set(group, pressure) {
    tiles.setPressure(group, pressure);
  }

  groupsWithPressure.watch.forward(function (oldp, newp) {
    // old and new are lists. We need to figure out the set of groups to update.
    // Each group will appear zero or one times in old, and zero or one times in
    // new.

    var newGroups = new Map(); // group -> pressure.

    var _loop = function _loop(i) {
      var p = newp[i];
      // console.log('newp', p);
      if (p.pressure === 0) return 'continue';
      p.regions.forEach(function (r) {
        return r.groups.forEach(function (g) {
          newGroups.set(g, p.pressure);
        });
      });
    };

    for (var i = 0; i < newp.length; i++) {
      var _ret = _loop(i);

      if (_ret === 'continue') continue;
    }

    var _loop2 = function _loop2(i) {
      var p = oldp[i];
      // console.log('oldp', p);
      if (p.pressure === 0) return 'continue';
      var _p = P(p.pressure);
      p.regions.forEach(function (r) {
        return r.groups.forEach(function (g) {
          if (newGroups.has(g)) {
            if (_p === P(newGroups.get(g))) {
              newGroups.delete(g);
            }
          } else {
            set(g, 0);
          }
        });
      });
    };

    for (var i = 0; i < oldp.length; i++) {
      var _ret2 = _loop2(i);

      if (_ret2 === 'continue') continue;
    }
    newGroups.forEach(function (p, g) {
      return set(g, P(p));
    });
  });
}

var GLRenderer = (function () {
  function GLRenderer(canvas, view) {
    _classCallCheck(this, GLRenderer);

    this.canvas = canvas;
    this.view = view;
    //this.jit = jit;
    var opts = { antialias: true, depth: false };
    var gl = this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);

    view.watch.forward(function (_ref) {
      var width = _ref.width;
      var height = _ref.height;

      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;

      gl.viewport(0, 0, canvas.width, canvas.height);
      //this.updateProjection();
      // this.draw();
    });

    this.shader = (0, _glutil.compileProgram)(gl, {"vertex":"precision mediump float;attribute vec2 pos;uniform mat3 proj;varying vec2 a;void main(){a=pos;gl_Position=vec4((vec3(pos,1)*proj).xy,0,1);}","fragment":"precision mediump float;precision mediump float;uniform sampler2D tile;varying vec2 a;void main(){ivec3 b=ivec3(texture2D(tile,a)*256.);int c=b.r;bool d,e;d=c>=128;if(d)c-=128;e=c>=64;if(e)c-=64;vec4 f=c==0?vec4(.035,.098,.105,1):c==1?vec4(1):c==2?vec4(.709,.709,.709,1):c==3?vec4(.36,.8,.36,1):c==4?vec4(.839,.341,.16,1):c==5?vec4(.101,.494,.835,1):c==6?vec4(.725,.235,.682,1):c==7?vec4(.423,.117,.85,1):vec4(1,.411,.705,1);gl_FragColor=d?f*.8+vec4(.2,0,0,.2):e?f*.8+vec4(0,.2,0,.2):f;}"}, ['proj', 'tile'], ['pos']);

    this.verts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    var tverts = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, tverts, gl.STATIC_DRAW);
  }

  _createClass(GLRenderer, [{
    key: 'addModules',
    value: function addModules(jit) {
      var modules = jit.modules;
      var baseGrid = modules.baseGrid;
      var shuttles = modules.shuttles;
      var engines = modules.engines;
      var groups = modules.groups;
      var regions = modules.regions;
      var zones = modules.zones;
      var currentStates = modules.currentStates;
      var stepWatch = modules.stepWatch;

      // Delete old textures so we don't leak.

      if (this.tiles) this.tiles.cleanup();

      this.frameTimer = modules.frameTimer = FrameTimer(currentStates, shuttles, stepWatch);
      this.tiles = modules.tiles = Tiles(this.gl, baseGrid, groups, zones, this.frameTimer);
      this.groupWithPressure = modules.groupWithPressure = GroupsWithPressure(engines, groups, regions, zones, currentStates);
      this.groupPressure = GroupPressure(this.tiles, this.groupWithPressure);
    }
  }, {
    key: 'draw',
    value: function draw() {
      this.groupWithPressure.flush();
      // console.log('draw base');
      var gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);

      var shader = this.shader;
      gl.useProgram(shader.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
      // index, size, type, normalized, stride, offset from the buffer
      gl.vertexAttribPointer(shader.attrs.pos, 2, gl.FLOAT, false, 8, 0);

      var view = this.view;
      var maxtx = T(view.scrollX + view.width / view.size);
      var maxty = T(view.scrollY + view.height / view.size);

      // Might be better off with a 16 array - I hear 4x4 matricies are faster?
      var proj = new Float32Array(9);

      for (var x = T(view.scrollX); x <= maxtx; x++) {
        for (var y = T(view.scrollY); y <= maxty; y++) {
          var t = this.tiles.data.get(x, y);
          if (!t) continue;

          // console.log('rendering tile', x, y);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1i(shader.uniforms.tile, 0);
          t.bind();

          var _view = this.view;
          // Tile width in pixels
          var TWS = TILE_SIZE * _view.size;

          // Scroll size in pixels, rounded off to avoid weird glitching
          var sx = Math.floor(_view.scrollX * _view.size);
          var sy = Math.floor(_view.scrollY * _view.size);

          proj[0] = 2 * TWS / _view.width;
          proj[4] = -2 * TWS / _view.height;

          proj[2] = 2 * (x * TILE_SIZE * _view.size - sx) / _view.width - 1;
          proj[5] = 1 - 2 * (y * TILE_SIZE * _view.size - sy) / _view.height;
          proj[8] = 1;

          // console.log(proj);

          gl.uniformMatrix3fv(shader.uniforms.proj, false, proj);

          // DRAW!
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
    }
  }]);

  return GLRenderer;
})();

exports.default = GLRenderer;

},{"./glutil":7,"assert":19,"boilerplate-jit":11}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compileProgram = compileProgram;

// Type is gl.FRAGMENT_SHADER or gl.VERTEX_SHADER
function compile(gl, type, code) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, code);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function compileProgram(gl, source, uniformNames, attrNames) {
  var program = gl.createProgram();

  var vert = compile(gl, gl.VERTEX_SHADER, source.vertex);
  var frag = compile(gl, gl.FRAGMENT_SHADER, source.fragment);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.validateProgram(program);
  var message = gl.getProgramInfoLog(program);
  if (message) console.warn(message);
  //gl.useProgram(program);

  var uniforms = {};
  if (uniformNames) uniformNames.forEach(function (u) {
    uniforms[u] = gl.getUniformLocation(program, u);
  });

  var attrs = {};
  if (attrNames) attrNames.forEach(function (name) {
    attrs[name] = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attrs[name]);
  });

  return {
    program: program,
    uniforms: uniforms,
    attrs: attrs,
    draw: function draw() {}
  };
};

},{}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.letsShuttleThrough = letsShuttleThrough;
exports.layerOf = layerOf;
exports.lerp = lerp;
exports.clamp = clamp;
function letsShuttleThrough(v) {
  return v === 'nothing' || v === 'bridge' || v === 'ribbon' || v === 'ribbonbridge';
}

function layerOf(v) {
  return v === 'shuttle' || v === 'thinshuttle' ? 'shuttles' : 'base';
}

// t=0 -> x, t=1 -> y
function lerp(t, x, y) {
  return (1 - t) * x + t * y;
}

function clamp(x, min, max) {
  return Math.max(Math.min(x, max), min);
}

},{}],9:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _boilerplateJit = require('boilerplate-jit');

var _util = require('./util');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UP = 0,
    RIGHT = 1,
    DOWN = 2,
    LEFT = 3;

// For now using old export syntax to make require() easier.
module.exports = (function () {
  function View(width, height, options) {
    var _this = this;

    _classCallCheck(this, View);

    this.width = width;
    this.height = height;
    this.watch = new _boilerplateJit.Watcher(function (fn) {
      fn(_this);
    });
    this.reset(options);
  }

  _createClass(View, [{
    key: 'reset',
    value: function reset() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      this.zoomLevel = options.initialZoom || 1;
      this.zoomBy(0);

      // In tile coordinates.
      this.scrollX = options.initialX || 0;
      this.scrollY = options.initialY || 0;
      this.watch.signal(this);
    }
  }, {
    key: 'zoomBy',
    value: function zoomBy(diff, center) {
      // Center is {x, y}
      var oldsize = this.size;
      this.zoomLevel += diff;
      this.zoomLevel = (0, _util.clamp)(this.zoomLevel, 1 / 20, 5);

      // this.size = Math.floor(20 * this.zoomLevel);
      this.size = 20 * this.zoomLevel;

      // Recenter
      if (center != null) {
        this.scrollX += center.x / oldsize - center.x / this.size;
        this.scrollY += center.y / oldsize - center.y / this.size;
      }
      this.watch.signal(this);
    }
  }, {
    key: 'snap',
    value: function snap(center) {
      var fl = Math.floor(this.size);
      // const AMT = 0.05;
      if (this.size != fl) {
        var oldsize = this.size;
        this.size = fl; //(oldsize - fl < AMT) ? fl : oldsize - AMT;

        if (center != null) {
          this.scrollX += center.x / oldsize - center.x / this.size;
          this.scrollY += center.y / oldsize - center.y / this.size;
        }
        return true;
      } else return false;
    }
  }, {
    key: 'scrollBy',
    value: function scrollBy(dx, dy) {
      this.scrollX += dx / this.size;
      this.scrollY += dy / this.size;
      this.watch.signal(this);
    }
  }, {
    key: 'resizeTo',
    value: function resizeTo(width, height) {
      this.width = width;
      this.height = height;
      this.watch.signal(this);
    }

    // **** Utility methods

    // given pixel x,y returns tile x,y

  }, {
    key: 'screenToWorld',
    value: function screenToWorld(px, py) {
      if (px == null) return { tx: null, ty: null };
      // first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
      px += Math.floor(this.scrollX * this.size);
      py += Math.floor(this.scrollY * this.size);
      // now we can simply divide and floor to find the tile
      var tx = Math.floor(px / this.size);
      var ty = Math.floor(py / this.size);
      return { tx: tx, ty: ty };
    }

    // Same as screenToWorld, but also returns which cell in the result.

  }, {
    key: 'screenToWorldCell',
    value: function screenToWorldCell(px, py, jit) {
      if (px == null) return { tx: null, ty: null };
      // This logic is adapted from screenToWorld above.
      px += Math.floor(this.scrollX * this.size);
      py += Math.floor(this.scrollY * this.size);
      var tx_ = px / this.size,
          ty_ = py / this.size;
      var tx = Math.floor(tx_),
          ty = Math.floor(ty_);

      // There's no cell for solid (null) cells.
      var v = jit.get('base', tx, ty);
      if (!v) return { tx: tx, ty: ty, tc: null };

      var offX = tx_ - tx,
          offY = ty_ - ty;
      var upRight = offX > offY;
      var downRight = offX + offY > 1;

      var tc;
      switch (v) {
        case 'bridge':
          // The only cells are UP and RIGHT.
          tc = upRight !== downRight ? UP : RIGHT;
          break;
        case 'ribbon':case 'ribbonbridge':
          tc = Math.floor(offY * util.NUMINS);
          break;
        case 'negative':case 'positive':
          tc = upRight ? downRight ? RIGHT : UP : downRight ? DOWN : LEFT;
          break;
        default:
          tc = 0;
      }

      return { tx: tx, ty: ty, tc: tc };
    }
  }, {
    key: 'worldToScreen',
    value: function worldToScreen(tx, ty) {
      if (tx == null) return { px: null, py: null };
      return {
        px: tx * this.size - Math.floor(this.scrollX * this.size),
        py: ty * this.size - Math.floor(this.scrollY * this.size)
      };
    }
  }]);

  return View;
})();

},{"./util":8,"boilerplate-jit":11}],10:[function(require,module,exports){
var Map2, Map3, Set2, Set3, SetOfPairs, assert, inspect,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

inspect = require('util').inspect;

assert = require('assert');

exports.Set2 = Set2 = require('set2');

Map.prototype.getDef = WeakMap.prototype.getDef = function(k) {
  var v;
  v = this.get(k);
  if (v == null) {
    v = this["default"](k);
    this.set(k, v);
  }
  return v;
};

Set.prototype.map = function(fn) {
  var result;
  result = new Set;
  this.forEach(function(x) {
    return result.add(fn(x));
  });
  return result;
};

exports.Map2 = Map2 = (function(superClass) {
  extend(Map2, superClass);

  function Map2(data) {
    if (typeof data === 'function') {
      this["default"] = data;
      Map2.__super__.constructor.call(this);
    } else {
      Map2.__super__.constructor.call(this, data);
    }
  }

  Map2.prototype.getDef = function(k1, k2) {
    var v;
    v = this.get(k1, k2);
    if (v == null) {
      this.set(k1, k2, v = this["default"](k1, k2));
    }
    return v;
  };

  Map2.prototype.forEach = function(fn) {
    return Map2.__super__.forEach.call(this, function(v, k1, k2) {
      return fn(k1, k2, v);
    });
  };

  return Map2;

})(require('map2'));

exports.Map3 = Map3 = (function() {
  function Map3(data) {
    var i, k1, k2, k3, len, ref, v;
    this.map = new Map;
    this.size = 0;
    if (typeof data === 'function') {
      this["default"] = data;
    } else if (data) {
      for (i = 0, len = data.length; i < len; i++) {
        ref = data[i], k1 = ref[0], k2 = ref[1], k3 = ref[2], v = ref[3];
        this.set(k1, k2, k3, v);
      }
    }
  }

  Map3.prototype.get = function(k1, k2, k3) {
    var l1, l2, v;
    l1 = this.map.get(k1);
    if (l1) {
      l2 = l1.get(k2);
    }
    if (l2) {
      v = l2.get(k3);
    }
    if ((v == null) && this["default"]) {
      this.set(k1, k2, k3, v = this["default"](k1, k2));
    }
    return v;
  };

  Map3.prototype.has = function(k1, k2, k3) {
    var l1, l2;
    l1 = this.map.get(k1);
    if (l1) {
      l2 = l1.get(k2);
    }
    return (l2 != null ? l2.has(k3) : void 0) || false;
  };

  Map3.prototype.set = function(k1, k2, k3, v) {
    var l1, l2;
    l1 = this.map.get(k1);
    if (!l1) {
      l1 = new Map;
      this.map.set(k1, l1);
    }
    l2 = l1.get(k2);
    if (!l2) {
      l2 = new Map;
      l1.set(k2, l2);
    }
    this.size -= l2.size;
    l2.set(k3, v);
    this.size += l2.size;
    return this;
  };

  Map3.prototype["delete"] = function(k1, k2, k3) {
    var deleted, l1, l2;
    l1 = this.map.get(k1);
    if (l1) {
      l2 = l1.get(k2);
    }
    if (l2) {
      deleted = l2["delete"](k3);
      if (deleted) {
        this.size--;
      }
      return deleted;
    } else {
      return false;
    }
  };

  Map3.prototype.forEach = function(fn) {
    return this.map.forEach(function(l1, k1) {
      return l1.forEach(function(l2, k2) {
        return l2.forEach(function(v, k3) {
          return fn(k1, k2, k3, v);
        });
      });
    });
  };

  Map3.prototype.clear = function() {
    return this.map.clear();
  };

  Map3.prototype.inspect = function(depth, options) {
    var entries;
    if (depth < 0) {
      return "[Map3 (" + this.size + ")]";
    }
    if (this.size === 0) {
      return '{[Map3]}';
    }
    entries = [];
    this.forEach(function(k1, k2, k3, v) {
      return entries.push("(" + (inspect(k1, options)) + "," + (inspect(k2, options)) + "," + (inspect(k3, options)) + ") : " + (inspect(v, options)));
    });
    assert(entries.length === this.size);
    return "{[Map3] " + (entries.join(', ')) + " }";
  };

  return Map3;

})();

exports.Set3 = Set3 = (function() {
  function Set3(data) {
    var i, len, ref, v1, v2, v3;
    this.map = new Map;
    this.size = 0;
    if (data) {
      for (i = 0, len = data.length; i < len; i++) {
        ref = data[i], v1 = ref[0], v2 = ref[1], v3 = ref[2];
        this.add(v1, v2, v3);
      }
    }
  }

  Set3.prototype.has = function(v1, v2, v3) {
    var l1, l2;
    l1 = this.map.get(v1);
    if (l1) {
      l2 = l1.get(v2);
    }
    return (l2 != null ? l2.has(v3) : void 0) || false;
  };

  Set3.prototype.add = function(v1, v2, v3) {
    var l1, l2;
    l1 = this.map.get(v1);
    if (!l1) {
      l1 = new Map;
      this.map.set(v1, l1);
    }
    l2 = l1.get(v2);
    if (!l2) {
      l2 = new Set;
      l1.set(v2, l2);
    }
    this.size -= l2.size;
    l2.add(v3);
    this.size += l2.size;
    return this;
  };

  Set3.prototype["delete"] = function(v1, v2, v3) {
    var l1, l2;
    l1 = this.map.get(v1);
    if (l1) {
      l2 = l1.get(v2);
    }
    if (l2 != null ? l2["delete"](v3) : void 0) {
      this.size--;
      if (l2.size === 0) {
        l1["delete"](v2);
        if (l1.size === 0) {
          this.map["delete"](v1);
        }
      }
      return true;
    } else {
      return false;
    }
  };

  Set3.prototype.forEach = function(fn) {
    return this.map.forEach(function(l1, v1) {
      return l1.forEach(function(l2, v2) {
        return l2.forEach(function(v3) {
          return fn(v1, v2, v3);
        });
      });
    });
  };

  Set3.prototype.clear = function() {
    return this.map.clear();
  };

  Set3.prototype.inspect = function(depth, options) {
    var entries;
    if (depth < 0) {
      return "[Set3 (" + this.size + ")]";
    }
    if (this.size === 0) {
      return '{[Set3]}';
    }
    entries = [];
    this.forEach(function(v1, v2, v3) {
      return entries.push("(" + (inspect(v1, options)) + "," + (inspect(v2, options)) + "," + (inspect(v3, options)) + ")");
    });
    assert(entries.length === this.size);
    return "{[Set3] " + (entries.join(', ')) + " }";
  };

  return Set3;

})();

exports.SetOfPairs = SetOfPairs = (function(superClass) {
  extend(SetOfPairs, superClass);

  function SetOfPairs() {
    return SetOfPairs.__super__.constructor.apply(this, arguments);
  }

  SetOfPairs.prototype.add = function(a, b) {
    SetOfPairs.__super__.add.call(this, a, b);
    return SetOfPairs.__super__.add.call(this, b, a);
  };

  SetOfPairs.prototype["delete"] = function(a, b) {
    if (SetOfPairs.__super__["delete"].call(this, a, b)) {
      SetOfPairs.__super__["delete"].call(this, b, a);
      return true;
    } else {
      return false;
    }
  };

  SetOfPairs.prototype.getAll = function(a) {
    return this.map.get(a);
  };

  SetOfPairs.prototype.deleteAll = function(a) {
    var set;
    if (set = this.map.get(a)) {
      set.forEach((function(_this) {
        return function(b) {
          var set2;
          set2 = _this.map.get(b);
          set2["delete"](a);
          if (set2.size === 0) {
            return _this.map["delete"](b);
          }
        };
      })(this));
      this.map["delete"](a);
      this.size -= set.size * 2;
      return true;
    } else {
      return false;
    }
  };

  return SetOfPairs;

})(Set2);


},{"assert":19,"map2":14,"set2":15,"util":23}],11:[function(require,module,exports){
var collections, i, k, len, ref;

exports.Jit = require('./jit');

exports.util = require('./util');

exports.Watcher = require('./watch');

collections = require('./collections2');

ref = ['Map2', 'Set2', 'Map3', 'Set3'];
for (i = 0, len = ref.length; i < len; i++) {
  k = ref[i];
  exports[k] = collections[k];
}


},{"./collections2":10,"./jit":12,"./util":16,"./watch":17}],12:[function(require,module,exports){
(function (process){
var BaseBuffer, BaseGrid, BlobFiller, CollapseDetector, CurrentStates, DIRS, DOWN, DirtyShuttles, EngineGrid, FillKeys, GroupConnections, Groups, Jit, LEFT, Map2, Map3, RIGHT, Regions, SHUTTLE, Set2, Set3, SetOfPairs, ShuttleBuffer, ShuttleGrid, ShuttleOverlap, ShuttleStates, StateForce, THINSHUTTLE, UP, Watcher, Zones, abs, assert, filename, fill, letsShuttleThrough, log, makeId, normalizeShuttleV, parseFile, parseXY, pump, ref, ref1, shuttleConnects, util,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Watcher = require('./watch');

ref = require('./collections2'), Map2 = ref.Map2, Map3 = ref.Map3, Set2 = ref.Set2, Set3 = ref.Set3, SetOfPairs = ref.SetOfPairs;

ref1 = util = require('./util'), parseXY = ref1.parseXY, fill = ref1.fill, DIRS = ref1.DIRS;

log = require('./log');

assert = require('assert');

UP = 0;

RIGHT = 1;

DOWN = 2;

LEFT = 3;

makeId = (function() {
  var nextId;
  nextId = 1;
  return function() {
    return nextId++;
  };
})();

letsShuttleThrough = function(v) {
  return v === 'nothing' || v === 'bridge' || v === 'ribbon' || v === 'ribbonbridge';
};

log.quiet = true;

abs = function(x) {
  if (x >= 0) {
    return x;
  } else {
    return -x;
  }
};

SHUTTLE = 0x40;

THINSHUTTLE = 0x80;

normalizeShuttleV = function(v) {
  if (typeof v === 'number') {
    return v;
  }
  if (v === 'shuttle') {
    return SHUTTLE | 0xf;
  } else if (v === 'thinshuttle') {
    return THINSHUTTLE | 0xf;
  } else {
    assert.equal(v, null);
    return 0;
  }
};

shuttleConnects = function(sv, dir) {
  return !!(sv & (1 << dir));
};

BaseGrid = function() {
  var afterWatch, beforeWatch, forEach, grid;
  grid = new Map2;
  forEach = function(fn) {
    return grid.forEach(function(x, y, v) {
      return fn(x, y, null, v);
    });
  };
  beforeWatch = new Watcher(forEach);
  afterWatch = new Watcher(forEach);
  return {
    beforeWatch: beforeWatch,
    afterWatch: afterWatch,
    get: grid.get.bind(grid),
    set: function(x, y, v) {
      var oldv;
      assert((v == null) || typeof v === 'string');
      if (v === null || v === 'solid') {
        v = void 0;
      }
      assert(v !== 'shuttle' && v !== 'thinshuttle');
      oldv = grid.get(x, y);
      beforeWatch.signal(x, y, oldv, v);
      oldv = grid.get(x, y);
      if (v !== oldv) {
        if (v) {
          grid.set(x, y, v);
        } else {
          grid["delete"](x, y);
        }
        afterWatch.signal(x, y, oldv, v);
        return true;
      } else {
        return false;
      }
    },
    forEach: grid.forEach.bind(grid),
    checkEmpty: function() {
      return assert.strictEqual(0, grid.size);
    }
  };
};

pump = function(grid) {
  return function(x, y) {
    var v;
    v = grid.get(x, y);
    if (v) {
      grid["delete"](x, y);
    }
    return v;
  };
};

BaseBuffer = function(grid, values) {
  var buffer, watch;
  buffer = new Map2;
  watch = new Watcher;
  grid.afterWatch.forward(function(x, y, oldv, v) {
    if (indexOf.call(values, oldv) >= 0) {
      assert.equal(buffer.get(x, y), oldv);
      buffer["delete"](x, y);
      watch.signal(x, y);
    }
    if (indexOf.call(values, v) >= 0) {
      buffer.set(x, y, v);
      return watch.signal(x, y, v);
    }
  });
  return {
    watch: watch,
    data: buffer,
    pump: pump(buffer)
  };
};

ShuttleBuffer = function() {
  var buffer, watch;
  buffer = new Map2;
  watch = new Watcher;
  return {
    set: function(x, y, v) {
      var connects, connects2, d, d2, dx, dy, j, l, len, len1, oldV, ref2, ref3, v2, x2, y2;
      v = normalizeShuttleV(v);
      watch.signal(x, y, v);
      if (v) {
        if (buffer.get(x, y) === v) {
          return;
        }
        for (d = j = 0, len = DIRS.length; j < len; d = ++j) {
          ref2 = DIRS[d], dx = ref2.dx, dy = ref2.dy;
          connects = shuttleConnects(v, d);
          x2 = x + dx;
          y2 = y + dy;
          v2 = buffer.get(x2, y2);
          if (v2) {
            connects2 = shuttleConnects(v2, (d2 = util.oppositeDir(d)));
            if (connects !== connects2) {
              if (connects) {
                v2 |= 1 << d2;
              } else {
                v2 &= ~(1 << d2);
              }
              buffer.set(x2, y2, v2);
            }
          } else {
            v &= ~(1 << d);
          }
        }
        return buffer.set(x, y, v);
      } else {
        oldV = buffer.get(x, y);
        for (d = l = 0, len1 = DIRS.length; l < len1; d = ++l) {
          ref3 = DIRS[d], dx = ref3.dx, dy = ref3.dy;
          if (!(shuttleConnects(oldV, d))) {
            continue;
          }
          x2 = x + dx;
          y2 = y + dy;
          v2 = buffer.get(x2, y2);
          d2 = util.oppositeDir(d);
          assert(shuttleConnects(v2, d2));
          v2 &= ~(1 << d2);
          buffer.set(x2, y2, v2);
        }
        return buffer["delete"](x, y);
      }
    },
    watch: watch,
    data: buffer,
    pump: pump(buffer)
  };
};

BlobFiller = function(type, buffer) {
  var Blob, addWatch, blobs, deleteBlob, deleteWatch;
  if (type !== 'shuttle' && type !== 'engine') {
    throw Error('Invalid type');
  }
  blobs = new Set;
  addWatch = new Watcher(function(fn) {
    return blobs.forEach(fn);
  });
  deleteWatch = new Watcher;
  deleteBlob = function(b, pos) {
    var dx, dy;
    if (!blobs["delete"](b)) {
      return false;
    }
    assert(!pos || (pos.dx != null));
    log("Destroyed " + type + " " + b.id + " at", b.points);
    assert(b.used);
    b.used = false;
    if (pos) {
      dx = pos.dx, dy = pos.dy;
    } else {
      dx = dy = 0;
    }
    b.points.forEach(function(x2, y2, v) {
      return buffer.data.set(x2 + dx, y2 + dy, v);
    });
    deleteWatch.signal(b);
    return true;
  };
  Blob = function(x, y, v0) {
    this.id = makeId();
    this.used = true;
    this.size = 0;
    this.points = new Map2;
    this.edges = new Set3;
    if (type === 'shuttle') {
      this.pushEdges = new Set3;
      this.numValidStates = 0;
      this.currentState = null;
      this.eachCurrentPoint = function(fn) {
        var dx, dy;
        dx = this.currentState ? this.currentState.dx : 0;
        dy = this.currentState ? this.currentState.dy : 0;
        return this.points.forEach(function(x, y, v) {
          return fn(x + dx, y + dy, v);
        });
      };
      this.blockedX = this.blockedY = null;
    }
    blobs.add(this);
    util.fill3(x, y, v0, (function(_this) {
      return function(x, y, v, hmm) {
        var d, dx, dy, j, len, ref2, results, v2, x2, y2;
        buffer.pump(x, y);
        _this.size++;
        _this.points.set(x, y, v);
        results = [];
        for (d = j = 0, len = DIRS.length; j < len; d = ++j) {
          ref2 = DIRS[d], dx = ref2.dx, dy = ref2.dy;
          x2 = x + dx;
          y2 = y + dy;
          v2 = _this.points.get(x2, y2) || buffer.data.get(x2, y2);
          if (v2 && ((type === 'shuttle' && shuttleConnects(v, d)) || (type === 'engine' && v2 === v))) {
            if (type === 'shuttle') {
              assert(shuttleConnects(v2, util.oppositeDir(d)));
            }
            hmm(x2, y2, v2);
          } else {
            _this.edges.add(x, y, d);
          }
          if (type === 'shuttle' && v & SHUTTLE && (!v2 || !(v2 & SHUTTLE) || !shuttleConnects(v, d))) {
            results.push(_this.pushEdges.add(x, y, d));
          } else {
            results.push(void 0);
          }
        }
        return results;
      };
    })(this));
    assert(this.size);
    if (type === 'shuttle') {
      assert(this.pushEdges.size === 0 || this.pushEdges.size >= 4);
    }
    if (type === 'engine') {
      this.type = v0;
      this.pressure = (v0 === 'positive' ? 1 : -1) * this.size;
    }
    log(this.id, ", Added " + type, this);
    addWatch.signal(this);
  };
  return {
    addWatch: addWatch,
    deleteWatch: deleteWatch,
    flush: function() {
      buffer.data.forEach(function(x, y, v) {
        return new Blob(x, y, v);
      });
      return assert.equal(buffer.data.size, 0);
    },
    flushAt: function(x, y) {
      var v;
      if (v = buffer.data.get(x, y)) {
        return new Blob(x, y, v);
      }
    },
    forEach: function(fn) {
      this.flush();
      return blobs.forEach(fn);
    },
    "delete": deleteBlob,
    check: function(invasive) {
      if (invasive) {
        this.forEach(function() {});
      }
      return blobs.forEach((function(_this) {
        return function(b) {
          assert(b.used);
          return b.points.forEach(function(x, y, v) {
            var c1, c2, d, dx, dy, j, len, ref2, results, v2;
            if (type === 'engine') {
              assert(!buffer.data.has(x, y));
            }
            results = [];
            for (d = j = 0, len = DIRS.length; j < len; d = ++j) {
              ref2 = DIRS[d], dx = ref2.dx, dy = ref2.dy;
              if (b.points.has(x + dx, y + dy)) {
                if (type === 'shuttle') {
                  v2 = b.points.get(x + dx, y + dy);
                  c1 = shuttleConnects(v, d);
                  c2 = shuttleConnects(v2, util.oppositeDir(d));
                  results.push(assert.equal(c1, c2, "Mismatched adjacency in a shuttle: " + c1 + " " + c2));
                } else {
                  results.push(void 0);
                }
              } else {
                if (type === 'engine') {
                  v2 = buffer.data.get(x + dx, y + dy);
                  results.push(assert(v2 !== v));
                } else if (type === 'shuttle') {
                  assert(!shuttleConnects(v, d));
                  if (v & SHUTTLE) {
                    results.push(assert(b.pushEdges.has(x, y, d)));
                  } else {
                    results.push(void 0);
                  }
                } else {
                  results.push(void 0);
                }
              }
            }
            return results;
          });
        };
      })(this));
    }
  };
};

EngineGrid = function(grid, engines) {
  var engineGrid;
  engineGrid = new Map2;
  grid.beforeWatch.forward(function(x, y, oldv, v) {
    var dx, dy, e, j, len, ref2, results;
    if ((oldv === 'positive' || oldv === 'negative') && (e = engineGrid.get(x, y))) {
      engines["delete"](e);
    }
    if (v === 'positive' || v === 'negative') {
      results = [];
      for (j = 0, len = DIRS.length; j < len; j++) {
        ref2 = DIRS[j], dx = ref2.dx, dy = ref2.dy;
        if ((e = engineGrid.get(x + dx, y + dy))) {
          results.push(engines["delete"](e));
        }
      }
      return results;
    }
  });
  engines.addWatch.forward(function(engine) {
    return engine.points.forEach(function(x, y, v) {
      return engineGrid.set(x, y, engine);
    });
  });
  engines.deleteWatch.on(function(engine) {
    return engine.points.forEach(function(x, y) {
      return engineGrid["delete"](x, y);
    });
  });
  return {
    get: function(x, y) {
      var e;
      e = engineGrid.get(x, y);
      if (!e) {
        return engines.flushAt(x, y);
      } else {
        return e;
      }
    },
    check: function(invasive) {
      return engineGrid.forEach(function(x, y, e) {
        var dx, dy, e2, j, len, ref2;
        assert(e.used);
        for (j = 0, len = DIRS.length; j < len; j++) {
          ref2 = DIRS[j], dx = ref2.dx, dy = ref2.dy;
          if ((e2 = engineGrid.get(x + dx, y + dy))) {
            assert(e2 === e || e.type !== e2.type);
          }
        }
        return e.points.forEach(function(x, y, v) {
          return assert.equal(engineGrid.get(x, y), e);
        });
      });
    }
  };
};

ShuttleStates = function(baseGrid, shuttles) {
  var addWatch, canShuttleFitAt, createStateAt, deleteWatch, shuttleStates;
  shuttleStates = new Map;
  addWatch = new Watcher(function(fn) {
    return shuttleStates.forEach(function(shuttle, states) {
      return states.forEach(function(x, y, state) {
        return fn(state);
      });
    });
  });
  deleteWatch = new Watcher;
  shuttles.deleteWatch.on(function(shuttle) {
    var states;
    states = shuttleStates.get(shuttle);
    if (states) {
      shuttleStates["delete"](shuttle);
      return states.forEach(function(x, y, state) {
        return deleteWatch.signal(state);
      });
    }
  });
  canShuttleFitAt = function(shuttle, dx, dy) {
    var fits;
    fits = true;
    shuttle.points.forEach((function(_this) {
      return function(x, y) {
        if (!letsShuttleThrough(baseGrid.get(x + dx, y + dy))) {
          return fits = false;
        }
      };
    })(this));
    return fits;
  };
  createStateAt = function(shuttle, dx, dy) {
    var state, states, valid;
    states = shuttleStates.get(shuttle);
    valid = canShuttleFitAt(shuttle, dx, dy);
    state = {
      dx: dx,
      dy: dy,
      valid: valid,
      shuttle: shuttle,
      id: valid ? shuttle.numValidStates : -1
    };
    if (valid) {
      shuttle.numValidStates++;
    }
    if (states) {
      states.set(dx, dy, state);
    } else {
      shuttleStates.set(shuttle, new Map2([[dx, dy, state]]));
    }
    if (valid) {
      log('made shuttle state for shuttle', state.id, state.shuttle.id, state.dx, state.dy);
    }
    addWatch.signal(state);
    return state;
  };
  return {
    flushStatesAt: function(x, y) {
      return shuttles.flushAt(x, y);
    },
    addWatch: addWatch,
    deleteWatch: deleteWatch,
    get: function(s) {
      return shuttleStates.get(s);
    },
    getInitialState: function(s) {
      var ref2;
      return ((ref2 = this.get(s)) != null ? ref2.get(0, 0) : void 0) || createStateAt(s, 0, 0);
    },
    collapse: function(shuttle) {
      var saved, states;
      log('collapsing', shuttle);
      saved = shuttle.currentState;
      if (!(states = shuttleStates.get(shuttle))) {
        return;
      }
      return states.forEach(function(dx, dy, state) {
        if (state === saved) {
          return;
        }
        states["delete"](dx, dy);
        return deleteWatch.signal(state);
      });
    },
    getStateNear: function(state, dir) {
      var dx, dy, ref2, successor;
      assert(state.shuttle.used);
      if (!state.valid) {
        return null;
      }
      ref2 = DIRS[dir], dx = ref2.dx, dy = ref2.dy;
      dx += state.dx;
      dy += state.dy;
      successor = shuttleStates.get(state.shuttle).get(dx, dy);
      if (successor == null) {
        successor = createStateAt(state.shuttle, dx, dy);
      }
      if (successor.valid) {
        return successor;
      }
    },
    "delete": function(state) {
      var shuttle;
      log('deleting state', state);
      shuttle = state.shuttle;
      assert(shuttle.used);
      shuttleStates.get(shuttle)["delete"](state.dx, state.dy);
      return deleteWatch.signal(state);
    }
  };
};

ShuttleGrid = function(shuttleStates) {
  var fillGrid, fillWatch, stateGrid, stateWatch;
  fillGrid = new Map2(function() {
    return new Set;
  });
  fillWatch = new Watcher;
  stateGrid = new Map2(function() {
    return new Set;
  });
  stateWatch = new Watcher;
  shuttleStates.addWatch.forward(function(state) {
    return state.shuttle.points.forEach(function(x, y, v) {
      x += state.dx;
      y += state.dy;
      stateGrid.getDef(x, y).add(state);
      stateWatch.signal(x, y);
      if (v & SHUTTLE && state.valid) {
        fillGrid.getDef(x, y).add(state);
        return fillWatch.signal(x, y);
      }
    });
  });
  shuttleStates.deleteWatch.on(function(state) {
    log('shuttle grid removing', state.shuttle.id, state.dx, state.dy);
    return state.shuttle.points.forEach(function(x, y, v) {
      x += state.dx;
      y += state.dy;
      stateGrid.get(x, y)["delete"](state);
      stateWatch.signal(x, y);
      if (v & SHUTTLE && state.valid) {
        fillGrid.get(x, y)["delete"](state);
        return fillWatch.signal(x, y);
      }
    });
  });
  return {
    fillGrid: fillGrid,
    fillWatch: fillWatch,
    stateGrid: stateGrid,
    stateWatch: stateWatch,
    getStates: function(x, y) {
      return stateGrid.get(x, y);
    },
    getShuttle: function(x, y) {
      var ref2, shuttle;
      shuttle = null;
      if ((ref2 = stateGrid.get(x, y)) != null) {
        ref2.forEach(function(state) {
          if (state.shuttle.currentState === state) {
            return shuttle = state.shuttle;
          }
        });
      }
      return shuttle;
    },
    getValue: function(x, y) {
      var dx, dy, ref2, shuttle;
      if (!(shuttle = this.getShuttle(x, y))) {
        return;
      }
      ref2 = shuttle.currentState, dx = ref2.dx, dy = ref2.dy;
      return shuttle.points.get(x - dx, y - dy);
    },
    check: function() {}
  };
};

FillKeys = function(baseGrid, shuttleStates, shuttleGrid) {
  var calcKeyAt, fillKey, fillStates, keysReferencingState, watch;
  fillKey = new Map2;
  fillStates = new Map;
  fillStates["default"] = function() {
    return new Set;
  };
  fillStates.set('', new Set);
  keysReferencingState = new WeakMap;
  keysReferencingState["default"] = function() {
    return new Set;
  };
  watch = new Watcher;
  shuttleGrid.fillWatch.on(function(x, y) {
    return fillKey["delete"](x, y);
  });
  baseGrid.afterWatch.on(function(x, y, oldv, v) {
    if (letsShuttleThrough(oldv)) {
      return fillKey["delete"](x, y);
    }
  });
  shuttleStates.deleteWatch.on(function(state) {
    var ref2;
    return (ref2 = keysReferencingState.get(state)) != null ? ref2.forEach(function(key) {
      fillStates["delete"](key);
      return watch.signal(key);
    }) : void 0;
  });
  calcKeyAt = function(x, y) {
    var j, key, l, len, len1, ref2, set, state, stateList;
    stateList = [];
    if ((ref2 = shuttleGrid.fillGrid.get(x, y)) != null) {
      ref2.forEach(function(state) {
        return stateList.push(state);
      });
    }
    stateList.sort(function(s1, s2) {
      if (s1.shuttle !== s2.shuttle) {
        return s1.shuttle.id - s2.shuttle.id;
      } else {
        return s1.id - s2.id;
      }
    });
    key = stateList.map(function(state) {
      return state.shuttle.id + "." + state.id;
    }).join(' ');
    if (!fillStates.has(key)) {
      set = fillStates.getDef(key);
      for (j = 0, len = stateList.length; j < len; j++) {
        state = stateList[j];
        set.add(state);
      }
    }
    for (l = 0, len1 = stateList.length; l < len1; l++) {
      state = stateList[l];
      keysReferencingState.getDef(state).add(key);
    }
    return key;
  };
  return {
    watch: watch,
    getFilledStates: function(key) {
      return fillStates.get(key);
    },
    getFillKey: function(x, y) {
      var key;
      if (!letsShuttleThrough(baseGrid.get(x, y))) {
        return '';
      }
      shuttleStates.flushStatesAt(x, y);
      key = fillKey.get(x, y);
      if (!key) {
        key = calcKeyAt(x, y);
        fillKey.set(x, y, key);
      }
      return key;
    },
    checkEmpty: function() {
      assert.equal(0, fillKey.size);
      return assert.equal(1, fillStates.size);
    }
  };
};

Groups = function(baseGrid, engines, engineGrid, shuttleGrid, fillKeys) {
  var addWatch, check, deleteGroup, deleteGroupsAt, deleteWatch, edgeGrid, groupGrid, groups, groupsWithEngine, makeGroupAt, pendingCells;
  pendingCells = new Set3;
  groups = new Set;
  groupGrid = new Map3;
  edgeGrid = new Map2(function() {
    return new Set;
  });
  addWatch = new Watcher(groups);
  deleteWatch = new Watcher;
  groupsWithEngine = new WeakMap;
  groupsWithEngine["default"] = function() {
    return new Set;
  };
  deleteGroupsAt = function(x, y) {
    var c, cmax, group, j, ref2, results;
    cmax = util.cellMax(baseGrid.get(x, y));
    results = [];
    for (c = j = 0, ref2 = cmax; 0 <= ref2 ? j < ref2 : j > ref2; c = 0 <= ref2 ? ++j : --j) {
      if ((group = groupGrid.get(x, y, c))) {
        results.push(deleteGroup(group));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };
  deleteGroup = function(group) {
    log(group._id, ': deleting group', group);
    assert(group.used);
    group.used = false;
    groups["delete"](group);
    group.engines.forEach(function(e) {
      return groupsWithEngine.get(e)["delete"](group);
    });
    group.points.forEach(function(px, py, pc, pv) {
      pendingCells.add(px, py, pc);
      return groupGrid["delete"](px, py, pc);
    });
    group.edges.forEach(function(x, y, c) {
      return edgeGrid.get(x, y)["delete"](group);
    });
    return deleteWatch.signal(group);
  };
  baseGrid.afterWatch.forward(function(x, y, oldv, v) {
    var c, cmax, dx, dy, group, j, l, len, n, ref2, ref3, ref4, results;
    cmax = util.cellMax(oldv);
    for (c = j = 0, ref2 = cmax; 0 <= ref2 ? j < ref2 : j > ref2; c = 0 <= ref2 ? ++j : --j) {
      if ((group = groupGrid.get(x, y, c))) {
        deleteGroup(group);
      }
      pendingCells["delete"](x, y, c);
    }
    for (l = 0, len = DIRS.length; l < len; l++) {
      ref3 = DIRS[l], dx = ref3.dx, dy = ref3.dy;
      deleteGroupsAt(x + dx, y + dy);
    }
    results = [];
    for (c = n = 0, ref4 = util.cellMax(v); 0 <= ref4 ? n < ref4 : n > ref4; c = 0 <= ref4 ? ++n : --n) {
      results.push(pendingCells.add(x, y, c));
    }
    return results;
  });
  engines.deleteWatch.on(function(e) {
    var set;
    set = groupsWithEngine.get(e);
    if (set) {
      set.forEach(function(g) {
        return deleteGroup(g);
      });
      return groupsWithEngine["delete"](e);
    }
  });
  shuttleGrid.fillWatch.on(function(x, y) {
    var ref2;
    deleteGroupsAt(x, y);
    return (ref2 = edgeGrid.get(x, y)) != null ? ref2.forEach(function(g) {
      return deleteGroup(g);
    }) : void 0;
  });
  makeGroupAt = function(x, y, c) {
    var filledStates, group, key, shuttles, v0;
    v0 = baseGrid.get(x, y);
    assert(v0 != null);
    assert(c < util.cellMax(v0));
    assert(pendingCells.has(x, y, c));
    key = fillKeys.getFillKey(x, y);
    filledStates = fillKeys.getFilledStates(key);
    shuttles = util.uniqueShuttlesInStates(filledStates);
    group = {
      _id: makeId(),
      used: true,
      size: 0,
      fillKey: key,
      points: new Map3,
      edges: new Set3,
      shuttles: shuttles,
      shuttleKey: shuttles.map(function(s) {
        return "" + s.id;
      }).join(' '),
      useless: true,
      engines: new Set
    };
    log(group._id, ': makeGroupAt', x, y, c, "'" + key + "'");
    util.fill3(x, y, c, function(x, y, c, hmm) {
      var c2, e, j, len, ref2, ref3, v, x2, y2;
      v = baseGrid.get(x, y);
      if (!v) {
        return;
      }
      if (v && (v !== 'positive' && v !== 'negative')) {
        group.useless = false;
      }
      if (fillKeys.getFillKey(x, y) !== key) {
        group.edges.add(x, y, c);
        edgeGrid.getDef(x, y).add(group);
        return;
      }
      log('fillCells', x, y, c, v);
      group.points.set(x, y, c, v);
      group.size++;
      assert(!groupGrid.has(x, y, c));
      groupGrid.set(x, y, c, group);
      assert(pendingCells.has(x, y, c));
      pendingCells["delete"](x, y, c);
      if (v === 'positive' || v === 'negative') {
        e = engineGrid.get(x, y);
        group.engines.add(e);
        groupsWithEngine.getDef(e).add(group);
      }
      ref2 = util.connectedCells(baseGrid, x, y, c);
      for (j = 0, len = ref2.length; j < len; j++) {
        ref3 = ref2[j], x2 = ref3[0], y2 = ref3[1], c2 = ref3[2];
        hmm(x2, y2, c2);
      }
    });
    groups.add(group);
    if (!group.useless) {
      log(group._id, ': made group', group.points);
    }
    assert(group.size);
    assert(group.used);
    addWatch.signal(group);
    return group;
  };
  return {
    addWatch: addWatch,
    deleteWatch: deleteWatch,
    get: function(x, y, c) {
      var g, v;
      g = groupGrid.get(x, y, c);
      if (!g) {
        v = baseGrid.get(x, y);
        assert((0 <= c && c < util.cellMax(v)));
        if (v != null) {
          g = makeGroupAt(x, y, c);
        }
      }
      if (!g.useless) {
        return g;
      }
    },
    getDir: function(x, y, dir) {
      var c, v;
      v = baseGrid.get(x, y);
      if (!v) {
        return;
      }
      if (v === 'ribbon' || v === 'ribbonbridge') {
        return;
      }
      c = (function() {
        switch (v) {
          case 'positive':
          case 'negative':
            return dir;
          case 'bridge':
            return dir % 2;
          default:
            return 0;
        }
      })();
      return this.get(x, y, c);
    },
    flush: function() {
      return pendingCells.forEach(function(x, y, c) {
        return makeGroupAt(x, y, c);
      });
    },
    forEach: function(fn) {
      this.flush();
      return groups.forEach(function(g) {
        if (!g.useless) {
          return fn(g);
        }
      });
    },
    check: check = function() {
      return groups.forEach(function(g) {
        return g.points.forEach(function(x, y, c) {
          return assert.equal(groupGrid.get(x, y, c), g);
        });
      });
    },
    checkEmpty: function() {
      assert.equal(0, groups.size);
      assert.equal(0, groupGrid.size);
      return assert.equal(0, pendingCells.size);
    }
  };
};

StateForce = function(grid, shuttleStates, shuttleGrid, groups) {
  var deleteForce, makeForce, stateForGroup, stateForce, watch;
  stateForce = new Map;
  stateForce["default"] = function(state) {
    return makeForce(state);
  };
  stateForGroup = new Map;
  stateForGroup["default"] = function() {
    return new Set;
  };
  watch = new Watcher;
  shuttleStates.deleteWatch.on(function(state0) {
    var dx, dy, j, len, ref2, results, state, states;
    deleteForce(state0);
    if ((states = shuttleStates.get(state0.shuttle))) {
      results = [];
      for (j = 0, len = DIRS.length; j < len; j++) {
        ref2 = DIRS[j], dx = ref2.dx, dy = ref2.dy;
        state = states.get(state0.dx + dx, state0.dy + dy);
        if (state) {
          results.push(deleteForce(state));
        } else {
          results.push(void 0);
        }
      }
      return results;
    }
  });
  grid.afterWatch.on(function(x, y, oldv, v) {
    var dx, dy, j, len, ref2, results, states;
    if (util.cellMax(oldv) === 0) {
      results = [];
      for (j = 0, len = DIRS.length; j < len; j++) {
        ref2 = DIRS[j], dx = ref2.dx, dy = ref2.dy;
        states = shuttleGrid.getStates(x + dx, y + dy);
        results.push(states != null ? states.forEach(deleteForce) : void 0);
      }
      return results;
    }
  });
  groups.deleteWatch.on(function(group) {
    var set;
    log('got group deleted', group._id);
    if ((set = stateForGroup.get(group))) {
      set.forEach(function(state) {
        return deleteForce(state);
      });
      return assert(!stateForGroup.has(group));
    }
  });
  deleteForce = function(state) {
    var delGroups, force, ref2, ref3;
    if ((force = stateForce.get(state))) {
      stateForce["delete"](state);
      log('deleteForce', state);
      force.used = false;
      delGroups = function(pressure, group) {
        var set;
        if ((set = stateForGroup.get(group))) {
          set["delete"](state);
          if (set.size === 0) {
            return stateForGroup["delete"](group);
          }
        }
      };
      if ((ref2 = force.x) != null) {
        ref2.forEach(delGroups);
      }
      if ((ref3 = force.y) != null) {
        ref3.forEach(delGroups);
      }
      return watch.signal(state, force);
    }
  };
  makeForce = function(state) {
    var canMoveX, canMoveY, force, j, len, map, ref2, ref3, ref4;
    log('makeForce', state);
    assert(state.shuttle.used);
    assert(state.valid);
    canMoveX = shuttleStates.getStateNear(state, LEFT) || shuttleStates.getStateNear(state, RIGHT);
    canMoveY = shuttleStates.getStateNear(state, UP) || shuttleStates.getStateNear(state, DOWN);
    force = {
      x: canMoveX ? new Map : void 0,
      y: canMoveY ? new Map : void 0,
      used: true
    };
    if ((ref2 = force.x) != null) {
      ref2["default"] = function() {
        return 0;
      };
    }
    if ((ref3 = force.y) != null) {
      ref3["default"] = function() {
        return 0;
      };
    }
    if (canMoveX || canMoveY) {
      state.shuttle.pushEdges.forEach(function(x, y, dir) {
        var dx, dy, f, group, map, ref4;
        x += state.dx;
        y += state.dy;
        if (dir === LEFT || dir === RIGHT) {
          if (!canMoveX) {
            return;
          }
          map = force.x;
          f = dir === LEFT ? -1 : 1;
        } else {
          if (!canMoveY) {
            return;
          }
          map = force.y;
          f = dir === UP ? -1 : 1;
        }
        ref4 = DIRS[dir], dx = ref4.dx, dy = ref4.dy;
        log('edge', x, y);
        log('looking in', x + dx, y + dy, util.oppositeDir(dir));
        group = groups.getDir(x + dx, y + dy, util.oppositeDir(dir));
        if (!group) {
          return;
        }
        return map.set(group, map.getDef(group) + f);
      });
    }
    ref4 = [force.x, force.y];
    for (j = 0, len = ref4.length; j < len; j++) {
      map = ref4[j];
      if (map) {
        map.forEach(function(pressure, group) {
          if (pressure === 0) {
            return map["delete"](group);
          } else {
            return stateForGroup.getDef(group).add(state);
          }
        });
      }
    }
    log('-> makeForce', force);
    return force;
  };
  return {
    watch: watch,
    get: function(state) {
      var f;
      f = stateForce.getDef(state);
      assert(f.used);
      return f;
    }
  };
};

GroupConnections = function(groups) {
  var complete, connections, findConnections;
  connections = new SetOfPairs;
  complete = new WeakSet;
  groups.deleteWatch.on(function(group) {
    var gc;
    if ((gc = connections.getAll(group))) {
      gc.forEach(function(g2) {
        return complete["delete"](g2);
      });
    }
    return connections.deleteAll(group);
  });
  findConnections = function(group) {
    assert(group.used);
    group.edges.forEach(function(x, y, c) {
      var g2;
      g2 = groups.get(x, y, c);
      assert(g2.used);
      return connections.add(group, g2);
    });
    return complete.add(group);
  };
  return {
    get: function(group) {
      if (!complete.has(group)) {
        findConnections(group);
      }
      return connections.getAll(group);
    },
    check: function(invasive) {
      if (invasive) {
        groups.forEach((function(_this) {
          return function(g) {
            var set;
            set = _this.get(g);
            return assert(set);
          };
        })(this));
      }
      return connections.forEach(function(group1, group2) {
        var found;
        if (invasive) {
          assert(complete.has(group1));
          assert(complete.has(group2));
        }
        if (!complete.has(group1)) {
          return;
        }
        assert(group1.used);
        assert(group2.used);
        found = false;
        group1.edges.forEach(function(x, y, c) {
          if (group2.points.has(x, y, c)) {
            return found = true;
          }
        });
        return assert(found);
      });
    },
    checkEmpty: function() {
      return assert.equal(0, connections.size);
    }
  };
};

Regions = function(fillKeys, groups, groupConnections) {
  var Region, deleteRegion, makeRegion, regions, regionsForGroup, regionsTouchingGroup, watch;
  regionsForGroup = new Map;
  regionsForGroup["default"] = function(g) {
    return new util.ShuttleStateMap(g.shuttles);
  };
  regionsTouchingGroup = new Map;
  regionsTouchingGroup["default"] = function() {
    return new Set;
  };
  regions = new Set;
  watch = new Watcher;
  groups.deleteWatch.on(function(group) {
    var map, set;
    map = regionsForGroup.get(group);
    if (!map) {
      return;
    }
    regionsForGroup["delete"](group);
    map.forEachValue(function(region) {
      return deleteRegion(region);
    });
    set = regionsTouchingGroup.get(group);
    if (set) {
      set.forEach(function(region) {
        return deleteRegion(region);
      });
      return regionsTouchingGroup["delete"](group);
    }
  });
  deleteRegion = function(region) {
    log('delete region', region._id);
    assert(region.used);
    region.used = false;
    regions["delete"](region);
    region.groups.forEach(function(group) {
      var ref2;
      return (ref2 = regionsForGroup.get(group)) != null ? ref2["delete"](region.states) : void 0;
    });
    region.edges.forEach(function(group) {
      var set;
      if ((set = regionsTouchingGroup.get(group))) {
        set["delete"](region);
        if (set.size === 0) {
          return regionsTouchingGroup["delete"](group);
        }
      }
    });
    return watch.signal(region);
  };
  Region = function(group0, trimmedStates, shuttleStateMap) {
    var shuttleKey;
    assert(regionsForGroup.getDef(group0).isDefinedFor(shuttleStateMap));
    shuttleKey = group0.shuttleKey;
    this._id = makeId();
    this.used = true;
    this.size = 0;
    this.groups = new Set;
    this.states = trimmedStates;
    this.edges = new Set;
    this.engines = new Set;
    log(this._id, ': createRegion from group', group0._id);
    util.fillGraph(group0, (function(_this) {
      return function(group, hmm) {
        var filled, filledStates, ref2;
        if (group.shuttleKey !== shuttleKey) {
          _this.edges.add(group);
          regionsTouchingGroup.getDef(group).add(_this);
          return;
        }
        filledStates = fillKeys.getFilledStates(group.fillKey);
        filled = false;
        trimmedStates.forEach(function(state) {
          if (filledStates.has(state)) {
            return filled = true;
          }
        });
        if (filled) {
          return;
        }
        regionsForGroup.getDef(group).set(trimmedStates, _this);
        _this.size++;
        _this.groups.add(group);
        group.engines.forEach(function(e) {
          return _this.engines.add(e);
        });
        return (ref2 = groupConnections.get(group)) != null ? ref2.forEach(hmm) : void 0;
      };
    })(this));
    assert(this.size);
    regions.add(this);
    log(this._id, ': Made region with groups', this.groups.map(function(g) {
      return {
        id: g._id,
        points: g.points
      };
    }));
  };
  makeRegion = function(group, shuttleStateMap) {
    var filledStates, invalid, trimmedStates;
    trimmedStates = new Map;
    invalid = false;
    filledStates = fillKeys.getFilledStates(group.fillKey);
    group.shuttles.forEach(function(s) {
      var state;
      state = shuttleStateMap.get(s);
      trimmedStates.set(s, state);
      if (filledStates.has(state)) {
        return invalid = true;
      }
    });
    if (invalid) {
      regionsForGroup.getDef(group).set(shuttleStateMap, null);
      return null;
    }
    return new Region(group, trimmedStates, shuttleStateMap);
  };
  return {
    watch: watch,
    get: function(group, shuttleStateMap) {
      var map, region;
      map = regionsForGroup.getDef(group);
      region = map.get(shuttleStateMap);
      if (region === void 0) {
        region = makeRegion(group, shuttleStateMap);
      }
      if (region === null) {
        return null;
      }
      return region;
    },
    check: function() {
      return regions.forEach(function(r) {
        assert(r.used);
        assert(r.size);
        return r.groups.forEach(function(g) {
          return assert(g.used);
        });
      });
    },
    checkEmpty: function() {
      assert.equal(0, regionsForGroup.size);
      assert.equal(0, regionsTouchingGroup.size);
      return assert.equal(0, regions.size);
    }
  };
};

CurrentStates = function(shuttles, stateForce, shuttleStates) {
  var _move, buffering, currentStates, patch, watch;
  currentStates = new Map;
  buffering = false;
  patch = new Map;
  watch = new Watcher;
  shuttles.addWatch.forward(function(s) {
    var state;
    state = shuttleStates.getInitialState(s);
    s.currentState = state;
    currentStates.set(s, state);
    return watch.signal(s, null, state);
  });
  shuttles.deleteWatch.on(function(s) {
    if (buffering) {
      patch["delete"](s);
    }
    currentStates["delete"](s);
    return s.currentState = null;
  });
  _move = function(shuttle, state) {
    var prev;
    log("moving " + shuttle.id + " to " + state.dx + "," + state.dy);
    prev = shuttle.currentState;
    shuttle.currentState = state;
    currentStates.set(shuttle, state);
    return watch.signal(shuttle, prev, state);
  };
  return {
    map: currentStates,
    watch: watch,
    beginTxn: function() {
      return buffering = true;
    },
    endTxn: function() {
      patch.forEach(function(state, shuttle) {
        return _move(shuttle, state);
      });
      patch.clear();
      return buffering = false;
    },
    set: function(shuttle, state) {
      if (buffering) {
        return patch.set(shuttle, state);
      } else {
        return _move(shuttle, state);
      }
    },
    getImmediate: function(shuttle) {
      return patch.get(shuttle) || shuttle.currentState;
    }
  };
};

CollapseDetector = function(grid, shuttleBuffer, shuttles, shuttleStates, shuttleGrid) {
  grid.beforeWatch.forward(function(x, y, oldv, v) {
    var newPassable, oldPassable, ref2, ref3;
    oldPassable = letsShuttleThrough(oldv);
    newPassable = letsShuttleThrough(v);
    if (!oldPassable && newPassable) {
      return (ref2 = shuttleGrid.stateGrid.get(x, y)) != null ? ref2.forEach(function(state) {
        if (!state.valid) {
          return shuttleStates["delete"](state);
        }
      }) : void 0;
    } else if (oldPassable && !newPassable) {
      return (ref3 = shuttleGrid.stateGrid.get(x, y)) != null ? ref3.forEach(function(state) {
        var shuttle;
        shuttle = state.shuttle;
        if (shuttle.currentState === state) {
          return shuttles["delete"](shuttle, state);
        } else {
          return shuttleStates.collapse(shuttle);
        }
      }) : void 0;
    }
  });
  return shuttleBuffer.watch.on(function(x, y, v) {
    var d, dx, dy, j, len, ref2, results, shuttle;
    shuttle = shuttleGrid.getShuttle(x, y);
    if (shuttle) {
      shuttles["delete"](shuttle, shuttle.currentState);
    }
    results = [];
    for (d = j = 0, len = DIRS.length; j < len; d = ++j) {
      ref2 = DIRS[d], dx = ref2.dx, dy = ref2.dy;
      if (shuttleConnects(v, d)) {
        if ((shuttle = shuttleGrid.getShuttle(x + dx, y + dy))) {
          results.push(shuttles["delete"](shuttle, shuttle.currentState));
        } else {
          results.push(void 0);
        }
      }
    }
    return results;
  });
};

Zones = function(shuttles, fillKeys, regions, currentStates) {
  var deleteZone, deleteZonesWithShuttle, makeZone, watch, zoneForRegion, zonesDependingOnShuttle;
  zoneForRegion = new Map;
  zonesDependingOnShuttle = new WeakMap;
  zonesDependingOnShuttle["default"] = function() {
    return new Set;
  };
  watch = new Watcher;
  regions.watch.on(function(r) {
    deleteZone(zoneForRegion.get(r));
    return zoneForRegion["delete"](r);
  });
  deleteZonesWithShuttle = function(shuttle) {
    var ref2;
    log('deleteZonesWithShuttle', shuttle);
    return (ref2 = zonesDependingOnShuttle.get(shuttle)) != null ? ref2.forEach(function(zone) {
      return deleteZone(zone);
    }) : void 0;
  };
  shuttles.deleteWatch.on(deleteZonesWithShuttle);
  currentStates.watch.on(deleteZonesWithShuttle);
  deleteZone = function(z) {
    log('delete zone', z);
    if (!(z != null ? z.used : void 0)) {
      return;
    }
    log('deleting zone', z._id);
    z.used = false;
    return watch.signal(z);
  };
  makeZone = function(r0) {
    var engines, zone;
    zone = {
      _id: makeId(),
      used: true,
      pressure: 0,
      fixed: true,
      filled: false
    };
    log(zone._id, ': makezone from', r0 != null ? r0._id : void 0);
    engines = new Set;
    if (r0) {
      util.fillGraph(r0, function(r, hmm) {
        var ref2;
        log('zone fillGraph', r._id);
        assert(!((ref2 = zoneForRegion.get(r)) != null ? ref2.used : void 0));
        zoneForRegion.set(r, zone);
        if (r.states.size) {
          zone.fixed = false;
        }
        r.states.forEach(function(state) {
          return zonesDependingOnShuttle.getDef(state.shuttle).add(zone);
        });
        r.engines.forEach(function(e) {
          if (!engines.has(e)) {
            assert(e.used);
            engines.add(e);
            return zone.pressure += e.pressure;
          }
        });
        return r.edges.forEach(function(group) {
          var j, len, ref3, shuttle;
          assert(group.used);
          r = regions.get(group, currentStates.map);
          if (r === null) {
            ref3 = group.shuttles;
            for (j = 0, len = ref3.length; j < len; j++) {
              shuttle = ref3[j];
              zonesDependingOnShuttle.getDef(shuttle).add(zone);
            }
          }
          if (r) {
            return hmm(r);
          }
        });
      });
    }
    return zone;
  };
  return {
    watch: watch,
    makeZoneUnderShuttle: function(shuttle) {
      var zone;
      zone = makeZone(null);
      zonesDependingOnShuttle.getDef(shuttle).add(zone);
      zone.filled = true;
      return zone;
    },
    getZoneForRegion: function(region) {
      var zone;
      assert(region);
      zone = zoneForRegion.get(region);
      if (!(zone != null ? zone.used : void 0)) {
        zone = makeZone(region);
      }
      return zone;
    },
    getZoneForGroup: function(group) {
      var blockingShuttle, filledStates, r;
      r = regions.get(group, currentStates.map);
      if (r !== null) {
        return this.getZoneForRegion(r);
      }
      filledStates = fillKeys.getFilledStates(group.fillKey);
      blockingShuttle = null;
      group.shuttles.forEach(function(s) {
        var state;
        state = currentStates.map.get(s);
        if (filledStates.has(state)) {
          assert.equal(blockingShuttle, null);
          return blockingShuttle = s;
        }
      });
      assert(blockingShuttle);
      return this.makeZoneUnderShuttle(blockingShuttle);
    },
    checkEmpty: function() {
      return assert.strictEqual(0, zoneForRegion.size);
    }
  };
};

DirtyShuttles = function(shuttles, shuttleStates, stateForce, currentStates, zones) {
  var dirty, setDirty, shuttleZoneDeps, shuttlesForZone;
  dirty = new Set;
  shuttlesForZone = new Map;
  shuttlesForZone["default"] = function() {
    return new Set;
  };
  shuttleZoneDeps = new Map;
  shuttleZoneDeps["default"] = function() {
    return new Set;
  };
  shuttles.deleteWatch.on(function(s) {
    log('s deletewatch', s);
    setDirty(s);
    return dirty["delete"](s);
  });
  zones.watch.on(function(z) {
    var set;
    log('zw', z._id, z);
    if ((set = shuttlesForZone.get(z))) {
      log('zones watch', z._id);
      set.forEach(function(s) {
        return setDirty(s, 'adjacent zone killed');
      });
      return shuttlesForZone["delete"](z);
    }
  });
  stateForce.watch.on(function(state) {
    return setDirty(state.shuttle, 'force changed');
  });
  currentStates.watch.on(function(shuttle) {
    return setDirty(shuttle, 'moved this step');
  });
  shuttleStates.deleteWatch.on(function(state) {
    log('state deletewatch', state);
    return setDirty(state.shuttle, 'state was deleted');
  });
  setDirty = function(shuttle, reason) {
    var deps;
    if (dirty.has(shuttle)) {
      if (reason) {
        log("XXXDirty " + shuttle.id + " because " + reason);
      }
      return;
    }
    if (reason) {
      log("setDirty " + shuttle.id + " because " + reason);
    }
    log('+ dirty shuttle', shuttle);
    if ((deps = shuttleZoneDeps.get(shuttle))) {
      deps.forEach(function(z) {
        return shuttlesForZone.get(z)["delete"](shuttle);
      });
      shuttleZoneDeps["delete"](shuttle);
    }
    return dirty.add(shuttle);
  };
  return {
    data: dirty,
    setCleanDeps: function(shuttle, deps) {
      var actuallyClean;
      actuallyClean = true;
      deps.forEach(function(z) {
        if (!z.used) {
          return actuallyClean = false;
        }
      });
      if (!actuallyClean) {
        log("NOT CLEANING " + shuttle.id + " - zones changed");
        return;
      }
      dirty["delete"](shuttle);
      deps.forEach(function(z) {
        return shuttlesForZone.getDef(z).add(shuttle);
      });
      shuttleZoneDeps.set(shuttle, deps);
      return log('setCleanDeps', shuttle.id);
    },
    forEach: function(fn) {
      return dirty.forEach(fn);
    },
    check: function(invasive) {
      dirty.forEach(function(s) {
        return assert(!shuttleZoneDeps.has(s));
      });
      shuttlesForZone.forEach(function(shuttles, zone) {
        assert(zone.used);
        return shuttles.forEach(function(s) {
          assert(!dirty.has(s));
          return assert(shuttleZoneDeps.get(s).has(zone));
        });
      });
      return shuttleZoneDeps.forEach(function(zones, s) {
        return zones.forEach(function(z) {
          return assert(shuttlesForZone.get(z).has(s));
        });
      });
    },
    checkEmpty: function() {},
    stats: function() {
      console.log('shuttlesForZone.size:', shuttlesForZone.size);
      return console.log('shuttleZoneDeps.size:', shuttleZoneDeps.size);
    }
  };
};

ShuttleOverlap = function(shuttleStates, shuttleGrid, currentStates) {
  var overlappingStates;
  overlappingStates = new SetOfPairs;
  shuttleStates.addWatch.forward(function(state1) {
    if (!state1.valid) {
      return;
    }
    return state1.shuttle.points.forEach(function(x, y) {
      var ref2;
      return (ref2 = shuttleGrid.stateGrid.get(x + state1.dx, y + state1.dy)) != null ? ref2.forEach(function(state2) {
        if (state2.shuttle === state1.shuttle) {
          return;
        }
        return overlappingStates.add(state1, state2);
      }) : void 0;
    });
  });
  shuttleStates.deleteWatch.on(function(state) {
    return overlappingStates.deleteAll(state);
  });
  return {
    willOverlap: function(shuttle1, state1) {
      var overlap, ref2;
      overlap = null;
      if ((ref2 = overlappingStates.getAll(state1)) != null) {
        ref2.forEach(function(state2) {
          var shuttle2;
          shuttle2 = state2.shuttle;
          if (shuttle2.currentState === state2 || currentStates.getImmediate(shuttle2) === state2) {
            return overlap = shuttle2;
          }
        });
      }
      log('overlap', overlap, shuttle1.id);
      return overlap;
    }
  };
};

module.exports = Jit = function(rawGrid) {
  var baseGrid, calcImpulse, currentStates, dependancies, dirtyShuttles, engineBuffer, engineGrid, engines, fillKeys, groupConnections, groups, impulse, modules, regions, set, setGrid, shuttleBuffer, shuttleGrid, shuttleOverlap, shuttleStates, shuttles, shuttlesToMove, stateForce, stepCount, tryMove, zones;
  baseGrid = BaseGrid();
  engineBuffer = BaseBuffer(baseGrid, ['positive', 'negative']);
  engines = BlobFiller('engine', engineBuffer);
  engineGrid = EngineGrid(baseGrid, engines);
  shuttleBuffer = ShuttleBuffer();
  shuttles = BlobFiller('shuttle', shuttleBuffer);
  shuttleStates = ShuttleStates(baseGrid, shuttles);
  shuttleGrid = ShuttleGrid(shuttleStates);
  fillKeys = FillKeys(baseGrid, shuttleStates, shuttleGrid);
  groups = Groups(baseGrid, engines, engineGrid, shuttleGrid, fillKeys);
  stateForce = StateForce(baseGrid, shuttleStates, shuttleGrid, groups);
  groupConnections = GroupConnections(groups);
  regions = Regions(fillKeys, groups, groupConnections);
  currentStates = CurrentStates(shuttles, stateForce, shuttleStates);
  zones = Zones(shuttles, fillKeys, regions, currentStates);
  CollapseDetector(baseGrid, shuttleBuffer, shuttles, shuttleStates, shuttleGrid);
  dirtyShuttles = DirtyShuttles(shuttles, shuttleStates, stateForce, currentStates, zones);
  shuttleOverlap = ShuttleOverlap(shuttleStates, shuttleGrid, currentStates);
  modules = {
    baseGrid: baseGrid,
    engineBuffer: engineBuffer,
    engines: engines,
    engineGrid: engineGrid,
    shuttleBuffer: shuttleBuffer,
    shuttles: shuttles,
    shuttleStates: shuttleStates,
    shuttleGrid: shuttleGrid,
    fillKeys: fillKeys,
    groups: groups,
    stateForce: stateForce,
    groupConnections: groupConnections,
    regions: regions,
    currentStates: currentStates,
    zones: zones,
    dirtyShuttles: dirtyShuttles,
    shuttleOverlap: shuttleOverlap
  };
  set = function(x, y, bv, sv) {
    baseGrid.set(x, y, bv);
    return shuttleBuffer.set(x, y, sv);
  };
  setGrid = function(rawGrid) {
    return util.deserialize(rawGrid, false, set);
  };
  setGrid(rawGrid);
  calcImpulse = function(f, deps) {
    var impulse;
    impulse = 0;
    f.forEach(function(mult, group) {
      var zone;
      log('calculating pressure in group', group);
      assert(group.used);
      zone = zones.getZoneForGroup(group);
      assert(zone && zone.used);
      if (zone.pressure) {
        log('pressure', zone.pressure);
      }
      deps.add(zone);
      return impulse -= mult * zone.pressure;
    });
    return impulse;
  };
  tryMove = function(shuttle, state, impulse, deps, isTop) {
    var block, dir, moved, next;
    log('trymove s', shuttle.id, 'impulse', impulse, 'istop', isTop);
    if (!impulse) {
      return null;
    }
    dir = impulse < 0 ? (impulse = -impulse, isTop ? UP : LEFT) : isTop ? DOWN : RIGHT;
    moved = false;
    while (impulse) {
      if (!(next = shuttleStates.getStateNear(state, dir))) {
        log('no state avaliable in dir', util.DN[dir], 'from state', state.dx, state.dy);
        break;
      }
      if ((block = shuttleOverlap.willOverlap(shuttle, next))) {
        deps.add(zones.makeZoneUnderShuttle(block));
        break;
      }
      state = next;
      moved = true;
      impulse--;
    }
    if (moved) {
      return state;
    } else {
      return null;
    }
  };
  shuttlesToMove = [];
  dependancies = [];
  impulse = [];
  stepCount = 1;
  return {
    step: function() {
      log("------------ STEP " + (stepCount++) + " ------------");
      this.calcPressure();
      return this.update();
    },
    calcPressure: function() {
      log('step 1) calculating pressure');
      shuttles.flush();
      dirtyShuttles.forEach(function(shuttle) {
        var deps, force, fx, fy;
        log('step() looking at shuttle', shuttle);
        Jit.stats.checks++;
        if (shuttle.held) {
          return;
        }
        assert(shuttle.used);
        force = stateForce.get(shuttle.currentState);
        fx = force.x, fy = force.y;
        log('step() looking at shuttle', shuttle.id, force);
        shuttlesToMove.push(shuttle);
        dependancies.push(deps = new Set);
        impulse.push(fx ? calcImpulse(fx, deps) : 0);
        impulse.push(fy ? calcImpulse(fy, deps) : 0);
        return log('impulse', impulse[impulse.length - 2], impulse[impulse.length - 1]);
      });
      return !!shuttlesToMove.length;
    },
    update: function() {
      var deps, i, j, len, next, shuttle, somethingMoved, state, xImpulse, yImpulse;
      log('step 2) update - moving shuttles');
      somethingMoved = false;
      currentStates.beginTxn();
      for (i = j = 0, len = shuttlesToMove.length; j < len; i = ++j) {
        shuttle = shuttlesToMove[i];
        xImpulse = impulse[i * 2];
        yImpulse = impulse[i * 2 + 1];
        state = shuttle.currentState;
        deps = dependancies[i];
        if (abs(yImpulse) >= abs(xImpulse)) {
          next = tryMove(shuttle, state, yImpulse, deps, true);
          if (!next) {
            next = tryMove(shuttle, state, xImpulse, deps, false);
          }
        } else {
          next = tryMove(shuttle, state, xImpulse, deps, false);
          if (!next) {
            next = tryMove(shuttle, state, yImpulse, deps, true);
          }
        }
        if (next) {
          log('----> shuttle', shuttle.id, 'moved to', next.dx, next.dy);
          currentStates.set(shuttle, next);
          Jit.stats.moves++;
          somethingMoved = true;
        } else {
          log('----> shuttle', shuttle.id, 'did not move. Zone deps:', deps);
          dirtyShuttles.setCleanDeps(shuttle, deps);
        }
      }
      currentStates.endTxn();
      shuttlesToMove.length = dependancies.length = impulse.length = 0;
      return somethingMoved;
    },
    baseGrid: baseGrid,
    modules: modules,
    moveShuttle: function(shuttle, state) {
      if (!shuttleOverlap.willOverlap(shuttle, state)) {
        return currentStates.set(shuttle, state);
      }
    },
    getZoneContents: function(x, y, c) {
      var group, points, r0;
      group = modules.groups.get(x, y, c);
      if (!group) {
        return null;
      }
      points = new Set2;
      engines = new Set;
      r0 = modules.regions.get(group, modules.currentStates.map);
      if (r0) {
        util.fillGraph(r0, function(r, hmm) {
          r.groups.forEach(function(g) {
            return g.points.forEach(function(x, y, c, v) {
              return points.add(x, y);
            });
          });
          r.engines.forEach(function(e) {
            return engines.add(e);
          });
          return r.edges.forEach(function(group) {
            assert(group.used);
            if ((r = modules.regions.get(group, modules.currentStates.map))) {
              return hmm(r);
            }
          });
        });
      }
      return {
        points: points,
        engines: engines
      };
    },
    check: function(invasive) {
      var k, m;
      for (k in modules) {
        m = modules[k];
        if (typeof m.check === "function") {
          m.check(invasive);
        }
      }
      return shuttles.forEach(function(shuttle) {
        return shuttle.eachCurrentPoint(function(x, y, v) {
          var baseV;
          baseV = baseGrid.get(x, y);
          return assert(baseV === 'nothing' || baseV === 'bridge' || baseV === 'ribbon' || baseV === 'ribbonbridge');
        });
      });

      /*
      map = new Map2
      shuttles.forEach (shuttle) ->
        shuttle.eachCurrentPoint (x, y, v) ->
          for {dx, dy} in DIRS
            s2 = map.get(x+dx, y+dy)
            assert !s2 || s2 == shuttle
          map.set x, y, shuttle
       */
    },
    checkEmpty: function() {
      var k, m, results;
      results = [];
      for (k in modules) {
        m = modules[k];
        results.push(typeof m.checkEmpty === "function" ? m.checkEmpty() : void 0);
      }
      return results;
    },
    printGrid: function() {
      var overlay;
      overlay = new Map2;
      shuttles.forEach(function(s) {
        var dx, dy, state;
        state = s.currentState;
        if (!state) {
          return log('no state for', s);
        }
        dx = state.dx, dy = state.dy;
        return s.points.forEach(function(x, y, v) {
          return overlay.set(x + dx, y + dy, v & SHUTTLE ? 'shuttle' : 'thinshuttle');
        });
      });
      return util.printCustomGrid(util.gridExtents(baseGrid), function(x, y) {
        return overlay.get(x, y) || baseGrid.get(x, y);
      });
    },
    toJSON: function() {
      var json;
      json = {
        base: {},
        shuttles: {}
      };
      baseGrid.forEach(function(x, y, v) {
        assert(typeof v === 'string');
        if (v != null) {
          return json.base[x + "," + y] = v;
        }
      });
      shuttles.forEach(function(s) {
        var dx, dy, ref2, state;
        ref2 = state = s.currentState, dx = ref2.dx, dy = ref2.dy;
        return s.points.forEach(function(x, y, v) {
          return json.shuttles[(x + dx) + "," + (y + dy)] = v;
        });
      });
      return json;
    },
    set: set,
    get: function(layer, x, y) {
      switch (layer) {
        case 'shuttles':
          return shuttleBuffer.data.get(x, y) || shuttleGrid.getValue(x, y);
        case 'base':
          return baseGrid.get(x, y);
        default:
          throw Error("No such layer " + layer);
      }
    },
    stats: function() {
      var k, m;
      console.log(Jit.stats);
      for (k in modules) {
        m = modules[k];
        if (typeof m.stats === "function") {
          m.stats();
        }
      }
    },
    setQuiet: function(v) {
      if (v == null) {
        v = false;
      }
      return log.quiet = v;
    }
  };
};

Jit.stats = {
  moves: 0,
  checks: 0
};

parseFile = exports.parseFile = function(filename, opts) {
  var data, fs, j, j2, jit, json, moved, torture;
  torture = filename === '-t' || filename === 'torture' ? (filename = 'simple.json', true) : false;
  fs = require('fs');
  data = JSON.parse(fs.readFileSync(filename, 'utf8').split('\n')[0]);
  delete data.tw;
  delete data.th;
  jit = new Jit(data, opts);
  jit.modules.shuttles.forEach(function(s) {
    return console.log("Shuttle " + s.id + " has points", s.points);
  });
  jit.printGrid();
  if (torture) {
    jit.torture();
  }
  if (!torture) {
    for (j = 1; j <= 10; j++) {
      moved = jit.step();
      jit.printGrid();
      if (!moved) {
        json = jit.toJSON();
        j2 = new Jit(json);
        assert(!j2.step(), 'World erroneously stable');
        console.log('-> World stable.');
        break;
      }
      console.log('dirty shuttles:', jit.modules.dirtyShuttles.data.size);
    }
    return log('-----');
  }
};

if (require.main === module) {
  filename = process.argv[2];
  if (!filename) {
    throw Error('Missing file argument');
  }
  log.quiet = true;
  parseFile(filename);
  console.log(Jit.stats);
}


}).call(this,require('_process'))
},{"./collections2":10,"./log":13,"./util":16,"./watch":17,"_process":21,"assert":19,"fs":18}],13:[function(require,module,exports){
var log,
  slice = [].slice;

log = module.exports = function() {
  var args, f, inspect;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  if (log.quiet) {
    return;
  }
  if (typeof window === 'object') {
    return console.log.apply(console, args);
  } else {
    inspect = require('util').inspect;
    f = function(a) {
      if (typeof a === 'string') {
        return a;
      } else {
        return inspect(a, {
          depth: 5,
          colors: true
        });
      }
    };
    return console.log(args.map(f).join(' '));
  }
};

log.quiet = false;


},{"util":23}],14:[function(require,module,exports){
module.exports = Map2;

// Create a new Map2. The constructor takes in an iterable of data values in
// the form of [[k1, k2, v], [k1, k2, v], ...].
function Map2(data) {
  this.map = new Map;
  this.size = 0;
  if (data) {
    for (var i = 0; i < data.length; i++) {
      var ref = data[i], k1 = ref[0], k2 = ref[1], v = ref[2];
      this.set(k1, k2, v);
    }
  }
}

// Get k1, k2. Returns value or undefined.
Map2.prototype.get = function(k1, k2) {
  var inner;
  if ((inner = this.map.get(k1))) {
    return inner.get(k2);
  }
};

// Does the map have k1, k2. Returns true / false.
Map2.prototype.has = function(k1, k2) {
  var inner = this.map.get(k1);
  return inner ? inner.has(k2) : false;
};

// Set (k1, k2) -> v. Chainable - returns the set.
Map2.prototype.set = function(k1, k2, v) {
  var inner = this.map.get(k1);
  if (!inner) {
    inner = new Map;
    this.map.set(k1, inner);
  }
  this.size -= inner.size;
  inner.set(k2, v);
  this.size += inner.size;
  return this;
};

// Deletes the value for (k1, k2). Returns true if an element was removed,
// false otherwise.
Map2.prototype.delete = function(k1, k2) {
  var inner = this.map.get(k1);
  if (inner) {
    var deleted = inner.delete(k2);
    if (deleted) {
      this.size--;
    }
    return deleted;
  } else {
    return false;
  }
};

// Iterates through all values in the set via the passed function. Note the
// order of arguments - your function is called with (v, k1, k2). This is to
// match the semantics of Map.forEach which passes (v, k).
Map2.prototype.forEach = function(fn) {
  this.map.forEach(function(inner, k1) {
    inner.forEach(function(v, k2) {
      fn(v, k1, k2);
    });
  });
};

function iterWithNext(next) {
  var iter = {};
  iter.next = next;
  iter[Symbol.iterator] = function() { return iter; };
  return iter;
}

// Iterator to support for..of loops
Map2.prototype[Symbol.iterator] = Map2.prototype.entries = function() {
  var outer = this.map.entries();

  var k1;
  var inner = null;

  return iterWithNext(function() {
    var innerV;
    while (inner == null || (innerV = inner.next()).done) {
      // Go to the next outer map.
      var outerV = outer.next();
      // We need to return {done:true} - but this has the object we want.
      if (outerV.done) return outerV;

      k1 = outerV.value[0];
      inner = outerV.value[1].entries();
    }

    // Ok, innerV should now contain [k2, v].
    var k2 = innerV.value[0];
    var v = innerV.value[1];

    return {value:[k1, k2, v], done: false};
  });
};

// Iterate through all keys pairwise
Map2.prototype.keys = function() {
  var iter = this.entries();
  return iterWithNext(function() {
    var v = iter.next();
    if (v.done) {
      return v;
    } else {
      return {value:[v.value[0], v.value[1]], done:false};
    }
  });
};

// Iterate through all values
Map2.prototype.values = function() {
  var iter = this.entries();
  return iterWithNext(function() {
    var v = iter.next();
    if (v.done) {
      return v;
    } else {
      return {value:v.value[2], done:false};
    }
  });
};


// Remove all items in the map.
Map2.prototype.clear = function() {
  this.map.clear();
  this.size = 0;
};

// Helper for node / iojs so you can see the map in the repl.
Map2.prototype.inspect = function(depth, options) {
  var inspect = require('util').inspect;
  if (depth < 0) {
    return '[Map2]';
  }
  if (this.size === 0) {
    return '{[Map2]}';
  }
  var entries = [];
  this.forEach(function(k1, k2, v) {
    entries.push("(" + (inspect(k1, options)) + "," + (inspect(k2, options)) + ") : " + (inspect(v, options)));
  });
  //assert(entries.length === this.size);
  return "{[Map2] " + (entries.join(', ')) + " }";
};


},{"util":23}],15:[function(require,module,exports){
module.exports = Set2;

// Create a new Set2. The constructor takes optional data of the form [[a1,b1],
// [a2,b2], ...].
function Set2(data) {
  this.map = new Map;
  this.size = 0;
  if (data) {
    for (var i = 0; i < data.length; i++) {
      this.add(data[i][0], data[i][1]);
    }
  }
}

// Subset of the set. Returns a set with all entries with first value a.
Set2.prototype.subset = function(v1) {
  return this.map.get(v1);
};

// Does the set have (v1,v2)? Returns a bool.
Set2.prototype.has = function(v1, v2) {
  var inner = this.map.get(v1);
  return inner ? inner.has(v2) : false;
};

// Add (v1,v2) to the set. Chainable.
Set2.prototype.add = function(v1, v2) {
  var inner = this.map.get(v1);
  if (!inner) {
    inner = new Set;
    this.map.set(v1, inner);
  }
  this.size -= inner.size;
  inner.add(v2);
  this.size += inner.size;
  return this;
};

// Delete (v1,v2). Returns true if an item was removed.
Set2.prototype.delete = function(v1, v2) {
  var inner = this.map.get(v1);
  if (!inner) return false;

  var deleted = inner.delete(v2);
  if (!deleted) return false;

  this.size--;
  if (inner.size === 0) {
    this.map.delete(v1);
  }
  return true;
};

// Delete all entries with first value v1. Returns true if anything was
// removed. Otherwise returns false.
Set2.prototype.deleteAll = function(v1) {
  var set;
  if ((set = this.map.get(v1))) {
    this.size -= set.size;
    this.map.delete(v1);
    return true;
  }
  return false;
};

// Removes everything from the set.
Set2.prototype.clear = function() {
  this.map.clear();
  this.size = 0;
};


// ** Iteration

// Iterate through all items. fn(v1, v2).
Set2.prototype.forEach = function(fn) {
  this.map.forEach(function(inner, v1) {
    inner.forEach(function(v2) {
      fn(v1, v2);
    });
  });
};

// Iterator to support for..of loops. Its kind of weird that we register the
// same method under 3 different names, but both Map and Set have a .entries()
// method which lets you iterate over pairs of [k,v] or [v,v] in the case of
// set. 
//
// So I'll make the API more or less compatible - but in reality, you probably
// want .values() or to use for..of (which uses [Symbol.iterator]).
Set2.prototype[Symbol.iterator] = Set2.prototype.values = Set2.prototype.entries = function() {
  var outer = this.map.entries(); // Iterator over outer map

  var v1;
  var inner = null; // Iterator over inner set

  var iterator = {
    next: function() {
      var innerV;
      while (inner == null || (innerV = inner.next()).done) {
        // Go to the next outer map.
        var outerV = outer.next();
        // We need to return {done:true} - but this has the object we want.
        if (outerV.done) return outerV;

        v1 = outerV.value[0];
        inner = outerV.value[1].values();
      }

      // Ok, innerV should now contain [k2, v].
      var v2 = innerV.value;

      return {value:[v1, v2], done: false};

    }
  };

  iterator[Symbol.iterator] = function() { return iterator; };
  return iterator;
};


Set2.prototype.inspect = function(depth, options) {
  // This is a dirty hack to confuse browserify so it won't pull in node's util
  // library just to give us inspect.
  var inspect = require('' + 'util').inspect;

  if (depth < 0) {
    return '[Set2]';
  }
  var entries = [];
  this.forEach(function(v1, v2) {
    entries.push("(" + inspect(v1, options) + "," + inspect(v2, options) + ")");
  });
  assert.equal(entries.length, this.size);
  return "{[Set2] " + (entries.join(', ')) + " }";
};


},{}],16:[function(require,module,exports){
(function (process){
var DIRS, DN, DOWN, LEFT, Map2, Map3, NUMINS, RIGHT, SHUTTLE, Set2, Set3, ShuttleStateMap, THINSHUTTLE, UP, assert, cellAt, chalk, chars, connectedCells, deserialize, insLevelOf, insNum, jsonExtents, log, oppositeDir, parseXY, printCustomGrid, ref, shuttleStr;

ref = require('./collections2'), Map2 = ref.Map2, Set2 = ref.Set2, Map3 = ref.Map3, Set3 = ref.Set3;

log = require('./log');

assert = require('assert');

chalk = require('chalk');

(function() {
  var fn, j, len, ref1, results;
  if (!chalk.bgGreen) {
    chalk = function(x) {
      return x;
    };
    ref1 = ['bgGreen', 'bgRed', 'bgWhite', 'bgBlue', 'blue', 'yellow', 'grey', 'magenta'];
    results = [];
    for (j = 0, len = ref1.length; j < len; j++) {
      fn = ref1[j];
      results.push(chalk[fn] = chalk);
    }
    return results;
  }
})();

chars = {
  positive: chalk.bgGreen('+'),
  negative: chalk.bgRed('-'),
  nothing: chalk.bgWhite(' '),
  thinsolid: chalk.bgWhite.grey('x'),
  shuttle: chalk.magenta('S'),
  thinshuttle: chalk.magenta.bgWhite('s'),
  bridge: chalk.bgBlue('B'),
  thinbridge: chalk.blue('b'),
  ribbon: chalk.yellow('r'),
  ribbonbridge: chalk.yellow.bgBlue('r')
};

UP = 0;

RIGHT = 1;

DOWN = 2;

LEFT = 3;

DN = exports.DN = {
  0: 'UP',
  1: 'RIGHT',
  2: 'DOWN',
  3: 'LEFT'
};

DIRS = exports.DIRS = [
  {
    dx: 0,
    dy: -1
  }, {
    dx: 1,
    dy: 0
  }, {
    dx: 0,
    dy: 1
  }, {
    dx: -1,
    dy: 0
  }
];

NUMINS = exports.NUMINS = 16;

insNum = exports.insNum = (function() {
  var i, j, map;
  map = {};
  for (i = j = 1; j <= 16; i = ++j) {
    map["ins" + i] = i - 1;
  }
  return function(v) {
    var ref1;
    return (ref1 = map[v]) != null ? ref1 : -1;
  };
})();

SHUTTLE = 0x80;

THINSHUTTLE = 0x40;

shuttleStr = exports.shuttleStr = function(v) {
  if (v & SHUTTLE) {
    return 'shuttle';
  } else if (v & THINSHUTTLE) {
    return 'thinshuttle';
  } else {
    return null;
  }
};

parseXY = exports.parseXY = function(k) {
  var ref1, x, y;
  ref1 = k.split(','), x = ref1[0], y = ref1[1];
  return {
    x: x | 0,
    y: y | 0
  };
};

exports.fill = function(initialX, initialY, f) {
  var explore, hmm, visited, x, y;
  visited = new Set2([[initialX, initialY]]);
  explore = [initialX, initialY];
  hmm = function(x, y) {
    if (!visited.has(x, y)) {
      visited.add(x, y);
      explore.push(x);
      return explore.push(y);
    }
  };
  while (explore.length > 0) {
    x = explore.shift();
    y = explore.shift();
    if (f(x, y, hmm)) {
      hmm(x + 1, y);
      hmm(x - 1, y);
      hmm(x, y + 1);
      hmm(x, y - 1);
    }
  }
};

exports.fill3 = function(a0, b0, c0, f) {
  var a, b, c, explore, hmm, visited;
  visited = new Set3;
  visited.add(a0, b0, c0);
  explore = [a0, b0, c0];
  hmm = function(x, y, c) {
    if (!visited.has(x, y, c)) {
      visited.add(x, y, c);
      explore.push(x);
      explore.push(y);
      return explore.push(c);
    }
  };
  while (explore.length > 0) {
    a = explore.shift();
    b = explore.shift();
    c = explore.shift();
    f(a, b, c, hmm);
  }
};

oppositeDir = exports.oppositeDir = function(dir) {
  return (dir + 2) % 4;
};


/*

inum, inum2, result
0, 0, normal
0, x, normal

x, y, null
x, x, [x,y,0]
x, 0, [x,y,0]
 */

exports.cellMax = function(v) {
  switch (v) {
    case 'positive':
    case 'negative':
      return 4;
    case 'bridge':
      return 2;
    case 'ribbon':
      return NUMINS;
    case 'ribbonbridge':
      return NUMINS * 2;
    case null:
    case void 0:
      return 0;
    default:
      return 1;
  }
};

insLevelOf = function(v) {
  if (v === 'ribbon' || v === 'ribbonbridge') {
    return 0x2;
  } else if (insNum(v) !== -1) {
    return 0x3;
  } else {
    return 0x1;
  }
};

cellAt = function(grid, x, y, dir, insLevel, inum2) {
  var inum, v;
  v = grid.get(x, y);
  if (!(insLevel & insLevelOf(v))) {
    return null;
  }
  if ((inum = insNum(v)) !== -1) {
    if (inum2 === (-1) || inum2 === inum) {
      return [x, y, 0];
    } else {
      return null;
    }
  } else {
    switch (v) {
      case 'ribbon':
        assert(inum2 !== -1);
        return [x, y, inum2];
      case 'ribbonbridge':
        return [x, y, dir === UP || dir === DOWN ? inum2 : inum2 + NUMINS];
      case 'nothing':
      case 'thinsolid':
        return [x, y, 0];
      case 'bridge':
        return [x, y, dir === UP || dir === DOWN ? 0 : 1];
      case 'negative':
      case 'positive':
        return [x, y, dir];
      default:
        return null;
    }
  }
};

connectedCells = function(grid, x, y, c) {
  var cell, cells, dir, dirs, dx, dy, insLevel, inum, j, len, ref1, v;
  v = grid.get(x, y);
  inum = insNum(v);
  insLevel = 0x1;
  dirs = (function() {
    if (inum !== -1) {
      insLevel = 0x3;
      return [UP, RIGHT, DOWN, LEFT];
    } else {
      if (v === 'ribbon' || v === 'ribbonbridge') {
        inum = c % NUMINS;
        insLevel = 0x2;
      }
      switch (v) {
        case 'nothing':
        case 'thinsolid':
        case 'ribbon':
          return [UP, RIGHT, DOWN, LEFT];
        case 'bridge':
          if (c === 0) {
            return [UP, DOWN];
          } else {
            return [LEFT, RIGHT];
          }
          break;
        case 'ribbonbridge':
          if (c < NUMINS) {
            return [UP, DOWN];
          } else {
            return [LEFT, RIGHT];
          }
          break;
        case 'positive':
        case 'negative':
          return [c];
        default:
          return [];
      }
    }
  })();
  cells = [];
  for (j = 0, len = dirs.length; j < len; j++) {
    dir = dirs[j];
    ref1 = DIRS[dir], dx = ref1.dx, dy = ref1.dy;
    cell = cellAt(grid, x + dx, y + dy, oppositeDir(dir), insLevel, inum);
    if (cell) {
      cells.push(cell);
    }
  }
  return cells;
};

exports.connectedCells = function(grid, x, y, c) {
  var cells;
  cells = connectedCells(grid, x, y, c);
  return cells;
};

exports.uniqueShuttlesInStates = function(states) {
  var marked, shuttles;
  shuttles = [];
  marked = new WeakSet;
  states.forEach(function(arg) {
    var shuttle;
    shuttle = arg.shuttle;
    if (marked.has(shuttle)) {
      return;
    }
    marked.add(shuttle);
    return shuttles.push(shuttle);
  });
  shuttles.sort(function(a, b) {
    return a.id - b.id;
  });
  return shuttles;
};

exports.setToArray = function(set) {
  var arr;
  arr = [];
  set.forEach(function(x) {
    return arr.push(x);
  });
  return arr;
};

exports.ShuttleStateMap = ShuttleStateMap = (function() {
  var each;

  function ShuttleStateMap(shuttleSet) {
    this.shuttles = [];
    shuttleSet.forEach((function(_this) {
      return function(s) {
        assert(s.used);
        return _this.shuttles.push(s);
      };
    })(this));
    this.values = void 0;
  }

  each = function(list, depth, fn) {
    var item, j, len, results;
    if (depth === 0) {
      if (list != null) {
        fn(list);
      }
      return;
    }
    depth--;
    results = [];
    for (j = 0, len = list.length; j < len; j++) {
      item = list[j];
      if (item) {
        results.push(each(item, depth, fn));
      }
    }
    return results;
  };

  ShuttleStateMap.prototype.isDefinedFor = function(currentStates) {
    var j, len, ref1, s;
    ref1 = this.shuttles;
    for (j = 0, len = ref1.length; j < len; j++) {
      s = ref1[j];
      if (!currentStates.has(s)) {
        return false;
      }
    }
    return true;
  };

  ShuttleStateMap.prototype.get = function(currentStates) {
    var container, j, len, ref1, s, state;
    container = this.values;
    ref1 = this.shuttles;
    for (j = 0, len = ref1.length; j < len; j++) {
      s = ref1[j];
      if (!container) {
        return;
      }
      state = currentStates.get(s);
      assert(state);
      container = container[state.id];
    }
    return container;
  };

  ShuttleStateMap.prototype.set = function(currentStates, v) {
    var container, j, key, len, ref1, s, state;
    if (this.shuttles.length === 0) {
      return this.values = v;
    }
    key = 'values';
    container = this;
    ref1 = this.shuttles;
    for (j = 0, len = ref1.length; j < len; j++) {
      s = ref1[j];
      state = currentStates.get(s);
      if (!state) {
        throw Error('ShuttleStateMap.set on an unbound set');
      }
      if (!container[key]) {
        container = container[key] = [];
      } else {
        container = container[key];
      }
      key = state.id;
    }
    return container[key] = v;
  };

  ShuttleStateMap.prototype["delete"] = function(currentStates) {
    return this.set(currentStates, void 0);
  };

  ShuttleStateMap.prototype.forEachValue = function(fn) {
    return each(this.values, this.shuttles.length, fn);
  };

  return ShuttleStateMap;

})();

exports.fillGraph = function(initialNode, f) {
  var explore, hmm, node, visited;
  visited = new Set;
  explore = [];
  hmm = function(node) {
    if (!visited.has(node)) {
      visited.add(node);
      return explore.push(node);
    }
  };
  hmm(initialNode);
  while (explore.length > 0) {
    node = explore.shift();
    f(node, hmm);
  }
};

exports.printCustomGrid = printCustomGrid = function(arg, getFn, stream) {
  var bottom, header, j, l, left, m, n, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, right, top, v, x, y;
  top = arg.top, left = arg.left, bottom = arg.bottom, right = arg.right;
  if (stream == null) {
    stream = process.stdout;
  }
  top || (top = 0);
  left || (left = 0);
  header = chalk.bold;
  stream.write(header('+ '));
  for (x = j = ref1 = left, ref2 = right; ref1 <= ref2 ? j <= ref2 : j >= ref2; x = ref1 <= ref2 ? ++j : --j) {
    stream.write(header("" + (x % 10)));
  }
  stream.write('\n');
  for (y = l = ref3 = top, ref4 = bottom; ref3 <= ref4 ? l <= ref4 : l >= ref4; y = ref3 <= ref4 ? ++l : --l) {
    stream.write(header((y % 10) + " "));
    for (x = m = ref5 = left, ref6 = right; ref5 <= ref6 ? m <= ref6 : m >= ref6; x = ref5 <= ref6 ? ++m : --m) {
      v = getFn(x, y);
      if (typeof v === 'number') {
        v = shuttleStr(v);
      }
      stream.write(chars[v] || (v != null ? ("" + v)[0] : ';'));
    }
    stream.write('\n');
  }
  stream.write(header('+ '));
  for (x = n = ref7 = left, ref8 = right; ref7 <= ref8 ? n <= ref8 : n >= ref8; x = ref7 <= ref8 ? ++n : --n) {
    stream.write(header("" + (x % 10)));
  }
  return stream.write('\n');
};

exports.gridExtents = function(grid) {
  var bottom, left, right, top;
  top = left = bottom = right = null;
  grid.forEach(function(x, y, v) {
    if (left === null || x < left) {
      left = x;
    }
    if (right === null || x > right) {
      right = x;
    }
    if (top === null || y < top) {
      top = y;
    }
    if (bottom === null || y > bottom) {
      return bottom = y;
    }
  });
  return {
    top: top,
    left: left,
    bottom: bottom,
    right: right
  };
};

jsonExtents = function(grid) {
  var bottom, left, right, scan, top;
  top = left = bottom = right = null;
  scan = function(g) {
    var k, ref1, results, v, x, y;
    results = [];
    for (k in g) {
      v = g[k];
      ref1 = parseXY(k), x = ref1.x, y = ref1.y;
      if (left === null || x < left) {
        left = x;
      }
      if (right === null || x > right) {
        right = x;
      }
      if (top === null || y < top) {
        top = y;
      }
      if (bottom === null || y > bottom) {
        results.push(bottom = y);
      } else {
        results.push(void 0);
      }
    }
    return results;
  };
  if (grid.base) {
    scan(grid.base);
    scan(grid.shuttles);
  } else {
    scan(grid);
  }
  return {
    top: top,
    left: left,
    bottom: bottom,
    right: right
  };
};

exports.printJSONGrid = function(grid, stream) {
  var extents, fn;
  if (stream == null) {
    stream = process.stdout;
  }
  extents = jsonExtents(grid);
  fn = grid.base ? function(x, y) {
    return grid.shuttles[[x, y]] || grid.base[[x, y]];
  } : function(x, y) {
    return grid[[x, y]];
  };
  return printCustomGrid(extents, fn, stream);
};

exports.printGrid = function(extents, grid, stream) {
  if (stream == null) {
    stream = process.stdout;
  }
  return printCustomGrid(extents, (function(x, y) {
    return grid.get(x, y);
  }), stream);
};

exports.deserialize = deserialize = function(data, rebase, setCell) {
  var k, maxx, maxy, minx, miny, ref1, ref2, ref3, ref4, ref5, ref6, v, x, y;
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  maxx = maxy = -Infinity;
  if (rebase) {
    if (data.tw != null) {
      minx = miny = 0;
      maxx = data.tw;
      maxy = data.th;
    } else {
      minx = miny = Infinity;
      ref2 = (ref1 = data.base) != null ? ref1 : data;
      for (k in ref2) {
        v = ref2[k];
        ref3 = parseXY(k), x = ref3.x, y = ref3.y;
        if (x < minx) {
          minx = x;
        }
        if (y < miny) {
          miny = y;
        }
        if (x > maxx) {
          maxx = x;
        }
        if (y > maxy) {
          maxy = y;
        }
      }
      minx--;
      miny--;
      maxx += 2;
      maxy += 2;
    }
  } else {
    minx = miny = 0;
  }
  if (data.base) {
    ref4 = data.base;
    for (k in ref4) {
      v = ref4[k];
      ref5 = parseXY(k), x = ref5.x, y = ref5.y;
      if (v === 'thinbridge') {
        v = 'bridge';
      }
      setCell(x - minx, y - miny, v, data.shuttles[k]);
    }
  } else {
    console.log('Loading from old style data');
    for (k in data) {
      v = data[k];
      if (!(k !== 'tw' && k !== 'th')) {
        continue;
      }
      ref6 = parseXY(k), x = ref6.x, y = ref6.y;
      x -= minx;
      y -= miny;
      if (v === 'shuttle' || v === 'thinshuttle') {
        setCell(x, y, 'nothing', v);
      } else {
        setCell(x, y, v, null);
      }
    }
  }
  if (rebase) {
    return {
      tw: maxx - minx,
      th: maxy - miny
    };
  }
};

exports.deserializeRegion = function(data) {
  var ref1, selection, th, tw;
  selection = {
    base: new Map2,
    shuttles: new Map2
  };
  ref1 = deserialize(data, true, (function(_this) {
    return function(x, y, bv, sv) {
      selection.base.set(x, y, bv);
      if (sv != null) {
        return selection.shuttles.set(x, y, sv);
      }
    };
  })(this)), tw = ref1.tw, th = ref1.th;
  selection.tw = tw;
  selection.th = th;
  return selection;
};


}).call(this,require('_process'))
},{"./collections2":10,"./log":13,"_process":21,"assert":19,"chalk":18}],17:[function(require,module,exports){
var Watcher,
  slice = [].slice;

module.exports = Watcher = (function() {
  function Watcher(forEach) {
    var container;
    this.forEach = forEach;
    if (typeof this.forEach !== 'function') {
      container = this.forEach;
      this.forEach = function(fn) {
        return container.forEach(fn);
      };
    }
    this.observers = [];
  }

  Watcher.prototype.forward = function(fn) {
    this.forEach(fn);
    return this.observers.push(fn);
  };

  Watcher.prototype.on = function(fn) {
    return this.observers.push(fn);
  };

  Watcher.prototype.signal = function() {
    var args, i, len, o, ref;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    ref = this.observers;
    for (i = 0, len = ref.length; i < len; i++) {
      o = ref[i];
      o.apply(null, args);
    }
  };

  return Watcher;

})();


},{}],18:[function(require,module,exports){

},{}],19:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":23}],20:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],21:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],23:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":22,"_process":21,"inherits":20}]},{},[3]);
