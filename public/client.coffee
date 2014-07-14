
sim = null
boilerplate = null

start = (initialGrid) ->
  sim = new Simulator initialGrid

  container = document.getElementById 'bp'
  boilerplate = new Boilerplate container, sim

  # putting autofocus in the html doesn't cut it for some reason.
  container.focus()

  do window.onresize = ->
    boilerplate.resizeTo(window.innerWidth, window.innerHeight)

  sendTimer = null
  delta = null
  boilerplate.onEdit = (x, y, value) ->
    # Coalesce the edits
    delta ?= {}
    delta[[x,y]] = value

    if sendTimer is null
      sendTimer = setTimeout ->
        ws.send JSON.stringify {delta}
        delta = null
        sendTimer = null




ws = new WebSocket 'ws://' + window.location.host + window.location.pathname

ws.onerror = (err) ->
  console.err err
ws.onmessage = (msg) ->
  msg = JSON.parse msg.data
  if msg.initial
    start msg.initial
  else if msg.delta?.changed
    for k,v of msg.delta.changed
      {x,y} = Simulator.parseXY k
      sim.set x, y, v

    boilerplate.draw()





window.addEventListener 'copy', (e) ->
  document.activeElement?.boilerplate?.copy e

window.addEventListener 'paste', (e) ->
  document.activeElement?.boilerplate?.paste e

Boilerplate.addKeyListener window

# Setup the tool panel
do ->
  panel = document.getElementsByClassName('toolpanel')[0]

  selected = null
  panel.onclick = (e) ->
    element = e.target
    return if element is panel

    Boilerplate.changeTool element.id

  Boilerplate.onToolChanged = (newTool) ->
    console.log 'onToolChanged', newTool
    if selected
      selected.className = ''

    e = document.getElementById (newTool || 'solid')
    return unless e
    e.className = 'selected'
    selected = e

  Boilerplate.onToolChanged Boilerplate.activeTool


