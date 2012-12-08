canvas = document.getElementsByTagName('canvas')[0]

window.onresize = ->
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  draw?()
window.onresize()
ctx = canvas.getContext '2d'

CELL_SIZE = 20
zoom_level = 1
size = CELL_SIZE * zoom_level

grid = {}
pressure = {}
ws = new WebSocket 'ws://' + window.location.host
ws.onerror = (err) ->
  console.err err
ws.onmessage = (msg) ->
  msg = JSON.parse msg.data
  if msg.delta
    for k,v of msg.delta
      if v?
        grid[k] = v
      else
        delete grid[k]
    s = new Simulator grid
    pressure = s.getPressure()
    draw()

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
  thinshuttle: 'rgb(255,0,255)'
  shuttle: 'rgb(128,0,128)'
  negative: 'red'
  positive: 'rgb(0,255,0)'
  thinsolid: 'rgb(128,128,128)'

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
    # 1-7
    49: 'nothing'
    50: 'solid'
    51: 'positive'
    52: 'negative'
    53: 'shuttle'
    54: 'thinshuttle'
    55: 'thinsolid'

    80: 'positive' # p
    78: 'negative' # n
    83: 'shuttle' # s
    65: 'thinshuttle' # a
    69: 'nothing' # e
    66: 'thinsolid' # b
    68: 'solid' # d
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
canvas.onmousemove = (e) ->
  mouse.x = e.pageX - e.target.offsetLeft
  mouse.y = e.pageY - e.target.offsetTop
  switch mouse.mode
    when 'paint' then paint()
    when 'select' then selectedB = screenToWorld mouse.x, mouse.y
  draw()
canvas.onmousedown = (e) ->
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
canvas.onmouseup = ->
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

draw = ->
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
