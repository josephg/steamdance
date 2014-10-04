
for el in document.getElementsByClassName 'boilerplate'
  bp = new Boilerplate el, canScroll:no
  bp.addKeyListener window


###
setInterval =>
  sim.step()
  bp.draw()
, 200
###



