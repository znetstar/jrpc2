rpc = require './src/jrpc2'

x = new rpc.wsTransport({ port: 3000 })
s = new rpc.Server()
s.expose('test', () ->
    console.log('hi')
)
x.listen(s)