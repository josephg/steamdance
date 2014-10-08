# Opengl canvas context which supports fillRect and strokeRect.

class WebGLContext
  vertSource = """
  attribute vec2 a_position;
  attribute vec4 a_color;
  varying lowp vec4 v_color;

  uniform vec2 u_resolution;

  void main() {
     // convert the rectangle from pixels to 0.0 to 1.0
     vec2 zeroToOne = a_position / u_resolution;

     // convert from 0->1 to 0->2
     vec2 zeroToTwo = zeroToOne * 2.0;

     // convert from 0->2 to -1->+1 (clipspace)
     vec2 clipSpace = zeroToTwo - 1.0;

     gl_Position = vec4(clipSpace * vec2(1,-1), 0, 1);
     v_color = a_color;
  }
  """

  fragSource = """
  varying lowp vec4 v_color;
  void main() {
    gl_FragColor = v_color;
  }
  """

  loadShader = (gl, shaderSource, shaderType, opt_errorCallback) ->
    shader = gl.createShader(shaderType)
    gl.shaderSource(shader, shaderSource)
    gl.compileShader(shader)
    compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    if !compiled
      lastError = gl.getShaderInfoLog(shader)
      console.error("*** Error compiling shader '" + shader + "':" + lastError)
      gl.deleteShader(shader)
      return null
    shader

  loadProgram = (gl, shaders, opt_attribs, opt_locations) ->
    program = gl.createProgram()
    for s in shaders
      gl.attachShader(program, s)
    if opt_attribs
      for attrib, i in opt_attribs
        gl.bindAttribLocation(
          program,
          if opt_locations then opt_locations[i] else i,
          attrib
        )
    gl.linkProgram(program)

    linked = gl.getProgramParameter(program, gl.LINK_STATUS)
    if !linked
      lastError = gl.getProgramInfoLog(program)
      console.error("Error in program linking:" + lastError)

      gl.deleteProgram(program)
      return null
    program

  cssColorToRGB = do ->
    s = document.createElement('span')
    s.id = '-color-converter'
    s.style.position = 'absolute'
    s.style.left = '-9999px'
    s.style.top = '-9999px'
    document.body.appendChild(s)
    cache = {}
    (cssColor) ->
      if cache[cssColor] then return cache[cssColor]
      s.style.backgroundColor = cssColor
      rgb = getComputedStyle(s).backgroundColor
      m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb)
      if !m then m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(rgb)
      r = parseInt(m[1])
      g = parseInt(m[2])
      b = parseInt(m[3])
      a = if m[4] then parseFloat(m[4]) else 1.0
      cache[cssColor] = [r/255, g/255, b/255, a]

  constructor: (canvas) ->
    @gl = canvas.getContext 'webgl'
    vertexShader = loadShader(@gl, vertSource, @gl.VERTEX_SHADER)
    fragmentShader = loadShader(@gl, fragSource, @gl.FRAGMENT_SHADER)
    program = loadProgram(@gl, [vertexShader, fragmentShader])
    @gl.useProgram(program)

    @positionLocation = @gl.getAttribLocation(program, "a_position")
    @colorLocation = @gl.getAttribLocation(program, "a_color")
    @resolutionLocation = @gl.getUniformLocation(program, "u_resolution")
    #console.log "setting resolution uniform to #{canvas.width}, #{canvas.height}"
    #@resizeTo canvas.width, canvas.height

    @vbuf = @gl.createBuffer()
    @gl.bindBuffer @gl.ARRAY_BUFFER, @vbuf
    @gl.bufferData @gl.ARRAY_BUFFER, 4*1000000*4, @gl.STATIC_DRAW
    @cbuf = @gl.createBuffer()
    @gl.bindBuffer @gl.ARRAY_BUFFER, @cbuf
    @gl.bufferData @gl.ARRAY_BUFFER, 4*1000000*6, @gl.STATIC_DRAW

    @gl.blendFunc @gl.SRC_ALPHA, @gl.ONE_MINUS_SRC_ALPHA
    @gl.enable @gl.BLEND

    @tris = []
    @colors = []
    @fillStyle = 'rgba(0,255,0,1.0)'
    @strokeStyle = 'rgba(0,255,0,1.0)'

  resizeTo: (width, height) ->
    @gl.viewport 0, 0, width * devicePixelRatio, height * devicePixelRatio
    @gl.uniform2f @resolutionLocation, width, height



  fillRect: (l, t, w, h) ->
    r = l+w
    b = t+h
    @tris.push.apply @tris, [
      l, t
      r, t
      l, b
      l, b
      r, t
      r, b
    ]
    [r, g, b, a] = cssColorToRGB @fillStyle
    @colors.push.apply @colors, [
      r, g, b, a
      r, g, b, a
      r, g, b, a
      r, g, b, a
      r, g, b, a
      r, g, b, a
    ]

  strokeRect: (l, t, w, h) ->
    oldFill = @fillStyle
    @fillStyle = @strokeStyle
    @fillRect l, t, w, 1
    @fillRect l, t+1, 1, h-1
    @fillRect l+w-1, t+1, 1, h-1
    @fillRect l+1, t+h-1, w-2, 1
    @fillStyle = oldFill

  flush: ->
    @gl.bindBuffer(@gl.ARRAY_BUFFER, @vbuf)
    # ugh
    max = 20000*6
    for i in [0..(@tris.length/max)|0]
      subData = new Float32Array @tris[i*max...((i+1)*max)]
      @gl.bufferSubData(@gl.ARRAY_BUFFER, i*max*4, subData)
    @gl.enableVertexAttribArray(@positionLocation)
    @gl.vertexAttribPointer(@positionLocation, 2, @gl.FLOAT, false, 0, 0)

    @gl.bindBuffer(@gl.ARRAY_BUFFER, @cbuf)
    for i in [0..(@colors.length/max)|0]
      subData = new Float32Array @colors[i*max...((i+1)*max)]
      @gl.bufferSubData(@gl.ARRAY_BUFFER, i*max*4, subData)
    @gl.enableVertexAttribArray(@colorLocation)
    @gl.vertexAttribPointer(@colorLocation, 4, @gl.FLOAT, false, 0, 0)

    @gl.drawArrays(@gl.TRIANGLES, 0, @tris.length/2)
    @tris.length = 0
    @colors.length = 0

exports.WebGLContext = WebGLContext
