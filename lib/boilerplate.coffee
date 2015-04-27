{Jit, Map2, util} = require 'boilerplate-jit'
{WebGLContext} = require './gl'

UP=0; RIGHT=1; DOWN=2; LEFT=3

KEY =
  up: 1
  right: 2
  down: 4
  left: 8

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
    bridge: 'hsl(203, 67%, 51%)'
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
        #57: 'buttonup'

        80: 'positive' # p
        78: 'negative' # n
        83: 'shuttle' # s
        65: 'thinshuttle' # a
        69: 'nothing' # e
        71: 'thinsolid' # g
        68: 'solid' # d
        66: 'bridge' # b
        #84: 'buttonup' # t
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
    if @parsed.grid.set x, y, v
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

  setJSONGrid: (json) -> @parsed = Jit json
  getJSONGrid: -> @parsed.grid.toJSON()

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

    @el.onmousemove = (e) =>
      @imminentSelect = !!e.shiftKey
      # If the mouse is released / pressed while not in the box, handle that correctly

      @el.onmousedown e if e.button && !@mouse.mode

      @mouse.from = {tx: @mouse.tx, ty: @mouse.ty}
      @mouse.x = clamp e.offsetX ? e.layerX, 0, @el.offsetWidth - 1
      @mouse.y = clamp e.offsetY ? e.layerY, 0, @el.offsetHeight - 1
      {tx, ty, tc} = @screenToWorldCell @mouse.x, @mouse.y

      if tx != @mouse.tx || ty != @mouse.ty || tc != @mouse.tc
        if @mouse.mode is 'paint' and e.shiftKey
          switch @mouse.direction
            when 'x' then {ty} = @mouse
            when 'y' then {tx} = @mouse
            when null
              @mouse.direction = if tx != @mouse.tx then 'x' else 'y'

        @mouse.tx = tx; @mouse.ty = ty; @mouse.tc = tc

        switch @mouse.mode
          when 'paint' then @paint()
          when 'select' then @selectedB = @screenToWorld @mouse.x, @mouse.y

        @dragShuttleTo tx, ty if @draggedShuttle?

        @updateCursor()
        @draw()

    @el.onmousedown = (e) =>
      if e.shiftKey
        @mouse.mode = 'select'
        @selection = @selectOffset = null
        @selectedA = @screenToWorld @mouse.x, @mouse.y
        @selectedB = @selectedA
      else if @selection
        @stamp()
      else
        if @activeTool is 'move'
          v = @parsed.grid.get @mouse.tx, @mouse.ty
          if v in ['shuttle', 'thinshuttle']
            # find the shuttle id for the shuttle under the cursor
            #@compile() if @needsCompile

            throw Error 'blerk not ported'
            sid = @compiled.ast.shuttleGrid[[@mouse.tx, @mouse.ty]]
            shuttle = @compiled.ast.shuttles[sid]
            if !shuttle.immobile
              {dx,dy} = shuttle.states[@compiled.states[sid]]
              @draggedShuttle =
                sid: sid
                heldPoint: {x:@mouse.tx - dx, y:@mouse.ty - dy}

            #@simulator.holdShuttle @draggedShuttle
        else
          @mouse.mode = 'paint'
          @mouse.from = {tx:@mouse.tx, ty:@mouse.ty}
          @mouse.direction = null
          @paint()
      @updateCursor()
      @draw()

    @el.onmouseup = =>
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
        if @draggedShuttle?
          '-webkit-grabbing'
        else if @parsed.grid.get(@mouse.tx, @mouse.ty) in ['shuttle', 'thinshuttle']
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

  compile: (force) ->
    throw new Error 'crap'
    @parsed = Jit @grid

    for s in @compiled.ast.shuttles
      s.edges = {}
      for k,v of s.points
        {x, y} = parseXY k
        e = 0
        # top
        e = e|1 if !s.points["#{x},#{y-1}"]
        # right
        e = e|2 if !s.points["#{x+1},#{y}"]
        # bot
        e = e|4 if !s.points["#{x},#{y+1}"]
        # left
        e = e|8 if !s.points["#{x-1},#{y}"]
        s.edges[k] = e

    #@compiled.calcPressure()
    #@prevStates = new @compiled.states.constructor @compiled.states
    #@states = @compiled.states
    @draw()

  step: ->
    return

    #@compile() if @needsCompile

    anythingChanged = no

    for v, sid in @states
      @prevStates[sid] = @states[sid]

    @compiled.updateShuttles()

    if @draggedShuttle?
      @states[@draggedShuttle.sid] = @prevStates[@draggedShuttle.sid]

    for v, sid in @states
      if @prevStates[sid] != v
        anythingChanged = yes
        @moveShuttle sid, @prevStates[sid], v

    @lastStepAt = Date.now()

    if anythingChanged
      @compiled.calcPressure()
      @draw()
      @updateCursor()

  moveShuttle: (sid, from, to) ->
    throw Error 'blerk'
    moveShuttle @compiled.grid, @compiled.ast.shuttles, sid, from, to

  dragShuttleTo: (tx, ty) ->
    throw Error 'blerk'
    return unless @draggedShuttle?

    {sid, heldPoint} = @draggedShuttle
    shuttle = @compiled.ast.shuttles[sid]

    dist2 = ({x:x1,y:y1},{x:x2,y:y2}) -> dx = x2-x1; dy = y2-y1; dx*dx+dy*dy
    minDist = null
    bestState = @compiled.states[sid]
    for {dx, dy},state in shuttle.states
      if (d = dist2({x:heldPoint.x + dx, y:heldPoint.y + dy}, {x:tx, y:ty})) < minDist or !minDist?
        bestState = state
        minDist = d

    if @states[sid] != bestState
      @moveShuttle sid, @states[sid], bestState
      @states[sid] = @prevStates[sid] = bestState
      @compiled.calcPressure()
      @draw()

  #########################
  # SELECTION             #
  #########################
  copySubgrid: (rect) ->
    {tx, ty, tw, th} = rect
    subgrid = new Map2
    subgrid.tw = tw; subgrid.th = th

    for y in [ty...ty+th]
      for x in [tx...tx+tw]
        if v = @parsed.grid.get x, y
          subgrid.set x-tx, y-ty, v
    subgrid

  flip: (dir) ->
    return unless @selection
    newSelection = new Map2
    tw = newSelection.tw = @selection.tw; th = newSelection.th = @selection.th

    @selection.forEach (x, y, v) ->
      tx_ = if 'x' in dir then tw-1 - tx else tx
      ty_ = if 'y' in dir then th-1 - ty else ty
      newSelection.set tx_, ty_, v
    @selection = newSelection

  mirror: ->
    return unless @selection
    newSelection = new Map2
    tw = newSelection.tw = @selection.tw; th = newSelection.th = @selection.th

    @selection.forEach (x, y, v) -> newSelection.set ty, tx, v
    @selection = newSelection

  stamp: ->
    throw new Error 'tried to stamp without a selection' unless @selection
    {tx:mtx, ty:mty} = @screenToWorld @mouse.x, @mouse.y
    mtx -= @selectOffset.tx
    mty -= @selectOffset.ty

    changed = no
    @selection.forEach (x, y, v) =>
      changed = true if @set mtx+x, mty+y, v
    @draw() if changed

  copy: (e) ->
    #console.log 'copy'
    if @selection
      json = {tx:@selection.tx, ty:@selection.ty}
      @selection.forEach (x, y, v) -> json["#{x},#{y}"] = v if v?
      e.clipboardData.setData 'text', JSON.stringify json

      console.log JSON.stringify json
    e.preventDefault()

  paste: (e) ->
    #console.log 'paste'
    data = e.clipboardData.getData 'text'
    if data
      try
        json = JSON.parse data
        @selection = new Map2
        tw = th = 0
        for k, v of json when k not in ['tw', 'th']
          {x,y} = util.parseXY k
          tw = x+1 if x >= tw
          th = y+1 if y >= th
          @selection.set x, y, v
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

  drawShuttleOLD: (t, sid) ->
    shuttle = @compiled.ast.shuttles[sid]

    drawnAnything = no
    moving = no

    if !shuttle.immobile
      stateid = @states[sid]
      state = shuttle.states[stateid]
      dx = state.dx; dy = state.dy

      if t < 1
        prevstateid = @prevStates[sid]
        prevstate = shuttle.states[prevstateid]

        if stateid != prevstateid
          moving = yes

          if dx != prevstate.dx
            dx = lerp t, prevstate.dx, dx
          else if dy != prevstate.dy
            dy = lerp t, prevstate.dy, dy

    else
      dx = dy = 0
      t = 1

    for k,v of shuttle.points
      {x,y} = parseXY k
      {px, py} = @worldToScreen x+dx, y+dy

      if px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
        drawnAnything = yes

        @ctx.fillStyle = Boilerplate.colors[v]
        #@ctx.fillStyle = Boilerplate.colors.shuttle
 
        px2 = px; py2 = py; sizex = sizey = @size

        e = shuttle.edges[k]
        if e
          b = if v is 'shuttle'
            @size * 0.04
          else
            #e = ~e
            @size * 0.25
          b = (b+1)|0
          # top, right, bottom, left
          if e & 1 then py2 += b; sizey -= b
          if e & 2 then sizex -= b
          if e & 4 then sizey -= b
          if e & 8 then px2 += b; sizex -= b
        @ctx.fillRect px2, py2, sizex, sizey

        # Fill back in inner corners
        @ctx.fillStyle = Boilerplate.colors.nothing
        if (e & 0x9) == 0 && !shuttle.points["#{x-1},#{y-1}"] # top left
          @ctx.fillRect px, py, b, b
        if (e & 0x3) == 0 && !shuttle.points["#{x+1},#{y-1}"] # top right
          @ctx.fillRect px + @size - b, py, b, b
        if (e & 0x6) == 0 && !shuttle.points["#{x+1},#{y+1}"] # bot right
          @ctx.fillRect px + @size - b, py + @size - b, b, b
        if (e & 0xc) == 0 && !shuttle.points["#{x-1},#{y+1}"] # bot left
          @ctx.fillRect px, py + @size - b, b, b
        
        if v is 'thinshuttle'
          k2 = if state then "#{x+state.dx},#{y+state.dy}" else k
          rid = shuttle.adjacentTo[k2]?[stateid || 0]
          if rid?
            p = @compiled.getPressure(rid)
            if p != 0
              @ctx.fillStyle = if p < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.15)'
              @ctx.fillRect px, py, @size, @size

    # Return whether this shuttle needs to be redrawn again.
    return drawnAnything and moving

  getRegionId: (k) ->
    return unless @compiled

    v = @compiled.grid[k]
    return unless v

    return if v is 'bridge'
      [@compiled.ast.edgeGrid["#{k},true"], @compiled.ast.edgeGrid["#{k},false"]]
    else if v
      # We might be able to find the region if its in a shuttle zone based on
      # the state of the shuttle.
      if (sid = @compiled.ast.shuttleGrid[k])?
        shuttle = @compiled.ast.shuttles[sid]
        shuttle.adjacentTo[k]?[@states[sid]] ? shuttle.adjacentTo[k]?[@prevStates[sid]]
      else
        @compiled.ast.regionGrid[k]

  drawPoints: (points, override) ->
    points.forEach (tx, ty, v) =>
      {px, py} = @worldToScreen tx, ty
      return unless px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
      @ctx.fillStyle = if typeof override is 'function'
        override tx, ty, v
      else if override
        override
      else
        Boilerplate.colors[v] || 'red'

      @ctx.fillRect px, py, @size, @size



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

    hover = hoverType = null
    if @activeTool is 'move' and !@selection and !@imminentSelect
      v = @parsed.grid.get mtx, mty
      # What is the mouse hovering over? A shuttle?
      if hover = @parsed.shuttles.get mtx, mty
        hoverType = 'shuttle'
      else if v and hover = @parsed.groups.get mtx, mty, mtc
        hoverType = 'group'

    #console.log hover if hover

    # Draw the grid
    @drawPoints @parsed.grid, (tx, ty, v) ->
      if v in ['shuttle', 'thinshuttle']
        # Draw the blank (white) under the shuttle.
        Boilerplate.colors.nothing
      else
        # Normal case.
        Boilerplate.colors[v] || 'red'

    @parsed.shuttles.forEach (shuttle) =>
      @drawPoints shuttle.points, (tx, ty, v) ->
        if hover is shuttle then 'darkred' else Boilerplate.colors[v]

    if hoverType is 'group'
      group = hover
      @drawPoints hover.points, 'grey'

    @draw() if t != 1 and needsRedraw
    return

  drawGridOLD: ->
    # Will we need to redraw again soon?
    needsRedraw = no

    t = if @animTime && @lastStepAt
      now = Date.now()
      exact = Math.min 1, (now - @lastStepAt) / @animTime

      ((exact * @size)|0) / @size
    else
      1

    # Mouse position.
    mx = @mouse.x
    my = @mouse.y
    {tx:mtx, ty:mty} = @screenToWorld mx, my

    if @activeTool is 'move' and !@selection and !@imminentSelect
      # Shade the thing the mouse is hovering over
      k = "#{mtx},#{mty}"
      rids = @getRegionId k
      if Array.isArray rids # Its a bridge - we get 2 rids.
        hoverZone = @compiled.getZone rids[0]
        hoverZone2 = @compiled.getZone rids[1]
      else
        hoverZone = rids? && @compiled.getZone rids

      # Only hover the shuttle grid if we're hovering on the shuttle itself.
      hoverSid = if @draggedShuttle
        @draggedShuttle.sid
      else if @compiled.grid[k] in ['shuttle', 'thinshuttle']
        @compiled.ast.shuttleGrid[k]
    
    getShadeColor = (rid) =>
      zone = @compiled.getZone rid
      pressure = @compiled.getPressure rid

      if zone >= 0 && zone in [hoverZone, hoverZone2]
        return if pressure < 0 then 'hsla(16,68%,50%,0.8)' else if pressure > 0 then 'hsla(120,52%,58%,0.8)' else 'rgba(0,0,0,0.5)'

      if pressure
        return if pressure < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.15)'

    # Draw the tiles
    #pressure = @simulator.getPressure()
    for k,v of @compiled.grid
      {x:tx,y:ty} = parseXY k
      {px, py} = @worldToScreen tx, ty
      if px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
        @ctx.fillStyle = if v in ['shuttle', 'thinshuttle']
          # Draw the blank (white) under the shuttle.
          Boilerplate.colors.nothing
        else
          # Normal case.
          Boilerplate.colors[v] || 'red'

        @ctx.fillRect px, py, @size, @size

        continue unless @compiled

        # Shading. We'll shade other cells that we're hovering over, or anything with pressure.
        if v is 'bridge'
          topColor = getShadeColor @compiled.ast.edgeGrid["#{k},true"]
          b = (@size/4 + 1)|0
          if topColor
            @ctx.fillStyle = topColor
            @ctx.fillRect px+b, py, @size-2*b, @size

          leftColor = getShadeColor @compiled.ast.edgeGrid["#{k},false"]
          if leftColor
            @ctx.fillStyle = leftColor
            @ctx.fillRect px, py+b, @size, @size-2*b

        else if v
          if hoverSid? and @compiled.ast.shuttleGrid[k] is hoverSid
            @ctx.fillStyle = Boilerplate.colors.thinshuttle
            @ctx.fillRect px, py, @size, @size
          else
            rid = @getRegionId k
            if rid? and (shadeColor = getShadeColor rid)
              @ctx.fillStyle = shadeColor
              @ctx.fillRect px, py, @size, @size

    for _,sid in @compiled.ast.shuttles
      if @drawShuttle(t, sid) then needsRedraw = yes

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
        {tx, ty, tw, th} = enclosingRect sa, sb
        {px, py} = @worldToScreen tx, ty
        @ctx.fillStyle = 'rgba(0,0,255,0.5)'
        @ctx.fillRect px, py, tw*@size, th*@size

        @ctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @ctx.strokeRect px, py, tw*@size, th*@size
      else if @selection # mouse.tx is null when the mouse isn't in the div
        @ctx.globalAlpha = 0.8
        for y in [0...@selection.th]
          for x in [0...@selection.tw]
            {px, py} = @worldToScreen x+mtx-@selectOffset.tx, y+mty-@selectOffset.ty
            if px+@size >= 0 and px < @canvas.width and py+@size >= 0 and py < @canvas.height
              v = @selection.get x, y
              @ctx.fillStyle = if v then Boilerplate.colors[v] else Boilerplate.colors['solid']
              @ctx.fillRect px, py, @size, @size
        @ctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @ctx.strokeRect mpx - @selectOffset.tx*@size, mpy - @selectOffset.ty*@size, @selection.tw*@size, @selection.th*@size
        @ctx.globalAlpha = 1
      else if mpx?
        if @activeTool isnt 'move'
          # Tool hover
          @ctx.fillStyle = Boilerplate.colors[@activeTool ? 'solid']
          @ctx.fillRect mpx + @size/4, mpy + @size/4, @size/2, @size/2

          @ctx.strokeStyle = if @parsed.grid.get(mtx, mty) then 'black' else 'white'
          @ctx.strokeRect mpx + 1, mpy + 1, @size - 2, @size - 2


    return

