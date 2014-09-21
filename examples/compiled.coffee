compiler = require('boilerplate-compiler')

compile = (grid, fillMode) ->
  buffer = []
  # I could use a real stream here, but then my test would be asyncronous.
  stream =
    write: (str) -> buffer.push str
    end: ->

  ast = compiler.compileGrid grid, {stream, module:'bare', fillMode}

  code = buffer.join ''

  #console.log 'code length', code.length
  #console.log code
  f = new Function(code)
  {states, calcPressure, updateShuttles, getPressure} = f()
  {states, calcPressure, updateShuttles, getPressure, ast, grid}

el = document.getElementById 'bp'

worldLabel = document.getElementById 'worldlabel'
load = ->
  location.hash = '#boilerplate' unless location.hash

  hash = location.hash
  worldName = hash[1..]
  worldLabel.textContent = worldName
  
  gridStr = localStorage.getItem "world #{worldName}"
  if gridStr != ''
    try
      grid = JSON.parse gridStr
      console.log 'loaded', worldName if grid
  new Simulator grid


sim = load()
compiled = compile sim.grid

bp = new Boilerplate el, compiled: compiled

bp.draw()

compiled.calcPressure()
setInterval =>
  compiled.updateShuttles()
  compiled.calcPressure()
  bp.draw()
  bp.updateCursor()
, 200

window.onresize = ->
  console.log 'resize'
  bp.resizeTo window.innerWidth, window.innerHeight
