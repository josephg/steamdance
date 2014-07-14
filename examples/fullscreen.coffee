
sim = new Simulator()

el = document.getElementById 'bp'

bp = new Boilerplate el, sim

window.onresize = ->
  bp.resizeTo(window.innerWidth, window.innerHeight)

isEmpty = (obj) ->
  return false for k of obj
  return true

setInterval =>
  delta = sim.step()
  if !isEmpty delta.changed
    console.log 'draw', delta.changed
    bp.draw()
, 200

window.addEventListener 'copy', (e) ->
  document.activeElement?.boilerplate?.copy e

window.addEventListener 'paste', (e) ->
  document.activeElement?.boilerplate?.paste e

# putting autofocus in the html doesn't cut it for some reason.
el.focus()

Boilerplate.addKeyListener window

do ->
  panel = document.getElementsByClassName('toolpanel')[0]

  selected = null
  panel.onclick = (e) ->
    element = e.target
    return if element is panel

    Boilerplate.changeTool element.id

  Boilerplate.onToolChanged = (newTool) ->
    if selected
      selected.className = ''

    e = document.getElementById (newTool || 'solid')
    return unless e
    e.className = 'selected'
    selected = e


