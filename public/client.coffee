#########################
#                       #
#  DEPRECATION WARNING  #
#                       #
#########################

# This code is hella deprecated. The new version is super clean and stuff, and
# you should well use it.


canvas = document.getElementsByTagName('canvas')[0]
canvas.parentNode.appendChild(uiCanvas = document.createElement('canvas'))

window.onresize = ->
  uiCanvas.width = canvas.width = window.innerWidth
  uiCanvas.height = canvas.height = window.innerHeight
  calcUIBoxes?()

  draw?()
  #drawUI?()
  drawUIBoxes?()
window.onresize()
ctx = canvas.getContext '2d'

audioCtx = new (window.AudioContext || window.webkitAudioContext)?()

mixer = audioCtx?.createGain()
mixer?.connect audioCtx.destination

{parseXY} = Simulator

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
  source.start time ? 0
  #source.noteOn time ? 0
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


###
# Loading this sound crashes iOS safari
loadSound '/sounds/thud.wav', (error, buffer) ->
  console.log error, buffer
  sounds.thud = buffer
###

CELL_SIZE = 20
zoom_level = 1
size = CELL_SIZE * zoom_level

grid = {}
pressure = {}
ws = new WebSocket 'ws://' + window.location.host + window.location.pathname
ws.onerror = (err) ->
  console.err err
ws.onmessage = (msg) ->
  console.log msg
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
  solid: 'hsl(184, 49%, 7%)'
  nothing: 'white'
  shuttle: 'hsl(44, 87%, 52%)'
  thinshuttle: 'hsl(44, 87%, 72%)'
  negative: 'hsl(17, 98%, 36%)'
  positive: 'hsl(170, 49%, 51%)'
  thinsolid: 'lightgrey'
  bridge: '#08f'


###
  solid: 'black'
  nothing: 'white'
  thinshuttle: '#f0f'
  shuttle: '#808'
  negative: 'red'
  positive: '#0f0'
  thinsolid: '#888'
  bridge: '#08f'
###
placing = 'nothing'
imminent_select = false
selectedA = selectedB = null
selectOffset = null
selection = null

show_gridlines = no

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

  switch kc
    when 37 # left
      scroll_x -= 1
    when 39 # right
      scroll_x += 1
    when 38 # up
      scroll_y -= 1
    when 40 # down
      scroll_y += 1

    when 192 # ~
      toggleMute()

    when 16 # shift
      imminent_select = true
    when 27 # esc
      selection = selectOffset = null

    when 88 # x
      flip 'x' if selection
    when 89 # y
      flip 'y' if selection
    when 77 # m
      mirror() if selection

    when 9 # tab
      show_gridlines = !show_gridlines
      e.preventDefault()

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

line = (x0, y0, x1, y1, f) ->
  dx = Math.abs x1-x0
  dy = Math.abs y1-y0
  ix = if x0 < x1 then 1 else -1
  iy = if y0 < y1 then 1 else -1
  e = 0
  for i in [0..dx+dy]
    f x0, y0
    e1 = e + dy
    e2 = e - dx
    if Math.abs(e1) < Math.abs(e2)
      x0 += ix
      e = e1
    else
      y0 += iy
      e = e2
  return
paint = ->
  throw 'Invalid placing' if placing is 'move'
  {tx, ty} = mouse
  {tx:fromtx, ty:fromty} = mouse.from
  fromtx ?= tx
  fromty ?= ty

  delta = {}
  line fromtx, fromty, tx, ty, (x, y) ->
    delta[[x,y]] = placing
    if placing?
      grid[[x,y]] = placing
    else
      delete grid[[x,y]]
  ws.send JSON.stringify {delta}

paste = ->
  throw new Error 'tried to paste without a selection' unless selection
  {tx:mtx, ty:mty} = screenToWorld mouse.x, mouse.y
  mtx -= selectOffset.tx
  mty -= selectOffset.ty
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

mouse = {x:null,y:null, mode:null}
window.onblur = ->
  mouse.mode = null
  imminent_select = false
