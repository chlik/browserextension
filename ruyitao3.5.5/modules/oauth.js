if ( !exports ) var exports = {};

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/util.js", S);
  S.exports.extend(S, S.exports);
  Components.utils.import("resource://ruyitao/console.js", S);
  S.console = S.exports.console;
  Components.utils.import("resource://ruyitao/browser.js", S);
  S.browser = S.exports.browser;

  var oauth = function(options) {
    this.authorize_url = options.authorize_url;
    this.redirect_url = options.redirect_url;
    this.resource_url = options.resource_url;
    this.appkey = options.appkey;
    this.storage = options.storage;
    this.preparedAuthorizationCallbacks = [];
    this.token = null;
  };

  oauth.tabs = {
    _data: {},
    add: function(authTabId, requestTabId, callback){
      this._data[authTabId] = {
        requestTab: requestTabId,
        authTab: authTabId,
        callback: callback
      };
    },
    has: function(tabId) {
      return this._data.hasOwnProperty(tabId);
    },
    get: function(tabId) {
      return this._data[tabId];
    },
    remove: function(tabId) {
      delete this._data[tabId];
    }
  };

  oauth.prototype.runPreparedAuthorizationCallbacksIfReady = function() {
    var callbacks = this.preparedAuthorizationCallbacks;
    if (callbacks.length) {
      for (var i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i][0].apply(this, callbacks[i][1]);
      }
      this.preparedAuthorizationCallbacks = [];
    }
  };

  oauth.prototype.addPreparedAuthorizationCallback = function(callback, args) {
    this.preparedAuthorizationCallbacks.push([callback, args]);
  }

  oauth.prototype.getAuthorizationUrl = function(logout) {
    var url= this.authorize_url + '?client_id=' + this.appkey
      + '&redirect_uri=' + encodeURIComponent(this.redirect_url)
      + '&response_type=token' + (logout ? '&logout=1' : '');
    S.console.debug('Authorization url: ' + url)
    return url
  };
  
  oauth.prototype.getAccessToken = function() {
    if ( null === this.token ) {
      this.token = {};
    // get_object returns null or object
      var token = this.storage.get_object("oauth_token/"+this.authorize_url+'/'+this.appkey);
      if (token) {
        try {
          if ( typeof token.expires != "undefined" && token.expires > (new Date()).getTime() ) {
            this.token = token;
          }
        } catch ( e ) {
          S.console.debug(e);
        }
      }
    }
    return this.token;
  };

  oauth.prototype.setAccessToken = function(token) {
    if ( token.expires_in ) {
      token.expires = (new Date()).getTime() + (token.expires_in-60) * 1000;
    }
    this.storage.set_object("oauth_token/"+this.authorize_url+'/'+this.appkey, token);
    this.token = token;
  };

  oauth.prototype.removeAccessToken = function(token) {
    this.storage.remove_object("oauth_token/"+this.authorize_url+'/'+this.appkey);
    this.token = {};
  };

  oauth.prototype.setTokenData = function(data) {
    var token = this.getAccessToken();
    if ( token ) {
      token = S.extend(token, data);
      this.setAccessToken(token);
    }
  };

  oauth.prototype.getTokenData = function(name) {
    var token = this.getAccessToken();
    return token ? token[name] : undefined;
  };

  // http://ruyi.taobao.com/service/access-token-callback.html#access_token=2.00RK6TKCIKZAJC518f464469l8He8E&remind_in=2591999&expires_in=2591999&uid=1987037273
  oauth.prototype.parseAccessToken = function(url) {
    var hash = url.split('#')[1];
    if (!hash || typeof hash !== 'string') {
      return;
    }

    var keyValues = hash.split('&');
    var token = {};

    for (var keyValue, i = 0, l = keyValues.length; i < l; i++) {
      keyValue = keyValues[i].split('=');
      token[keyValue[0]] = keyValue[1];
    }
    return token;
  };

  oauth.prototype.isAuthorized = function (){
    var token = this.getAccessToken();
    return typeof token != "undefined" && typeof token['access_token'] != "undefined";
  };

  oauth.prototype.authorize = function(tabId, callback, logout) {
    var self = this;
    if ( this.isAuthorized() ) {
      callback();
    } else {
      var authorize = function(tabId) {
        S.browser.tabs.create({
          url: self.getAuthorizationUrl(logout),
          selected: true
        }, function(authTab) {
          oauth.tabs.add(authTab.id, tabId, callback);
          self.runPreparedAuthorizationCallbacksIfReady();
        });
      };
      if ( tabId && ((typeof tabId == 'number' && tabId > 0) || typeof tabId == 'string') ) {
        authorize(tabId);
      } else {
        S.browser.tabs.getCurrent(function(tab){
          authorize(tab ? tab.id : '');
        });
      }
    }
  };

  oauth.prototype.storeAccessToken = function(authTabId, redirect_url) {
    if ( oauth.tabs.has(authTabId) ) {
      var token = this.parseAccessToken(redirect_url);
      if ( typeof token.access_token != "undefined" ) {
        this.setAccessToken(token);
      } else {
        S.console.debug("oauth get access token failed");
      }
    } else {
      this.addPreparedAuthorizationCallback(arguments.callee, [authTabId, redirect_url]);
      S.console.debug("oauth tab does not exists");
    }
  };

  oauth.prototype.authorizeCallback = function(authTabId) {
    if (!authTabId) {
      S.console.debug('Invalid authorization tab id.');
      return
    }

    var data = oauth.tabs.get(authTabId);
    if (data) {
      var requestTabId = data.requestTab;

      if (requestTabId &&
          ((typeof requestTabId == 'number' && requestTabId > 0) ||
           typeof requestTabId == 'string') ) {
        S.browser.tabs.update(requestTabId, {active: true});
      }
      data.callback();
      S.browser.tabs.remove(authTabId);
      oauth.tabs.remove(authTabId);
    } else {
      S.console.debug('No cached data found by authorization tab id: ' + authTabId);
      this.addPreparedAuthorizationCallback(arguments.callee, [authTabId]);
    }
  };

  oauth.prototype.request = function(options, reAuthorizeArgs){
    var self = this;
    var token = this.getAccessToken();
    if ( !token ) {
      return;
    }
    if ( typeof options.data == "undefined" ) {
      options.data = {};
    }
    options.data['access_token'] = token.access_token;
    options.url = this.resource_url + options.url;
    var tmpError = options.error;

    options.error = function(xhr, statusCode) {
      try {
        var res = JSON.parse(xhr.responseText);

        // 当 access token 无效时删除本地保存的 access token，下次请求时重新请求获取
        if (res.error && res.error == 'invalid_grant') {
          self.removeAccessToken();
        } else if (tmpError) {
          tmpError(xhr, statusCode);
        }
      } catch (e) {
        if (tmpError) {
          tmpError(xhr, statusCode);
        }
      } 
    };

    S.ajax(options);
  };

  S.oauth = oauth;
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
