if ( !exports ) var exports = {};

(function(S, undefined) {
  S.options = {
    _locales: {"zh": true, "us": true, "uk": true, "de": true, "it": true, "fr": true, "ca": true},
    _locale: undefined,

    init: function(options) {
      options = options || {};
      this.storage = options.storage;
      if ( !this._get("locale") ) {
        this.set_locale(options.locale);
      }
    },

    get_secure_api_url: function() {
      return 'https://ruyi.taobao.com';
    },

    get_api_url: function(locale) {
      return "http://ruyi.taobao.com";
    },

    has_locale: function(locale) {
      return locale in this._locales;
    },

    get_locale: function () {
      return 'zh';
    },

    set_locale: function (locale) {
      if ( !(locale in this._locales) ) {
        locale = 'zh';
      }
      this._locale = locale;
      return this._set("locale", locale);
    },

    set_search_engine: function(conf) {
      this.storage.set_object('search_engine', conf);
    },

    get_search_engine: function() {
      return this.storage.get_object('search_engine') || {};
    },

    set_accept_term: function(value) {
      return this.storage.set('accept_term', value);
    },

    get_accept_term: function() {
      return this.storage.get('accept_term') == "1";
    },

    get_search_result_setting: function() {
      return this._get('search_result_setting') == 'true';
    },

    set_search_result_setting: function(val) {
      return this._set('search_result_setting', String(val));
    },

    get_price_compare_result_setting: function() {
      return this._get('price_compare_result_setting') == 'true';
    },

    set_price_compare_result_setting: function(val) {
      return this._set('price_compare_result_setting', String(val));
    },

    get_sync_order_result_setting: function() {
      var val = this._get('sync_order_result_setting');
      if ( !val ) {
        val = 'true';
      }
      return val == 'true';
    },

    set_sync_order_result_setting: function(val) {
      return this._set('sync_order_result_setting', String(val));
    },
    
    get_movie_result_setting: function() {
      var val = this._get('movie_result_setting');
      if ( !val ) {
        val = 'true';
      }
      return val == 'true';
    },

    set_movie_result_setting: function(val) {
      return this._set('movie_result_setting', String(val));
    },

    get_price_curve_result_setting: function() {
      var val = this._get('price_curve_result_setting');
      val = val || 'false';
      return val === 'true';
    },

    set_price_curve_result_setting: function(val) {
      return this._set('price_curve_result_setting', val + '');
    },
    
    get_serp_list_result_setting: function() {
      var val = this._get('serp_list_result_setting');
      //val = val || 'false';
      //return val === 'true';
      return val !== 'false';
    },

    set_serp_list_result_setting: function(val) {
      return this._set('serp_list_result_setting', val + '');
    },

    _get: function (key) {
      return this.storage.get(key);
    },

    _set: function(key, value) {
      return this.storage.set(key, value);
    },

    get: function(key, def) {
      var ret;
      if ( typeof this['get_'+key] == "function" ) {
        ret = this['get_' + key]();
      } else {
        ret = this._get(key);
      }
      return ret === undefined ? def : ret;
    },

    set: function(key, val) {
      if ( typeof this['set_'+key] == "function" ) {
        var args = [];
        for ( var i=1; i<arguments.length; i++ ) {
          args[i-1] = arguments[i];
        }
        return this['set_'+key].apply(this, args);
      } else {
        return this._set(key, val);
      }
    }
  };
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
