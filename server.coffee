#http = require 'http'

try
  redis = require 'redis'
express = require 'express'
Simulator = require './simulator'
app = express.createServer()

app.use express.static("#{__dirname}/")
port = 8080

run = (error, value) ->
  value = JSON.parse value if value
  
  simulator = new Simulator value
  console.log simulator.grid

  WebSocketServer = require('ws').Server
  wss = new WebSocketServer {server: app}
  si = (time, fn) -> setInterval fn, time
  si 200, ->
    delta = simulator.step()
    for k, v of delta
      # Update db
      db?.set 'boilerplate', JSON.stringify(simulator.grid)

      # Update clients
      for c in wss.clients
        c.send JSON.stringify {delta}

      console.log delta
      break

  wss.on 'connection', (ws) ->
    ws.on 'message', (msg) ->
      #console.log msg
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
  console.log "Listening on port #{port}"

if redis?
  db = redis.createClient()
  db.on 'ready', -> db.get 'boilerplate', run
else
  run null, '{}'
