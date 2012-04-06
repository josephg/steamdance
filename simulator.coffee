fill = (initial_squares, f) ->
	visited = {}
	visited[[x,y]] = true for {x, y} in initial_squares
	to_explore = initial_squares.slice()
	hmm = (x,y) ->
		if not visited[[x,y]]
			visited[[x,y]] = true
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

class Simulator
  constructor: (@grid) ->
    @grid ||= {}
    @engines = {}
    for k,v of @grid
      if v in ['positive','negative']
        {x,y} = parseXY k
        @engines[[x,y]] = {x,y}
    @delta = {}

  set: (x, y, v) ->
    if v?
      @grid[[x,y]] = v
      @delta[[x,y]] = v

      delete @engines[[x,y]]
      if v in ['positive', 'negative']
        @engines[[x,y]] = {x,y}
    else
      if @grid[[x,y]] in ['positive', 'negative']
        delete @engines[[x,y]]
      delete @grid[[x,y]]
      @delta[[x,y]] = null
  get: (x,y) -> @grid[[x,y]]

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
      shuttle[[x,y]] = @get x, y
      @set x, y, 'nothing'
    for {x,y} in points
      @set x+dx, y+dy, shuttle[[x,y]]

    true

  step: ->
    #pressure = {}

    shuttleMap = {}
    shuttles = []
    getShuttle = (x, y) =>
      return null unless @get(x, y) in ['shuttle']
      s = shuttleMap[[x,y]]
      return s if s

      shuttles.push (s = {points:[], force:{x:0,y:0}})

      # Flood fill the shuttle
      fill [{x,y}], (x, y) =>
        if @get(x, y) in ['shuttle', 'thinshuttle']
          shuttleMap[[x,y]] = s
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
          when 'positive', 'negative'
            false
          when 'shuttle'
            false
          when 'nothing', 'thinshuttle', 'thinsolid'
            for [dx,dy] in [[0,1],[0,-1],[1,0],[-1,0]]
              s = getShuttle x+dx, y+dy
              if s
                s.force.x += dx * direction
                s.force.y += dy * direction
            #pressure[[x,y]] = (pressure[[x,y]] ? 0) + direction

            true
          else
            false

    #console.log shuttles, @engines

    for {points, force} in shuttles
      movedY = @tryMove points, 0, force.y# + 1
      @tryMove points, force.x, 0 unless movedY

    thisDelta = @delta
    @delta = {}

    thisDelta


module.exports = Simulator
