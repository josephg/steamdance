#http = require 'http'

http = require 'http'
level = require 'level'
express = require 'express'
path = require 'path'
Simulator = require 'boilerplate-sim'
fs = require 'fs'

app = express()
# For simulator.js
app.use express.static path.dirname(require.resolve('boilerplate-sim'))
app.use express.static "#{__dirname}/public"

index = fs.readFileSync 'public/client.html', 'utf8'
app.get '/', (req, res) -> res.redirect '/world/boilerplate'
app.get '/world/:worldname', (req, res) ->
  res.send index

server = http.createServer app
port = 8011

#worldname = process.argv[2] ? 'boilerplate'
#console.log "Opening file #{worldname}"

# Map from world name -> {simulator, clients list}
worlds = {}

db = level 'db', valueEncoding:'json'

ws = require 'ws'
WebSocketServer = ws.Server
wss = new WebSocketServer {server}

addClient = (worldname, client) ->
  world = worlds[worldname]

  # Should error or something I guess. the client just won't work at all.
  return if !world

  client.send JSON.stringify({initial:world.simulator.grid})
  world.clients.push client
  address = client.upgradeReq.connection.remoteAddress
  console.log "connection #{world.clients.length} on world #{worldname} from #{address}"

  remove = ->
    return unless world
    idx = world.clients.indexOf client
    return unless idx >= 0

    world.clients.splice idx, 1
    console.log "Client disconnected from #{worldname}. #{world.clients.length} remain"
    if !world.clients.length
      console.log "Unloading #{worldname}"
      delete worlds[worldname]
      world = null

  client.on 'close', remove
  client.on 'error', (e) ->
    console.log 'Error in websocket client: ', e.stack
    remove()

  client.on 'message', (msg) ->
    #console.log msg
    return console.warn "World #{worldname} already unloaded" unless world
    try
      msg = JSON.parse msg
      if msg.delta
        for k, v of msg.delta
          [x,y] = k.split /,/
          x = parseInt x
          y = parseInt y

          world.simulator.set x, y, v
    catch e
      console.log 'invalid JSON', e, msg


wss.on 'connection', (client) ->
  url = client.upgradeReq.url
  return unless path.dirname(url) is '/world'
  worldname = path.basename url

  return addClient(worldname, client) if worlds[worldname]

  db.get worldname, (error, value) ->
    #return console.error('Error loading world', error.stack, value) if error
    if !value? # Lets just hope its a world-not-found situation
      console.log "Created new world #{worldname}"
      value = {}

    # World may have loaded while we were loading.
    if !worlds[worldname]
      simulator = new Simulator value
      console.log "#{worldname} loaded: #{Object.keys(simulator.grid).length} cells set"

      worlds[worldname] = {simulator:simulator, clients:[]}

    addClient(worldname, client)

run = (error, value) ->
  setInterval ->
    for worldname, {simulator, clients} of worlds
      delta = simulator.step()
      send = false
      for k, v of delta.changed
        send = true
        break
      for k, v of delta.sound
        send = true
        break

      if send
        # Update db
        db?.put worldname, simulator.grid

        # Update clients
        msg = JSON.stringify {delta}
        for c in clients when c.readyState is ws.OPEN
          c.send msg
  , 200

server.listen port
console.log "Listening on port #{port}"
run()

