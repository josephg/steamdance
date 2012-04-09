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
ws.onmessage = (msg) ->
  msg = JSON.parse msg.data
  if msg.delta
    #console.log msg.delta
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

colors =
  solid: 'black'
  nothing: 'white'
  thinshuttle: 'rgb(255,0,255)'
  shuttle: 'rgb(128,0,128)'
  negative: 'red'
  positive: 'rgb(0,255,0)'
  thinsolid: 'rgb(128,128,128)'

placing = 'nothing'
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

mouse = {x:0,y:0, down:false}
window.onblur = -> mouse.down = false
canvas.onmousemove = (e) ->
  mouse.x = e.pageX - e.target.offsetLeft
  mouse.y = e.pageY - e.target.offsetTop
  if mouse.down
    paint()
  draw()

window.onmousewheel = (e) ->
  #console.log "mouse scroll", e
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
  mx = mouse.x
  my = mouse.y
  tx = Math.floor mx / size + scroll_x
  ty = Math.floor my / size + scroll_y

  #tx = stx + scroll_x
  #ty = sty + scroll_y
  delta = {}
  delta[[tx,ty]] = placing
  ws.send JSON.stringify {delta}
  if placing?
    grid[[tx,ty]] = placing
  else
    delete grid[[tx,ty]]

canvas.onmousedown = ->
  mouse.down = true
  paint()
  draw()
canvas.onmouseup = ->
  mouse.down = false

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
  pw: size
  ph: size

draw = ->
  ctx.fillStyle = 'black'
  ctx.fillRect 0, 0, canvas.width, canvas.height
  for k,v of grid
    [tx,ty] = k.split /,/
    tx = parseInt tx
    ty = parseInt ty
    {px, py, pw, ph} = worldToScreen tx, ty
    if px+pw >= 0 and px < canvas.width and py+ph >= 0 and py < canvas.height
      ctx.fillStyle = colors[v]

      ctx.fillRect px, py, pw, ph
      if (p = pressure[k]) and p != 0
        ctx.fillStyle = if p < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.2)'
        ctx.fillRect px, py, pw, ph

  mx = mouse.x
  my = mouse.y
  {tx, ty} = screenToWorld mx, my
  {px, py, pw, ph} = worldToScreen tx, ty

  ctx.fillStyle = colors[placing ? 'solid']
  ctx.fillRect px + pw/4, py + ph/4, pw/2, ph/2

  ctx.strokeStyle = if grid[[tx,ty]] then 'black' else 'white'
  ctx.strokeRect px + 1, py + 1, pw - 2, ph - 2

  return
