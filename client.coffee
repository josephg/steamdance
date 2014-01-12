canvas = document.getElementsByTagName('canvas')[0]
canvas.parentNode.appendChild(uiCanvas = document.createElement('canvas'))

window.onresize = ->
  uiCanvas.width = canvas.width = window.innerWidth
  uiCanvas.height = canvas.height = window.innerHeight
  draw?()
  drawUI?()
window.onresize()
ctx = canvas.getContext '2d'

audioCtx = new (window.AudioContext || window.webkitAudioContext)?()

mixer = audioCtx?.createGainNode()
mixer?.connect audioCtx.destination


loadSound = (url, callback) ->
  return callback 'No audio support' unless audioCtx

  request = new XMLHttpRequest()
  request.open 'GET', url, true
  request.responseType = 'arraybuffer'

  request.onload = ->
    audioCtx.decodeAudioData request.response, (buffer) ->
      #source = audioCtx.createBufferSource()
      #source.buffer = buffer
      callback null, buffer
    , (error) ->
      callback error

  try
    request.send()
  catch e
    callback e.message


###
sfx =
  thud: 'thud.wav'

for s, url of sfx
  do (s, url) ->
    atom.loadSound "sounds/#{url}", (error, buffer) ->
      console.error error if error
      sounds[s] = buffer if buffer
      didLoad()
###
 
sounds = {}
play = (name, time) ->
  return unless sounds[name] and audioCtx
  source = audioCtx.createBufferSource()
  source.buffer = sounds[name]
  source.connect mixer
  source.noteOn time ? 0
  source

muted = false
toggleMute = ->
  if !muted
    muted = true
    mixer?.gain.value = 0
  else
    muted = false
    mixer?.gain.value = 1

# Start it muted.
toggleMute()


loadSound '/sounds/thud.wav', (error, buffer) ->
  console.log error, buffer
  sounds.thud = buffer


CELL_SIZE = 20
zoom_level = 1
size = CELL_SIZE * zoom_level

grid = {}
pressure = {}
ws = new WebSocket 'ws://' + window.location.host + window.location.pathname
ws.onerror = (err) ->
  console.err err
ws.onmessage = (msg) ->
  msg = JSON.parse msg.data
  if msg.delta?.changed
    for k,v of msg.delta.changed
      #console.log k, v
      continue if (v? and grid[k] is v) or (!v? and !grid[k]?)

      #switch v
      #  when 'shuttle'
      #    play 'thud'

      if v?
        grid[k] = v
      else
        delete grid[k]

    s = new Simulator grid
    pressure = s.getPressure()
    draw()

  if msg.delta?.sound and Object.keys(msg.delta.sound).length
    setTimeout (-> play 'thud'), 50

scroll_x = 0 # in tile coords
scroll_y = 0

copySubgrid = (rect) ->
  {tx, ty, tw, th} = rect
  subgrid = {tw,th}
  for y in [ty..ty+th]
    for x in [tx..tx+tw]
      if s = grid[[x,y]]
        subgrid[[x-tx,y-ty]] = s
  subgrid

colors =
  solid: 'black'
  nothing: 'white'
  thinshuttle: '#f0f'
  shuttle: '#808'
  negative: 'red'
  positive: '#0f0'
  thinsolid: '#888'
  bridge: '#880'

placing = 'nothing'
imminent_select = false
selectedA = selectedB = null
selection = null

flip = (dir) ->
  return unless selection
  new_selection = {tw:tw = selection.tw, th:th = selection.th}
  for k,v of selection
    {x:tx,y:ty} = parseXY k
    tx_ = if 'x' in dir then tw-1 - tx else tx
    ty_ = if 'y' in dir then th-1 - ty else ty
    new_selection[[tx_,ty_]] = v
  selection = new_selection

mirror = ->
  return unless selection
  new_selection = {tw:tw = selection.th, th:th = selection.tw}
  for k,v of selection
    {x:tx,y:ty} = parseXY k
    new_selection[[ty,tx]] = v
  selection = new_selection

