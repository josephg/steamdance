{Watcher} = require 'boilerplate-jit'
{clamp} = require './util'

UP=0; RIGHT=1; DOWN=2; LEFT=3

# This stores & exports the view the user can currently see of boilerplate.
module.exports = class View
  constructor: (@width, @height, options) ->
    @watch = new Watcher ((fn) => fn @)
    @reset options

  reset: (options) ->
    @zoomLevel = options?.initialZoom ? 1
    @zoomBy 0
    # In tile coordinates
    @scrollX = options?.initialX ? 0
    @scrollY = options?.initialY ? 0
    @watch.signal @

  zoomBy: (diff, center) -> # center is {x, y}
    # console.log 'zoomBy', diff
    oldsize = @size

    @zoomLevel += diff
    @zoomLevel = clamp @zoomLevel, 1/20, 5

    # @size = Math.floor 20 * @zoomLevel
    @size = 20 * @zoomLevel

    # Recenter
    if center?
      @scrollX += center.x / oldsize - center.x / @size
      @scrollY += center.y / oldsize - center.y / @size
    @watch.signal @

  scrollBy: (dx, dy) -> # In pixels.
    @scrollX += dx / @size
    @scrollY += dy / @size
    @watch.signal @

  resizeTo: (@width, @height) ->
    @watch.signal @


  # Utility methods

  # given pixel x,y returns tile x,y
  screenToWorld: (px, py) ->
    return {tx:null, ty:null} unless px?
    # first, the top-left pixel of the screen is at |_ scroll * size _| px from origin
    px += Math.floor(@scrollX * @size)
    py += Math.floor(@scrollY * @size)
    # now we can simply divide and floor to find the tile
    tx = Math.floor(px / @size)
    ty = Math.floor(py / @size)
    {tx,ty}

  # Same as screenToWorld, but also returns which cell in the result.
  screenToWorldCell: (px, py, parsed) ->
    return {tx:null, ty:null} unless px?
    # This logic is adapted from screenToWorld above.
    px += Math.floor(@scrollX * @size)
    py += Math.floor(@scrollY * @size)
    tx_ = px / @size; ty_ = py / @size
    tx = Math.floor(tx_); ty = Math.floor(ty_)

    # There's no cell for solid (null) cells.
    v = parsed.get 'base', tx, ty
    return {tx, ty, tc:null} unless v

    offX = tx_ - tx; offY = ty_ - ty

    upRight = offX > offY
    downRight = offX + offY > 1
    tc = switch v
      when 'bridge'
        # The only cells are UP and RIGHT.
        if upRight != downRight then UP else RIGHT
      when 'ribbonbridge'
        if upRight != downRight then 0 else util.NUMINS
      when 'negative', 'positive'
        if upRight
          if downRight then RIGHT else UP
        else
          if downRight then DOWN else LEFT
      else
        0

    return {tx, ty, tc}

  # given tile x,y returns the pixel x,y,w,h at which the tile resides on the screen.
  worldToScreen: (tx, ty) ->
    return {px:null, py:null} unless tx?
    px: tx * @size - Math.floor(@scrollX * @size)
    py: ty * @size - Math.floor(@scrollY * @size)
