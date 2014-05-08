#TODO make mocha tests of httpClient
rpc = require '../src/jrpc2.coffee'

http = new rpc.httpTransport { uri: 'http://localhost:8080/' }
client = new rpc.client http

client.call 'users.auth', ["admin", "swd"], (err, raw) ->
  console.log err, raw

client.call 'users.auth', {password: "pass", login: "user"}, (err, raw) ->
  console.log err, raw

methods = [
  'users.auth',
  'users.auth'
]
params = [
  {login: "cozy", password: "causeBorn"},
  ["admin", "wrong"]
]
client.batch methods, params, (err, raw) ->
  console.log err, raw