document.onkeydown = (e) ->
  kc = e.keyCode
  if kc == 37 # left
    scroll_x -= 1
  else if kc == 39 # right
    scroll_x += 1
  else if kc == 38 # up
    scroll_y -= 1
  else if kc == 40 # down
    scroll_y += 1

  if kc == 192
    return toggleMute()

  if kc == 16 # shift
    imminent_select = true

  if kc == 27 # esc
    selection = null

  if kc == 88 # x
    flip 'x' if selection
  else if kc == 89 # y
    flip 'y' if selection
  else if kc == 77 # m
    mirror() if selection

  pressed = ({
    # 1-8
    49: 'nothing'
    50: 'solid'
    51: 'positive'
    52: 'negative'
    53: 'shuttle'
    54: 'thinshuttle'
    55: 'thinsolid'
    56: 'bridge'

    80: 'positive' # p
    78: 'negative' # n
    83: 'shuttle' # s
    65: 'thinshuttle' # a
    69: 'nothing' # e
    71: 'thinsolid' # g
    68: 'solid' # d
    66: 'bridge' # b
  })[kc]
  if pressed?
    placing = if pressed is 'solid' then null else pressed
  draw()

document.onkeyup = (e) ->
  kc = e.keyCode
  if kc == 16 # shift
    imminent_select = false
    draw()

window.onmousewheel = (e) ->
  if e.shiftKey
    oldsize = size
    zoom_level += e.wheelDeltaY / 800
    zoom_level = Math.max(Math.min(zoom_level, 5),1/CELL_SIZE)
    size = Math.floor zoom_level * CELL_SIZE

    scroll_x += mouse.x / oldsize - mouse.x / size
    scroll_y += mouse.y / oldsize - mouse.y / size
  else
    scroll_x += e.wheelDeltaX / (-2 * size)
    scroll_y += e.wheelDeltaY / (-2 * size)
  e.preventDefault()
  draw()

paint = ->
  {tx, ty} = screenToWorld mouse.x, mouse.y

  delta = {}
  delta[[tx,ty]] = placing
  ws.send JSON.stringify {delta}
  if placing?
    grid[[tx,ty]] = placing
  else
    delete grid[[tx,ty]]

paste = ->
  throw new Error 'tried to paste without a selection' unless selection
  {tx:mtx, ty:mty} = screenToWorld mouse.x, mouse.y
  delta = {}
  for y in [0...selection.th]
    for x in [0...selection.tw]
      tx = mtx+x
      ty = mty+y
      if (s = selection[[x,y]]) != grid[[tx,ty]]
        delta[[tx,ty]] = s or null
        if s?
          grid[[tx,ty]] = s
        else
          delete grid[[tx,ty]]
  ws.send JSON.stringify {delta}

mouse = {x:0,y:0, mode:null}
window.onblur = ->
  mouse.mode = null
  imminent_select = false
document.onmousemove = (e) ->
  mouse.x = e.pageX
  mouse.y = e.pageY
  switch mouse.mode
    when 'paint' then paint()
    when 'select' then selectedB = screenToWorld mouse.x, mouse.y
  draw()
document.onmousedown = (e) ->
  if imminent_select
    mouse.mode = 'select'
    selection = null
    selectedA = screenToWorld mouse.x, mouse.y
    selectedB = selectedA
  else if selection
    paste()
  else
    mouse.mode = 'paint'
    paint()
  draw()
document.onmouseup = ->
  if mouse.mode is 'select'
    selection = copySubgrid enclosingRect selectedA, selectedB
  mouse.mode = null
  imminent_select = false

enclosingRect = (a, b) ->
  tx: Math.min a.tx, b.tx
  ty: Math.min a.ty, b.ty
  tw: Math.abs(b.tx-a.tx) + 1
  th: Math.abs(b.ty-a.ty) + 1

# given pixel x,y returns tile x,y
screenToWorld = (px, py) ->
  # first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
  px += Math.floor(scroll_x * size)
  py += Math.floor(scroll_y * size)
  # now we can simply divide and floor to find the tile
  tx = Math.floor(px / size)
  ty = Math.floor(py / size)
  {tx,ty}

# given tile x,y returns the pixel x,y,w,h at which the tile resides on the screen.
worldToScreen = (tx, ty) ->
  px: tx * size - Math.floor(scroll_x * size)
  py: ty * size - Math.floor(scroll_y * size)

requestAnimationFrame = window.requestAnimationFrame or
  window.webkitRequestAnimationFrame or
  window.mozRequestAnimationFrame or
  window.oRequestAnimationFrame or
  window.msRequestAnimationFrame or
  (callback) ->
    window.setTimeout(callback, 1000 / 60)

