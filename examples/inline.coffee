
for el in document.getElementsByClassName 'boilerplate'
  bp = new Boilerplate el, canScroll:no


###
setInterval =>
  sim.step()
  bp.draw()
, 200
###


window.addEventListener 'copy', (e) ->
  document.activeElement?.boilerplate?.copy e

window.addEventListener 'paste', (e) ->
  document.activeElement?.boilerplate?.paste e

Boilerplate.addKeyListener window

