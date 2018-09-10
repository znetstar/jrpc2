// Generated by CoffeeScript 1.12.7
(function() {
  var Server, async, extend, fs, rpcError,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  fs = require('fs');

  async = require('async');

  extend = require('xtend');

  rpcError = require('./rpcError');

  Server = (function() {
    function Server(methods1) {
      this.methods = methods1 != null ? methods1 : 'methods';
      this.methodArgs = {};
      this.modules = {};
      this.context = {};
      Server.instance = this;
    }

    Server.prototype.expose = function(fullName, func) {
      var args, methodName, moduleName, ref;
      args = func.toString().match(/function[^(]*\(([^)]*)\)/)[1];
      this.methodArgs[fullName] = args ? args.split(/,\s*/) : [];
      ref = this.splitMethod(fullName), moduleName = ref[0], methodName = ref[1];
      if (!this.modules[moduleName]) {
        this.modules[moduleName] = {};
      }
      return this.modules[moduleName][methodName] = func;
    };

    Server.prototype.splitMethod = function(methodName) {
      var method, res;
      if (indexOf.call(methodName, ".") >= 0) {
        res = methodName.split('.');
        method = res.pop();
        return [res.join('.'), method];
      } else {
        return [this.methods, methodName];
      }
    };

    Server.prototype.getMethodContext = function(methodName) {
      var context, moduleName, ref;
      ref = this.splitMethod(methodName), moduleName = ref[0], methodName = ref[1];
      context = this.modules[moduleName];
      return extend(context, this.context);
    };

    Server.prototype.getMethod = function(methodName) {
      var moduleName, ref;
      ref = this.splitMethod(methodName), moduleName = ref[0], methodName = ref[1];
      return this.modules[moduleName][methodName];
    };

    Server.prototype.exposeModule = function(moduleName, module) {
      var methodName;
      for (methodName in module) {
        switch (typeof module[methodName]) {
          case "function":
            if (methodName !== "constructor") {
              this.expose(moduleName + "." + methodName, module[methodName]);
            }
            break;
          case "object":
            this.exposeModule(moduleName + "." + methodName, module[methodName]);
        }
      }
    };

    Server.prototype.checkAuth = function(call, req, callback) {
      return callback(true);
    };

    Server.prototype.loadModules = function(modulesDir, callback) {
      return fs.readdir(modulesDir, (function(_this) {
        return function(err, modules) {
          var check, j, len, module, moduleFile, moduleName;
          check = function(str, sub) {
            return str.indexOf(sub) !== -1;
          };
          if (!err) {
            for (j = 0, len = modules.length; j < len; j++) {
              moduleFile = modules[j];
              if (check(moduleFile, '.coffee') || check(moduleFile, '.js')) {
                module = require(modulesDir + moduleFile);
                moduleName = moduleFile.replace('.coffee', '').replace('.js', '');
                _this.exposeModule(moduleName, module);
              }
            }
          }
          if (callback) {
            return callback();
          }
        };
      })(this));
    };

    Server.prototype.invoke = function(req, methodName, params, callback) {
      var argNames, args, context, j, len, method, name, result;
      if (params == null) {
        params = [];
      }
      if (callback == null) {
        callback = function() {};
      }
      if (!this.methodArgs[methodName]) {
        return callback(rpcError.methodNotFound());
      }
      method = this.getMethod(methodName);
      context = this.getMethodContext(methodName);
      context.req = req;
      result = null;
      if (params instanceof Array) {
        result = method.apply(context, params);
      } else {
        argNames = this.methodArgs[methodName];
        args = [];
        for (j = 0, len = argNames.length; j < len; j++) {
          name = argNames[j];
          args.push(params[name]);
        }
        result = method.apply(context, args);
      }
      if ((result != null) && typeof result.then === 'function') {
        return result.then(function(res) {
          return callback(null, res);
        }, function(error) {
          return callback(error);
        });
      } else {
        if (result instanceof Error) {
          return callback(result);
        } else {
          return callback(null, result);
        }
      }
    };

    Server.prototype.batch = function(req, methods, params, finalCallback) {
      var i, j, len, list, method, param;
      if (finalCallback == null) {
        finalCallback = (function() {});
      }
      if (methods.length !== params.length) {
        return finalCallback(new Error("Wrong params"), null);
      }
      list = [];
      for (i = j = 0, len = methods.length; j < len; i = ++j) {
        method = methods[i];
        param = params[i];
        list.push((function(_this) {
          return function(callback) {
            return _this.invoke(req, method, param, callback);
          };
        })(this));
      }
      return async.series(list, finalCallback);
    };

    Server.prototype.handleSingle = function(call, req, callback) {
      var responseId, setError, setResult, setSuccess;
      responseId = typeof call.id === 'number' ? call.id : call.id || null;
      setError = function(error) {
        if (error instanceof Error) {
          error = rpcError.abstract(error.message, -32099, responseId);
        } else {
          error.id = responseId;
        }
        return callback(error);
      };
      setSuccess = function(result) {
        var response;
        response = {
          jsonrpc: '2.0',
          result: typeof result !== 'undefined' ? result : null,
          id: responseId
        };
        return callback(response);
      };
      setResult = function(err, result) {
        if (call.id == null) {
          return callback(null);
        } else {
          if (err != null) {
            return setError(err);
          } else {
            return setSuccess(result);
          }
        }
      };
      if (!(call instanceof Object)) {
        return setError(rpcError.invalidRequest());
      }
      if (!call.method || !call.jsonrpc || call.jsonrpc !== '2.0') {
        return setError(rpcError.invalidRequest(responseId));
      }
      if (!this.methodArgs[call.method]) {
        return setError(rpcError.methodNotFound(responseId));
      }
      return this.checkAuth(call, req, (function(_this) {
        return function(trusted) {
          if (!trusted) {
            return setResult(rpcError.abstract("AccessDenied", -32000, responseId));
          }
          return _this.invoke(req, call.method, call.params, setResult);
        };
      })(this));
    };

    Server.prototype.handleBatch = function(calls, req, callback) {
      var iterate;
      if (calls.length === 0) {
        return callback(rpcError.invalidRequest());
      }
      iterate = (function(_this) {
        return function(call, done) {
          return _this.handleSingle(call, req, function(res) {
            return done(null, res);
          });
        };
      })(this);
      return async.map(calls, iterate, function(err, results) {
        return callback(results.filter(function(v) {
          return v != null;
        }));
      });
    };

    Server.prototype.handleCall = function(json, req, reply) {
      var call, error;
      if (typeof json === "string") {
        try {
          call = JSON.parse(json);
        } catch (error1) {
          error = error1;
          return reply(rpcError.invalidRequest());
        }
      } else {
        call = json;
      }
      if (!(call instanceof Array)) {
        return this.handleSingle(call, req, reply);
      } else {
        return this.handleBatch(call, req, reply);
      }
    };

    return Server;

  })();

  Server.instance = {};

  module.exports = Server;

}).call(this);