document.onmousemove = (e) ->
  mouse.from = {tx: mouse.tx, ty: mouse.ty}
  mouse.x = e.pageX
  mouse.y = e.pageY
  {tx:mouse.tx, ty:mouse.ty} = screenToWorld mouse.x, mouse.y
  switch mouse.mode
    when 'paint' then paint()
    when 'select' then selectedB = screenToWorld mouse.x, mouse.y
  draw()
document.onmousedown = (e) ->
  if imminent_select
    mouse.mode = 'select'
    selection = selectOffset = null
    selectedA = screenToWorld mouse.x, mouse.y
    selectedB = selectedA
  else if selection
    paste()
  else
    if !selectMat()
      mouse.mode = 'paint'
      mouse.from = {tx:mouse.tx, ty:mouse.ty}
      paint()
  draw()
document.onmouseup = ->
  if mouse.mode is 'select'
    selection = copySubgrid enclosingRect selectedA, selectedB
    selectOffset =
      tx:selectedB.tx - Math.min selectedA.tx, selectedB.tx
      ty:selectedB.ty - Math.min selectedA.ty, selectedB.ty

  mouse.mode = null
  imminent_select = false

enclosingRect = (a, b) ->
  tx: Math.min a.tx, b.tx
  ty: Math.min a.ty, b.ty
  tw: Math.abs(b.tx-a.tx) + 1
  th: Math.abs(b.ty-a.ty) + 1

# given pixel x,y returns tile x,y
screenToWorld = (px, py) ->
  return {tx:null, ty:null} unless px?
  # first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
  px += Math.floor(scroll_x * size)
  py += Math.floor(scroll_y * size)
  # now we can simply divide and floor to find the tile
  tx = Math.floor(px / size)
  ty = Math.floor(py / size)
  {tx,ty}

# given tile x,y returns the pixel x,y,w,h at which the tile resides on the screen.
worldToScreen = (tx, ty) ->
  return {px:null, py:null} unless tx?
  px: tx * size - Math.floor(scroll_x * size)
  py: ty * size - Math.floor(scroll_y * size)

needsDraw = false
draw = ->
  return if needsDraw
  needsDraw = true
  requestAnimationFrame ->
    drawReal()
    #drawUI()
    drawUIBoxes()
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
        ctx.fillStyle = if p < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.2)'
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

  if show_gridlines
    ctx.fillStyle = 'rgba(255,255,127,0.5)'
    ctx.fillRect mpx + size/4, 0, size/2, canvas.height
    ctx.fillRect 0, mpy + size/4, canvas.width, size/2

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
        {px, py} = worldToScreen x+mtx-selectOffset.tx, y+mty-selectOffset.ty
        if px+size >= 0 and px < canvas.width and py+size >= 0 and py < canvas.height
          v = selection[[x,y]]
          ctx.fillStyle = if v then colors[v] else 'black'
          ctx.fillRect px, py, size, size
    ctx.strokeStyle = 'rgba(0,255,255,0.5)'
    ctx.strokeRect mpx - selectOffset.tx*size, mpy - selectOffset.ty*size, selection.tw*size, selection.th*size
    ctx.globalAlpha = 1
  else if mpx?
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
    uictx.setShadow? 1, 1, 2.5, 'black'

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

    uictx.clearShadow?()
    uictx.textBaseline = 'middle'
    uictx.setShadow? 0, 0, 4, '#222'
    uictx.fillStyle = '#eee'
    uictx.fillText text, 35, y
    y += 25


UIBOXSIZE = 80
UIBORDER = 13

uiboxes = []

do calcUIBoxes = ->
  boxes = ['move', 'nothing', 'solid', 'positive', 'negative', 'shuttle', 'thinshuttle', 'thinsolid', 'bridge']

  x = canvas.width / 2 - (boxes.length / 2) * UIBOXSIZE
  y = canvas.height - 100
  uiboxes.length = 0
  for mat, i in boxes
    uiboxes.push {x, y, mat}
    x += UIBOXSIZE

