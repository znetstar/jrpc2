[![Build Status](https://travis-ci.org/Santinell/jrpc2.svg?branch=master)](https://travis-ci.org/Santinell/jrpc2) [![Coverage Status](https://coveralls.io/repos/Santinell/jrpc2/badge.png)](https://coveralls.io/r/Santinell/jrpc2)

![NPM Info](https://nodei.co/npm/jrpc2.png?downloads=true)
JRPC2
=====

JSON-RPC 2.0 library with support of batches and named parameters.

Supported protocols:
+ **HTTP(S)** + **WebSocket**, **WebSocket Secure**
+ **TCP**
+ **ZeroMQ**
+ **Express/Connect** middleware.

Features: simple loading of modules; extending of method's scope by change context of server.


INSTALL
=====

```bash
npm install jrpc2
```

EXAMPLES
=====

Server example:

```javascript
  var rpc = require('jrpc2');

  var server = new rpc.server;

  server.loadModules(__dirname + '/modules/', function () {
    var http = new rpc.httpTransport({port: 8080, websocket: true});
    http.listen(server);
  });
```

It's very simple way to load modules. Just put it in one directory.

Example of 'logs' module (./modules/logs.js in this example):

```javascript

  var logs = {
    userLogout: function (timeOnSite, lastPage) {
      var coll = this.db.collection('logs');
      coll.insert({ip: this.ip, userId: this.user.userId, addTime: new Date(), 
        text: "User logout. Spend on site:"+timeOnSite+" sec. Last page: "+lastPage});
    },
    loginBruteForce: function () {
      var coll = this.db.collection('logs');
      coll.insert({ip: this.ip, userId: null, addTime: new Date(), text: "Brute force of login form"});
    }
  };

  module.exports = logs;
```

Client example:

```javascript
  var rpc = require('jrpc2');

  var http = new rpc.httpTransport({port: 8080, hostname: 'localhost'});

  var client = new rpc.client(http);

  //single call with named parameters
  client.call('users.auth', {password: "swd", login: "admin"}, function (err, raw) {
    console.log(err, raw);
  });

  //single call with positional parameters
  client.call('users.auth', ["user", "pass"], function (err, raw) {
    console.log(err, raw);
  });

  //methods and parameters for batch call
  var methods = ["users.auth",  "users.auth"];
  var params = [
    {login: "cozy", password: "causeBorn"},
    ["admin", "wrong"]
  ];
  client.batch(methods, params, function (err, raw) {
    console.log(err, raw);
  });
```

ZeroMQ server

```javascript
  var rpc = require('jrpc2');

  var server = new rpc.server;  

  server.loadModules(__dirname + '/modules/', function () {
    var zmq = new rpc.zmqTransport({url: 'tcp://127.0.0.1:5555'});
    zmq.listen(server);
  });
```
ZeroMQ client:

```javascript
  var rpc = require('jrpc2');

  var zmq = new rpc.zmqTransport({url: 'tcp://127.0.0.1:5555'});

  var client = new rpc.client(zmq);

  client.call('users.auth', ["admin","swd"], function (err, raw) {
    console.log(err, raw);
  });
```

Using as Express/Connect middleware:

```javascript

var rpc = require('jrpc2');
var express = require('express');
var server = new rpc.server();
var app = express();

server.loadModules(__dirname + '/modules/', function () {
  app.use(rpc.middleware(server));  
  app.listen(80);
});

```

Complex example of Express/Connect + httpTransport with checkAuth and change of context:

(for async checkAuth you can use promises)
```javascript

var rpc = require('jrpc2');
var url = require('url');
var mongoose = require('mongoose');
var express = require('express');
var server = new rpc.server();
var app = express();

server.loadModules(__dirname + '/modules/', function () {
    app.use(rpc.middleware(server));
    var https = new rpc.httpTransport({
      framework: app,
      port: 8443,
      ssl: true,
      key: fs.readFileSync(__dirname + '/keys/ssl-key.pem'),
      cert: fs.readFileSync(__dirname + '/keys/ssl-cert.pem')
    });
    mongoose.connect('mongodb://127.0.0.1:27017/test', function (err, db) {
        //this is our new context
        var global = {};
        global.mongoose = mongoose;
        global.db = db;
        //there you can check IP, session ID or login and password of basic auth in headers.
        //And check whether the user has access to that method
        server.checkAuth = function (method, params, headers) {
            if (method === 'users.auth') {//for methods that don't require authorization
                return true;
            } else {
                if (!headers.user)
                    var cookies = url.parse('?' + (headers.cookie || ''), true).query;
                    var sessionID = cookies.sessionID || '';
                    var query = db.collection('users').findOne({session_id: sessionID});
                    var promise = query.exec(function(err, user) {
                      if (err)
                        return false; 
                      headers.user = user;
                      return true;
                    });
                    return promise;
            }
        }
        //There we set context
        server.context = global;
        https.listen(server);
    });

});
```

And now you can use context in your modules (for async methods you can use promises):

```javascript

  var users = {
    auth: function(login, password) {
      //this.db from server.context
      var query = this.db.collection('users').findOne({login: login, password: password});
      var promise = query.exec(function(err, user) {
        if (err) {
          throw new Error('Wrong login or password');
        }
        return {sessionId: user.sessionId};
      });
      return promise;
    }
  };

  module.exports = users;
```

Https client with auth and notification:

```javascript
  var rpc = require('jrpc2');

  //ignore self-signed sertificate, remove for production
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  var https = new rpc.httpTransport({port: 8443, hostname: 'localhost', ssl: true});
  var client = new rpc.client(https);

  client.call('users.auth', {password: "swd", login: "admin"}, function (err, raw) {
    var obj = JSON.parse(raw);
    if (obj.error) {
        console.log(obj.error.description);
    } else { //successful auth
      https.setHeader('Cookie', 'sessionID=' + obj.result.sessionID);
      client.notify('logs.userLogout', {timeOnSite: 364, lastPage: '/price'});
    }
  });
```