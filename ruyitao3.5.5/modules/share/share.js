/**
 * share.js - 分享功能的主逻辑模块
 */

if ( !exports ) var exports = {};

var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
  .getService(Components.interfaces.nsIWindowMediator);  
var gBrowser = wm.getMostRecentWindow("navigator:browser").gBrowser;
var window = gBrowser.contentWindow;
var document = window.document;

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/console.js", S);
  S.console = S.exports.console;
  Components.utils.import("resource://ruyitao/browser.js", S);
  S.browser = S.exports.browser;
  Components.utils.import("resource://ruyitao/factory.js", S);
  S.factory = S.exports.factory;
  Components.utils.import("resource://ruyitao/share/share-manager.js", S);
  S.ShareManager = S.exports.ShareManager;
  S.ShareError = S.exports.ShareError;
  Components.utils.import("resource://ruyitao/share/sina-weibo.js", S);
  S.SinaWeibo = S.exports.SinaWeibo;

var Manager = S.ShareManager;
var Share = S.Share = {
  storage: null,
  storageKey: 'share_access_tokens',

  init: function(storage) {
    this.storage = storage || S.factory.getStorage('persist');
    var self = this;
    Manager.registerSite('sina_weibo', S.SinaWeibo);
  },

  getCachedAccessToken: function(siteId) {
    var accessTokens = this.storage.get_object(this.storageKey);
    if (accessTokens) {
      return accessTokens[siteId];
    } else {
      return '';
    }
  },

  cacheAccessToken: function(siteId, accessToken) {
    var accessTokens = this.storage.get_object(this.storageKey) || {};
    accessTokens[siteId] = accessToken;
    this.storage.set_object(this.storageKey, accessTokens);
  },

  removeAccessToken: function(siteId) {
    var accessTokens = this.storage.get_object(this.storageKey);
    if (accessTokens) {
      accessTokens[siteId] = undefined;
      this.storage.set_object(this.storageKey, accessTokens);
    }
  },

  handleRequest: function(options) {
    var self = this;
    var siteId = options.siteId;
    var srcTabId = options.srcTabId;
    var shareId = siteId + '_' + srcTabId;

    S.console.debug('[share site] site id: ' + siteId);

    Manager.setOptions(shareId, options);
    Manager.setSiteId(shareId, siteId);

    // 保存分享来源页面 tab id 以供后续重新激活
    Manager.setSourceTabId(shareId, srcTabId);

    // 截图并马上返回。
    // 1. 提高速度；
    // 2. 避免授权后回到源页面截图的时候比价 popup 已经消失，导致截图错误。
    if (options.imageType == 'capture') {
      this.capture(options.imageWidth, options.imageHeight,
                   options.top, options.left, function(dataUrl) {
        S.browser.tabs.sendRequest(srcTabId, {
          topic: 'capture_image_data',
          imageData: dataUrl
        });
      });
    }

    // 首先尝试从本地缓存读取 access token
    var accessToken = this.getCachedAccessToken(siteId);
    if (accessToken) {
      this.shortenUrl(shareId, accessToken);
    } else {
      // 弹出授权页面，回调函数为 self.handleAccessToken()
      this.getAccessToken(siteId, function(tab) {
        // 保存授权页面的 tab id 以供后续关闭
        Manager.setAuthorizationTabId(shareId, tab.id);
      });
    }
  },

  /**
   * 打开授权请求页面获取 access token，回调函数为 this.handleAccessToken
   */
  getAccessToken: function(siteId, callback) {
    var site = Manager.getSiteBySiteId(siteId);
    var self = this;
    var authorizationUrl = site.getAuthorizationUrl();
    S.browser.tabs.create({
      url: authorizationUrl,
      selected: true
    }, callback);
  },

  /**
   * 关闭 callback 页面并转回原页面，缓存 access token
   * @param {string} url 回调包含 access token 或错误信息的 url
   */
  handleAuthorizationCallback: function(url, authorizationTabId) {
    S.console.debug('[share authorization url] url: ' + url);
    var shareId = Manager.getShareIdByAuthorizationTabId(authorizationTabId);
    if (!shareId)
      return;
    var srcTabId = Manager.getSourceTabId(shareId);
    var siteId = Manager.getSiteId(shareId);
    var site = Manager.getSiteBySiteId(siteId);
    if (!site)
      return;
    var parseResult = site.parseAccessToken(url);

    removeTab(authorizationTabId);
    activeTab(srcTabId);

    if (parseResult.success) {
      var accessToken = parseResult.accessToken;
      this.cacheAccessToken(siteId, accessToken);
      this.shortenUrl(shareId, accessToken);
    } else {
      // 授权失败，暂无任何操作。
    }
  },

  // 耗费时间在 50ms 上下
  shortenUrl: function(shareId, accessToken) {
    var self = this;
    var siteId = Manager.getSiteId(shareId);
    var site = Manager.getSiteBySiteId(siteId);
    var srcTabId = Manager.getSourceTabId(shareId);
    var opts = Manager.getOptions(shareId);
    var url = opts.url;

    site.shortenUrl(accessToken, url, function(result) {
      var response = {
        topic: 'short_url'
      };

      if (result.success) {
        response.shortUrl =  result.shortUrl;
        S.console.debug('[short url] url: ' + result.shortUrl);
      } else {
        var reason = Manager.getSiteBySiteId(siteId).handleError(result.reason);
        S.console.debug('[shorten url failed] reason: ' + reason.error);

        // 无效的 access token，删除本地缓存的 access token，并重新请求获取
        if (reason == S.ShareError.INVALID_ACCESS_TOKEN) {
          self.removeAccessToken(siteId);
          self.getAccessToken(siteId, function(tab) {
            // 保存授权页面的 tab id 以供后续关闭
            Manager.setAuthorizationTabId(shareId, tab.id);
          });
        }
      }

      S.browser.tabs.sendRequest(srcTabId, response);
    });
  },

  // 耗费时间比较多的部分，其中 tabs.captureVisibleTab() 耗时最多，其次是
  // context.drawImage 和 image.onload
  capture: function(width, height, top, left, callback) {
    var self = this;
    var options = {
      top: top,
      left: left,
      width: width,
      height: height
    };
    S.browser.tabs.captureVisibleTab(options, callback);
  },

  cropImage: function(dataUrl, width, height, top, left, callback) {
    var body = document.body;
    var canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    body.appendChild(canvas);

    var image = new Image();
    image.onload = function() {
      var context = canvas.getContext('2d');
      context.drawImage(image, left, top, width, height, 0, 0, width, height);
      callback(canvas.toDataURL());
      body.removeChild(canvas);
    };
    image.src = dataUrl;
  },

  share: function(options, callback) {
    var siteId = options.siteId;
    var site = Manager.getSiteBySiteId(siteId);
    var accessToken = this.getCachedAccessToken(siteId);

    if (options.followRuyitao) {
      site.followRuyitao(accessToken);
    }

    var textContent = options.textContent;
    if (options.imageData) {
      site.uploadImageByData(accessToken, textContent, options.imageData, uploadCallback);
    } else if (options.imageUrl) {
      site.uploadImageByUrl(accessToken, textContent, options.imageUrl, uploadCallback);
    }

    function uploadCallback(res, status) {
      var result = {
        success: false
      };

      if (res.error && res.error_code != '20032') {
        result.reason = site.handleError(res);
        S.console.debug('share failed] reason: ' + result.reason.error);
      } else {
        result.success = true;
        result.shareLink = site.getShareLink(res);
      }

      callback(result);
    }
  }
};

function removeTab(tabId, callback) {
  S.browser.tabs.remove(tabId, callback);
}

function activeTab(tabId, callback) {
  S.browser.tabs.update(tabId, {
    selected: true // chrome 19 中使用 active 代替 selected，后者仍保留
  }, callback);
}

})(exports);

var EXPORTED_SYMBOLS = ["exports"];
