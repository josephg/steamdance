{Jit, Map2, Map3, Set2, Set3, util, Watcher} = require 'boilerplate-jit'
{DIRS} = util

assert = require 'assert'
{letsShuttleThrough, layerOf, lerp, clamp} = require './util'
View = require './view'

{default: GLRenderer} = require './gl'

# {WebGLContext} = require './gl'

UP=0; RIGHT=1; DOWN=2; LEFT=3
fl = Math.floor

KEY =
  up: 1<<0
  right: 1<<1
  down: 1<<2
  left: 1<<3
  shift: 1<<4


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


PrevState = (shuttles, currentStates, stepWatch) ->
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
  stepWatch = jit.modules.stepWatch = new Watcher
  {shuttles, engines, currentStates} = jit.modules

  BlobBounds shuttles
  BlobBounds engines

  prevState = PrevState shuttles, currentStates, stepWatch

  jit.modules.prevState = prevState


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

global.Boilerplate = module.exports = class Boilerplate
  @colors =
    bridge: 'rgb(26, 126, 213)'
    # bridge: 'hsl(216, 92%, 33%)'
    # thinbridge: 'hsl(203, 67%, 51%)'
    negative: 'hsl(16, 68%, 50%)'
    nothing: 'hsl(0, 0%, 100%)'
    positive: 'hsl(120, 52%, 58%)'
    shuttle: 'hsl(283, 65%, 45%)'
    solid: 'hsl(184, 49%, 7%)'
    thinshuttle: 'hsl(283, 89%, 75%)'
    thinsolid: 'hsl(0, 0%, 71%)'
    interface: 'hsl(44, 87%, 52%)'
    ribbon: 'rgb(185, 60, 174)'
    ribbonbridge: 'rgb(108, 30, 217)'
  # These colors are pretty ugly but they'll do for now. Maybe just 1 color but
  # with numbers drawn on the cell?
  @colors["ins#{i}"] = "hsl(188, #{24 + 6 * i}%, #{43 - 2*i}%)" for i in [1..8]
  @colors["ins#{i+8}"] = "hsl(44, #{24 + 6 * i}%, #{43 - 2*i}%)" for i in [1..8]

  enclosingRect = (a, b) ->
    tx: Math.min a.tx, b.tx
    ty: Math.min a.ty, b.ty
    tw: Math.abs(b.tx-a.tx) + 1
    th: Math.abs(b.ty-a.ty) + 1

  changeTool: (newTool) ->
    @activeTool = if newTool is 'solid' then null else newTool
    @onToolChanged? @activeTool
    @updateCursor()

  addKeyListener: (el) ->
    el.addEventListener 'keydown', (e) =>
      kc = e.keyCode
      # console.log kc

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
        57: 'ribbon'

        80: 'positive' # p
        78: 'negative' # n
        83: 'shuttle' # s
        65: 'thinshuttle' # a
        69: 'nothing' # e
        71: 'thinsolid' # g
        68: 'solid' # d
        66: 'bridge' # b
        82: 'ribbon' # r
      })[kc]
      if e.ctrlKey
        a = if e.shiftKey then 8 else 0
        newTool = "ins#{kc - 48 + a}" if 49 <= kc <= 57 # ins1 to ins16.
        newTool = 'bridge' if newTool is 'nothing'
        newTool = 'ribbonbridge' if newTool is 'ribbon'

      # console.log 'newTool', newTool

      if newTool
        if @selection
          # Fill the entire selection with the selected brush
          for x in [0...@selection.tw]
            for y in [0...@selection.th]
              if newTool is 'nothing'
                @selection.base.delete x, y
                @selection.shuttles.delete x, y
              else if newTool in ['shuttle', 'thinshuttle']
                @selection.base.set x, y, 'nothing' unless letsShuttleThrough @selection.base.get(x, y)
                @selection.shuttles.set x, y, newTool
              else
                @selection.base.set x, y, newTool
                @selection.shuttles.delete x, y
        else
          @changeTool newTool

      if 37 <= e.keyCode <= 40
        @lastKeyScroll = Date.now()

      switch kc
        # left, right, up, down.
        when 37 then @keysPressed |= KEY.left
        when 39 then @keysPressed |= KEY.right
        when 38 then @keysPressed |= KEY.up
        when 40 then @keysPressed |= KEY.down

        when 16 # shift
          @keysPressed |= KEY.shift
          @imminentSelect = true
        when 27,192 # esc
          if @selection
            @clearSelection()
          else
            @changeTool 'move'

        when 88 # x
          @flip 'x' if @selection
        when 89 # y
          @flip 'y' if @selection
        when 77 # m
          @mirror() if @selection

        when 187, 189 # plus
          # debugger
          amt = Math.max(1, @view.size/8)/20
          amt *= -1 if kc is 189 # minus key
          amt *= 3 if @keysPressed & KEY.shift
          @view.zoomBy amt, {x:@width/2, y:@height/2}

      if (e.ctrlKey || e.metaKey) and kc is 90 # ctrl+z or cmd+z
        if e.shiftKey then @redo() else @undo()
        e.preventDefault()
      else if e.ctrlKey and kc is 89 # ctrl+y for windows
        @redo()
        e.preventDefault()

      @draw()

    el.addEventListener 'keyup', (e) =>
      if 37 <= e.keyCode <= 40
        @lastKeyScroll = Date.now()

      switch e.keyCode
        when 16 # shift
          @keysPressed &= ~KEY.shift
          @imminentSelect = false
          @draw()

        # left, right, up, down.
        when 37 then @keysPressed &= ~KEY.left
        when 39 then @keysPressed &= ~KEY.right
        when 38 then @keysPressed &= ~KEY.up
        when 40 then @keysPressed &= ~KEY.down


    el.addEventListener 'blur', =>
      @mouse.mode = null
      @imminentSelect = false
      @editStop()
      @draw()

    el.addEventListener 'copy', (e) => @copy(e)
    el.addEventListener 'paste', (e) => @paste(e)



  set: (x, y, bv = null, sv = null) ->
    #throw Error "Invalid layer #{layer}" unless !v? or layer == layerOf v
    bp = @parsed.get('base', x, y) || null
    sp = @parsed.get('shuttles', x, y) || null
    return false if bv == bp and sp == sv # js double equals would be perfect here
    if @currentEdit and !@currentEdit.base.has x, y
      @currentEdit.base.set x, y, bp
      @currentEdit.shuttles.set x, y, sp

    @parsed.set x, y, bv, sv
    return true

  resetView: -> @view.reset @options

  setJSONGrid: (json) ->
    @parsed = Jit json
    addModules @parsed
    @gridRenderer.addModules @parsed
    @parsed.modules.shuttles.deleteWatch.on (s) =>
      @draggedShuttle = null if s is @draggedShuttle?.shuttle

    @currentEdit = null
    @undoStack.length = @redoStack.length = 0
    @drawAll()

  getJSONGrid: -> @parsed.toJSON()

  constructor: (@el, @options) ->
    @keysPressed = 0 # bitmask. up=1, right=2, down=4, left=8
    @lastKeyScroll = 0 # epoch time

    @activeTool = 'move'

    # A list of patches
    @currentEdit = null
    @undoStack = []
    @redoStack = []

    @view = new View @el.offsetWidth, @el.offsetHeight, @options

    @canScroll = @options.canScroll ? true
    @animTime = @options.animTime || 0

    #@el = document.createElement 'div'
    #@el.className = 'boilerplate'
    @el.tabIndex = 0 if @el.tabIndex is -1 # allow keyboard events
    @gridCanvas = @el.appendChild document.createElement 'canvas'
    @gridCanvas.className = 'draw'
    @gridCanvas.style.backgroundColor = Boilerplate.colors.solid

    @dynCanvas = @el.appendChild document.createElement 'canvas'
    @dynCanvas.className = 'draw'

    @el.boilerplate = this

    @gridRenderer = new GLRenderer @gridCanvas, @view

    @setJSONGrid @options.grid

    #@el.onresize = -> console.log 'yo'


    @mouse = {x:null,y:null, mode:null}
    #@placing = 'nothing'
    @imminentSelect = false
    @selectedA = @selectedB = null
    @selectOffset = null
    @selection = null

    @drawAll()

    # ----- Event handlers

    @view.watch.forward ({@width, @height}) =>
      #console.log "resized to #{@width}x#{@height}"

      @dynCanvas.width = @width * devicePixelRatio
      @dynCanvas.height = @height * devicePixelRatio
      # I'm not sure why this is needed?
      #@dynCanvas.style.width = @gridCanvas.style.width = @width + 'px'
      #@dynCanvas.style.height = @gridCanvas.style.height = @height + 'px'

      #@sctx = @gridCanvas.getContext '2d'
      #@sctx.scale devicePixelRatio, devicePixelRatio

      @dctx = @dynCanvas.getContext '2d'
      @dctx.scale devicePixelRatio, devicePixelRatio

      @drawAll()

    @el.onmousemove = (e) =>
      @imminentSelect = !!e.shiftKey
      # If the mouse is released / pressed while not in the box, handle that correctly
      @el.onmousedown e if e.button && !@mouse.mode
      @cursorMoved() if @updateMousePos e
      @draw() if @mouse and @parsed.get 'base', @mouse.tx, @mouse.ty

    @el.onmousedown = (e) =>
      @updateMousePos e

      if e.shiftKey
        @mouse.mode = 'select'
        @clearSelection()
        @selectedA = @view.screenToWorld @mouse.x, @mouse.y
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
          @editStart()
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
        @onSelection? @selection
      else if @mouse.mode is 'paint'
        @editStop()
        # Its dangerous firing this event here - it should be in a nextTick or
        # something, but I'm lazy. (Sorry future me)
        @onEditFinish?()

      @mouse.mode = null
      @mouse.direction = null
      @imminentSelect = false
      @updateCursor()
      @draw()

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
      @updateMousePos e

      if e.shiftKey or e.ctrlKey
        @view.zoomBy -e.deltaY / 400, @mouse
      else
        @view.scrollBy e.deltaX, e.deltaY
      {tx:@mouse.tx, ty:@mouse.ty} = @view.screenToWorld @mouse.x, @mouse.y
      e.preventDefault()
      @cursorMoved()

  updateMousePos: (e) ->
    @mouse.from = {tx: @mouse.tx, ty: @mouse.ty}
    if e
      @mouse.x = clamp e.offsetX ? e.layerX, 0, @el.offsetWidth - 1
      @mouse.y = clamp e.offsetY ? e.layerY, 0, @el.offsetHeight - 1
    {tx, ty, tc} = @view.screenToWorldCell @mouse.x, @mouse.y, @parsed

    if tx != @mouse.tx || ty != @mouse.ty || tc != @mouse.tc
      @mouse.tx = tx; @mouse.ty = ty; @mouse.tc = tc
      return yes
    else
      return no

  cursorMoved: ->
    switch @mouse.mode
      when 'paint' then @paint()
      when 'select' then @selectedB = @view.screenToWorld @mouse.x, @mouse.y

    @dragShuttleTo @mouse.tx, @mouse.ty if @draggedShuttle?

    @draw()
    @updateCursor()

  updateCursor: ->
    @dynCanvas.style.cursor =
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

  resizeTo: (w, h) -> @view.resizeTo w, h

  paint: ->
    throw 'Invalid placing' if @activeTool is 'move'
    {tx, ty} = @mouse
    {tx:fromtx, ty:fromty} = @mouse.from
    fromtx ?= tx
    fromty ?= ty

    line fromtx, fromty, tx, ty, (x, y) =>
      #@simulator.set x, y, @activeTool
      # @activeTool is null for solid.

      if @activeTool in ['shuttle', 'thinshuttle']
        bv = @parsed.get 'base', x, y
        bv = 'nothing' unless letsShuttleThrough bv
        @set x, y, bv, @activeTool
      else
        @set x, y, @activeTool, null
    @drawAll()

  step: ->
    # Only redraw if step did something.
    @parsed.modules.stepWatch.signal 'before'
    if @parsed.step()
      @lastStepAt = Date.now()
      @drawAll()
      @updateCursor()
    @parsed.modules.stepWatch.signal 'after'

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
      @drawAll() # Need to redraw the background to update pressure.


  #########################
  # UNDO STACK            #
  #########################
  editStart: ->
    @editStop()
    @currentEdit =
      base: new Map2
      shuttles: new Map2

  editStop: (stack = @undoStack) ->
    # ... also clear the redo stack for real edits.
    if @currentEdit
      if @currentEdit.base.size || @currentEdit.shuttles.size
        stack.push @currentEdit
      @currentEdit = null

  _popStack: (from, to) ->
    @editStop()
    if (edit = from.pop())
      @editStart()
      edit.base.forEach (x, y, v) =>
        @set x, y, v, edit.shuttles.get x, y
    @editStop to
    @drawAll()

  redo: -> @_popStack @redoStack, @undoStack
  undo: -> @_popStack @undoStack, @redoStack

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
        if v = @parsed.get 'base', x, y
          subgrid.base.set x-tx, y-ty, v
        if v = @parsed.get 'shuttles', x, y
          subgrid.shuttles.set x-tx, y-ty, v

    #console.log subgrid
    subgrid

  _transformSelection: (tw, th, copyfn) ->
    return unless @selection

    newSelection =
      tw: tw
      th: th
      base: new Map2
      shuttles: new Map2

    @selection.base.forEach copyfn newSelection.base
    @selection.shuttles.forEach copyfn newSelection.shuttles
    @selection = newSelection

  flip: (dir) ->
    if @selection
      @_transformSelection (tw = @selection.tw), (th = @selection.th), (dest) -> (x, y, v) ->
        x_ = if dir is 'x' then tw-1 - x else x
        y_ = if dir is 'y' then th-1 - y else y
        dest.set x_, y_, v

  mirror: ->
    # Width and height swapped! So tricky.
    if @selection
      @_transformSelection @selection.th, @selection.tw, (dest) -> (x, y, v) -> dest.set y, x, v

  stamp: ->
    throw new Error 'tried to stamp without a selection' unless @selection
    {tx:mtx, ty:mty} = @view.screenToWorld @mouse.x, @mouse.y
    mtx -= @selectOffset.tx
    mty -= @selectOffset.ty

    changed = no
    # We need to set all values, even the nulls.
    @editStart()
    for y in [0...@selection.th]
      for x in [0...@selection.tw]
        bv = @selection.base.get x, y
        sv = @selection.shuttles.get x, y
        changed = true if @set mtx+x, mty+y, bv, sv

    @editStop()
    @onEditFinish?()
    @drawAll() if changed

  clearSelection: ->
    if @selection
      @selection = @selectOffset = null
      @onSelectionClear?()

  setSelection: (data) ->
    @clearSelection()
    return if !data?
    assert data.tw?
    @selection = data
    @selectOffset = {tx:0, ty:0}
    @onSelection? @selection

  copy: (e) ->
    #console.log 'copy'
    if @selection
      json = {tw:@selection.tw, th:@selection.th, base:{}, shuttles:{}}
      @selection.base.forEach (x, y, v) -> json.base["#{x},#{y}"] = v if v?
      @selection.shuttles.forEach (x, y, v) -> json.shuttles["#{x},#{y}"] = v if v?
    else
      json = @getJSONGrid()

    e.clipboardData.setData 'text', JSON.stringify json
    #console.log JSON.stringify json

    e.preventDefault()

  paste: (e) ->
    #console.log 'paste'
    json = e.clipboardData.getData 'text'
    if json
      try
        @selection = util.deserializeRegion json
        @selectOffset = {tx:0, ty:0}
        @onSelection? @selection
      catch e
        @selection = null
        console.error 'Error parsing data in clipboard:', e.stack


  #########################
  # DRAWING               #
  #########################
  drawAll: ->
    @needsDrawAll = true
    @draw()

  draw: ->
    return if @needsDraw
    @needsDraw = true
    requestAnimationFrame =>
      @needsDraw = false

      if @needsDrawAll
        @parsed.modules.shuttles.flush()
        @gridRenderer.draw()
        @needsDrawAll = false

      # This is a weird place to do keyboard scrolling, but if we do it in
      # step() it'll only happen once every few hundred ms.
      if (@keysPressed & 0xf) && @canScroll
        #console.log @keysPressed
        now = Date.now()
        amt = 0.6 * Math.min now - @lastKeyScroll, 300
        amt *= 3 if @keysPressed & KEY.shift

        @view.scrollBy(0, -amt) if @keysPressed & KEY.up
        @view.scrollBy(amt, 0) if @keysPressed & KEY.right
        @view.scrollBy(0, amt) if @keysPressed & KEY.down
        @view.scrollBy(-amt, 0) if @keysPressed & KEY.left

        @lastKeyScroll = now

        if @updateMousePos()
          @cursorMoved()

      @dctx.clearRect 0, 0, @width, @height
      @drawGrid()
      @drawOverlay()
      @draw() if @keysPressed

  drawCells: (ctx, points, offset, override) ->
    # Helper to draw blocky cells
    if typeof offset in ['function', 'string']
      [offset, override] = [{dx:0, dy:0}, offset]

    {dx, dy} = offset
    size = @view.size
    points.forEach (tx, ty, v) =>
      {px, py} = @view.worldToScreen tx+dx, ty+dy
      return unless px+size >= 0 and px < @width and py+size >= 0 and py < @height
      if typeof override is 'function'
        return unless (style = override tx, ty, v)
        ctx.fillStyle = style
      else if override
        ctx.fillStyle = override
      else
        ctx.fillStyle = Boilerplate.colors[v] || 'red'

      ctx.fillRect px, py, size, size

  # Draw a path around the specified blob edge. The edge should be a Set3 of (x,y,dir).
  pathAroundEdge: (ctx, edge, border, pos) ->
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

      {px, py} = @view.worldToScreen ex, ey

      {dx, dy} = DIRS[dir]
      # Come in from the edge
      px += border * (-dx - dy*em)
      py += border * (-dy + dx*em)

      if first
        ctx.moveTo px, py
      else
        ctx.lineTo px, py

      #@ctx.lineTo (ex-@scrollX)*@view.size, (ey-@scrollY)*@view.size

    visited = new Set3
    ctx.beginPath()
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
      ctx.closePath()




  drawShuttle: (shuttle, t, isHovered) ->
    # First get bounds - we might not even be able to display the shuttle.
    if (prevState = @parsed.modules.prevState.get shuttle) and
        shuttle isnt @draggedShuttle?.shuttle
      sx = lerp t, prevState.dx, shuttle.currentState.dx
      sy = lerp t, prevState.dy, shuttle.currentState.dy
    else
      {dx:sx, dy:sy} = shuttle.currentState

    bounds = shuttle.bounds
    topLeft = @view.worldToScreen bounds.left+sx, bounds.top+sy
    botRight = @view.worldToScreen bounds.right+sx+1, bounds.bottom+sy+1
    return no if topLeft.px > @width or
      topLeft.py > @height or
      botRight.px < 0 or
      botRight.py < 0

    border = if @view.size < 5 then 0 else (@view.size * 0.04+1)|0

    # Thinshuttles first.
    @dctx.strokeStyle = if isHovered
      'hsl(283, 89%, 65%)'
    else
      Boilerplate.colors.thinshuttle
    size2 = (@view.size/2)|0
    size4 = (@view.size/4)|0
    @dctx.lineWidth = size4 * 2 # An even number.
    shuttle.points.forEach (x, y, v) =>
      return if v is 'shuttle'

      # base x, y of the tile
      {px, py} = @view.worldToScreen x+sx, y+sy
      px += size2; py += size2

      numLines = 0
      for {dx,dy} in DIRS when shuttle.points.has x+dx, y+dy
        # Draw a little line from here to there.
        @dctx.beginPath()
        @dctx.moveTo px - size4*dx, py - size4*dy
        @dctx.lineTo px + (@view.size+size4) * dx, py + (@view.size+size4) * dy
        @dctx.stroke()
        numLines++

      if numLines is 0
        # Erk, the shuttle would be invisible. I'll draw a sympathy square.
        {px, py} = @view.worldToScreen x+sx, y+sy
        @dctx.fillStyle = Boilerplate.colors.thinshuttle
        @dctx.fillRect px + size4, py + size4, size2, size2

    @pathAroundEdge @dctx, shuttle.pushEdges, border, {sx, sy}
    @dctx.fillStyle = Boilerplate.colors.shuttle
    @dctx.fill()

    if isHovered
      @pathAroundEdge @dctx, shuttle.pushEdges, border*2, {sx, sy}
      @dctx.lineWidth = border*4
      @dctx.strokeStyle = 'hsla(283, 65%, 25%, 0.5)'
      @dctx.stroke()

    return yes

  drawEngine: (engine, t) ->
    @pathAroundEdge @dctx, engine.edges, 2

    @dctx.strokeStyle = if engine.type is 'positive'
      'hsl(120, 52%, 26%)'
    else
      'hsl(16, 68%, 20%)'

    @dctx.lineWidth = 4
    @dctx.stroke()

    #@dctx.fillStyle = Boilerplate.colors[engine.type]
    #@dctx.fill()

  drawGrid: ->
    # Will we need to redraw again soon?
    needsRedraw = no

    # For animating shuttle motion
    t = if @animTime && @lastStepAt
      now = Date.now()
      exact = Math.min 1, (now - @lastStepAt) / @animTime

      ((exact * @view.size)|0) / @view.size
    else
      1

    # Mouse position
    mx = @mouse.x; my = @mouse.y
    {tx:mtx, ty:mty, tc:mtc} = @view.screenToWorldCell mx, my, @parsed
    hover = {}

    # Draw the grid
    #@drawCells @sctx, @parsed.baseGrid, (tx, ty, v) ->
    #  Boilerplate.colors[v] || 'red'


    if @activeTool is 'move' and !@selection and !@imminentSelect
      bv = @parsed.get 'base', mtx, mty
      sv = @parsed.get 'shuttles', mtx, mty
      # What is the mouse hovering over? For better or worse, this relies
      # heavily uses the parser internals.
      modules = @parsed.modules

      # hover.engines = new Set
      # hover.shuttles = new Set
      # hover.points = new Set
      if (shuttle = modules.shuttleGrid.getShuttle mtx, mty)
        hover.shuttle = shuttle
      else if (engine = modules.engineGrid.get mtx, mty)
        @drawEngine engine, t

      if sv != 'shuttle' and bv and
            (contents = @parsed.getZoneContents mtx, mty, mtc)
        hover.points = contents.points
        hover.pressure = 0
        contents.engines.forEach (e) =>
          hover.pressure += e.pressure
          @drawEngine e, t

      # hover.zone = if hover.group then @parsed.modules.zones.getZoneForGroup hover.group

    #console.log hover if hover

    # Draw pressure
    # @drawCells @dctx, @parsed.baseGrid, (tx, ty, v) =>
    #   if v in ['nothing', 'thinsolid', 'thinshuttle'] or util.insNum(v) != -1
    #     group = @parsed.modules.groups.get tx, ty, 0
    #     zone = @parsed.modules.zones.getZoneForGroup(group) if group
    #     if zone?.pressure
    #       return if zone?.pressure < 0 then 'rgba(255,0,0,0.2)' else 'rgba(0,255,0,0.2)'
    #     else
    #       return null

    # Draw the shuttles
    @parsed.modules.shuttles.forEach (shuttle) =>
      needsRedraw = true if @drawShuttle shuttle, t, hover.shuttle == shuttle

    if hover.points then @drawCells @dctx, hover.points, 'rgba(100,100,100,0.3)'

    if hover.pressure
      # {px, py} = @view.worldToScreen mtx, mty
      px = mx; py = my + 20
      size = 23

      fontsize = size
      text = "#{hover.pressure}"
      while fontsize > 3
        @dctx.font = "#{fl fontsize}px sans-serif"
        break if (@dctx.measureText text).width < size - 3
        fontsize--

      @dctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      @dctx.fillRect px, py, size, size

      @dctx.fillStyle = if hover.pressure < 0
        Boilerplate.colors['negative']
      else
        Boilerplate.colors['positive']
      @dctx.textBaseline = 'middle'
      @dctx.textAlign = 'center'
      @dctx.fillText text, px + size/2, py + size/2

    @draw() if t != 1 and needsRedraw
    return

  drawOverlay: ->
    mx = @mouse.x
    my = @mouse.y
    {tx:mtx, ty:mty} = @view.screenToWorld mx, my
    {px:mpx, py:mpy} = @view.worldToScreen mtx, mty

    if @mouse.mode is 'select'
      sa = @selectedA
      sb = @selectedB
    else if @imminentSelect
      sa = sb = {tx:mtx, ty:mty}

    @dctx.lineWidth = 1

    size = @view.size

    # Draw the mouse hover state
    if @mouse.tx != null
      if sa
        # The user is dragging out a selection rectangle
        {tx, ty, tw, th} = enclosingRect sa, sb
        {px, py} = @view.worldToScreen tx, ty
        @dctx.fillStyle = 'rgba(0,0,255,0.5)'
        @dctx.fillRect px, py, tw*size, th*size

        @dctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @dctx.strokeRect px, py, tw*size, th*size
      else if @selection # mouse.tx is null when the mouse isn't in the div
        # The user is holding a selection stamp
        @dctx.globalAlpha = 0.8
        for y in [0...@selection.th]
          for x in [0...@selection.tw]
            {px, py} = @view.worldToScreen x+mtx-@selectOffset.tx, y+mty-@selectOffset.ty
            if px+size >= 0 and px < @width and py+size >= 0 and py < @height
              v = @selection.shuttles.get(x, y) or @selection.base.get(x, y)
              @dctx.fillStyle = (if v then Boilerplate.colors[v] else Boilerplate.colors['solid']) or 'red'
              @dctx.fillRect px, py, size, size
        @dctx.strokeStyle = 'rgba(0,255,255,0.5)'
        @dctx.strokeRect mpx - @selectOffset.tx*size, mpy - @selectOffset.ty*size, @selection.tw*size, @selection.th*size
        @dctx.globalAlpha = 1
      else if mpx?
        if @activeTool isnt 'move'
          # The user is holding a paintbrush to paint with a different tool
          @dctx.fillStyle = Boilerplate.colors[@activeTool ? 'solid'] || 'red'
          @dctx.fillRect mpx + size/4, mpy + size/4, size/2, size/2

          @dctx.strokeStyle = if @parsed.get('base', mtx, mty) then 'black' else 'white'
          @dctx.strokeRect mpx + 1, mpy + 1, size - 2, size - 2


    return
