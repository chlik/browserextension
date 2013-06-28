if ( !exports ) var exports = {};

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/storage.js", S);
  S.storage = S.exports.storage;
  Components.utils.import("resource://ruyitao/cache.js", S);
  S.cache = S.exports.cache;
  Components.utils.import("resource://ruyitao/constants.js", S);
  S.constants = S.exports.constants;

  var get_cached_object = function (creator) {
    var obj = undefined;
    return function() {
      if ( obj )
        return obj;
      if ( typeof obj == "undefined" ) {
        obj = creator();
      }
      return obj;
    };
  };

  var factory = {};

  factory.init = function(options) {
    options = options || {};
    this.storage = options.storage;
  };

  factory.getStorage = function (namespace) {
    return new S.storage(namespace, this.storage);
  };

  factory.getCache = get_cached_object(function () {
    var cache = new S.cache({
      max_size: S.constants.cache_size,
      expire_time: S.constants.cache_expire_time,
      storage: factory.getStorage("cache")
    });
    var total = 0;
    cache.storage.each(function() { total++ });
    cache._count = total;
    return cache;
  });

  factory.getRuyitaoOauth = get_cached_object(function() {
    Components.utils.import("resource://ruyitao/oauth.js", S);
    S.oauth = S.exports.oauth;
    var base_url = 'http://ruyi.taobao.com/my';
    var oauth = new S.oauth({
      appkey: '1362053493',
      authorize_url: base_url + '/oauth/authorize',
      resource_url: base_url,
      redirect_url: 'http://ruyi.taobao.com/service/access-token-callback.html?app=ruyitao',
      storage: factory.getStorage('extension')
    });
    oauth.getUserInfo = function(callback) {
      if ( oauth.isAuthorized() ) {
        this.request({
          url: '/api/me',
          success: function(data) {
            if ( data.nick ) {
              oauth.setTokenData({nick: data.nick,user_id: data.user_id});
              callback && callback(data);
            } else if (data.error)  {
              callback && callback();
            }
          },
          error: function(xhr, statusCode, e) {
            if ( statusCode == '401' ) {
              oauth.removeAccessToken();
            }
            callback && callback();
          }
        });
      } else {
        if ( callback ) callback();
      }
    };
    return oauth;
  });

  S.factory = factory;
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
