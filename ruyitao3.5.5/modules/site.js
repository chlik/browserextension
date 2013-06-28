/**
 * site.js - manage site config and status
 * Copyright (c) 2010 Ookong inc (ookong.com).
 */

if ( !exports ) var exports = {};

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/util.js", S);
  S.exports.extend(S, S.exports);
  Components.utils.import("resource://ruyitao/console.js", S);
  S.console = S.exports.console;
  Components.utils.import("resource://ruyitao/constants.js", S);
  S.constants = S.exports.constants;
  Components.utils.import("resource://ruyitao/options.js", S);
  S.options = S.exports.options;
  S.site = {
    cache: undefined,
    storage: undefined,
    key_config: 'site_config',
    key_status: 'site_status',
    loading_status: -1,  // -1 not load; 0 sent but not load; 1 loaded
    next_try_time: undefined, // 下次加载时间
    search_default_status: false,
    price_compare_default_status: true,
    price_curve_default_status: false,

    price_compare_default_status_false_sites: ['taobao.com', 'tmall.com'],

    /**
     * 初始化站点状态
     * @param options 初始化参数
     *  - storage
     *  - cache 
     */
    init: function(options) {
      options = options || {};
      this.storage = options.storage;
      this.cache = options.cache;
      this.search_default_status = !!options.search_status;
      this.price_compare_default_status = !!options.price_compare_status;
      this.price_curve_default_status = !!options.price_curve_status;
    },

    /**
     * 获得 domain 对应的站点配置
     * @param domain 站点域名，如 google.com
     * @param callbacks 从服务器获得配置后的回调函数，包括 success 和 error 两个回调。
     *      在单元测试中使用
     */
    getConfig: function (domain, callbacks) {
      var cache = this.cache;
      var locale = S.options.get_locale();
      var self = this;
      var config;
      if ( this.loading_status == 0 && this.next_try_time && this.next_try_time < (new Date()).getTime() ) {
        this.loading_status = -1;
      }
      if ( this.loading_status == -1 ) {
        if ( cache.has(this.key_config) ) {
          S.constants.site_config = cache.get(this.key_config);
          this.loading_status = 1;
        } else {
          this.loading_status = 0;
          S.ajax({
            url: S.options.get_api_url() + "/ext/siteconfig",
            data: {
              locale: locale,
              version: S.constants.version,
              pid: S.constants.pid,
              uid: S.constants.uid
            },
            success: function(data, status, xhr) {
              self.loading_status = 1;
              S.constants.site_config = data;
              cache.set(self.key_config, data);
              if ( callbacks && callbacks.success ) {
                callbacks.success(data, status, xhr);
              }
            },
            error: function(xhr, status, error) {
              S.console.error("get site config failed: " + (status ? "status code(" + status + ")" : (error||"Unknown Error")));
              if ( callbacks && callbacks.error ) {
                callbacks.error(xhr, status, error);
              }
              var interval = ( status == 0 ) ? 0 : 600 * 1000; // 如果网络连接问题，可以立即重试，否则过10分钟重试
              self.next_try_time = (new Date()).getTime() + interval;
            }
          });
        }
      }
      config = S.constants.site_config.search;
      if ( config.hasOwnProperty(locale) ) {
        config = config[locale];
      } else {
        config = config['en'];
      }
      return config[domain];
    },

    getIvyConfig: function(domain) {
      var config = S.constants.site_config.ivy;
      if ( config && config[domain] ) {
        return config[domain];
      }
    },

    getSrpConfig: function(domain) {
      var config = S.constants.site_config.srp;
      if ( config && config[domain] ) {
        return config[domain];
      }
    },
    
    getMovieConfig: function(domain) {
      var config = S.constants.site_config.movie;
      if ( config && config[domain] ) {
        return config[domain];
      }
    },

    _getStatusKey: function(type){
      return (( typeof type == "undefined" || !type ) ? '' : type + '_') + this.key_status;
    },

    getStatus: function(domain, type) {
      var default_status =
        type == 'search' ? this.search_default_status : this.price_compare_default_status;
      
      // 如果站点是允许站点
      var sites = this.storage.get_object(this._getStatusKey(type)) || {};
      var storedSiteStatus = typeof sites[domain] != "undefined" ? sites[domain] : default_status;

      // 某些站点下比价页默认隐藏状态，不依赖选项，且只在用户手动改变显示/隐藏状态后才依赖。
      if (type == 'price_compare' && S.elemInArray(domain, this.price_compare_default_status_false_sites)) {
        var statusChangedSites = this.storage.get_object('price_compare_status_changed_sites');
        if (!statusChangedSites ||
            (statusChangedSites && !S.elemInArray(domain, statusChangedSites))) {
          return false;
        }
      }

      return storedSiteStatus;
    },

    setStatus: function(domain, status, type) {
      var key = this._getStatusKey(type),
          sites = this.storage.get_object(key) || {};
      sites[domain] = status;
      this.storage.set_object(key, sites);

      if (type == 'price_compare' && S.elemInArray(domain, this.price_compare_default_status_false_sites)) {
        sites = this.storage.get_object('price_compare_status_changed_sites');
        if (!sites) {
          sites = [domain]
        } else {
          if (!S.elemInArray(domain, sites)) {
            sites.push(domain)
          }
        }
        this.storage.set_object('price_compare_status_changed_sites', sites);
      }
    },

    clearStatus: function(type) {
      var key = this._getStatusKey(type);
      this.storage.set_object(key, {});
    },

    getPriceCurveStatus: function(domain) {
      var default_status = this.price_curve_default_status;
      var key = this._getStatusKey('price_curve');
      var sites = this.storage.get_object(key) || {};
      if (sites[domain] !== undefined) {
        return sites[domain];
      } else {
        return default_status;
      }
    },

    setPriceCurveStatus: function(domain, status) {
      var key = this._getStatusKey('price_curve');
      var sites = this.storage.get_object(key) || {};
      sites[domain] = status;
      this.storage.set_object(key, sites);
    }
  };
})(exports);

var EXPORTED_SYMBOLS = ["exports"];

