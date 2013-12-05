cardinal_dirs = [[0,1],[0,-1],[1,0],[-1,0]]
fill = (initial_squares, f) ->
	visited = {}
	visited["#{x},#{y}"] = true for {x, y} in initial_squares
	to_explore = initial_squares.slice()
	hmm = (x,y) ->
		k = "#{x},#{y}"
		if not visited[k]
			visited[k] = true
			to_explore.push {x,y}
	while n = to_explore.shift()
		ok = f n.x, n.y
		if ok
			hmm n.x+1, n.y
			hmm n.x-1, n.y
			hmm n.x, n.y+1
			hmm n.x, n.y-1
	return

parseXY = (k) ->
  [x,y] = k.split /,/
  {x:parseInt(x), y:parseInt(y)}

sign = (x) -> if x > 0 then 1 else if x < 0 then -1 else 0

class Simulator
  constructor: (@grid) ->
    @grid ||= {}

    # Map 'x,y' in a shuttle to dy*3 + dx
    @lastMoved = {}

    @engines = {}
    for k,v of @grid
      if v in ['positive','negative']
        {x,y} = parseXY k
        @engines[k] = {x,y}
    #console.log "Initiating #{Object.keys(@engines).length} engines..."
    @delta = {changed:{}, sound:{}}

  set: (x, y, v) ->
    k = "#{x},#{y}"
    if v?
      @grid[k] = v
      @delta.changed[k] = v

      delete @engines[k]
      if v in ['positive', 'negative']
        @engines[k] = {x,y}
    else
      if @grid[k] in ['positive', 'negative']
        delete @engines[k]
      delete @grid[k]
      @delta.changed[k] = null
  get: (x,y) -> @grid["#{x},#{y}"]

  tryMove: (points, dx, dy) ->
    dx = if dx < 0 then -1 else if dx > 0 then 1 else 0
    dy = if dy < 0 then -1 else if dy > 0 then 1 else 0
    throw new Error('one at a time, fellas') if dx and dy
    return unless dx or dy
    for {x,y} in points
      if @get(x+dx, y+dy) not in ['nothing', 'shuttle', 'thinshuttle']
        return false

    shuttle = {}
    for {x,y} in points
      shuttle["#{x},#{y}"] = @get x, y
      @set x, y, 'nothing'
    for {x,y} in points
      @set x+dx, y+dy, shuttle["#{x},#{y}"]

    true

  getPressure: ->
    pressure = {}
    for k,v of @engines
      direction = if 'positive' is @get v.x, v.y then 1 else -1
      fill [v], (x, y) =>
        cell = @get x, y
        cell = 'nothing' if x is v.x and y is v.y
        if cell in ['nothing', 'thinshuttle', 'thinsolid']
          pressure["#{x},#{y}"] = (pressure["#{x},#{y}"] ? 0) + direction
          return true
        false
    pressure
  step: ->
    shuttleMap = {}
    shuttles = []
    getShuttle = (x, y) =>
      return null unless @get(x, y) in ['shuttle']
      s = shuttleMap["#{x},#{y}"]
      return s if s

      shuttles.push (s = {points:[], force:{x:0,y:0}})

      # Flood fill the shuttle
      fill [{x,y}], (x, y) =>
        if @get(x, y) in ['shuttle', 'thinshuttle']
          shuttleMap["#{x},#{y}"] = s
          s.points.push {x,y}
          true
        else
          false

      s

    # Populate the shuttles list with all shuttles. Needed because of gravity
    #for k,v of @grid
    #  {x,y} = parseXY k
    #  getShuttle x, y

    for k,v of @engines
      direction = if 'positive' is @get v.x, v.y then 1 else -1
      fill [v], (x, y) =>
        cell = @get x, y
        cell = 'nothing' if x is v.x and y is v.y

        switch cell
          when 'nothing', 'thinshuttle', 'thinsolid'
            for [dx,dy] in cardinal_dirs
              s = getShuttle x+dx, y+dy
              if s
                s.force.x += dx * direction
                s.force.y += dy * direction
            #pressure[[x,y]] = (pressure[[x,y]] ? 0) + direction

            true
          else
            false

    #console.log shuttles, @engines

    nextMoved = {}

    for {points, force} in shuttles
      movedY = @tryMove points, 0, force.y# + 1
      dy = if movedY then sign(force.y) else 0

      unless movedY
        movedX = @tryMove points, force.x, 0
        dx = if movedX then sign(force.x) else 0
      else
        dx = 0

      val = dy*3 + dx
      for {x,y} in points
        key = "#{x},#{y}"
        #console.log key, val, @lastMoved[key]
        if @lastMoved[key] && @lastMoved[key] != val
          @delta.sound[key] = true

        nextMoved["#{x+dx},#{y+dy}"] = val

    @lastMoved = nextMoved

    thisDelta = @delta
    @delta = {changed:{}, sound:{}}

    thisDelta


if typeof module != 'undefined'
	module.exports = Simulator
