Boilerplate = require '../lib/boilerplate.coffee'
modules = require './modules'
{util} = require 'boilerplate-jit'
assert = require 'assert'
db = require './db'
window.util = util

isEmpty = (obj) ->
  return false for k of obj
  return true

el = document.getElementById 'bp'

worldLabel = document.getElementById 'worldlabel'
playpausebutton = document.getElementById 'playpause'
stepbutton = document.getElementById 'step'

worldList = document.getElementById 'worldlist'
do populate = ->
  while worldList.firstChild
    worldList.removeChild worldList.firstChild

  worlds = new Set
  r = /^world(?:v2)? (.*)$/
  for i in [0...localStorage.length]
    k = localStorage.key i
    m = r.exec k
    continue unless m
    name = m[1]

    continue if worlds.has name
    worlds.add name

    option = document.createElement 'option'
    option.value = name
    worldList.appendChild option

worldName = null
loadGrid = (name) ->
  worldName = name
  console.log "loading #{worldName}"
  location.hash = "##{worldName}"
  worldLabel.value = worldName

  populate()

  # Load from either location (preferring the new). We'll only save back to the new slots.
  gridStr = localStorage.getItem("worldv2 #{worldName}") or
    localStorage.getItem("world #{worldName}")

  #console.log "got", gridStr

  return db.fromString gridStr # Promise

bpromise = loadGrid(location.hash?[1..] || 'boilerplate').then (grid) ->
  bp = window.bp = new Boilerplate el,
    grid: grid
    animTime:200
    # initialZoom: 0.1375
    # initialX: -178.6
    # initialY: -26.5

  el.focus()
  bp.addKeyListener window
  bp.draw()
  return bp

running = false
timer = null
setRunning = (v) ->
  document.getElementById('playpanel').className = if v then 'running' else 'stopped'
  if running != v
    running = v
    if v
      playpausebutton.textContent = '||'
      timer = setInterval =>
        bpromise.then (bp) -> bp.step()
      , 200
    else
      playpausebutton.textContent = '►'
      clearInterval timer

setRunning false

reset = (grid) -> bpromise.then (bp) ->
  bp.setJSONGrid grid
  bp.resetView()
  setRunning true

save = -> bpromise.then (bp) ->
  grid = bp.getJSONGrid()
  #console.log grid
  if isEmpty(grid.base) && isEmpty(grid.shuttles)
    console.log 'removing', worldName
    localStorage.removeItem "worldv2 #{worldName}"
  else
    console.log 'saving', worldName
    localStorage.setItem "worldv2 #{worldName}", db.toString(grid)

bpromise.then (bp) ->
  bp.onEditFinish = save
  setInterval save, 15000

window.addEventListener 'keypress', (e) ->
  # console.log e.keyCode, e.key, e.which

  # Space - which doesn't work with e.keyCode on firefox. :p
  setRunning !running if e.keyCode is 32 or e.which is 32

  switch e.keyCode
    when 13 # enter
      bpromise.then -> bp.step()

worldLabel.onkeydown = (e) ->
  if e.keyCode is 27 # escape
    worldLabel.value = worldName
    worldLabel.blur()

worldLabel.onchange = (e) ->
  # console.log 'onchange'
  worldLabel.blur()
  loadGrid(worldLabel.value).then (grid) ->
    reset grid

# worldLabel.oninput = (e) ->
#   console.log 'oninput'

worldLabel.onkeydown = (e) ->
  # console.log 'onkeydown'
  e.cancelBubble = true

window.onhashchange = ->
  hash = location.hash
  newWorld = hash[1..] if hash
  if newWorld != worldName
    worldName = newWorld
    loadGrid(worldName).then (grid) ->
      reset grid

window.onresize = -> bpromise.then (bp) ->
  bp.resizeTo window.innerWidth, window.innerHeight

playpausebutton.onclick = (e) ->
  setRunning !running

stepbutton.onclick = (e) -> bpromise.then (bp) ->
  bp.step()

bpromise.then (bp) ->
  panel = document.getElementsByClassName('toolpanel')[0]

  selected = null
  panel.onclick = (e) ->
    element = e.target
    return if element is panel

    bp.changeTool element.id

  bp.onToolChanged = (newTool) ->
    if selected
      selected.className = ''

    e = document.getElementById (newTool || 'solid')
    return unless e
    e.className = 'selected'
    selected = e

  bp.onToolChanged(bp.activeTool)

  modules.load bp

window.backup = ->
  data = {}
  for i in [0...localStorage.length]
    k = localStorage.key i
    v = JSON.parse localStorage.getItem k
    data[k] = v

  data


#
# downloadURI = (uri, name) ->
#   link = document.createElement("a")
#   link.download = name
#   link.href = uri
#   link.click()
