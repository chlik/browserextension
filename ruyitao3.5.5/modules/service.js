if ( !exports ) var exports = {};

(function(S, undefined) {
  S.PriceCharModels = {};

  Components.utils.import("resource://ruyitao/util.js", S);
  S.exports.extend(S, S.exports);
  Components.utils.import("resource://ruyitao/console.js", S);
  S.console = S.exports.console;
  Components.utils.import("resource://ruyitao/browser.js", S);
  S.browser = S.exports.browser;
  Components.utils.import("resource://ruyitao/constants.js", S);
  S.constants = S.exports.constants;
  Components.utils.import("resource://ruyitao/factory.js", S);
  S.factory = S.exports.factory;
  Components.utils.import("resource://ruyitao/options.js", S);
  S.options = S.exports.options;
  Components.utils.import("resource://ruyitao/site.js", S);
  S.site = S.exports.site;
  Components.utils.import("resource://ruyitao/notification.js", S);
  S.notification = S.exports.notification;
  Components.utils.import("resource://ruyitao/search-engine.js", S);
  S.SearchEngine = S.exports.SearchEngine;
  Components.utils.import("resource://ruyitao/share/share.js", S);
  S.Share = S.exports.Share;
  Components.utils.import("resource://ruyitao/price-detector.js", S);
  S.PriceDetector = S.exports.PriceDetector;
  /**
   * common ajax error handler
   */
  var error_handler = function (sendResponse) {
    return function(xhr, status, error) {
      sendResponse({
        Code: status,
        Message: error
          ? error.toString()
          : "Something is wrong(May be the networking is abnormal)."
      });
    };
  };

  var service = {
    get_price_comparation_and_history_prices_data: function(req, sender, sendResponse) {
      var pid = S.service.helper.getPid()
      var cache = S.factory.getCache();
      var cache_key = "link_search_with_history_prices/" + req.link;
      if ( cache.has(cache_key) ) {
        sendResponse(cache.get(cache_key));
      } else {
        S.ajax({
          url: S.options.get_api_url('zh')+"/ext/productLinkSearch",
          data: {
            link : req.link,
            pid: pid,
            group: 'prices,item,items'
          },
          success: function(data) {
            cache.set(cache_key, data);
            sendResponse(data);
          },
          error: function() {
            sendResponse({})
          }
        });
      }
    
    },

    construct_click_url: function(req, sender, sendResponse) {
      var pid = S.service.helper.getPid()
      var baseUrl = S.options.get_api_url('zh') + '/ext/clickurl?'
      var siteUrl = req.url
      var url = baseUrl + 'url=' + siteUrl + '&pid=' + pid
      sendResponse(url)
    },
    sanitize_html: function(req, sender, sendResponse) {
      var doc = sender.tab.document
      var sanitizedHTML = S.service.helper.sanitizeHTML(req.htmlString, doc)
      sendResponse(sanitizedHTML)
    },
    is_first_shown: function(request, sender, sendResponse) {
      sendResponse(S.factory.getStorage("persist").get('first_shown') == 'true');
    },
    
    set_first_shown: function(request, sender, sendResponse) {
      var type = request.type === undefined ? true: request.type;
      S.factory.getStorage("persist").set('first_shown', type);
      sendResponse && sendResponse({});
    },

    get_site_config: function(request, sender, sendResponse) {
      var result = {
        status: S.site.getStatus(request.domain, request.type || 'search'),
        config: S.site.getConfig(request.domain)
      };
      sendResponse(result);
    },

    get_site_status: function(request, sender, sendResponse) {
      sendResponse(S.site.getStatus(request.domain, request.type));
    },

    set_site_status: function(request, sender, sendResponse) {
      S.site.setStatus(request.domain, request.status, request.type);
      sendResponse({});
    },

    parse_image_price: function(req, sender, sendResponse) {
      var doc = sender.tab.document;
      S.service.helper.parseImagePrice(req.domain, req.url, sendResponse, doc)
    },

    get_detail_config: function(req, sender, callback) {
      var cache = S.factory.getCache();
      var config = S.constants.site_config.detail_info;
      var topLevelDomain = S.service.helper.get_top_level_domain(req.domain)
      if (config[topLevelDomain]) {
        callback(config[topLevelDomain])
      } else {
        callback()
      }
    },

    support_custom_share: function(req, sender, callback) {
      var result = {};
      if (supportTabAPI()) {
        result.simple = true;
        if (S.supportTypedArray() && S.supportXHR2() && supportCaptureVisibleTab()) {
          result.capture = true
        }
      }
      callback(result);

      function supportTabAPI() {
        var tabs = S.browser.tabs;
        return tabs.create && tabs.update && tabs.remove;
      }

      function supportCaptureVisibleTab() {
        return typeof S.browser.tabs.captureVisibleTab === 'function';
      }
    },

    share: function(req, sender, callback) {
      S.Share.share(req, callback);
    },

    /**
     * 处理分享的 shorten url，截图（根据 image type）
     */
    handle_share_request: function(req, sender, callback) {
      req.srcTabId = sender.tab.id;
      S.Share.handleRequest(req);
    },

    callback_share_authorization: function(req, sender, callback) {
      S.Share.handleAuthorizationCallback(req.url, sender.tab.id);
    },

    get_price_curve_status: function(request, sender, sendResponse){
      var domain = request.domain;
      var status = S.site.getPriceCurveStatus(domain);
      sendResponse(status);
    },

    set_price_curve_status: function(request, sender, sendResponse) {
      S.site.setPriceCurveStatus(request.domain, request.status);
    },

    get_price_history_data: function(request, sender, sendResponse) {
      S.console.debug('[get_price_history_data] url: ' + request.url);
      var cache = S.factory.getCache();
      var cacheKey = "price_history/" + request.url;
      if (cache.has(cacheKey)) {
        sendResponse(cache.get(cacheKey));
      } else {
        var url = S.options.get_api_url('zh')+'/ext/productLinkSearch';
        S.ajax({
          url: url,
          data: {
            link: request.url,
            group: 'prices,item',
            pid: S.constants.pid
          },
          success: function(data) {
            S.console.debug('[history price data length]: ' + (data.Item && data.Item.Prices && data.Item.Prices.length || 0)); 
            if (data.Item && data.Item.Prices && data.Item.Prices.length) {
              cache.set(cacheKey, data);
              sendResponse(data);
            } else {
              sendResponse();
            }
          },
          error: function() {
            sendResponse();
          }
        });
      }
    },
    
    get_srp_config: function(request, sender, sendResponse) {
      var config = S.site.getSrpConfig(request.domain)
        || S.site.getSrpConfig(this.helper.get_top_level_domain(request.domain));
      sendResponse(config);
    },

    item_link_search: function(request, sender, sendResponse) {
      var cache = S.factory.getCache();
      var cache_key = "link_search/" + request.link;
      if ( cache.has(cache_key) ) {
        sendResponse(cache.get(cache_key));
      } else {
        S.ajax({
          url: S.options.get_api_url('zh')+"/ext/productLinkSearch",
          data: {
            "link" : request.link,
            "pid": S.constants.pid
          },
          success: function(data) {
            cache.set(cache_key, data);
            sendResponse(data);
          },
          error: function() {
            sendResponse({})
          }
        });
      }
    },

    get_search_engines: function(request, sender, sendResponse) {
      var locale = S.options.get_locale();
      var enabled = S.options.get_search_engine();
      var ses = S.SearchEngine.search_engines;
      var conf = {};
      for ( var name in ses ) {
        var se = ses[name];
        if ( se.enabled ) {
          var locales = se.locales.split(',');
          var info = {
            name: se.name,
            title: typeof se.title[locale] == "undefined" ? se.title['en'] : se.title[locale],
            homepage: se.homepage,
            order: se.order,
            host: se.host
          };
          if ( se.icon ) {
            info.icon = se.icon;
          }
          // 搜索引擎是否启用的优先级判定：
          // 1. 用户是否选择
          // 2. 搜索引擎的 locales 设置是否包括当前选中 locale
          // 3. 搜索引擎配置 selected 是否为 true
          if ( typeof enabled[name] != "undefined" ) {
            info.enabled = enabled[name];
          } else if ( se.locales.indexOf(locale) != -1 ) {
            info.enabled = se.selected;
          } else {
            info.enabled = false;
          }
          if ( typeof conf[locales[0]] == "undefined" ) {
            conf[locales[0]] = [];
          }
          conf[locales[0]].push(info);
        }
      }
      for ( var l in conf ) {
        conf[l].sort(function(a, b) { return a.order-b.order; });
      }
      sendResponse({
        locale: locale,
        search_engines: conf
      });
    },

    is_book_site: function(request, sender, sendResponse) {
      var book_site_config = S.constants.site_config.book;
      var domain = request.domain;
      var url = request.url;
      var patterns = book_site_config[domain] && book_site_config[domain].patterns;
      var p;
      var i;
      var match;

      if (patterns) {
        i = patterns.length;
        for (;i--;) {
          p = patterns[i];
          if (url.match(new RegExp(p.url))) {
            match = true;
            sendResponse(p.meta);
            break;
          }
        }
        if ( !match ) {
          sendResponse(false);
        }
      } else {
        sendResponse(false);
      }
    },

    item_search: function(request, sender, sendResponse) {
      var self = this,
          se = request.SearchEngine;
      if ( typeof this[se+'_search'] == "function" ) {
        this[se+'_search'](request, sender, sendResponse);
      } else if ( S.SearchEngine.has(se) ) {
        S.service.helper.search({
          search_engine: se,
          request: request,
          callback: function(data) {
            sendResponse(data);
            //增加到搜索历史
            var SE = S.SearchEngine.get(se);
            if (SE && SE.enabled && request.ItemPage == 1 && data && data.Items && data.Items.length > 0) {
              self.add_search_history({
                searchBean: {
                  keyword: request.Keyword,
                  se: se,
                  img: data.Items[0].SmallImageUrl,
                  minPrice: '',
                  maxPrice: '',
                  time: new Date().getTime()
                }
              }, sender);
            }
          },
          preload: true
        });
      } else {
        sendResponse({ TotalPages:0, Items:[] });
      }
    },

    is_detail_site: function(request, sender, sendResponse) {
      var url = request.url;
      var site = this.helper.get_top_level_domain(url);
      var is_detail = false;
      var patterns = S.constants.site_config.product[site];
      if ( typeof patterns != "undefined" ) {
        if ( typeof patterns.length != "undefined" ) {
          for ( var i=0; i<patterns.length; i++ ) {
            if ( url.match(patterns[i]) ) {
              is_detail = true;
            }
          }
        } else {
          is_detail = true;
        }
      }
      if ( !is_detail ) {
        sendResponse({});
        return;
      }
      S.service.helper.search({
        search_engine: "product_search",
        request: {Keyword: JSON.stringify({url: request.url, title: request.title}), ItemPage: 1},
        callback: function(data) {
          if ( data.DetailPage ) {
            if (data.LikeItems && data.LikeItems.length) {
              sendResponse({ locale : S.options.get_locale(), likeItems: data.LikeItems, likePage: data.LikePage });
            } else if ( typeof data.Items != "undefined" ) {
              sendResponse({ locale : S.options.get_locale(), product: data.Product });
            } else {
              sendResponse({ locale : S.options.get_locale(), keyword: data.Keyword });
            }
          } else {
            sendResponse({});
          }
        }
      });
    },

    get_notification: function(request, sender, sendResponse) {
      if ( S.options.get_locale() == 'zh' ) {
        sendResponse(S.notification.getNotification(request.url));
      } else {
        sendResponse();
      }
    },

    set_notification: function(request, sender, sendResponse) {
      S.notification.setStatus(request.id, request.status);
      sendResponse({});
    },

    ajax: function(request, sender, sendResponse) {
      if (!request.success) {
        request.success = function(data) {
          sendResponse(data);
        };
      }

      if (!request.error) {
        request.error = function() {
          sendResponse({});
        };
      }
      S.ajax(request);
    },

    get_template: function(request, sender, sendResponse) {
      S.service.helper.getTemplate(request.page, sendResponse);
    },

    get_current_tab: function(request, sender, sendResponse) {
      try {
        S.browser.tabs.getSelected(null, sendResponse);
      } catch(e) {
        S.console.debug('Get current tab failed, message: ' + e.message)
        sendResponse();
      }
    },

    tab_open: function(request, sender, sendResponse) {
      S.browser.tabs.create({
        url: request.url,
        selected: (typeof request.selected == "undefined" ? true : request.selected)
      }, sendResponse);
    },

    close_tab: function(request, sender, sendResponse) {
      var tabId = request.tabId;
      S.browser.tabs.remove(tabId, sendResponse);
    },

    active_tab: function(request, sender, sendResponse) {
      var tabId = request.tabId;
      S.browser.tabs.update(tabId, {
        selected: true // chrome 19 中使用 active 代替 selected，后者仍保留
      }, sendResponse);
    },

    options_get: function(request, sender, sendResponse){
      var keys = request.options;
      var opts = {};
      var type;
      for ( var i=0, len=keys.length; i<len; i++ ) {
        type = keys[i] + '_result_setting';
        opts[type] = S.options.get(type, S.site[keys[i] + '_default_status']);
      }
      sendResponse(opts);
    },

    options_set: function(request, sender, sendResponse) {
      var val;
      for (var name in request) {
        val = request[name];
        if (name == "locale") {
          S.options.set_locale(request.locale);
          S.options.set_search_engine({});
          this.clear_search_history();
          this.clear_popup_status();
        } else if (name == "search_engine") {
          var conf = S.options.get_search_engine();
          conf[request.search_engine] = !!request.enabled;
          S.options.set_search_engine(conf);
        } else if (name == "topic") {
        } else if ( name == "search_result_setting" ) {
          S.options.set_search_result_setting(val);
          S.site.search_default_status = val;
        } else if (name == 'price_compare_result_setting') {
          S.options.set_price_compare_result_setting(val);
          S.site.price_compare_default_status = val;
        } else if ( name == 'sync_order_result_setting' ) {
          S.options.set_sync_order_result_setting(val);
        } else {
          if (name == 'price_curve_result_setting') {
            S.site.price_curve_default_status = val;
          }
          S.options.set(name, val);
        }
      }
      sendResponse({});
    },

    set_search_engine: function(request, sender, sendResponse) {
      var conf = S.options.get_search_engine();
      var searchEngines = request.search_engines;
      for ( var name in searchEngines ) {
        if ( searchEngines.hasOwnProperty(name) ) {
          conf[name] = searchEngines[name];
        }
      }
      S.options.set_search_engine(conf);
      sendResponse({});
    },

    set_cna_cookie: function(request, sender, sendResponse) {
      if ( S.constants.cnaCookie != request.value ) {
        S.constants.cnaCookie = request.value;
        S.factory.getStorage('extension').set('cna', request.value);
      }
    },

    encode_gbk: function(req, sender, sendResponse) {
      var str = req.str;
      if (str) {
        Components.utils.import("resource://ruyitao/encode.js", S);
        S.encode = S.exports.encode;
        sendResponse(S.encode.gb2312.encode(str))
      } else {
        sendResponse('')
      }
    },

    decode_gbk: function(request, sender, sendResponse) {
      if ( request.data.indexOf("%") == -1 ) {
        sendResponse(request.data);
      } else {
        Components.utils.import("resource://ruyitao/encode.js", S);
        S.encode = S.exports.encode;
        sendResponse(S.encode.gb2312.decode(request.data));
      }
    },

    log_message: function(request, sender, sendResponse) {
      S.console.debug("[page] " + request.message);
    },

    send_log: function(request, sender, sendResponse) {
      var constants = S.constants;
      var params = {
        a: request.action,
        p: constants.pid,
        u: constants.uid,
        v: constants.version,
        t: Math.floor((new Date()).getTime()/1000)
      };
      if ( request.label ) {
        params.l = request.label;
      }
      if ( request.referrer ) {
        params.r = request.referrer;
      }
      if ( constants.cnaCookie ) {
        params.c = constants.cnaCookie;
      }
      S.ajax({
        url: S.options.get_api_url() + "/s.gif",
        data: params
      });
    },

    get_movie_config: function(request, sender, sendResponse) {
      if ( S.options.get_movie_result_setting() ) {
        var config = S.site.getMovieConfig(request.domain)
          || S.site.getMovieConfig(this.helper.get_top_level_domain(request.domain));
        sendResponse(config);
      } else {
        sendResponse();
      }
    },
    movie_link_search: function(request, sender, sendResponse) {
      var cache = S.factory.getCache();
      var cache_key = "movie_link_search/" + request.link;
      if (cache.has(cache_key)) {
        sendResponse(cache.get(cache_key));
      } else {
        S.ajax({
          url: S.options.get_api_url('zh')+"/kanshaext",
          data: {
            "url" : request.link,
            "cna" : S.constants.cnaCookie,
            "uid" : S.constants.uid,
            "pid": S.constants.pid
          },
          success: function(data) {
            cache.set(cache_key, data);
            sendResponse(data);
          },
          error: function() {
            sendResponse({})
          }
        });
      }
    },
    
    get_locale: function(request, sender, sendResponse) {
      sendResponse(S.options.get_locale());
    },
    
    suggest_search: function(request, sender, sendResponse) {
      var locale = S.options.get_locale() || 'en',
          cache = S.factory.getCache(),
          cache_key = "suggest_search/" + locale + '/' + request.keyword,
          url;
      if ( cache.has(cache_key) ) {
        sendResponse(cache.get(cache_key));
      } else {
        switch(locale) {
          case 'zh': 
            url = 'http://suggest.taobao.com/sug?area=etao&code=utf-8';
            break;
          case 'en': 
            url = 'http://completion.amazon.com/search/complete?method=completion&search-alias=aps&mkt=1';
            break;
          case 'fr': 
            url = 'http://completion.amazon.co.uk/search/complete?method=completion&search-alias=aps&mkt=5';
            break;
          case 'it': 
            url = 'http://completion.amazon.co.uk/search/complete?method=completion&search-alias=aps&mkt=35691';
            break;
          case 'de': 
            url = 'http://completion.amazon.co.uk/search/complete?method=completion&search-alias=aps&mkt=4';
            break;
        }
        S.ajax({
          url: url,
          data: {
            "q" : request.keyword//,
            //"pid": S.constants.pid
          },
          success: function(data) {
            cache.set(cache_key, data);
            sendResponse(data);
          },
          error: function() {
            sendResponse({})
          }
        });
      }
    },
    
    add_search_history: function(request, sender, sendResponse) {
      var max = 10,
          /*
           keyword: '',
           se: '',
           img: '',
           minPrice: '',
           maxPrice: '',
           time: 1
          */
          searchBean = request.searchBean;
      if(searchBean) {
        this.search_history({}, sender, function(searchBeanArr) {
          var arr = [searchBean],
              len = searchBeanArr.length,
              i = 0;
          for(;i<len;i++) {
            if(searchBean.keyword && searchBeanArr[i].keyword && searchBean.keyword.toLowerCase() != searchBeanArr[i].keyword.toLowerCase()) {
              arr.push(searchBeanArr[i]);
            }
            if(arr.length >= max) {
              break;
            }
          }
          S.factory.getStorage('history').set_object('search_bean_array', arr);
          typeof sendResponse == 'function' && sendResponse();
        });
      }
    },
    search_history: function(request, sender, sendResponse) {
      var searchBeanArr = S.factory.getStorage('history').get_object('search_bean_array') || [],
          begin = request.begin || 0,
          num = request.num || searchBeanArr.length;
      typeof sendResponse == 'function' && sendResponse(searchBeanArr.slice(begin, num));
    },
    clear_search_history: function(request, sender, sendResponse) {
      S.factory.getStorage('history').set_object('search_bean_array', []);
      typeof sendResponse == 'function' && sendResponse();
    },
    
    add_popup_status: function(request, sender, sendResponse) {
      var max = 1,
          status = request.status;
      if(status) {
        this.get_popup_status({}, sender, function(arr) {
          arr.unshift(status);
          if(arr.length > max) {
            arr = arr.slice(0, max);
          }
          S.factory.getStorage('history').set_object('popup_status_array', arr);
          typeof sendResponse == 'function' && sendResponse();
        });
      }
    },
    get_popup_status: function(request, sender, sendResponse) {
      var arr = S.factory.getStorage('history').get_object('popup_status_array') || [],
          begin = request.begin || 0,
          num = request.num || arr.length;
      typeof sendResponse == 'function' && sendResponse(arr.slice(begin, num));
    },
    clear_popup_status: function(request, sender, sendResponse) {
      S.factory.getStorage('history').set_object('popup_status_array', []);
      typeof sendResponse == 'function' && sendResponse();
    }
  };

S.extend(service, {
  oauth_callback: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    var tabId = sender.tab.id;
    oauth.storeAccessToken(tabId, request.redirect_url);
    oauth.getUserInfo(function(user) {
      oauth.authorizeCallback(tabId, request.redirect_url);
    });
  },
  oauth_is_authorized: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    sendResponse(oauth.isAuthorized());
  },
  oauth_authorize: function(request, sender, sendResponse){
    var oauth = S.factory.getRuyitaoOauth();
    oauth.removeAccessToken();
    oauth.authorize(sender.tab.id, function() {
      service.oauth_get_user(null, sender, sendResponse);
    }, true);
  },
  oauth_remove_token: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    oauth.removeAccessToken();
    sendResponse();
  },
  oauth_get_user: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    var nick = oauth.getTokenData('nick');
    if ( !nick && oauth.isAuthorized() ) {
      oauth.getUserInfo(function(user) {
        sendResponse(user);
      });
    } else {
      sendResponse({ nick: oauth.getTokenData('nick') } );
    }
  }
});
var IvyCollections = {
  getSended: function(domain) {
    var set = {};
    var i, len;
    var md5Arr = S.factory.getCache().get('ivy_send_items/'+domain);
    md5Arr = (md5Arr||'').split('|');
    for ( i=0,len=md5Arr.length; i<len; i++ ) {
      set[md5Arr[i]] = true;
    }
    return set;
  },
  setSended: function(domain, set) {
    var md5Arr = [];
    for ( var md5 in set ) {
      if ( set.hasOwnProperty(md5) ) {
        md5Arr.push(md5);
      }
    }
    S.factory.getCache().set('ivy_send_items/'+domain, md5Arr.join('|'));
  },
  add: function(domain, collections){
    var set = this.getSended(domain);
    var i, len;
    var newCollections = [];
    for ( i=0,len=collections.length; i<len; i++ ) {
      var md5 = S.md5.hash(collections[i]);
      if ( !set.hasOwnProperty(md5) ) {
        set[md5] = true;
        newCollections.push(collections[i]);
      }
    }
    if ( newCollections.length > 0 ) {
      this.setSended(domain, set);
    }
    return newCollections;
  }
};
S.extend(service, {
  item_like_add: function(request, sender, sendResponse) {
    var oauth =  S.factory.getRuyitaoOauth();
    var tabId
    if (sender && sender.tab) {
      tabId = sender.tab.id
    }
    oauth.authorize(tabId, function() {
      oauth.request({
        url: "/api/save",
        type: "POST",
        data: { url: request.url },
        success: function(data) {
          var user_id = oauth.getTokenData('user_id');
          var cache_key = 'ivy_like/' + (user_id ? user_id + '/' : '') + request.url;
          S.factory.getCache().remove(cache_key);
          sendResponse(data);
        },
        error: function() {
          sendResponse({error: true});
        }
      });
    });
  },
  item_like_open_homepage: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    var tabId
    if (sender && sender.tab) {
      tabId = sender.tab.id
    }
    oauth.authorize(tabId, function() {
      var ref = '';
      try {
        ref = encodeURIComponent(request.url);
      } catch ( e ) {}
      var token = oauth.getAccessToken();
      var url = oauth.resource_url + '/api/landing'
        + (typeof token.access_token != "undefined" ? '?access_token='+token.access_token +'&' : '?')
        + (typeof ref != "undefined" ? 'ref=' + ref : '');
      S.browser.tabs.create({ url: url, selected: true });
    });
  },
  item_like_count: function(request, sender, sendResponse) {
    var cache = S.factory.getCache();
    var oauth = S.factory.getRuyitaoOauth();
    var user_id = oauth.getTokenData('user_id');
    var cache_key = 'ivy_like/' + (user_id ? user_id + '/' : '') + request.url;
    if ( cache.has(cache_key) ) {
      sendResponse(cache.get(cache_key));
    } else {
      S.factory.getRuyitaoOauth().request({
        url: "/api/get_saved_count",
        data: { url: request.url },
        success: function(data) {
          sendResponse(data)
          cache.set(cache_key, data);
        },
        error: function() {
          sendResponse({error: true});
        }
      });
    }
  },
  get_ivy_config: function(request, sender, sendResponse) {
    var config = S.site.getIvyConfig(request.domain)
      || S.site.getIvyConfig(this.helper.get_top_level_domain(request.domain));
    sendResponse(config);
  },
  ivy_send_user_collection: function(request, sender, sendResponse) {
    var oauth = S.factory.getRuyitaoOauth();
    if ( oauth.isAuthorized() ) {
      var url = request.source_url;
      var domain = service.helper.get_top_level_domain(url);
      var collections = IvyCollections.add(domain, request.collections);
      if ( collections.length ) {
        oauth.request({
          url: "/api/upload_collection",
          data: {
            type: request.type,
            collections: collections,
            source_url: url
          },
          type: "POST"
        });
      }
    }
  }
});
S.extend(service, {
  get_serp_list_status: function(request, sender, sendResponse){
    //var domain = request.domain;
    var status = S.options.get('serp_list_result_setting', false);
    sendResponse(status === 'true' || status === true);
  },
  set_serp_list_status: function(request, sender, sendResponse) {
    S.options.set('serp_list_result_setting', !!request.status);
    sendResponse();
  },
  get_serp_list_data: function(request, sender, sendResponse) {
    S.console.debug('[get_serp_list_data]: ' + request.keyword);
    var cache = S.factory.getCache();
    var cacheKey = "serp_list/" + request.keyword;
    if (cache.has(cacheKey)) {
      sendResponse(cache.get(cacheKey));
    } else {
      var url = S.options.get_api_url('zh')+'/ext/qpSearch';
      S.ajax({
        url: url,
        type: 'POST',
        data: {
          pid: S.constants.pid,
          keyword: request.keyword||'',
          url: request.url,
          urls: JSON.stringify(request.urls||[])
        },
        success: function(data) {
          if ( data && data.Items && data.Items.length > 0 ) {
            cache.set(cacheKey, data);
            sendResponse(data);
          } else {
            sendResponse();
          }
        },
        error: function() {
          sendResponse();
        }
      });
    }
  }
});

  service.helper = {
    getPid: function() {
      return S.constants.pid;
    },

    parseImagePrice: function(domain, imgUrl, callback, doc) {
      doc = doc || document
      var topLevelDomain = S.service.helper.get_top_level_domain(domain)
      var constructPriceDetector = function(data) {
        if (topLevelDomain == '360buy.com') {
          S.PriceCharModels['360buy.com'] = data['jd.com']
        } else {
          S.PriceCharModels[topLevelDomain] = data[topLevelDomain]
        }
        parsePrice()
      }

      var getImageData = function(url, callback) {
        var img = doc.createElement('img')
        img.onload = function() {
          var canvas = doc.createElement('canvas')
          var ctx = canvas.getContext('2d')
          var width = canvas.width = img.width
          var height = canvas.height = img.height
          ctx.drawImage(img, 0, 0, width, height)
          var imageData = ctx.getImageData(0, 0, width, height)
          callback(imageData)
        }
        img.onerror = function() {
          S.console.debug('Load image: ' + url + ' failed.')
          callback(null)
        }
        img.src = url
      }

      var parsePrice = function() {
        try {
          getImageData(imgUrl, function(imageData) {
            var price = null
            if (imageData && typeof imageData == 'object') {
              var models = S.PriceCharModels[topLevelDomain][imageData.height]
              if (models) {
                var priceDetector = new S.PriceDetector(models.boundaryValue, models.models)
                price = priceDetector.detect(imageData)
                if (/\?/.test(price)) {
                  S.console.debug('Parse price failed: ' + price)
                  S.console.debug('Price image url: ' + imgUrl)
                  price = null
                }
              }
              
            }
            callback(price);
          })
        } catch (e) {
          S.console.debug('Parse image price failed, message: ' + e.message)
          callback(null)
        }
      }

      // 创建价格字模对象
      if (!S.PriceCharModels[topLevelDomain]) {
        var cache = S.factory.getCache();
        if (cache.has('price_char_models')) {
          constructPriceDetector(cache.get('price_char_models'))
        } else {
          var url = S.options.get_api_url('zh')+'/ext/priceCharModels';
          S.ajax({
            url: url,
            success: function(data) {
              cache.set('price_char_models', data)
              constructPriceDetector(data)
            }
          });
        }
      } else {
        parsePrice()
      }
    },
    /**
     * Safely parse an HTML fragment, removing any executable
     * JavaScript, and return a document fragment.
     *
     * @param {Document} doc The document in which to create the
     *     returned DOM tree.
     * @param {string} html The HTML fragment to parse.
     * @param {boolean} allowStyle If true, allow <style> nodes and
     *     style attributes in the parsed fragment. Gecko 14+ only.
     * @param {nsIURI} baseURI The base URI relative to which resource
     *     URLs should be processed. Note that this will not work for
     *     XML fragments.
     * @param {boolean} isXML If true, parse the fragment as XML.
     */
    sanitizeHTML: function(htmlString, doc) {
      var PARSER_UTILS = '@mozilla.org/parserutils;1';
      var allowStyle = true
      var baseURI = doc.baseURI
      var docElement = doc.documentElement
      var isXML = false
   
      if (Components && Components.classes && Components.interfaces) {
        var Ci = Components.interfaces;
        try {
          if (PARSER_UTILS in Components.classes) {
            var parser = Components.classes[PARSER_UTILS].getService(Ci.nsIParserUtils);
            if ('sanitize' in parser) {
              return parser.sanitize(htmlString, allowStyle ? parser.SanitizerAllowStyle : 0);
            }
          }
     
          return Components.classes['@mozilla.org/feed-unescapehtml;1']
            .getService(Ci.nsIScriptableUnescapeHTML)
            .parseFragment(htmlString, isXML, baseURI, docElement);
        } catch (e) {
          S.console.debug('Sanitize html string failed, error message: ' + e.message)
        }

        return htmlString
      } else {
        return htmlString
      }
    },
    requestHandler: function(request, sender, sendResponse) {
      var topic = request.topic;
      S.console.debug("request for " + topic);
      try {
        if ( topic.charAt(0) != '_' && typeof S.service[request.topic] == "function" ) {
          S.service[request.topic](request, sender, sendResponse);
        } else {
          S.console.debug("unknown request " + topic);
        }
      } catch(e){
        S.console.error("REQEUST ERROR:" + e.message + (e.stack ? "\n" + e.stack : ''));
      }
    },

    getTemplate: function(path, callback) {
      var url, is_remote = false;
      if ( path.indexOf('http://') == 0 ) {
        is_remote = true;
        url = path;
      } else {
        url = S.browser.extension.getURL( path );
      }
      var cache = S.factory.getCache();
      var key = 'template/' + path;
      var replace_prefix = function(html) {
        html = html.replace(/%chrome-extension%/g, S.browser.extension.getURL(''));
        if (is_remote) cache.set(key, html);
        callback(html);
      };
      if ( is_remote && cache.has(key) ) {
        callback(cache.get(key));
      } else {
        S.ajax({
          url: url,
          dataType: 'text',
          success: function(data) {
            replace_prefix(data);
          },
          error: function(xhr, status, error) {
            if ( xhr.readyState == 4 && url.indexOf('http://') != 0 ) {
              replace_prefix(xhr.responseText);
            } else {
              callback({
                Code: status,
                Message: error ? error.toString() : "Something is wrong(May be the networking is abnormal)."
              });
            }
          }
        });
      }
    },

    search: function(options) {
      var cache = S.factory.getCache();
      var request = S.extend({}, options.request);
      var page_no = S.filter_int(request.ItemPage, 1, 1);
      var key = options.search_engine +'/'+ request.Keyword+'-'+page_no;
      if ( cache.has(key) ) {
        options.callback(cache.get(key));
      } else {
        S.SearchEngine.search(options.search_engine, request, {
          success: function(result) {
            cache.set(key, result);
            options.callback(result);
          },
          error: error_handler(options.callback)
        });
        if ( options.preload && page_no == 1 ) {
          var se = S.SearchEngine.search_engines[options.search_engine];
          if ( se.enabled ) {
            this.preloadSearch(options);
          }
        }
      }
    },

    preloadMutex: 0, // 限制只有一个预加载搜索进程
    preloadSearch:function(options) {
      var self = this;
      this.cancelPreloadSearch();
      var mutex = this.preloadMutex;
      S.service.get_search_engines({}, null, function(all) {
        if ( all.locale != "zh" ) {
          return;
        }
        var ses = all.search_engines[all.locale];
        var enablePreload;
        var doSearch = function(i) {
          if ( mutex == self.preloadMutex && i < ses.length ) {
            if ( ses[i].name != options.search_engine && ses[i].enabled ) {
              // 在非 chrome 禁用当当预加载防止产生搜索记录
              if (ses[i].name != 'dangdang') {
                S.service.helper.search({
                  search_engine: ses[i].name,
                  request: options.request,
                  callback: function() {
                    doSearch(i+1);
                  }
                });
              }
            } else {
              doSearch(i+1);
            }
          }
        };
        doSearch(0);
      });
    },
    cancelPreloadSearch: function() {
      this.preloadMutex++;
    },

    get_top_level_domain: function(url) {
      var domain = S.parse_url(url, "PHP_URL_HOST");
      var len = domain.match(/\.(com|co|org|net)\.(cn|uk|jp|hk|us|ca)$/) ? 3 : 2;
      var parts = domain.split(".");
      return parts.slice(Math.max(parts.length - len, 0)).join(".");
    },

    backupCookies: {},

    backupCookie: function(searchEngine, callback) {
      var self = this
      var name = searchEngine.name;
      var details
      if (name == 'amazoncn') {
        details = {
          url: 'http://www.amazon.cn',
          name: 'session-id'
        }

        chrome.cookies.get(details, function(cookie) {
          if (cookie && cookie.value) {
            self.backupCookies[name] = cookie.value
          }
          chrome.cookies.set({
            domain: '.amazon.cn',
            path: '/',
            url: 'http://www.amazon.cn',
            name: 'session-id',
            value: 'tmp-session-id'
          }, function(cookie) {
            S.console.debug('Set session-id in cookie for amazoncn: ' + cookie.value)
            callback && callback()
          })
        })

      } else if (name == 'dangdang') {
        details = {
          url: 'http://www.dangdang.com',
          name: 'HK'
        }

        chrome.cookies.get(details, function(cookie) {
          if (cookie && cookie.value) {
            self.backupCookies[name] = cookie.value
          }
          callback && callback()
        })
      } else {
        callback && callback()
      }
    },

    restoreCookie: function(searchEngine) {
      var self = this
      var name = searchEngine.name
      if (name == 'amazoncn') {
        chrome.cookies.set({
          domain: '.amazon.cn',
          path: '/',
          url: 'http://www.amazon.cn',
          name: 'session-id',
          value: self.backupCookies[name]
        }, function(cookie) {
          S.console.debug('Restore cookie session-id for amazoncn: ' + cookie.value)
        })
      } else if (name == 'dangdang') {
        chrome.cookies.set({
          domain: '.dangdang.com',
          path: '/',
          url: 'http://www.dangdang.com',
          name: 'HK',
          value: self.backupCookies[name]
        }, function(cookie) {
          S.console.debug('Restore cookie HK for dangdang: ' + cookie.value)
        })
      }
    }
  };

  S.service = service;
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
