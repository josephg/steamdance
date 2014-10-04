
el = document.getElementById 'bp'

worldLabel = document.getElementById 'worldlabel'
worldName = null
loadGrid = ->
  location.hash = '#boilerplate' unless location.hash

  hash = location.hash
  worldName = hash[1..]
  worldLabel.textContent = worldName
  
  gridStr = localStorage.getItem "world #{worldName}"
  if gridStr != ''
    try
      grid = JSON.parse gridStr
      console.log 'loaded', worldName if grid
  grid || {}


grid = loadGrid()

bp = new Boilerplate el, grid: grid, animTime:90

bp.onEditFinish = save = ->
  #console.log 'saving', worldName
  localStorage.setItem "world #{worldName}", JSON.stringify bp.getGrid()

setInterval save, 5000

el.focus()

bp.addKeyListener window

bp.draw()

setInterval =>
  bp.step()
, 200

window.onhashchange = ->
  bp.grid = grid = loadGrid()
  bp.compile()
  bp.draw()

window.onresize = ->
  console.log 'resize'
  bp.resizeTo window.innerWidth, window.innerHeight

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

