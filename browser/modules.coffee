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
  data.base.forEach (x, y, v) ->
    px = x * size; py = y * size
    v = data.shuttles.get(x, y) or v
    ctx.fillStyle = Boilerplate.colors[v]
    ctx.fillRect px, py, size, size

save = ->
  json = moduleData.map (data) ->
    result = {base:{}, shuttles:{}}
    result.tw = data.tw; result.th = data.th
    data.base.forEach (x, y, v) -> result.base[[x,y]] = v
    data.shuttles.forEach (x, y, v) -> result.shuttles[[x,y]] = v
    return result

  localStorage.setItem 'bp modules', JSON.stringify json

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

  # I did all this with a pseudo-selector (:after) but it didn't work because
  # you can't register onclick on them. Poo.
  rm = document.createElement 'div'
  rm.classList.add 'rm'
  rm.textContent = '\u232B'
  moduleElem.appendChild rm

  throw Error 'need w/h' unless data.tw?
  {tw, th} = data
  width = canvas.clientWidth; height = canvas.clientHeight
  size = fl Math.min width / tw, height / th
  # width = size * tw; height = size * th
  # console.log canvas.clientWidth, canvas.clientHeight, width, height
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
    # console.log 'elem click'
    selectModule moduleElem
    bp.setSelection data

  rm.onclick = (e) ->
    # console.log 'e click'
    if selectedModule is moduleElem
      selectModule null
      addModElem.style.display = 'inherit'
    delete rm.onclick
    delete moduleElem.onclick
    container.removeChild moduleElem
    elementForModuleData.delete data
    idx = moduleData.indexOf data
    moduleData.splice idx, 1
    # console.log moduleData
    e.stopPropagation()
    save()

  save()

  return moduleElem

# Load modules into list
exports.load = (bp) ->
  modules = JSON.parse (localStorage.getItem('bp modules') || '[]')

  for raw in modules
    addModule util.deserializeRegion raw

  bp.onSelection = (data) ->
    # console.log 'selection', data
    # document.getElementById('addmod').style.display = 'none'
    # addModElem.style.removeProperty 'height'
    if (e = elementForModuleData.get data)
      selectModule e
    else
      selectModule null
      addModElem.style.display = 'inherit'
    # drawTo data, document.getElementById('hackoverlay')

  do bp.onSelectionClear = ->
    # console.log 'selection clear'
    # addModElem.style.height = '0'
    selectModule null

  addModElem.onclick = ->
    if (s = bp.selection)
      m = addModule s
      selectModule m
