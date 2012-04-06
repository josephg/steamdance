#http = require 'http'

express = require 'express'
app = express.createServer()

app.use express.static("#{__dirname}/")

simulator = new (require('./simulator'))

WebSocketServer = require('ws').Server
wss = new WebSocketServer {server: app}

si = (time, fn) -> setInterval fn, time

si 200, ->
  delta = simulator.step()
  for k, v of delta
    for c in wss.clients
      c.send JSON.stringify {delta}

    console.log delta
    break

wss.on 'connection', (ws) ->
  ws.on 'message', (msg) ->
    console.log msg
    try
      msg = JSON.parse msg
      if msg.delta
        for k, v of msg.delta
          [_,x,y] = /^(\d+),(\d+)$/.exec k
          x = parseInt x
          y = parseInt y

          simulator.set x, y, v
    catch e
      console.log 'invalid JSON', e

  ws.send JSON.stringify({delta:simulator.grid})

app.listen 8080