drawUIBoxes = ->
  uictx = uiCanvas.getContext '2d'
  uictx.clearRect 0, 0, uiCanvas.width, uiCanvas.height
  uictx.fillStyle = 'rgba(200,200,200,0.9)'

  uictx.font = 'bold 14px Arial'
  for {x, y, mat}, i in uiboxes
    color = colors[mat] ? 'yellow'

    uictx.clearShadow?()
    uictx.fillStyle = if (placing ? 'solid') is mat
      'rgba(200,200,200,0.9)'
    else
      'rgba(120,120,120,0.9)'

    uictx.fillRect x, y, UIBOXSIZE, UIBOXSIZE

    uictx.setShadow? 1, 1, 2.5, 'black'

    uictx.fillStyle = color
    uictx.fillRect x+UIBORDER, y+UIBORDER, UIBOXSIZE-2*UIBORDER, UIBOXSIZE-2*UIBORDER

    text = mat
    #width = uictx.measureText(text).width
    uictx.textAlign = 'center'
    uictx.textBaseline = 'middle'

    if mat is 'nothing'
      uictx.clearShadow?()
    else
      uictx.setShadow? 0, 0, 4, '#222'

    uictx.fillStyle = if mat is 'nothing'
      '#888'
    else
      '#eee'
    #uictx.fillText "#{i}", x + UIBOXSIZE/2, y + UIBOXSIZE/2 - 15
    uictx.fillText mat, x + UIBOXSIZE/2, y + UIBOXSIZE/2



window.addEventListener 'copy', (e) ->
  if selection
    console.log e.clipboardData.setData 'text', JSON.stringify selection
  e.preventDefault()

window.addEventListener 'paste', (e) ->
  data = e.clipboardData.getData 'text'
  if data
    try
      selection = JSON.parse data
      selectOffset = {tx:0, ty:0}


# IOS

selectMat = ->
  for {x, y, mat} in uiboxes
    if x <= mouse.x < x + UIBOXSIZE and y <= mouse.y < y + UIBOXSIZE
      placing = if mat is 'solid' then null else mat
      #mouse.mode = if mat is 'move' then null else 'paint'
      return yes

  no


setMouse = (e) ->
  mouse.x = e.pageX
  mouse.y = e.pageY
  {tx:mouse.tx, ty:mouse.ty} = screenToWorld mouse.x, mouse.y

selectingBox = no

window.ontouchstart = (e) ->
  setMouse e
  mouse.from = {x: mouse.x, y: mouse.y, tx: mouse.tx, ty: mouse.ty}


  if selectMat()
    selectingBox = yes
  else if mouse.mode is 'paint'
    paint()

  if placing is 'move'
    mouse.mode = 'move'
  else
    mouse.mode = 'paint'
  draw()
  e.preventDefault()

window.ontouchend = (e) ->
  selectingBox = no
  e.preventDefault()
  mouse.x = mouse.y = mouse.tx = mouse.ty = null
  draw()

window.ontouchmove = (e) ->
  # Don't make the UI bounce around
  e.preventDefault()

  mouse.from = {x: mouse.x, y: mouse.y, tx: mouse.tx, ty: mouse.ty}
  setMouse e
  #mouse.from.x ?= mouse.x
  #mouse.from.y ?= mouse.y

  if selectingBox
    selectMat()
    draw()
  else
    switch mouse.mode
      when 'paint' then paint()
      when 'select' then selectedB = screenToWorld mouse.x, mouse.y # inaccessable
      when 'move'
        scroll_x -= (mouse.x - mouse.from.x) / size if mouse.from.x?
        scroll_y -= (mouse.y - mouse.from.y) / size if mouse.from.y?
    draw()

# The size when the pinch gesture started
basesize = 0
window.ongesturestart = (e) ->
  basesize = size

window.ongesturechange = (e) ->
  return if selectingBox
  oldsize = size

  size = e.scale * basesize

  scroll_x += e.pageX / oldsize - e.pageX / size
  scroll_y += e.pageY / oldsize - e.pageY / size


