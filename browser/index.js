// This is the code that powers the fullscreen boilerplate container found in
//the browser/ directory. Boilerplate itself should be able to run in an inlined
// context as well (inside a page element), so code that assumes there's only
//one bp instance is out here.

const util = require('boilerplate-jit').util;
const Boilerplate = require('../lib/boilerplate');
const modules = require('./modules');
const db = require('./db');

window.util = util;

const isEmpty = (obj) => {
  for (var k in obj) return false;
  return true;
};

// It might be worth moving to some little view library for all this. Maybe?
const el = document.getElementById('bp');

const worldLabel = document.getElementById('worldlabel');
const playpausebutton = document.getElementById('playpause');
const stepbutton = document.getElementById('step');

const worldList = document.getElementById('worldlist');

const populate = () => {
  while (worldList.firstChild) {
    worldList.removeChild(worldList.firstChild);
  }

  const worlds = new Set;
  const r = /^world(?:v2)? (.*)$/;
  for (var i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const m = r.exec(k);
    if (!m) continue;

    const name = m[1];
    if (worlds.has(name)) continue;
    worlds.add(name);

    const option = document.createElement('option');
    option.value = name;
    worldList.appendChild(option);
  }
};
populate();

var worldName = null;

const loadGrid = (name) => {
  worldName = name;
  console.log("loading " + worldName);
  location.hash = "#" + worldName;
  worldLabel.value = worldName;

  // Why am I re-populating the options set every time we load?
  populate();

  // Load from either version of data, preferring new if they both exist.
  // We'll only save back to the new data slots in local storage.
  const gridStr = localStorage.getItem("worldv2 " + worldName)
      || localStorage.getItem("world " + worldName);

  return db.fromString(gridStr); // Returns a promise.
};

const hashName = () => location.hash ? location.hash.slice(1) : 'boilerplate';

const bpromise = loadGrid(hashName()).then(grid => {
  const bp = window.bp = new Boilerplate(el, {
    grid: grid,
    animTime: 200,
    // initialZoom: 0.1375
    // initialX: -178.6
    // initialY: -26.5
  });
  el.focus();
  bp.addKeyListener(window);

  return bp;
});

var running = false;
var timer = null;

const setRunning = v => {
  document.getElementById('playpanel').className = v ? 'running' : 'stopped';
  if (running !== v) {
    running = v;
    if (v) {
      playpausebutton.textContent = '||';
      timer = setInterval(() => {
        bpromise.then(bp => bp.step());
      }, 200);
    } else {
      playpausebutton.textContent = '►';
      clearInterval(timer);
    }
  }
};

setRunning(false);

const reset = grid => bpromise.then(bp => {
  bp.setJSONGrid(grid);
  bp.resetView();
  setRunning(true);
});

const save = () => bpromise.then(bp => {
  const grid = bp.getJSONGrid();
  if (isEmpty(grid.base) && isEmpty(grid.shuttles)) {
    console.log('removing', worldName);
    localStorage.removeItem("worldv2 " + worldName);
  } else {
    console.log('saving', worldName);
    localStorage.setItem("worldv2 " + worldName, db.toString(grid));
  }
});

// Save every 15 seconds, or when an edit is made.
bpromise.then(bp => {
  bp.onEditFinish = save;
  setInterval(save, 15000);
});

window.addEventListener('keypress', e => {
  // console.log(e.keyCode, e.key, e.which);

  // Space - which doesn't work with e.keyCode on firefox. :p
  if (e.keyCode === 32 || e.which === 32) {
    setRunning(!running);
  }
  switch (e.keyCode) {
    case 13: // Enter. Step the world while we're paused.
      bpromise.then(bp => bp.step()); break;
  }
});

worldLabel.onkeydown = e => {
  if (e.keyCode === 27) { // Escape
    worldLabel.value = worldName;
    worldLabel.blur();
  }
};

worldLabel.onchange = e => {
  worldLabel.blur();
  loadGrid(worldLabel.value).then(grid => reset(grid));
};

// Don't also propogate to boilerplate underneath.
worldLabel.onkeydown = e => e.cancelBubble = true;

window.onhashchange = () => {
  const newWorld = hashName();
  if (newWorld !== worldName) {
    worldName = newWorld;
    loadGrid(worldName).then(grid => reset(grid));
  }
};

window.onresize = () => bpromise.then(bp => {
  bp.resizeTo(window.innerWidth, window.innerHeight);
});

playpausebutton.onclick = e => setRunning(!running);

stepbutton.onclick = e => bpromise.then(bp => {
  bp.step();
});

bpromise.then(bp => {
  const panel = document.getElementsByClassName('toolpanel')[0];

  var selected = null;
  panel.onclick = e => {
    const element = e.target;
    if (element === panel) return;

    bp.changeTool(element.id);
  };

  bp.onToolChanged = newTool => {
    if (selected) selected.className = '';

    const e = document.getElementById(newTool || 'solid');
    if (!e) return;

    e.className = 'selected';
    selected = e;
  };

  bp.onToolChanged(bp.activeTool);
  modules.load(bp);
});

// Utility method so I can backup my stuff while I'm programming.
window.backup = () => {
  const data = {};
  for (var i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = JSON.parse(localStorage.getItem(k));
    data[k] = v;
  }
  return data;
};
