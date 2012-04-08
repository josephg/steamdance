canvas = document.getElementsByTagName('canvas')[0]
canvas.width = 800
canvas.height = 600

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

draw = ->
  ctx.fillStyle = 'black'
  ctx.fillRect 0, 0, canvas.width, canvas.height
  for k,v of grid
    [x,y] = k.split /,/
    x = parseInt x
    y = parseInt y
    if scroll_x - size <= x < scroll_x + Math.floor(canvas.width/size) and
       scroll_y - size <= y < scroll_y + Math.floor(canvas.height/size)
      ctx.fillStyle = colors[v]
      px = Math.floor(size * (x - scroll_x))
      py = Math.floor(size * (y - scroll_y))

      ctx.fillRect px, py, size, size
      if (p = pressure[k]) and p != 0
        ctx.fillStyle = if p < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.2)'
        ctx.fillRect px, py, size, size

  mx = mouse.x
  my = mouse.y
  tx = Math.floor mx / size + scroll_x
  ty = Math.floor my / size + scroll_y

  mtx = tx - scroll_x
  mty = ty - scroll_y

  px = Math.floor(mtx * size)
  py = Math.floor(mty * size)

  ctx.fillStyle = colors[placing ? 'solid']
  ctx.fillRect px + size/4, py + size/4, size/2, size/2

  ctx.strokeStyle = if grid[[mtx,mty]] then 'black' else 'white'
  ctx.strokeRect px + 1, py + 1, size - 2, size - 2

  return
