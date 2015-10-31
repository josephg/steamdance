{Jit, Map2, Map3, Set2, Set3, util, Watcher} = require 'boilerplate-jit'
{WebGLContext} = require './gl'

UP=0; RIGHT=1; DOWN=2; LEFT=3
{DIRS} = util

KEY =
  up: 1
  right: 2
  down: 4
  left: 8


# We have some additional modules to chain to the jit.

BlobBounds = (blobFiller) ->
  # This calculates the bounds of all shuttles and engines.

  blobFiller.addWatch.on (blob) ->
    # I'm lazy. I'll just dump it on the blob itself.
    left = top = 1<<30
    right = bottom = -1<<30

    {points, edges} = blob
    (if points.size < edges.size then points else edges).forEach (x, y) ->
      left = x if x < left
      top = y if y < top
      right = x if x > right
      bottom = y if y > bottom

    blob.bounds = {left, top, right, bottom}


PrevState = (stepWatch, shuttles, currentStates) ->
  # Here we store enough information to know what the state of every shuttle
  # was before the most recent call to step().

  # I'd use a WeakMap here but apparently in chrome weakmaps don't support .clear().
  prevState = new Map

  shuttles.deleteWatch.on (shuttle) -> prevState.delete shuttle

  currentStates.watch.on (shuttle, prev) ->
    return unless prev # This will fire when the shuttle is first created.
    prevState.set shuttle, prev

  stepWatch.on (time) ->
    return unless time is 'before'
    prevState.clear()

  get: (shuttle) -> prevState.get shuttle

addModules = (jit) ->
  {stepWatch, shuttles, engines, currentStates} = jit.modules

  BlobBounds shuttles
  BlobBounds engines

  prevState = PrevState stepWatch, shuttles, currentStates


  jit.modules.prevState = prevState



