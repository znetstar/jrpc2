// Generated by CoffeeScript 1.12.7
(function() {
  var httpListener;

  exports.httpListener = httpListener = function(server) {
    return function(req, res) {
      var data;
      data = "";
      req.on('data', function(chunk) {
        return data += chunk;
      });
      return req.on('end', function() {
        req.client_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
        req.client_ip = req.client_ip.replace('::ffff:', '');
        return server.handleCall(data, req, function(answer) {
          if (answer) {
            res.writeHead(200, {
              'Content-Type': 'application/json'
            });
            res.write(JSON.stringify(answer));
          }
          res.emit('close');
          return res.end();
        });
      });
    };
  };

  exports.middleware = function(server) {
    var listener;
    listener = httpListener(server);
    return function(req, res, next) {
      if (req.method === 'POST') {
        return listener(req, res);
      } else {
        return next();
      }
    };
  };

}).call(this);