needsDraw = false
draw = ->
  return if needsDraw
  needsDraw = true
  requestAnimationFrame ->
    drawReal()
    drawUI()
    needsDraw = false
drawReal = ->
  ctx.fillStyle = 'black'
  ctx.fillRect 0, 0, canvas.width, canvas.height
  for k,v of grid
    {x:tx,y:ty} = parseXY k
    {px, py} = worldToScreen tx, ty
    if px+size >= 0 and px < canvas.width and py+size >= 0 and py < canvas.height
      ctx.fillStyle = colors[v]

      ctx.fillRect px, py, size, size
      if (p = pressure[k]) and p != 0
        ctx.fillStyle = if p < 0 then 'rgba(255,0,0,0.4)' else 'rgba(0,255,0,0.4)'
        ctx.fillRect px, py, size, size

  mx = mouse.x
  my = mouse.y
  {tx:mtx, ty:mty} = screenToWorld mx, my
  {px:mpx, py:mpy} = worldToScreen mtx, mty

  if mouse.mode is 'select'
    sa = selectedA
    sb = selectedB
  else if imminent_select
    sa = sb = {tx:mtx, ty:mty}

  if sa
    {tx, ty, tw, th} = enclosingRect sa, sb
    {px, py} = worldToScreen tx, ty
    ctx.fillStyle = 'rgba(0,0,255,0.5)'
    ctx.fillRect px, py, tw*size, th*size

    ctx.strokeStyle = 'rgba(0,255,255,0.5)'
    ctx.strokeRect px, py, tw*size, th*size
  else if selection
    ctx.globalAlpha = 0.8
    for y in [0...selection.th]
      for x in [0...selection.tw]
        {px, py} = worldToScreen x+mtx,y+mty
        if px+size >= 0 and px < canvas.width and py+size >= 0 and py < canvas.height
          v = selection[[x,y]]
          ctx.fillStyle = if v then colors[v] else 'black'
          ctx.fillRect px, py, size, size
    ctx.strokeStyle = 'rgba(0,255,255,0.5)'
    ctx.strokeRect mpx, mpy, selection.tw*size, selection.th*size
    ctx.globalAlpha = 1
  else
    ctx.fillStyle = colors[placing ? 'solid']
    ctx.fillRect mpx + size/4, mpy + size/4, size/2, size/2

    ctx.strokeStyle = if grid[[mtx,mty]] then 'black' else 'white'
    ctx.strokeRect mpx + 1, mpy + 1, size - 2, size - 2


  return

drawUI = ->
  uictx = uiCanvas.getContext '2d'
  uictx.clearRect 0, 0, uiCanvas.width, uiCanvas.height
  uictx.fillStyle = 'rgba(200,200,200,0.9)'
  uictx.beginPath()
  uictx.arc 15, 15, 10, 0, Math.PI*2
  uictx.fill()
  y = 40
  uictx.font = 'bold 18px Arial'
  for mat, i in ['nothing', 'solid', 'positive', 'negative', 'shuttle', 'thinshuttle', 'thinsolid', 'bridge']
    color = colors[mat]
    uictx.setShadow 1, 1, 2.5, 'black'

    uictx.fillStyle = if (placing ? 'solid') is mat
      'rgba(200,200,200,0.9)'
    else
      'rgba(120,120,120,0.9)'

    uictx.beginPath()
    uictx.arc 15, y, 10, Math.PI/2, Math.PI*3/2
    text = "#{i+1}: #{mat}"
    width = uictx.measureText(text).width + 30
    uictx.lineTo width, y-10
    uictx.arc 15+width, y, 10, Math.PI*3/2, Math.PI/2, false
    uictx.closePath()
    uictx.fill()

    uictx.fillStyle = color
    uictx.beginPath()
    uictx.arc 15, y, 6, 0, Math.PI*2
    uictx.fill()

    uictx.clearShadow()
    uictx.textBaseline = 'middle'
    uictx.setShadow 0, 0, 4, '#222'
    uictx.fillStyle = '#eee'
    uictx.fillText text, 35, y
    y += 25

window.addEventListener 'copy', (e) ->
  if selection
    console.log e.clipboardData.setData 'text', JSON.stringify selection
  e.preventDefault()

window.addEventListener 'paste', (e) ->
  data = e.clipboardData.getData 'text'
  if data
    try
      selection = JSON.parse data