# t=0 -> x, t=1 -> y
lerp = (t, x, y) -> (1 - t)*x + t*y
module.exports = class Boilerplate
  fill = (initial_square, f) ->
    visited = {}
    visited["#{initial_square.x},#{initial_square.y}"] = true
    to_explore = [initial_square]
    hmm = (x,y) ->
      k = "#{x},#{y}"
      if not visited[k]
        visited[k] = true
        to_explore.push {x,y}
    while n = to_explore.shift()
      ok = f n.x, n.y, hmm
      if ok
        hmm n.x+1, n.y
        hmm n.x-1, n.y
        hmm n.x, n.y+1
        hmm n.x, n.y-1
    return

  @colors =
    bridge: 'hsl(208, 78%, 47%)'
    # bridge: 'hsl(216, 92%, 33%)'
    # thinbridge: 'hsl(203, 67%, 51%)'
    negative: 'hsl(16, 68%, 50%)'
    nothing: 'hsl(0, 0%, 100%)'
    positive: 'hsl(120, 52%, 58%)'
    shuttle: 'hsl(283, 65%, 45%)'
    solid: 'hsl(184, 49%, 7%)'
    thinshuttle: 'hsl(283, 89%, 75%)'
    thinsolid: 'hsl(0, 0%, 71%)'

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

  enclosingRect = (a, b) ->
    tx: Math.min a.tx, b.tx
    ty: Math.min a.ty, b.ty
    tw: Math.abs(b.tx-a.tx) + 1
    th: Math.abs(b.ty-a.ty) + 1

  clamp = (x, min, max) -> Math.max(Math.min(x, max), min)

  changeTool: (newTool) ->
    @activeTool = if newTool is 'solid' then null else newTool
    @onToolChanged? @activeTool
    @updateCursor()

  addKeyListener: (el) ->
    el.addEventListener 'keydown', (e) =>
      kc = e.keyCode

      newTool = ({
        # 1-9
        49: 'nothing'
        50: 'thinsolid'
        51: 'solid'
        52: 'positive'
        53: 'negative'
        54: 'shuttle'
        55: 'thinshuttle'
        56: 'bridge'
        # 57: 'thinbridge'

        80: 'positive' # p
        78: 'negative' # n
        83: 'shuttle' # s
        65: 'thinshuttle' # a
        69: 'nothing' # e
        71: 'thinsolid' # g
        68: 'solid' # d
        66: 'bridge' # b
        # 84: 'thinbridge' # t
      })[kc]
      if newTool
        @selection = @selectOffset = null
        @changeTool newTool

      if 37 <= e.keyCode <= 40
        @lastKeyScroll = Date.now()

      switch kc
        when 37 # left
          @keysPressed |= KEY.left
        when 39 # right
          @keysPressed |= KEY.right
        when 38 # up
          @keysPressed |= KEY.up
        when 40 # down
          @keysPressed |= KEY.down

        when 16 # shift
          @imminentSelect = true
        when 27,192 # esc
          if @selection
            @selection = @selectOffset = null
          else
            @changeTool 'move'

        when 88 # x
          @flip 'x' if @selection
        when 89 # y
          @flip 'y' if @selection
        when 77 # m
          @mirror() if @selection

      @draw()

    el.addEventListener 'keyup', (e) =>
      if 37 <= e.keyCode <= 40
        @lastKeyScroll = Date.now()

      switch e.keyCode
        when 16 # shift
          @imminentSelect = false
          @draw()

        when 37 # left
          @keysPressed &= ~KEY.left
        when 39 # right
          @keysPressed &= ~KEY.right
        when 38 # up
          @keysPressed &= ~KEY.up
        when 40 # down
          @keysPressed &= ~KEY.down


    el.addEventListener 'blur', =>
      @mouse.mode = null
      @imminentSelect = false
      @draw()

    el.addEventListener 'copy', (e) => @copy(e)
    el.addEventListener 'paste', (e) => @paste(e)



  # ----- Utility methods for panning around the screen

  # given pixel x,y returns tile x,y
  screenToWorld: (px, py) ->
    return {tx:null, ty:null} unless px?
    # first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
    px += Math.floor(@scrollX * @size)
    py += Math.floor(@scrollY * @size)
    # now we can simply divide and floor to find the tile
    tx = Math.floor(px / @size)
    ty = Math.floor(py / @size)
    {tx,ty}

  # Same as screenToWorld, but also returns which cell in the result.
  screenToWorldCell: (px, py) ->
    return {tx:null, ty:null} unless px?
    # This logic is adapted from screenToWorld above.
    px += Math.floor(@scrollX * @size)
    py += Math.floor(@scrollY * @size)
    tx_ = px / @size; ty_ = py / @size
    tx = Math.floor(tx_); ty = Math.floor(ty_)

    # There's no cell for solid (null) cells.
    v = @parsed.grid.get tx, ty
    return {tx, ty, cell:null} unless v

    offX = tx_ - tx; offY = ty_ - ty

    upRight = offX > offY
    downRight = offX + offY > 1
    tc = switch v
      when 'bridge'
        # The only cells are UP and RIGHT.
        if upRight != downRight then UP else RIGHT
      when 'negative', 'positive'
        if upRight
          if downRight then RIGHT else UP
        else
          if downRight then DOWN else LEFT
      else
        0

    return {tx, ty, tc}

  # given tile x,y returns the pixel x,y,w,h at which the tile resides on the screen.
  worldToScreen: (tx, ty) ->
    return {px:null, py:null} unless tx?
    px: tx * @size - Math.floor(@scrollX * @size)
    py: ty * @size - Math.floor(@scrollY * @size)

  zoomBy: (diff) ->
    @zoomLevel += diff
    @zoomLevel = clamp @zoomLevel, 1/20, 5
    @size = Math.floor 20 * @zoomLevel

  set: (x, y, v) ->
    if @parsed.set x, y, v
      @onEdit? x, y, v
      return yes
    else
      return no

  resetView: (options) ->
    @zoomLevel = 1
    @zoomBy 0
    # In tile coordinates
    @scrollX = options?.initialX || 0
    @scrollY = options?.initialY || 0

  setJSONGrid: (json) ->
    @parsed = Jit json
    addModules @parsed
    @draw()

  getJSONGrid: -> @parsed.toJSON()

  constructor: (@el, options) ->
    @keysPressed = 0 # bitmask. up=1, right=2, down=4, left=8
    @lastKeyScroll = 0 # epoch time

    @activeTool = 'move'

    @setJSONGrid options.grid

    @resetView options

    @canScroll = options.canScroll ? true

    @animTime = options.animTime || 0

    @useWebGL = options.useWebGL || false

    #@el = document.createElement 'div'
    #@el.className = 'boilerplate'
    @el.tabIndex = 0 if @el.tabIndex is -1 # allow keyboard events
    @canvas = @el.appendChild document.createElement 'canvas'
    @canvas.className = 'draw'

    @el.boilerplate = this

    if @useWebGL
      @ctx = new WebGLContext @canvas
      console.log "using webgl"
    else
      console.log "using canvas"

    #@canvas.width = el.offsetWidth
    #@canvas.height = el.offsetHeight
    @resizeTo @el.offsetWidth, @el.offsetHeight


    #@el.onresize = -> console.log 'yo'

    @mouse = {x:null,y:null, mode:null}
    #@placing = 'nothing'
    @imminentSelect = false
    @selectedA = @selectedB = null
    @selectOffset = null
    @selection = null

    @draw()


    # ----- Event handlers

    updateMousePos = (e) =>
      @mouse.from = {tx: @mouse.tx, ty: @mouse.ty}
      @mouse.x = clamp e.offsetX ? e.layerX, 0, @el.offsetWidth - 1
      @mouse.y = clamp e.offsetY ? e.layerY, 0, @el.offsetHeight - 1
      {tx, ty, tc} = @screenToWorldCell @mouse.x, @mouse.y

      if tx != @mouse.tx || ty != @mouse.ty || tc != @mouse.tc
        @mouse.tx = tx; @mouse.ty = ty; @mouse.tc = tc
        return yes
      else
        return no

    @el.onmousemove = (e) =>
      @imminentSelect = !!e.shiftKey
      # If the mouse is released / pressed while not in the box, handle that correctly

      @el.onmousedown e if e.button && !@mouse.mode

      if updateMousePos e
        #if @mouse.mode is 'paint' and e.shiftKey
        #  switch @mouse.direction
        #    when 'x' then {ty} = @mouse
        #    when 'y' then {tx} = @mouse
        #    when null
        #      @mouse.direction = if tx != @mouse.tx then 'x' else 'y'


        switch @mouse.mode
          when 'paint' then @paint()
          when 'select' then @selectedB = @screenToWorld @mouse.x, @mouse.y

        @dragShuttleTo @mouse.tx, @mouse.ty if @draggedShuttle?

        @draw()
      @updateCursor()

    @el.onmousedown = (e) =>
      updateMousePos e

      if e.shiftKey
        @mouse.mode = 'select'
        @selection = @selectOffset = null
        @selectedA = @screenToWorld @mouse.x, @mouse.y
        @selectedB = @selectedA
      else if @selection
        @stamp()
      else
        if @activeTool is 'move'
          if (shuttle = @parsed.modules.shuttleGrid.getShuttle @mouse.tx, @mouse.ty)
            # Grab that sucker!
            #console.log shuttle

            {dx, dy} = shuttle.currentState
            @draggedShuttle =
              shuttle: shuttle
              heldPoint: {x:@mouse.tx - dx, y:@mouse.ty - dy}
            shuttle.held = true

            #console.log @draggedShuttle
        else
          @mouse.mode = 'paint'
          @mouse.from = {tx:@mouse.tx, ty:@mouse.ty}
          @mouse.direction = null
          @paint()
      @updateCursor()
      @draw()

    @el.onmouseup = =>
      if @draggedShuttle
        @draggedShuttle.shuttle.held = false
        @draggedShuttle = null


      #@compile() if @needsCompile

      if @mouse.mode is 'select'
        @selection = @copySubgrid enclosingRect @selectedA, @selectedB
        @selectOffset =
          tx:@selectedB.tx - Math.min @selectedA.tx, @selectedB.tx
          ty:@selectedB.ty - Math.min @selectedA.ty, @selectedB.ty

      @mouse.mode = null
      @mouse.direction = null
      @imminentSelect = false
      @updateCursor()
      @draw()
      @onEditFinish?()

    @el.onmouseout = (e) =>
      # Pretend the mouse just went up at the edge of the boilerplate instance then went away.
      @el.onmousemove e
      @mouse.x = @mouse.y = @mouse.from = @mouse.tx = @mouse.ty = null
      # ... But if we're drawing, stay in drawing mode.
      @mouse.mode = null# if @mouse.mode is 'select'
      @draw()

    @el.onmouseenter = (e) =>
      if e.button
        @el.onmousemove e
        @el.onmousedown e

    @el.onwheel = (e) =>
      #console.log e.wheelDeltaX, e.deltaX, e.deltaMode
      return unless @canScroll
      updateMousePos e
      if e.shiftKey
        oldsize = @size
        @zoomBy -e.deltaY / 400

        @scrollX += @mouse.x / oldsize - @mouse.x / @size
        @scrollY += @mouse.y / oldsize - @mouse.y / @size
      else
        @scrollX += e.deltaX / @size
        @scrollY += e.deltaY / @size
      {tx:@mouse.tx, ty:@mouse.ty} = @screenToWorld @mouse.x, @mouse.y
      e.preventDefault()
      @updateCursor()
      @draw()

  updateCursor: ->
    @canvas.style.cursor =
      if @activeTool is 'move' and !@imminentSelect
        if @draggedShuttle
          '-webkit-grabbing'
        else if @parsed.modules.shuttleGrid.getShuttle @mouse.tx, @mouse.ty
          '-webkit-grab'
        else
          'default'
      else
        switch @mouse.direction
          when 'x'
            'ew-resize'
          when 'y'
            'ns-resize'
          else
            'crosshair'

  resizeTo: (width, height) ->
    #console.log "resized to #{width}x#{height}"

    if @useWebGL
      @canvas.width = width
      @canvas.height = height
      @ctx.resizeTo width, height
    else
      @canvas.width = width * devicePixelRatio
      @canvas.height = height * devicePixelRatio
      @canvas.style.width = width + 'px'
      @canvas.style.height = height + 'px'
      @ctx = @canvas.getContext '2d'
      @ctx.scale devicePixelRatio, devicePixelRatio

    @draw()

  paint: ->
    throw 'Invalid placing' if @activeTool is 'move'
    {tx, ty} = @mouse
    {tx:fromtx, ty:fromty} = @mouse.from
    fromtx ?= tx
    fromty ?= ty

    line fromtx, fromty, tx, ty, (x, y) =>
      #@simulator.set x, y, @activeTool
      # @activeTool is null for solid.
      @set x, y, @activeTool
    @draw()

  step: ->
    @parsed.step()
    @lastStepAt = Date.now()
    # Preferably, only redraw if step did something.
    @draw()
    @updateCursor()

  moveShuttle: (sid, from, to) ->
    throw Error 'blerk'
    moveShuttle @compiled.grid, @compiled.ast.shuttles, sid, from, to

  dragShuttleTo: (tx, ty) ->
    return unless @draggedShuttle?

    {shuttle, heldPoint} = @draggedShuttle

    # This is a bit awkward - we don't generate all states.
    wantedDx = tx - heldPoint.x
    wantedDy = ty - heldPoint.y

    states = @parsed.modules.shuttleStates.get shuttle

    # First find the closest existing state to the mouse.
    minDist = null
    bestState = null

    dist2 = (dx, dy) -> dx*dx+dy*dy

    states.forEach (dx, dy, state) ->
      if state.valid
        d = dist2 wantedDx-dx, wantedDy-dy
        if !bestState or d < minDist
          bestState = state
          minDist = d

    # Ok, we've found the *closest* state. Lets see if we can do better by
    # making some more states until we get there. We'll do a dumb beam search
    getStateNear = @parsed.modules.shuttleStates.getStateNear.bind(@parsed.modules.shuttleStates)
    while (bestState.dx != wantedDx || bestState.dy != wantedDy)
      next = null
      distX = wantedDx - bestState.dx
      distY = wantedDy - bestState.dy
      if distX < 0 then next = getStateNear bestState, LEFT
      if !next && distX > 0 then next = getStateNear bestState, RIGHT
      if !next && distY < 0 then next = getStateNear bestState, UP
      if !next && distY > 0 then next = getStateNear bestState, DOWN

      if next
        bestState = next
      else
        break

    if shuttle.currentState != bestState
      @parsed.moveShuttle shuttle, bestState
      @draw()

  #########################
  # SELECTION             #
  #########################
  copySubgrid: (rect) ->
    {tx, ty, tw, th} = rect
    subgrid =
      tw: tw
      th: th
      base: new Map2
      shuttles: new Map2

    for y in [ty...ty+th]
      for x in [tx...tx+tw]
        if v = @parsed.grid.get x, y
          subgrid.base.set x-tx, y-ty, v
        if v = @parsed.modules.shuttleGrid.getValue x, y
          subgrid.shuttles.set x-tx, y-ty, v

    #console.log subgrid
    subgrid

  flip: (dir) ->
    return unless @selection

    newSelection =
      tw: tw = @selection.tw
      th: th = @selection.th
      base: new Map2
      shuttles: new Map2

    copyTo = (dest) -> (x, y, v) ->
      x_ = if dir is 'x' then tw-1 - x else x
      y_ = if dir is 'y' then th-1 - y else y
      dest.set x_, y_, v
    @selection.base.forEach copyTo newSelection.base
    @selection.shuttles.forEach copyTo newSelection.shuttles

    @selection = newSelection

  mirror: ->
    return unless @selection

    newSelection =
      tw: @selection.th # Swapped! So tricky.
      th: @selection.tw
      base: new Map2
      shuttles: new Map2

    copyTo = (dest) -> (x, y, v) -> dest.set y, x, v
    @selection.base.forEach copyTo newSelection.base
    @selection.shuttles.forEach copyTo newSelection.shuttles
    @selection = newSelection

  stamp: ->
    throw new Error 'tried to stamp without a selection' unless @selection
    {tx:mtx, ty:mty} = @screenToWorld @mouse.x, @mouse.y
    mtx -= @selectOffset.tx
    mty -= @selectOffset.ty

    changed = no
    # We need to set all values, even the nulls.
    for y in [0...@selection.th]
      for x in [0...@selection.tw]
        changed = true if @set mtx+x, mty+y, @selection.base.get x, y

        shuttleV = @selection.shuttles.get x, y
        changed = true if @set mtx+x, mty+y, shuttleV if shuttleV

    @draw() if changed

  copy: (e) ->
    #console.log 'copy'
    if @selection
      json = {tw:@selection.tw, th:@selection.th, base:{}, shuttles:{}}
      @selection.base.forEach (x, y, v) -> json.base["#{x},#{y}"] = v if v?
      @selection.shuttles.forEach (x, y, v) -> json.shuttles["#{x},#{y}"] = v if v?

      e.clipboardData.setData 'text', JSON.stringify json
      #console.log JSON.stringify json
    e.preventDefault()

  paste: (e) ->
    #console.log 'paste'
    data = e.clipboardData.getData 'text'
    if data
      try
        json = JSON.parse data
        @selection =
          base: new Map2
          shuttles: new Map2

        tw = json.tw or 0
        th = json.th or 0
        if json.base
          # New style
          for k, v of json.base
            {x,y} = util.parseXY k
            tw = x+1 if x >= tw
            th = y+1 if y >= th
            @selection.base.set x, y, v
          for k, v of json.shuttles
            {x,y} = util.parseXY k
            @selection.shuttles.set x, y, v
        else
          # Old style
          for k, v of json when k not in ['tw', 'th']
            {x,y} = util.parseXY k
            tw = x+1 if x >= tw
            th = y+1 if y >= th
            if v in ['shuttle', 'thinshuttle']
              @selection.base.set x, y, 'nothing'
              @selection.shuttles.set x, y, v
            else
              @selection.base.set x, y, v

        @selection.tw = tw; @selection.th = th
        @selectOffset = {tx:0, ty:0}


  #########################
  # DRAWING               #
  #########################

  draw: ->
    return if @needsDraw
    @needsDraw = true
    requestAnimationFrame =>
      @needsDraw = false

      # This is a weird place to do keyboard scrolling, but if we do it in
      # step() it'll only happen once every few hundred ms.
      if @keysPressed && @canScroll
        #console.log @keysPressed
        now = Date.now()
        amt = 0.5 * Math.min now - @lastKeyScroll, 300

        @scrollY -= amt/@size if @keysPressed & KEY.up
        @scrollX += amt/@size if @keysPressed & KEY.right
        @scrollY += amt/@size if @keysPressed & KEY.down
        @scrollX -= amt/@size if @keysPressed & KEY.left

        @lastKeyScroll = now

      @drawFrame()

      @draw() if @keysPressed

  drawFrame: ->
    @ctx.fillStyle = Boilerplate.colors['solid']
    @ctx.fillRect 0, 0, @canvas.width, @canvas.height

    @drawGrid()

    @drawOverlay()

    @ctx.flush?()

  drawCells: (points, offset, override) ->
    # Helper to draw blocky cells
    if typeof offset in ['function', 'string']
      [offset, override] = [{dx:0, dy:0}, offset]

    {dx, dy} = offset
    points.forEach (tx, ty, v) =>
      {px, py} = @worldToScreen tx+dx, ty+dy
      return unless px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
      if typeof override is 'function'
        return unless (style = override tx, ty, v)
        @ctx.fillStyle = style
      else if override
        @ctx.fillStyle = override
      else
        @ctx.fillStyle = Boilerplate.colors[v] || 'red'

      @ctx.fillRect px, py, @size, @size

  # Draw a path around the specified blob edge. The edge should be a Set3 of (x,y,dir).
  pathAroundEdge: (edge, border, pos) ->
    if pos
      {sx, sy} = pos
    else
      sx = sy = 0

    # Ok, now for the actual shuttles themselves
    lineTo = (x, y, dir, em, first) =>
      #console.log 'lineTo', x, y, dir, extendMult
      # Move to the right of the edge.
      ex = if dir in [UP, RIGHT] then x+1 else x
      ey = if dir in [RIGHT, DOWN] then y+1 else y
      ex += sx; ey += sy # transform by shuttle state x,y

      {px, py} = @worldToScreen ex, ey

      {dx, dy} = DIRS[dir]
      # Come in from the edge
      px += border * (-dx - dy*em)
      py += border * (-dy + dx*em)

      if first
        @ctx.moveTo px, py
      else
        @ctx.lineTo px, py

      #@ctx.lineTo (ex-@scrollX)*@size, (ey-@scrollY)*@size

    visited = new Set3
    @ctx.beginPath()
    # I can't simply draw from the first edge because the shuttle might have
    # holes (and hence multiple continuous edges).
    edge.forEach (x, y, dir) =>
      # Using pushEdges because I want to draw the outline around just the
      # solid shuttle cells.
      return if visited.has x, y, dir

      first = true # For the first point we need to call moveTo() not lineTo().
      while !visited.has x, y, dir
        visited.add x, y, dir

        # Follow the edge around
        {dx, dy} = DIRS[dir]
        if edge.has(x2=x+dx-dy, y2=y+dy+dx, dir2=(dir+3)%4) and # Up-right
            !edge.has(x, y, (dir+1)%4) # fix pincy corners
          #shuttle.points.get(x-dy, y+dx) is 'shuttle' # fix pincy corners
          # Curves in _|
          lineTo x, y, dir, 1, first
          x = x2; y = y2; dir = dir2
          first = no
        else if edge.has (x2=x-dy), (y2=y+dx), dir
          # straight __
          #lineTo x, y, dir, 1, first
          x = x2; y = y2
        else
          # curves down ^|
          # We could check for it, but there's no point.
          lineTo x, y, dir, -1, first
          dir = (dir+1) % 4

          first = no

      # End the path.
      @ctx.closePath()




  drawShuttle: (shuttle, t, isHovered) ->
    # First get bounds - we might not even be able to display the shuttle.
    if (prevState = @parsed.modules.prevState.get shuttle)
      sx = lerp t, prevState.dx, shuttle.currentState.dx
      sy = lerp t, prevState.dy, shuttle.currentState.dy
    else
      {dx:sx, dy:sy} = shuttle.currentState

    bounds = shuttle.bounds
    topLeft = @worldToScreen bounds.left+sx, bounds.top+sy
    botRight = @worldToScreen bounds.right+sx+1, bounds.bottom+sy+1
    return no if topLeft.px > @canvas.width or
      topLeft.py > @canvas.height or
      botRight.px < 0 or
      botRight.py < 0

    border = if @size < 5 then 0 else (@size * 0.04+1)|0

    # Thinshuttles first.
    @ctx.strokeStyle = if isHovered
      'hsl(283, 89%, 65%)'
    else
      Boilerplate.colors.thinshuttle
    size2 = (@size/2)|0
    size4 = (@size/4)|0
    @ctx.lineWidth = size4 * 2 # An even number.
    shuttle.points.forEach (x, y, v) =>
      return if v is 'shuttle'

      # base x, y of the tile
      {px, py} = @worldToScreen x+sx, y+sy
      px += size2; py += size2

      numLines = 0
      for {dx,dy} in DIRS when shuttle.points.has x+dx, y+dy
        # Draw a little line from here to there.
        @ctx.beginPath()
        @ctx.moveTo px - size4*dx, py - size4*dy
        @ctx.lineTo px + (@size+size4) * dx, py + (@size+size4) * dy
        @ctx.stroke()
        numLines++

      if numLines is 0
        # Erk, the shuttle would be invisible. I'll draw a sympathy square.
        {px, py} = @worldToScreen x+sx, y+sy
        @ctx.fillStyle = Boilerplate.colors.thinshuttle
        @ctx.fillRect px + size4, py + size4, size2, size2

    @pathAroundEdge shuttle.pushEdges, border, {sx, sy}
    @ctx.fillStyle = Boilerplate.colors.shuttle
    @ctx.fill()

    if isHovered
      @pathAroundEdge shuttle.pushEdges, border*2, {sx, sy}
      @ctx.lineWidth = border*4
      @ctx.strokeStyle = 'hsla(283, 65%, 25%, 0.5)'
      @ctx.stroke()

    return yes

  drawEngine: (engine, t) ->
    @pathAroundEdge engine.edges, 2

    @ctx.strokeStyle = if engine.type is 'positive'
      'hsl(120, 52%, 26%)'
    else
      'hsl(16, 68%, 20%)'

    @ctx.lineWidth = 4
    @ctx.stroke()

    #@ctx.fillStyle = Boilerplate.colors[engine.type]
    #@ctx.fill()

  drawGrid: ->
    # Will we need to redraw again soon?
    needsRedraw = no

    # For animating shuttle motion
    t = if @animTime && @lastStepAt
      now = Date.now()
      exact = Math.min 1, (now - @lastStepAt) / @animTime

      ((exact * @size)|0) / @size
    else
      1

    # Mouse position
    mx = @mouse.x; my = @mouse.y
    {tx:mtx, ty:mty, tc:mtc} = @screenToWorldCell mx, my

    hover = {}
    if @activeTool is 'move' and !@selection and !@imminentSelect
      v = @parsed.grid.get mtx, mty
      # What is the mouse hovering over?
      hover.shuttle = @parsed.modules.shuttleGrid.getShuttle mtx, mty
      hover.engine = @parsed.modules.engineGrid.get mtx, mty
      hover.group = v and @parsed.modules.groups.get mtx, mty, mtc
      hover.zone = if hover.group then @parsed.modules.zones.getZoneForGroup hover.group

    #console.log hover if hover


    # Draw the grid
    @drawCells @parsed.grid, (tx, ty, v) ->
      #return if v in ['positive', 'negative']
      Boilerplate.colors[v] || 'red'

    # Draw the engines
    #@parsed.modules.engines.forEach (engine) =>
    #  @drawEngine engine, t

    @drawEngine hover.engine, t if hover.engine

    # Draw pressure
    @drawCells @parsed.grid, (tx, ty, v) =>
      if v in ['nothing', 'thinsolid', 'thinshuttle']
        group = @parsed.modules.groups.get tx, ty, 0
        zone = @parsed.modules.zones.getZoneForGroup(group) if group
        if zone?.pressure
          return if zone?.pressure < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.15)'
        else
          return null

    # Draw the shuttles
    @parsed.modules.shuttles.forEach (shuttle) =>
      needsRedraw = true if @drawShuttle shuttle, t, hover.shuttle == shuttle

    @drawCells hover.group.points, 'rgba(100,100,100,0.3)' if hover.group and !hover.engine and !hover.shuttle



    @draw() if t != 1 and needsRedraw
    return

  drawOverlay: ->
    mx = @mouse.x
    my = @mouse.y
    {tx:mtx, ty:mty} = @screenToWorld mx, my
    {px:mpx, py:mpy} = @worldToScreen mtx, mty

    if @mouse.mode is 'select'
      sa = @selectedA
      sb = @selectedB
    else if @imminentSelect
      sa = sb = {tx:mtx, ty:mty}

    @ctx.lineWidth = 1

    # Draw the mouse hover state
    if @mouse.tx != null
      if sa
        # The user is dragging out a selection rectangle
        {tx, ty, tw, th} = enclosingRect sa, sb
        {px, py} = @worldToScreen tx, ty
        @ctx.fillStyle = 'rgba(0,0,255,0.5)'
        @ctx.fillRect px, py, tw*@size, th*@size

        @ctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @ctx.strokeRect px, py, tw*@size, th*@size
      else if @selection # mouse.tx is null when the mouse isn't in the div
        # The user is holding a selection stamp
        @ctx.globalAlpha = 0.8
        for y in [0...@selection.th]
          for x in [0...@selection.tw]
            {px, py} = @worldToScreen x+mtx-@selectOffset.tx, y+mty-@selectOffset.ty
            if px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
              v = @selection.shuttles.get(x, y) or @selection.base.get(x, y)
              @ctx.fillStyle = if v then Boilerplate.colors[v] else Boilerplate.colors['solid']
              @ctx.fillRect px, py, @size, @size
        @ctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @ctx.strokeRect mpx - @selectOffset.tx*@size, mpy - @selectOffset.ty*@size, @selection.tw*@size, @selection.th*@size
        @ctx.globalAlpha = 1
      else if mpx?
        if @activeTool isnt 'move'
          # The user is holding a paintbrush to paint with a different tool
          @ctx.fillStyle = Boilerplate.colors[@activeTool ? 'solid']
          @ctx.fillRect mpx + @size/4, mpy + @size/4, @size/2, @size/2

          @ctx.strokeStyle = if @parsed.grid.get(mtx, mty) then 'black' else 'white'
          @ctx.strokeRect mpx + 1, mpy + 1, @size - 2, @size - 2


    return
