{util} = require 'boilerplate-jit'
Boilerplate = require '../lib/boilerplate.coffee'
fl = Math.floor

moduleData = []
selectedModule = null
elementForModuleData = new Map

addModElem = document.getElementById 'addmod'

selectModule = (m) ->
  return if m == selectedModule

  if selectedModule
    selectedModule.classList.remove 'selected'
    selectedModule = null
  if m
    m.classList.add 'selected'
    addModElem.style.display = 'none'
    selectedModule = m
addModElem.style.display = 'none'

drawTo = (data, size, ctx) ->
  # ctx.fillStyle = Boilerplate.colors['solid']
  # ctx.fillRect 0, 0, data.tw * size, data.th * size

  data.base.forEach (x, y, v) ->
    px = x * size; py = y * size
    v = data.shuttles.get(x, y) or v
    ctx.fillStyle = Boilerplate.colors[v]
    console.log v, Boilerplate.colors[v]
    ctx.fillRect px, py, size, size

exports.addModule = addModule = (data) ->
  container = document.getElementById 'moduleList'
  moduleData.push data

  moduleElem = document.createElement 'div'
  moduleElem.className = 'module'
  elementForModuleData.set data, moduleElem
  # console.log 'insert before', addModElem.nextSibling
  container.insertBefore moduleElem, addModElem.nextSibling

  canvas = document.createElement 'canvas'
  moduleElem.appendChild canvas

  throw Error 'need w/h' unless data.tw?
  {tw, th} = data
  width = canvas.clientWidth; height = canvas.clientHeight
  size = fl Math.min width / tw, height / th
  # width = size * tw; height = size * th
  console.log canvas.clientWidth, canvas.clientHeight, width, height
  canvas.width = width * devicePixelRatio
  canvas.height = height * devicePixelRatio

  ctx = canvas.getContext '2d'
  ctx.scale devicePixelRatio, devicePixelRatio
  ctx.translate fl((width - size * tw)/2), fl((height - size * th)/2)

  drawTo data, size, ctx
  ctx.strokeStyle = 'rgba(0,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect 1, 1, size*tw - 2, size*th - 2

  moduleElem.onclick = ->
    selectModule moduleElem
    bp.setSelection data

  return moduleElem

# Load modules into list
exports.load = (bp) ->
  modules = JSON.parse (localStorage.getItem('bp modules') || '[]')

  for raw in modules
    addModule util.deserializeRegion raw

  bp.onSelection = (data) ->
    console.log 'selection'
    # console.log 'selection', data, JSON.stringify toJSON data
    # document.getElementById('addmod').style.display = 'none'
    # addModElem.style.removeProperty 'height'
    if (e = elementForModuleData.get data)
      selectModule e
    else
      selectModule null
      addModElem.style.display = 'inherit'
    # drawTo data, document.getElementById('hackoverlay')

  do bp.onSelectionClear = ->
    console.log 'selection clear'
    # addModElem.style.height = '0'
    selectModule null

  addModElem.onclick = ->
    if (s = bp.selection)
      m = addModule s
      selectModule m

# addModule util.deserializeRegion  {"tw":4,"th":5,"base":{"1,1":"thinsolid","1,2":"bridge","1,3":"positive","2,1":"thinsolid","2,2":"bridge","2,3":"negative","3,1":"thinsolid","3,2":"thinsolid"},"shuttles":{"1,2":"shuttle"}}

# addModule util.deserializeRegion {"tw":5,"th":3,"base":{"1,1":"positive","2,1":"nothing","3,1":"nothing"},"shuttles":{"3,1":"shuttle"}}
