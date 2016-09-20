// This is the code that powers the fullscreen boilerplate container found in
//the browser/ directory. Boilerplate itself should be able to run in an inlined
// context as well (inside a page element), so code that assumes there's only
//one bp instance is out here.

require('isomorphic-fetch');

const util = require('boilerplate-jit').util;
const Boilerplate = require('../lib/boilerplate');
const modules = require('./modules');
const db = require('./db');

window.util = util;
var readonly = false;

// It might be worth moving to some little view library for all this. Maybe?
const el = document.getElementById('bp');

const playpausebutton = document.getElementById('playpause');
const stepbutton = document.getElementById('step');
const worldNameLabel = document.getElementById('worldname');

var worldName = null;
(() => {
  const parts = location.pathname.split('/');
  const user = decodeURIComponent(parts[parts.length - 2]);
  const key = decodeURIComponent(parts[parts.length - 1]);
  worldName = `${user}/${key}`;
  worldNameLabel.textContent = worldName;
})();

const loadGrid = () => {
  // We'll actually just fire a request straight at the same URL as the one
  // we're on.
  const path = location.pathname + '.json';
  console.log("loading from " + path);

  // Load from either version of data, preferring new if they both exist.
  // We'll only save back to the new data slots in local storage.

  return fetch(path, {
    headers: {'Accept': 'application/json'},
    credentials: 'same-origin'
  })
  .then(res => (res.status === 404) ? {} : res.json())
  .then(grid => {
    if (grid && grid.readonly) {
      document.getElementById('readonly').style.display = 'inline'
    }
    readonly = !!grid.readonly;
    document.title = `${worldName} - Steamdance`;

    return db.fromData(grid.data)
  });
};

const bpromise = loadGrid().then(grid => {
  const bp = window.bp = new Boilerplate(el, {
    grid: grid,
    animTime: 200,

    // initialZoom: 0.1375,
    // initialX: -178.6,
    // initialY: -26.5,
  });
  el.focus();
  bp.addKeyListener(window);

  if (grid.w && grid.w > 30) { // Start looking at the whole world.
    bp.view.fit(grid.w, grid.h, grid.offx||0, grid.offy||0);
  }

  return bp;
});

var running = false;
var timer = null;
var unsavedMovement = false;

const setRunning = v => {
  document.getElementById('playpanel').className = v ? 'running' : 'stopped';
  if (running !== v) {
    running = v;
    if (v) {
      playpausebutton.textContent = '||';
      timer = setInterval(() => {
        bpromise.then(bp => unsavedMovement |= bp.step());
      }, 200);
    } else {
      playpausebutton.textContent = '►';
      clearInterval(timer);
    }
  }
};

const autoplay = window.location.hash === '#play'
setRunning(autoplay);

const isEmpty = (obj) => {
  for (var k in obj) return false;
  return true;
};

const saveNow = () => bpromise.then(bp => {
  if (readonly) return;
  const grid = bp.getJSONGrid();
  const empty = isEmpty(grid.base) && isEmpty(grid.shuttles);
  if (empty) console.log('removing');

  return fetch(location.pathname + '.json', {
    method: empty ? 'DELETE' : 'PUT',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: empty ? null : JSON.stringify({
      data: db.toData(grid),
    })
  }).catch(err => console.error(err));
  // localStorage.setItem("worldv2 " + worldName, db.toString(grid));
});

const save = (() => {
  if (readonly) return;
  // Rate limit saving to once every two seconds
  const DELAY = 2000;
  var last = 0, timer = -1;
  return () => {
    const now = Date.now();
    if (now - last > DELAY) {
      saveNow();
      last = now;
    } else {
      // Set a timer.
      if (timer === -1) timer = setTimeout(() => {
        saveNow();
        timer = -1;
        last = Date.now();
      }, last + DELAY - now);
    }
  }
})();

// Save every 15 seconds, or when an edit is made.
bpromise.then(bp => {
  bp.onEditFinish = save;
  // Save every 15 seconds while the world is turning.
  setInterval(() => {
    if (unsavedMovement) {
      save();
      unsavedMovement = false;
    }
  }, 15000);
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
