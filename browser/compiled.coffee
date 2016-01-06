Boilerplate = require '../lib/boilerplate.coffee'
modules = require './modules'
{util} = require 'boilerplate-jit'
assert = require 'assert'
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

  if gridStr != ''
    try
      grid = JSON.parse gridStr
      console.log 'loaded', worldName if grid
  grid || {base:{}, shuttles:{}}

running = false

timer = null
setRunning = (v) ->
  document.getElementById('playpanel').className = if v then 'running' else 'stopped'
  if running != v
    running = v
    if v
      playpausebutton.textContent = '||'
      timer = setInterval =>
        bp.step()
      , 200
    else
      playpausebutton.textContent = '►'
      clearInterval timer


setRunning false

grid = loadGrid location.hash?[1..] || 'boilerplate'

bp = window.bp = new Boilerplate el, grid: grid, animTime:200, useWebGL:no

el.focus()

bp.addKeyListener window

bp.draw()

reset = (grid) ->
  bp.setJSONGrid grid
  bp.resetView()
  setRunning true

bp.onEditFinish = save = ->
  grid = bp.getJSONGrid()
  #console.log grid
  if isEmpty(grid.base) && isEmpty(grid.shuttles)
    console.log 'removing', worldName
    localStorage.removeItem "worldv2 #{worldName}"
  else
    # console.log 'saving', worldName
    localStorage.setItem "worldv2 #{worldName}", JSON.stringify grid

setInterval save, 15000

window.addEventListener 'keypress', (e) ->
  #console.log e.keyCode
  switch e.keyCode
    when 32 # space
      setRunning !running
    when 13 # enter
      bp.step()

worldLabel.onkeydown = (e) ->
  if e.keyCode is 27 # escape
    worldLabel.value = worldName
    worldLabel.blur()

worldLabel.onchange = (e) ->
  worldLabel.blur()

worldLabel.oninput = (e) ->
  reset loadGrid worldLabel.value

worldLabel.onkeydown = (e) ->
  e.cancelBubble = true

window.onhashchange = ->
  hash = location.hash
  newWorld = hash[1..] if hash
  if newWorld != worldName
    worldName = newWorld
    reset loadGrid worldName

window.onresize = ->
  bp.resizeTo window.innerWidth, window.innerHeight

playpausebutton.onclick = (e) ->
  setRunning !running

stepbutton.onclick = (e) ->
  bp.step()

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

window.backup = ->
  data = {}
  for i in [0...localStorage.length]
    k = localStorage.key i
    v = JSON.parse localStorage.getItem k
    data[k] = v

  data

modules.load bp



downloadURI = (uri, name) ->
  link = document.createElement("a")
  link.download = name
  link.href = uri
  link.click()

toByte = (v, sv) ->
  #console.log v, sv, util.K[v] | (if sv? then util.K[sv] else 0)
  util.K[v] | (if sv? then util.K[sv] else 0)

fromByte = (b) ->
  sv = if b & util.K.shuttle
    'shuttle'
  else if b & util.K.thinshuttle
    'thinshuttle'
  else
    undefined

  v = util.K_[b & 0x3f]
  assert v?

  #assert v not in ['shuttle', 'thinshuttle']
  [v, sv]

toImage = ->
  json = bp.getJSONGrid()
  return if isEmpty json.base

  MAX = Number.MAX_SAFE_INTEGER
  [l, r, t, b] = [MAX,-MAX,MAX,-MAX]
  for k, v of json.base
    {x, y} = util.parseXY k
    l = x if x < l; r = x if x > r
    t = y if y < t; b = y if y > b

  w = r - l; h = b - t + 1
  w = w - (w%3) + 3 # round up to the next multiple of 3

  console.log w, h

  canvas = document.createElement 'canvas'
  canvas.width = w/3; canvas.height = h
  ctx = canvas.getContext '2d'
  imageData = ctx.createImageData(w/3, h)
  data = imageData.data
  # Set the image to be fully opaque
  data[i+3] = 255 for i in [0...data.length] by 4

  for k, v of json.base
    {x, y} = util.parseXY k
    sv = json.shuttles[k]
    x -= l; y -= t
    
    offs = x + (x-(x%3))/3 + y*w/3*4
    data[offs] = toByte(v, sv)
    #console.log offs, data[offs]

  console.log imageData.data
  ctx.putImageData(imageData, 0, 0)

  data = canvas.toDataURL()

  imageToJSON data, l, t, (err, result) ->
    throw err if err
    console.log result
    console.log json
    for k, v of json.base
      if (v2 = result.base[k]) != v
        console.log "WHOA! at #{k} #{v} #{v2}"
    for k, v of json.shuttles
      if (v2 = result.shuttles[k]) != v
        console.log "WHOA! sat #{k} #{v} #{v2}"
    assert.deepEqual json, result

  #downloadURI data, 'data.png'
  return

window.im = toImage # For testing

imageToJSON = (uri, offx, offy, callback) ->
  img = new Image
  img.src = uri
  img.onload = ->
    console.log 'loaded'
    canvas = document.createElement 'canvas'
    w = canvas.width = img.width; h = canvas.height = img.height
    ctx = canvas.getContext '2d'
    ctx.drawImage img, 0, 0, w, h
    imageData = ctx.getImageData 0, 0, w, h
    console.log imageData.data

    console.log w*3, h, offx, offy

    data =
      base: {}
      shuttles: {}

    for b,i in imageData.data when i%4 != 3
      # Unpack index.
      x0 = i % (w*4)
      x = x0 - (x0 - (x0%4))/4
      y = (i/(w*4))|0

      [v, sv] = fromByte b
      if v != 'solid'
        k = "#{x+offx},#{y+offy}"
        data.base[k] = v
        if sv
          data.shuttles[k] = sv
      #console.log i, b, [x, y], [x+offx, y+offy], [v, sv]
        
    callback null, data
  img.onerror = (e) -> callback Error e.stack
  return

