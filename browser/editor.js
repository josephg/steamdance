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

const playpausebutton = document.getElementById('playpause');
const stepbutton = document.getElementById('step');
const worldNameLabel = document.getElementById('worldname');

var worldName = null;
worldNameLabel.onchange = e => {
  e.target.blur();
  worldName = e.target.value;
  save();
};

const loadGrid = () => {
  // We'll actually just fire a request straight at the same URL as the one
  // we're on.
  const path = location.pathname + '.json';
  console.log("loading from " + path);
  // worldName = name;
  // worldLabel.value = worldName;

  // Load from either version of data, preferring new if they both exist.
  // We'll only save back to the new data slots in local storage.

  return fetch(path, {
    headers: {'Accept': 'application/json'},
    credentials: 'same-origin'
  })
  .then(res => res.json())
  .then(grid => {
    // worldName = grid.name;
    if (grid.readonly)
      document.getElementById('readonly').style.display = 'inline'

    const parts = location.pathname.split('/');
    worldNameLabel.value = worldName = grid.name || parts[parts.length - 1];

    return db.fromData(grid.data)
  });
};

const bpromise = loadGrid().then(grid => {
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

const save = () => bpromise.then(bp => {
  return fetch(location.pathname + '.json', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({
      data: db.toData(bp.getJSONGrid()),
      name: worldName
    })
  }).catch(err => console.error(err));
    // localStorage.setItem("worldv2 " + worldName, db.toString(grid));
});

// Save every 15 seconds, or when an edit is made.
bpromise.then(bp => {
  bp.onEditFinish = save;
  // setInterval(save, 15000);
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

window.onresize = () => bpromise.then(bp => {
  bp.resizeTo(window.innerWidth, window.innerHeight);
});

playpausebutton.onclick = e => setRunning(!running);

stepbutton.onclick = e => bpromise.then(bp => {
  bp.step();
});

// Tool panel.
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
