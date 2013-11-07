#http = require 'http'

http = require 'http'
level = require 'level'
express = require 'express'
Simulator = require './simulator'
app = express()

app.use express.static("#{__dirname}/")
server = http.createServer app
port = 8080

run = (error, value) ->
  #value = JSON.parse value if value
  
  simulator = new Simulator value
  console.log "#{Object.keys(simulator.grid).length} cells set"

  WebSocketServer = require('ws').Server
  wss = new WebSocketServer {server}
  si = (time, fn) -> setInterval fn, time
  si 200, ->
    delta = simulator.step()
    for k, v of delta
      # Update db
      db?.put 'boilerplate', simulator.grid

      # Update clients
      for c in wss.clients
        c.send JSON.stringify {delta}

      #console.log delta
      break

  wss.on 'connection', (ws) ->
    ws.on 'message', (msg) ->
      #console.log msg
      try
        msg = JSON.parse msg
        if msg.delta
          for k, v of msg.delta
            [x,y] = k.split /,/
            x = parseInt x
            y = parseInt y

            simulator.set x, y, v
      catch e
        console.log 'invalid JSON', e, msg

    ws.send JSON.stringify({delta:simulator.grid})

  server.listen port
  console.log "Listening on port #{port}"

db = level 'db', valueEncoding:'json'
db.get 'boilerplate', run
