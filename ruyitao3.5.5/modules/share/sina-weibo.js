if ( !exports ) var exports = {};

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/util.js", S);
  S.exports.extend(S, S.exports);
  Components.utils.import("resource://ruyitao/share/share-manager.js", S);
  S.ShareError = S.exports.ShareError;

var APPKEY = '1965387856';
var AUTHORIZE_URL = 'https://api.weibo.com/oauth2/authorize';
var SHORTEN_URL = 'https://api.weibo.com/2/short_url/shorten.json';
var REDIRECT_URL = 'http://ruyi.taobao.com/service/access-token-callback.html';
var UPLOAD_IMAGE_DATA_URL = 'https://upload.api.weibo.com/2/statuses/upload.json';
var UPLOAD_IMAGE_LINK_URL = 'https://api.weibo.com/2/statuses/upload_url_text.json';
var FOLLOW_USER_URL = 'https://api.weibo.com/2/friendships/create.json';
var RUYITAO_UID = '2401189514';

S.SinaWeibo = {
  getAuthorizationUrl: function() {
    return AUTHORIZE_URL + '?client_id=' + APPKEY +
      '&redirect_uri=' + REDIRECT_URL + '&response_type=token';
  },

  // http://ruyi.taobao.com/service/access-token-callback.html#access_token=2.00RK6TKCIKZAJC518f464469l8He8E&remind_in=2591999&expires_in=2591999&uid=1987037273
  parseAccessToken: function(url) {
    var result = {
      success: false
    };
    var hash = url.split('#')[1];
    if (!hash || typeof hash !== 'string') {
      return result;
    }

    var keyValues = hash.split('&');
    var response = {};

    for (var keyValue, i = 0, l = keyValues.length; i < l; i++) {
      keyValue = keyValues[i].split('=');
      response[keyValue[0]] = keyValue[1];
    }

    if (!response.error && response.access_token) {
      result.success = true;
      result.accessToken = response.access_token;
    }

    return result;
  },

  shortenUrl: function(accessToken, longUrl, callback) {
    var options = {
      url: SHORTEN_URL,
      data: {
        access_token: accessToken,
        url_long: longUrl
      },

      complete: function(res, status) {
        var urls = res.urls;
        var result = {
          success: false
        };

        if (!res.error && urls && urls[0].result) {
          result.success = true;
          result.shortUrl = res.urls[0].url_short;
        } else {
          result.reason = res;
        }
        callback(result);
      }
    };
    
    S.ajax(options);
  },

  uploadImageByData: function(accessToken, textContent, imageData, callback) {
    textContent = encodeURIComponent(textContent);
    var options = {
      url: UPLOAD_IMAGE_DATA_URL,
      textData: {
        access_token: accessToken,
        status: textContent
      },
      binaryData: {
        name: 'pic',
        data: imageData,
        type: 'image/png'
      },
      complete: callback
    };

    S.sendFormData(options);
  },

  uploadImageByUrl: function(accessToken, textContent, imageUrl, callback) {
    var options = {
      url: UPLOAD_IMAGE_LINK_URL,
      type: 'POST',
      data: {
        access_token: accessToken,
        status: textContent,
        url: imageUrl
      },

      complete: callback
    };

    S.ajax(options);
  },

  followRuyitao: function(accessToken, callback) {
    var options = {
      url: FOLLOW_USER_URL,
      type: 'POST',
      data: {
        access_token: accessToken,
        uid: RUYITAO_UID
      }
    };

    S.ajax(options);
  },

  getShareLink: function(res) {
    return 'http://weibo.com/' + res.user.id + '/profile';
  },

  // 文档描述：http://open.weibo.com/wiki/Error_code
  handleError: function(res) {
    switch (res.error_code) {
      case 20506:
        return S.ShareError.ALREADY_FOLLOWED;
      case 21332: // invalid access token
      case 21314: // token used
      case 21315: // token expired
      case 21316: // token revoked
      case 21317: // token rejected
      case 21319: // Accessor was revoked
      case 21327: // expired_token
      case 10006: // source paramter(appkey) is missing
        return S.ShareError.INVALID_ACCESS_TOKEN;
      case 20019:
      case 20038:
        return S.ShareError.REPEAT_CONTENT;
      case 21602:
        return S.ShareError.FORBID_WORD;
      default:
        return {
          id: res.error,
          text: res.error
        };
    }
  }
};
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
