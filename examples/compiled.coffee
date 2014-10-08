Boilerplate = require '../public/boilerplate.coffee'

el = document.getElementById 'bp'

worldLabel = document.getElementById 'worldlabel'

worldName = null
loadGrid = (name) ->
  worldName = name
  console.log "loading #{worldName}"
  location.hash = "##{worldName}"
  worldLabel.value = worldName

  gridStr = localStorage.getItem "world #{worldName}"
  if gridStr != ''
    try
      grid = JSON.parse gridStr
      console.log 'loaded', worldName if grid
  grid || {}


grid = loadGrid location.hash?[1..] || 'boilerplate'

bp = window.bp = new Boilerplate el, grid: grid, animTime:200, useWebGL:no

bp.onEditFinish = save = ->
  console.log 'saving', worldName
  localStorage.setItem "world #{worldName}", JSON.stringify bp.getGrid()

setInterval save, 5000

el.focus()

bp.addKeyListener window

bp.draw()

setInterval =>
  bp.step()
, 200

worldLabel.onkeydown = (e) ->
  if e.keyCode is 27 # escape
    worldLabel.value = worldName
    worldLabel.blur()
worldLabel.onchange = (e) ->
  #console.log 'onchange', e
  bp.setGrid loadGrid worldLabel.value
  worldLabel.blur()

worldList = document.getElementById 'worldlist'
do populate = ->
  r = /^world (.*)$/
  for i in [0...localStorage.length]
    k = localStorage.key i
    m = r.exec k
    continue unless m
    name = m[1]

    option = document.createElement 'option'
    option.value = name
    worldList.appendChild option


window.onhashchange = ->
  hash = location.hash
  worldName = hash[1..] if hash
  
  bp.setGrid loadGrid worldName

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

