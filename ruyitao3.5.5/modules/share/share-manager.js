if ( !exports ) var exports = {};

(function(S, undefined) {
S.ShareSite = function(id) {
  this.id = id;
};

S.ShareSite.prototype = {
  getAuthorizationUrl: function() {},
  parseAccessToken: function(url) {},

  /**
   * 使用微博短链接 API 缩短 URL
   * 同时检测 access token 的有效性
   * @param  {string}   accessToken 
   * @param  {string}   longUrl     要缩短的 URL
   * @param  {Function} callback    回调函数
   */
  shortenUrl: function(accessToken, longUrl, callback) {},
  uploadImageByData: function(accessToken, textContent, imageData, callback) {},
  uploadImageByUrl: function(accessToken, textContent, imageUrl, callback) {},
  followRuyitao: function(accessToken, callback) {},
  handleError: function(res) {}
};

S.ShareManager = {
  sites: {},

  registerSite: function(id, site) {
    this.sites[id] = site;
  },

  getSiteBySiteId: function(id) {
    return this.sites[id];
  },

  /*
     cache 用来保存 site id/authorization id/source id 和 share options，
     key 为 share id，为唯一的一次分享，这里用 siteId + sourceId 表示。
   */
  cache: {},

  getSiteId: function(shareId) {
    var info = this.cache[shareId] || {};
    return info.site;
  },

  setSiteId: function(shareId, siteId) {
    if (!this.cache[shareId]) {
      this.cache[shareId] = {};
    }
    this.cache[shareId].site = siteId;
  },

  getSourceTabId: function(shareId) {
    var info = this.cache[shareId] || {};
    return info.source;
  },

  setSourceTabId: function(shareId, srcTabId) {
    if (!this.cache[shareId]) {
      this.cache[shareId] = {};
    }
    this.cache[shareId].source = srcTabId;
  },

  setAuthorizationTabId: function(shareId, authorizationTabId) {
    if (!this.cache[shareId]) {
      this.cache[shareId] = {};
    }
    this.cache[shareId].authorization = authorizationTabId;
  },

  getShareIdByAuthorizationTabId: function(id) {
    var cache = this.cache;
    for (var shareId in cache) {
      if (cache[shareId] && cache[shareId].authorization == id) {
        return shareId;
      }
    }
    return '';
  },

  setOptions: function(shareId, options) {
    if (!this.cache[shareId]) {
      this.cache[shareId] = {};
    }
    this.cache[shareId].options = options;
  },

  getOptions: function(shareId) {
    var info = this.cache[shareId] || {};
    return info.options;
  },

  clearCache: function(shareId) {
    this.cache[shareId] = undefined;
  }
};

S.ShareError = {
  INVALID_ACCESS_TOKEN: {
    id: 'invalid_access_token',
    text: '\u65e0\u6548\u7684\u6388\u6743\u3002'
  },
  REPEAT_CONTENT: {
    id: 'repeat_content',
    text: '\u4f60\u5df2\u7ecf\u5206\u4eab\u8fc7\u4e00\u6b21\u76f8\u540c\u7684\u5185\u5bb9\u3002'
  },
  FORBID_WORD: {
    id: 'forbid_word',
    text: '\u4f60\u5206\u4eab\u7684\u5185\u5bb9\u4e2d\u53ef\u80fd\u542b\u6709\u654f\u611f\u8bcd\u3002'
  }
};

})(exports);

var EXPORTED_SYMBOLS = ["exports"];
