
worldLabel = document.getElementById 'worldlabel'
worldName = null
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

el = document.getElementById 'bp'
bp = new Boilerplate el, sim

window.onresize = ->
  console.log 'resize'
  bp.resizeTo window.innerWidth, window.innerHeight

isEmpty = (obj) ->
  return false for k of obj
  return true

setInterval =>
  delta = sim.step()
  if !isEmpty delta.changed
    bp.draw()
, 200

bp.onEditFinish = save = ->
  #console.log 'saving', worldName
  localStorage.setItem "world #{worldName}", JSON.stringify sim.getGrid()

setInterval save, 5000

window.onhashchange = ->
  bp.simulator = sim = load()
  bp.draw()

# putting autofocus in the html doesn't cut it for some reason.
el.focus()

bp.addKeyListener window

do ->
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

