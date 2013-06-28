if ( !exports ) var exports = {};
(function(win, S, undefined) {
  var exports = S; 
  Components.utils.import("resource://ruyitao/background.js", S);
  var B = S.exports.background.get();
  B.extend(S, B);
  S.browser = { extension: new S.browser.tabs.extension(document) };
  S.browser.extension.sendRequest = function(request, callback) {
    S.browser.extension.sendRequestInternal(request, function(data) {
      if ( data && typeof data == 'object' && typeof data['response'] != "undefined" ) {
        callback && callback(JSON.parse(data['response']));
      } else {
        callback && callback(data);
      }
    });
  };

  S.console = {
    debug: function(msg) {
      S.browser.extension.sendRequest({topic: 'log_message', message: msg});
    }
  };

/**
 * page_cache.js - Smart pager
 * Copyright (c) 2010 Ookong Ltd. Co. (ookong.com).
 */
if ( !exports ) var exports = {};
(function(S, undefined) {
    /**
     * interface PageCache {
     *    function next([callback]);
     *    function previous([callback]);
     *    function hasNext();
     *    function hasPrevious();
     *    function getTotalPages();
     *    function get(page_no[, callback]);
     *    function reset();
     * }
     */
    S.PageCache = function (generator, settings, async) {
        if ( async ) {
            return new S.PageCache.async(generator, settings);
        } else {
            return new S.PageCache.sync(generator, settings);
        }
    };

    /**
     * create page cache.
     * There are two types of generator:
     *  - function() {}
     *    only returns some entries, but don't known how many pages will
     *    get, and sometimes the number of entries does not equals each
     *    time. In this occasion, the generator is a function call with
     *    no arguments, and return an array of entries. When it returns
     *    an empty array, it means no more entries.
     *  - { PageSize: page_size, get: function(page_no) {} }
     *    return page_size entries each time and knows how many pages will
     *    gets. get function will return an object like:
     *    { TotalPages: total_pages, TotalEntries: total_entries, Entries: [] }
     *    The "TotalEntries" field is optional. start page is 1
     *
     * @param Function generator
     * @param object settings page cache options:
     *    - PageSize max items for one page
     */
    S.PageCache.sync = function(generator, settings) {
        if ( arguments.length == 0 ) {
            return;
        }
        // internal page_no start from 0
        this.page_no = -1;
        this.pager_total_pages = undefined;
        this.pager_total_entries = undefined;
        this.cache = [];
        if ( typeof generator == "function" ) {
            this.generator = generator;
            this.generator_finished = false;
        } else {
            this.pager = generator.get;
            this.pager_page_size = generator.PageSize;
        }
        this.page_size = settings.PageSize;
    };

    S.PageCache.sync.prototype = {
        /**
         * get entries in the next page
         *
         * @return Array the entries in the next page.
         *       return empty array if no more entries
         */
        next: function () {
            var entries = [];
            if ( this.hasNext() ) {
                this.page_no++;
                entries = this.get(this.page_no+1).Entries;
                if ( entries.length == 0 ) {
                    this.page_no--;
                }
            }
            return entries;
        },

        /**
         * get entries in the previous page
         *
         * @return Array the entries in the previous page.
         *       returns empty array if no previous page
         */
        previous: function() {
            var entries = [];
            if ( this.hasPrevious() ) {
                this.page_no--;
                entries = this.get(this.page_no+1).Entries;
            }
            return entries;
        },

        /**
         * check whether more entries to get
         *
         * @return bool
         */
        hasNext: function () {
            var total = this.getTotalPages();
            return isNaN(total) ? true : this.page_no+1<total;
        },

        /**
         * check whether there is previous page
         *
         * @return bool
         */
        hasPrevious: function () {
            return this.page_no > 0;
        },

        /**
         * gets total pages number
         *
         * @return int total pages. If total pages is not determined, return NaN
         */
        getTotalPages: function () {
            var total_entries;
            if ( this.pager ) {
                if ( typeof this.pager_total_pages == "undefined" ) {
                    return NaN;
                }
                if ( typeof this.pager_total_entries == "undefined" ) {
                    if ( typeof this.cache[this.pager_total_pages-1] != "undefined" ) {
                        total_entries = (this.pager_total_pages-1) * this.pager_page_size
                            + this.cache[this.pager_total_pages-1].Entries.length;
                    } else {
                        total_entries = this.pager_total_pages * this.pager_page_size;
                    }
                } else {
                    total_entries = this.pager_total_entries;
                }
            } else {
                if ( !this.generator_finished ) {
                    return NaN;
                } else {
                    total_entries = this.cache.length;
                }
            }
            return Math.ceil( total_entries / this.page_size );
        },

        /**
         * gets entries in given page
         *
         * @param int page_no start from 1
         * @return object a object as {TotalPages: pages, Entries: []}
         */
        get: function (page_no) {
            page_no = parseInt(page_no);
            if ( isNaN(page_no) || page_no < 1 ) {
                page_no = 1;
            }
            var entries = [];
            var start = (page_no-1) * this.page_size;
            var end = page_no * this.page_size;
            if ( this.pager ) {
                var page_start = Math.floor(start/this.pager_page_size);
                var page_end = Math.ceil(end/this.pager_page_size);
                for ( var i=page_start; i<page_end; i++ ) {
                    if ( typeof this.cache[i] == "undefined" ) {
                        this.cache[i] = this.pager(i+1);
                    }
                    var offset = this.pager_page_size*i;
                    var slice_start = offset>=start ? 0 : start-offset;
                    var slice_end = offset+this.pager_page_size > end ? end - offset : this.pager_page_size;
                    entries.push.apply(entries, this.cache[i].Entries.slice(slice_start, slice_end));
                    if ( typeof this.pager_total_pages == "undefined" ) {
                        this.pager_total_pages = this.cache[i].TotalPages;
                    }
                    page_end = Math.min(page_end, this.pager_total_pages);
                }
                if ( typeof this.cache[page_start] != "undefined" && this.cache[page_start].TotalEntries ) {
                    this.pager_total_entries = this.cache[page_start].TotalEntries;
                }
            } else {
                var next;
                while ( !this.generator_finished && this.cache.length < end ) {
                    next = this.generator();
                    if ( next.length == 0 ) {
                        this.generator_finished = true;
                    }
                    this.cache.push.apply(this.cache, next);
                }
                entries = this.cache.slice(start, end);
            }
            return { TotalPages: this.getTotalPages(), Entries: entries };
        },

        /**
         * reset page offset
         */
        reset: function () {
            this.page_no = -1;
        }
    };

    /**
     * asynchronize get page.
     * Similar to S.PageCache, there are two types of generator:
     *  - function( page_cb = function(entries){} ) {}
     *  the page_cb is a function with one argument as an array of entries in the page
     *  - { PageSize: page_size, get: function(page_no, page_cb = function(page_no, results){} ) {} }
     *  the page_cb is a function with two arguments, first is the current page number,
     *  second is an object {TotalPages: pages, TotalEntries: total_entries, Entries: []}.
     *  the "TotalEntries" field is optional.
     */
    S.PageCache.async = function (generator, settings) {
        S.PageCache.sync.call(this, generator, settings);
    };
    S.PageCache.async.prototype = new S.PageCache.sync();
    S.PageCache.async.prototype.constructor = S.PageCache.async;

    /**
     * get entries in the next page
     *
     * @param Function callback=function(entries) {} A function called when entries ready
     */
    S.PageCache.async.prototype.next = function(callback) {
        if ( this.hasNext() ) {
            this.page_no++;
            var self = this;
            this.get(this.page_no+1, function(results) {
                var entries = results.Entries;
                if ( entries.length == 0 ) {
                    self.page_no--;
                }
                callback(entries);
            });
        } else {
            callback([]);
        }
    };

    /**
     * get entries in the previous page
     *
     * @param Function callback=function(entries) {} A function called when entries ready
     */
    S.PageCache.async.prototype.previous = function(callback) {
        if ( this.hasPrevious() ) {
            this.page_no--;
            this.get(this.page_no+1, function(results) {
                callback(results.Entries);
            });
        } else {
            callback([]);
        }
    };

    /**
     * get entries in the given page
     *
     * @param int page_no
     * @param Function callback=function(results, page_no) {} A function called when entries ready
     *   the results is an object like {TotalPages: pages, Entries: []}
     */
    S.PageCache.async.prototype.get = function(page_no, callback) {
        var self = this;
        page_no = parseInt(page_no);
        if ( isNaN(page_no) || page_no < 1 ) {
            page_no = 1;
        }
        var start = (page_no-1) * this.page_size;
        var end = page_no * this.page_size;
        var entries = [];
        var finish = function() {
            callback({ TotalPages: self.getTotalPages(), Entries: entries }, page_no);
        };
        if ( this.pager ) {
            var page_start = Math.floor(start/this.pager_page_size);
            var page_end = Math.ceil(end/this.pager_page_size);
            var get_page = function (pager_page_no, entries) {
                if ( pager_page_no >= page_end ) {
                    if ( typeof self.cache[page_start] != "undefined" && self.cache[page_start].TotalEntries ) {
                        self.pager_total_entries = self.cache[page_start].TotalEntries;
                    }
                    finish();
                    return;
                }
                var cb = function(pager_page_no, results) {
                    pager_page_no = pager_page_no-1;
                    self.cache[pager_page_no] = results;
                    var offset = self.pager_page_size*pager_page_no;
                    var slice_start = offset>=start ? 0 : start-offset;
                    var slice_end = offset+self.pager_page_size > end ? end - offset : self.pager_page_size;
                    entries.push.apply(entries, self.cache[pager_page_no].Entries.slice(slice_start, slice_end));
                    if ( typeof self.pager_total_pages == "undefined" ) {
                        self.pager_total_pages = self.cache[pager_page_no].TotalPages;
                    }
                    page_end = Math.min(page_end, self.pager_total_pages);
                    get_page(pager_page_no+1, entries);
                };
                if ( typeof self.cache[pager_page_no] == "undefined" ) {
                    self.pager(pager_page_no+1, cb);
                } else {
                    cb(pager_page_no+1, self.cache[pager_page_no]);
                }
            };
            get_page(page_start, entries);
        } else {
            if ( !this.generator_finished && this.cache.length < end ) {
                var cb = function(next) {
                    if ( next && next.length == 0 ) {
                        self.generator_finished = true;
                    }
                    self.cache.push.apply(self.cache, next);
                    if ( !self.generator_finished && self.cache.length < end ) {
                        self.generator(cb);
                    } else {
                        entries = self.cache.slice(start, end);
                        finish();
                    }
                };
                this.generator(cb);
            } else {
                entries = self.cache.slice(start, end);
                finish();
            }
        }
    };
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
(function(S, undefined) {
  S.filterChain = function() {
    this.index = -1;
    this.chain = (arguments.length > 0 ? arguments : []);
  };
  S.filterChain.prototype.register = function(filter){
    this.chain.push(filter);
  };
  S.filterChain.prototype.run = function() {
    this.index++;
    if ( this.index < this.chain.length ) {
      this.chain[this.index].run(this);
    }
  };
  S.i18n = {
    locale: "en",
    messages: {
      "zh": {
        "see_detail": "\u8be6\u60c5",
        "no_results": "\u62b1\u6b49\uff01\u6ca1\u6709\u627e\u5230\u76f8\u5173\u7684\u5546\u54c1",
        'hide': "\u9690\u85cf",
        'show': "\u663e\u793a",
        'feedback': '\u53cd\u9988',
        'shoppingassist': '\u5982\u610f\u6dd8',
        'settings': '\u9009\u9879',
        'feedback_url': "http://ruyi.taobao.com/feedback",
        'choose_at_least_one': '\u8bf7\u81f3\u5c11\u9009\u4e2d\u4e00\u4e2a\u641c\u7d22\u7f51\u7ad9',
        'homepage': "\u5b98\u65b9\u7f51\u7ad9",
        'search': '\u641c\u7d22',
        'search_engine_setting': '\u641c\u7d22\u5546\u57ce\u8bbe\u7f6e',
        'search_engine_setting_title': '\u641c\u7d22\u5546\u57ce',
        'search_engine_setting_commit': '\u5b8c\u6210',
        'no_products': '\u62b1\u6b49\uff01\u6ca1\u6709\u627e\u5230\u76f8\u5173\u7684\u5546\u54c1',
        'search_engine_setting_msg': '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5546\u57ce\u3002',
        'search_product_in': '\u5728${1}\u641c\u7d22"${2}"',
        'click_to_hide': '\u70b9\u51fb\u9690\u85cf\u641c\u7d22\u7ed3\u679c',
        'expand': '\u5c55\u5f00',
        'shrink': '\u6536\u8d77',
        'close': '\u5173\u95ed',
        'hide_searchbox': '\u9690\u85cf\u641c\u7d22\u6846'
      },
      "en": {
        "see_detail": "See Detail",
        "no_results": "sorry, no results",
        'hide': "Hide",
        'show': "Show",
        'feedback': 'Feedback',
        'settings': 'Options',
        'shoppingassist': 'Shopping Assistant',
        'homepage': 'Homepage',
        "choose_at_least_one": "Please select at least one search site",
        'feedback_url': "http://spreadsheets.google.com/viewform?hl=en&formkey=dFhZVkE5ZC1veFk4YzRfVnpDRGtkTWc6MQ",
        'expand': 'Expand',
        'collapse': 'Collapse',
        'close': 'Close',
        'search': 'Search',
        'search_engine_setting': 'Customize',
        'search_engine_setting_title': 'Search On',
        'search_engine_setting_commit': 'OK',
        'no_products': 'Oops, no results',
        'search_engine_setting_msg': 'Please select at least one site.',
        'search_product_in': 'Search "${2}" at ${1}',
        'click_to_hide': 'Click to hide',
        'shrink': 'Shrink',
        'hide_searchbox': 'Hide searchbox'
      },
      "fr" : {
        "see_detail": "Voir le d\u00e9tail",
        "no_results": "D\u00e9sol\u00e9, aucun r\u00e9sultat",
        'hide': "Hide",
        'show': "Show",
        'feedback': 'Feedback',
        'settings': 'Options',
        'shoppingassist': 'Shopping Assistant',
        'homepage': 'Homepage',
        "choose_at_least_one": "Merci de s\u00e9lectionner au moins un site de recherche",
        'feedback_url': "http://spreadsheets.google.com/viewform?hl=en&formkey=dFhZVkE5ZC1veFk4YzRfVnpDRGtkTWc6MQ",
        'expand': 'Expand',
        'collapse': 'Collapse',
        'close': 'Close',
        'search': 'Search',
        'search_engine_setting': 'Customize',
        'search_engine_setting_title': 'Search On',
        'search_engine_setting_commit': 'OK',
        'no_products': 'Oops, no results',
        'search_engine_setting_msg': 'Please select at least one site.',
        'search_product_in': 'Search "${2}" at ${1}',
        'click_to_hide': 'Click to hide',
        'shrink': 'Shrink',
        'hide_searchbox': 'Hide searchbox'
      },
      "it": {
        "see_detail": "Vedi dettagli",
        "no_results": "Spiacenti, nessun risultato",
        'hide': "Hide",
        'show': "Show",
        'feedback': 'Feedback',
        'settings': 'Opzioni',
        'shoppingassist': 'Shopping Assistant',
        'homepage': 'Homepage',
        "choose_at_least_one": "Prego, selezionare almeno un sito di ricerca",
        'feedback_url': "http://spreadsheets.google.com/viewform?hl=en&formkey=dFhZVkE5ZC1veFk4YzRfVnpDRGtkTWc6MQ",
        'expand': 'Expand',
        'collapse': 'Collapse',
        'close': 'Close',
        'search': 'Search',
        'search_engine_setting': 'Customize',
        'search_engine_setting_title': 'Search On',
        'search_engine_setting_commit': 'OK',
        'no_products': 'Oops, no results',
        'search_engine_setting_msg': 'Please select at least one site.',
        'search_product_in': 'Search "${2}" at ${1}',
        'click_to_hide': 'Click to hide',
        'shrink': 'Shrink',
        'hide_searchbox': 'Hide searchbox'
      },
      "de" : {
        'see_detail' : 'Details anschauen',
        'no_results' : 'Entschuldigung, keine Suchergebnisse',
        'hide' : 'Verstecken',
        'show' : 'Zeigen',
        'feedback': 'Reaktion',
        'settings' : 'Optionen',
        'shoppingassist' : 'Shopping Assistant',
        'homepage': 'Startseite',
        'choose_at_least_one' : 'Bitte w\u00e4hlen Sie mindestens eine Seite zum Durchsuchen aus',
        'feedback_url': "http://spreadsheets.google.com/viewform?hl=en&formkey=dFhZVkE5ZC1veFk4YzRfVnpDRGtkTWc6MQ",
        'expand': 'Erweitern',
        'collapse': 'Zusammenbruch',
        'close': 'in der N\u00e4he',
        'search': 'Search',
        'search_engine_setting': 'Customize',
        'search_engine_setting_title': 'Search On',
        'search_engine_setting_commit': 'OK',
        'no_products': 'Oops, no results',
        'search_engine_setting_msg': 'Please select at least one site.',
        'search_product_in': 'Search "${2}" at ${1}',
        'click_to_hide': 'Click to hide',
        'shrink': 'Shrink',
        'hide_searchbox': 'Hide searchbox'
      }
    },

    setLocale: function(locale) {
      if ( !(locale in this.messages) ) {
        return;
      }
      this.locale = locale;
    },

    getLocale: function(){
      return this.locale;
    },

    getMessage: function() {
      var args = arguments;
      var key = args[0];
      var msg = '';
      if ( (key in this.messages[this.locale]) ) {
        msg = this.messages[this.locale][key];
        if (args.length > 1) {
          msg = msg.replace(/\$\{\d\}/g, function(placeholder) {
            var index = placeholder.substring(2, 3);
            return args[index];
          });
        }
      }
      return msg;
    }
  };

  /**
   * copy properties from extended to original
   *
   * @param object original
   * @param object extended
   * @return object original
   */
  S.extend = function(original, extended, overwrite, keys){
    if ( !original || !extended ) return original;
    if ( overwrite === undefined ) overwrite = true;
    var i,p,l;
    if ( keys && (l=keys.length) ) {
      for ( i=0; i<l; i++ ) {
        p = keys[i];
        if ( (p in extended) && (overwrite || !(p in original)) ) {
          original[p] = extended[p];
        }
      }
    } else {
      for (p in extended) {
        if ( overwrite || !(p in original) ) {
          original[p] = extended[p];
        }
      }
    }
    return original;
  };

  S.debounce = function(func, time, exeAsap ){
    var timer;

    return function debounced(){
      var obj  = this;
      var args = arguments;

      function delayed(){
        if ( ! exeAsap ) {
          func.apply( obj, args );
        }
        timer = null;
      }

      if ( timer ) {
        clearTimeout( timer );
      } else if ( exeAsap ) {
        func.apply( obj, args );
      }

      timer = setTimeout( delayed, time || 100 );
    };
  };

  /* borrowed from http://code.google.com/p/sprintf */
  S.str_repeat = function(i, m) {
    for (var o = []; m > 0; o[--m] = i);
    return o.join('');
  };

  S.sprintf = function() {
    var i = 0, a, f = arguments[i++], o = [], m, p, c, x, s = '';
    while (f) {
      if (m = /^[^\x25]+/.exec(f)) {
        o.push(m[0]);
      }
      else if (m = /^\x25{2}/.exec(f)) {
        o.push('%');
      }
      else if (m = /^\x25(?:(\d+)\$)?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(f)) {
        if (((a = arguments[m[1] || i++]) == null) || (a == undefined)) {
          throw('Too few arguments.');
        }
        if (/[^s]/.test(m[7]) && (typeof(a) != 'number')) {
          throw('Expecting number but found ' + typeof(a));
        }
        switch (m[7]) {
        case 'b': a = a.toString(2); break;
        case 'c': a = String.fromCharCode(a); break;
        case 'd': a = parseInt(a); break;
        case 'e': a = m[6] ? a.toExponential(m[6]) : a.toExponential(); break;
        case 'f': a = m[6] ? parseFloat(a).toFixed(m[6]) : parseFloat(a); break;
        case 'o': a = a.toString(8); break;
        case 's': a = ((a = String(a)) && m[6] ? a.substring(0, m[6]) : a); break;
        case 'u': a = Math.abs(a); break;
        case 'x': a = a.toString(16); break;
        case 'X': a = a.toString(16).toUpperCase(); break;
        }
        a = (/[def]/.test(m[7]) && m[2] && a >= 0 ? '+'+ a : a);
        c = m[3] ? m[3] == '0' ? '0' : m[3].charAt(1) : ' ';
        x = m[5] - String(a).length - s.length;
        p = m[5] ? S.str_repeat(c, x) : '';
        o.push(s + (m[4] ? a + p : p + a));
      } else {
        throw('Huh ?!');
      }
      f = f.substring(m[0].length);
    }
    return o.join('');
  };

  S.format_price = function (price_amount, locale) {
    if ( price_amount <= 0 ) {
      return '';
    }
    var s = '';
    var p = S.sprintf('%.2f', price_amount/100);
    switch ( locale ) {
    case 'us' :
      s = '$' + p;
      break;
    case 'ca':
      s = 'CDN$' + p;
      break;
    case 'fr':
    case 'de':
      s = 'EUR ' + p;
      break;
    case 'uk':
      s = '&#xA3;' + p;
      break;
    default:
      s = '$' + p;
    }
    return s;
  };

  S.get_cookie = function(key) {
    var pairs = document.cookie.split('; ');
    for (var i = 0, pair; pair = pairs[i] && pairs[i].split('='); i++) {
      if ( pair[0] === key ) {
        return pair[1] || '';
      }
    }
  };

  var _selectors = {};
  var _selectors_seen = {};
  var generateRandomString = function() {
    var rand_str = String.fromCharCode(Math.floor(Math.random() * 25 + 97)) +
      Math.floor(Math.random() * 134217728).toString(36);
    if ( typeof _selectors_seen[rand_str] != "undefined" ) {
      return generateRandomString();
    } else {
      _selectors_seen[rand_str] = true;
      return rand_str;
    }
  };

  S.transform_selector = function(selector) {
    // return 'ruyitao-' + selector;
    if ( typeof _selectors[selector] != "undefined" ) {
      return _selectors[selector];
    }
    var prefix = 'ryt-';
    return _selectors[selector] = prefix + generateRandomString();
  };
  
  S.isNumeric = function( obj ) {
    return !isNaN( parseFloat(obj) ) && isFinite( obj );
  };
})(exports);
(function(S, undefined) {
  S.site = {
    SearchTerm: (function () {
      var F = function ( str, enc ) {
        this.value = str;
        this.encoding = (typeof enc == "undefined"
                         ? (document.charset ||document.characterSet || '').toLowerCase()
                         : enc );
      };

      F.prototype = {
        toString: function() {
          return this.value;
        },

        containMultbyteChar: function(str) {
          for (var i=0, len=str.length; i<len; i++ ) {
            if ( str.charCodeAt(0) > 0x80 ) {
              return true;
            }
          }
          return false;
        },

        getUnicode: function(callback) {
          if ( this.value.match(/%u[0-9a-fA-F]{4}/) ) {
            var val = this.value.replace(/%u([0-9a-fA-F]{4})/g, function(str, code) { return String.fromCharCode(parseInt(code, 16)); });
            callback(val);
          } else if ( this.containMultbyteChar(this.value) ) {
            callback( decodeURIComponent(this.value) );
          } else if ( this.encoding.match(/(x-)?(cp936|gbk|gb2312|gb18030)/) ) {
            S.browser.extension.sendRequest({
              topic: "decode_gbk",
              data: this.value
            }, callback);
          } else {
            callback(this.value);
          }
        }
      }
      return F;
    })(),

    get_domain: function (doc) {
      if ( doc.location && doc.location.hostname ) {
        return doc.location.hostname;
      }
      return "";
    },

	get_domain_from_str: function (str){
	  var domain = "undefined";
	  if (str.toLowerCase().indexOf('http://') == 0){
		domain = str.substring(7);
		domain = 'http://'+domain.substring(0,domain.indexOf('/'));
	  }else if (str.toLowerCase().indexOf('https://') == 0){
		domain = str.substring(8);
		domain = 'https://'+domain.substring(0,domain.indexOf('/'));
	  }
	  return domain;
	},

    get_url: function (doc) {
      if ( doc.location && doc.location.href ) {
        return doc.location.href;
      }
      if ( doc.title ) {
        return doc.title;
      }
      return "";
    },

    get_site: function (domain) {
      var site = "";
      if ( domain ) {
        var len = 2;
        var parts = domain.split(".");
        if ( domain.match(/\.(com|co|org|net)\.(cn|uk|jp|hk|us|ca)$/) ) {
          len +=1;
        }
        if ( parts.length >= len ) {
          site = parts.splice(parts.length-len, parts.length).join(".");
        } else {
          site = domain;
        }
      }
      return site;
    },

    get_sub_domain: function (domain,site) {
      var sub_domain = "";
      if ( domain ) {
        if ( domain.length > site.length ) {
          sub_domain = domain.substring(0, domain.length-site.length-1);
        } else {
          sub_domain = "DUMMY";
        }
      }
      return sub_domain;
    },

    /**
     * check search key word is a shopping term
     */
    check_shopping_term: function () {
      var site = this.get_site(this.get_domain(document));
      if ( site == 'google.com' || site == 'google.cn' || site== 'google.com.hk' || site== 'google.co.uk' ) {
        var url = decodeURIComponent(document.location.href);
        if( url.indexOf('/products') != -1 ){ // shopping category search
          return true;
        } else if( url.indexOf( 'tbs=bks:1') != -1 || url.indexOf( 'tbs=shop:1') != -1 || url.indexOf( 'tbm=bks') != -1 || url.indexOf( 'tbm=shop') != -1  ){ // books/shopping category search
          return true;
        }
      } else if( site == 'bing.com' ) {
        // shopping category search
        if( document.location.href.indexOf('/shopping/') != -1 ){
          return true;
        }

        // bing suggest shoping
        var links = $('#sw_abarl').find('a');
        var flag = false;
        $.each(links, function( index, node) {
          if( $(node).attr('href').indexOf('/shopping/') != -1 ){
            flag = true;
            return;
          }
        });
        return flag;
      }else{
        return true;
      }
    },

    get_search_term: function(site_config, doc) {
      if ( ! this.check_shopping_term() ) {
        return false;
      }
      var search_term = "";
      var domain = this.get_domain(doc);
      var site = this.get_site(domain);
      var sub_domain = this.get_sub_domain(domain,site);
      if ( site_config[sub_domain] ) {
        // exclude the sub_domain mark by e
        if ( typeof site_config[sub_domain].e == "undefined" ) {
          search_term = this.extract_search_term(site_config[sub_domain], doc);
        }
      }
      if (search_term && typeof search_term == 'string') {
        search_term = new this.SearchTerm(search_term);
      }
      return search_term;
    },

    extract_search_term: function (domain_config, doc) {
      var search_term = "";
      var url = doc.location.href;
      var urlSearch = doc.location.search || doc.location.hash;
      var urlCharset;
      for ( var i=0; i<domain_config.length; i++ ) {
        var keyword = domain_config[i].k;
        var delimit = domain_config[i].d;
        var search_id = domain_config[i].s;
        var stop_keyword = domain_config[i].sk;
        var charset = domain_config[i].charset;
        
        var params;
        if (urlSearch) {
          urlSearch = urlSearch.slice(1);
          var params = urlSearch.split(delimit);
          var l = params.length;
          var param;
          for (var i = 0; i < l; i++) {
            param = params[i].split('=');
            if (keyword && param[0] == keyword) {
              search_term = param[1];
            } else if (param[0] == charset) {
              urlCharset = param[1];
            }
          }

          if (search_term) {
            search_term = new this.SearchTerm(search_term, urlCharset);
          }
        }

        /*if ( keyword ) {
          search_term = this.find_search_term_from_query(url, keyword, delimit);
        }*/

        if ( !search_term && search_id ) {
          search_term = this.find_search_term_from_document(doc, search_id);
          if ( stop_keyword && stop_keyword == search_term ) {
            search_term = "";
          }
        }

        if ( search_term ) {
          break;
        }
      }
      return search_term;
    },

    find_search_term_from_query: function (url, keyword, delimit) {
      var search_term = "";
      var parts = url.split(delimit);
      var re = new RegExp("(?:^|\\?)" + keyword + "=([^#;\\?:@=&{}\\|\\\\^~\\[\\]`<>\\\"]*)");
      for ( var i=0; i<parts.length; i++ ) {
        var match = re.exec(parts[i]);
        if ( match ) {
          search_term = match[1];
          // break;
        }
      }
      if ( search_term ) {
        search_term = search_term.replace(/\+/g, " ");
      }
      return search_term;
    },

    find_search_term_from_document: function (doc, search_id) {
      var search_term = "";
      var searchField = doc.getElementById(search_id);
      if (searchField) {
        search_term = searchField.value;
      } else {
        var nodes = doc.getElementsByTagName("input");
        for ( var i=0; i<nodes.length; i++ ) {
          if ( nodes[i].name == search_id ) {
            search_term= nodes[i].value;
            break;
          }
        }
      }
      return search_term ? new this.SearchTerm( search_term, "unicode" ) : search_term;
    }
  };
})(exports);

(function(S, win, doc, undefined) {
  if (!S.SearchBox)
    S.SearchBox = {};
  var cache = {};
  var SELECTORS = S.transform_selector;
  S.SearchBox.Util = {
    getClickUrl: function(url, callback) {
      S.browser.extension.sendRequest({
        topic: 'construct_click_url',
        url: url
      }, callback)
    },
    
    getURL: function(url) {
      return S.browser.extension.getURL(url);
    },

    getCurrentTab: function(callback) {
      S.browser.extension.sendRequest({
        topic: 'get_current_tab'
      }, callback);
    },

    openTab: function(url, select, callback) {
      select = select || false;
      S.browser.extension.sendRequest({
        topic: 'tab_open',
        url: url,
        selected: select
      }, callback);
    },

    closeTab: function(tabId, callback) {
      S.browser.extension.sendRequest({
        topic: 'close_tab',
        tabId: tabId
      }, callback);
    },

    activeTab: function(tabId, callback) {
      S.browser.extension.sendRequest({
        topic: 'active_tab',
        tabId: tabId
      }, callback);
    },

    appendTraceParameter: function(pageUrl, clickUrl) {
      var query = clickUrl.split(/[?&]/);
      for ( var i=0,len=query.length; i<len; i++ ) {
        if ( query[i].indexOf('tb_lm_id=') == 0 ) {
          pageUrl = pageUrl.replace(/&tb_lm_id=[^&]*/, '').replace(/\?tb_lm_id=[^&]*&/, '?')
            + (pageUrl.indexOf('?') == -1 ? '?' : '&') + query[i];
        }
      }
      return pageUrl;
    },

    sendLog: function(action, label) {
      var options = {
        topic: "send_log",
        action: action,
        referrer: document.referrer
      };
      if ( typeof label != "undefined" ) {
        options.label = label;
      }
      S.browser.extension.sendRequest(options);
    },

    _imgCache: {},
    _imgCacheIndex: 0,
    sendImageLog: function(url) {
      if ( !url ) { return; }
      var self = this,
      c = new Image,
      e = this._imgCacheIndex++;
      this._imgCache[e] = c;
      c.onload = c.onerror = function(){ delete self._imgCache[e]; };
      c.src = url;
      c = null;
    },

    getViewPortWidth: function() {
      if (doc.compatMode == 'CSS1Compat') {
        return doc.documentElement.clientWidth;
      } else {
        return doc.body.clientWidth;
      }
    },

    getViewPortHeight: function() {
      if (doc.compatMode == 'CSS1Compat') {
        return doc.documentElement.clientHeight;
      } else {
        return doc.body.clientHeight;
      }
    },

    getOverlayWidth: function() {
      var viewportWidth = this.getViewPortWidth();
      return Math.max(viewportWidth, doc.body.scrollWidth);
    },

    getOverlayHeight: function() {
      var viewportHeight = this.getViewPortHeight();
      return Math.max(viewportHeight, doc.body.scrollHeight);
    },

    getScrollPosition: function() {
      var isWebkit = $.browser.webkit;
      var body = doc.body;
      var docElement = doc.documentElement;
      var scrollTop = isWebkit ? body.scrollTop : docElement.scrollTop;
      var scrollLeft = isWebkit ? body.scrollLeft : docElement.scrollLeft;
      return {
        top: scrollTop,
        left: scrollLeft
      };
    },

    handleSogou: function() {
      var ua = win.navigator.userAgent;
      if (/SE\s\d\.X\sMetaSr\s\d\.\d/g.test(ua)) {
        $('#' + SELECTORS('option-link')).hide();
      }
    },

    replaceTemplateSelectors: function(html) {
      return html.replace(/ruyitao-selector-prefix-([\w_-]+)/g, function() {
        return S.transform_selector(arguments[1]);
      });
    },

    getTemplate: function(page_name, callback) {
      var self = this;
      S.browser.extension.sendRequest({
        topic: "get_template",
        page: page_name
      }, function (template) {
        if (typeof S.loadJQuery == "function") {
          $ = jQuery = S.loadJQuery();
        }
        template = S.SearchBox.Util.replaceTemplateSelectors(template);
        self.sanitizeHTML(template, function(sanitizedTemplate) {
          callback(sanitizedTemplate);
        })
      });
    },

    sanitizeHTML: function(htmlString, callback) {
      S.browser.extension.sendRequest({
        topic: 'sanitize_html',
        htmlString: htmlString
      }, function(sanitizedHTML) {
        callback(sanitizedHTML)
      })
    },


    addEvent: function(elem, _event, handler, capture) {
      capture = capture || false;
      if (elem.addEventListener) {
        elem.addEventListener(_event, handler, capture);
      } else if (elem.attachEvent) {
        elem.attachEvent('on' + _event, handler);
      }
    },

    /**
     * Add thousand separator for integer or float number.
     * @param {string|number} num number
     */
    addThousandSeparator: function(num) {
      if (isNaN(+num))
        return;
      num = num + '';
      var integer = num.split('.')[0];
      var decimals = num.split('.')[1];
      decimals = decimals ? '.' + decimals : '';  
      return integer.replace(/(\d)(?=(?:\d{3})+\b)/g, '$1,') + decimals;
    },

    ajax: function(options, callback) {
      options.topic = 'ajax';
      S.browser.extension.sendRequest(options, callback);
    },

    // 修复 IE 下 STYLE 或 LINK 超过 31 个的时候如意淘样式表失效的问题
    mergeStyleSheets: function() {
      if(!$.browser.msie || !document.styleSheets) {
        return true;
      }

      var aSheet = document.styleSheets
      var aStyle = document.getElementsByTagName('style')
      var aLink = document.getElementsByTagName('link')
      if (aStyle.length + aLink.length < 32 || !aSheet[0].cssText) {
        //document.styleSheets.cssText 只有IE支持
        return true;
      }

      var firstStyleSheet = document.styleSheets[0];
      var $styleSheets = $('.' + SELECTORS('stylesheet'));
      var elem;
      for (var i = 0; i < $styleSheets.length; i ++) {
        elem = $styleSheets.get(i)
        try {
          firstStyleSheet.cssText += elem.styleSheet.cssText;
          $(elem).remove();
        } catch (e) {
          return false; // Merge stylesheets failed
        }
      }
      return true
    },

    parseImagePrice: function($price, callback) {
      var url = $price.attr('data-lazyload'); // 京东惰性加载
      if (!url) {
        url = $price.attr('src')
      }
      S.browser.extension.sendRequest({
        topic: 'parse_image_price',
        domain: S.SearchBox.Util.getLocationProperty(win, 'hostname'),
        url: url
      }, callback)
    },

    loadJQuery: function() {
    },

    parsePriceString: function(price) {
      if (price) {
        var match = /\d+(?:\.\d+)?/.exec(price)
        if (match) {
          price = match[0]
          price = parseFloat(price)
        }
      }
      return price
    },

    getTopLevelDomain: function(domain) {
      var regexp = /[a-z0-9_-]+\.(?:com|net|org)/ig
      var match = regexp.exec(domain)
      if (!match) {
        return null
      }

      return match[0].toLowerCase()
    },

    getSiteMetaInfo: function(domain) {
      var topLevelDomain = this.getTopLevelDomain(domain)
      if (!topLevelDomain)
        return null
      var info = this.siteMetaInfo[topLevelDomain]
      return info
    },

    siteMetaInfo: {
      "360buy.com": {
        "name": "\u4eac\u4e1c"
      },

      "51buy.com": {
        "name": "\u6613\u8fc5"
      },

      "suning.com": {
        "name": "\u82cf\u5b81\u6613\u8d2d"
      }
    },

    randomAppend: function(parent, docFragment) {
      var $siblings = $(parent).find('> *')
      var length = $siblings.length
      var index = parseInt(Math.random() * length)
      $siblings.eq(index).after(docFragment)
    },
    
    openFeedback: function(epid, nid) {
      var url = 'http://ruyi.taobao.com/bug/item/' + epid + "?ref=" + (nid || encodeURIComponent(S.SearchBox.Util.getLocationHref(win)));
      S.SearchBox.Util.sendLog("click_compare", url);
      S.SearchBox.Util.openTab(url, true);
    },

    elemInArray: function(elem, array) {
      if (typeof array.indexOf == 'function') {
        return array.indexOf(elem) != -1;
      } else {
        for (var i = 0, l = array.length; i < l; i++) {
          if (array[i] === elem) {
            return true;
          }
        }
      }
      return false;
    },

    
    getLocation: function(win) {
      win = win || window;
      return win.location || win.document.location;
    },
    getLocationProperty: function(win, name) {
      //参数兼容只传递一个name
      if(typeof win === 'string') {
        name = win;
        win = undefined;
      }
      return S.SearchBox.Util.getLocation(win)[name];
    },
    getLocationHref: function(win) {
      return S.SearchBox.Util.getLocationProperty(win, 'href');
    }
  }
})(exports, window, document);

(function(S, doc) {
  if (!S.SearchBox)
    S.SearchBox = {};
  var SearchBox = S.SearchBox;
  var Util = S.SearchBox.Util;
  var UI = S.SearchBox.UI;
  var Tmpl = SearchBox.Tmpl;
  var _searchEngines;
  var _enabledSearchEngines;
  var _currentLocal;
  var _noValidation = false;
  var SELECTORS = S.transform_selector;
  S.SearchBox.SearchEngines = {
    init: function() {
      this.renderEnabledSearchEngines();
      this.registerEvents();
    },
    
    registerEvents: function() {
      var self = this;
      $('#' + SELECTORS('submit-ses-btn')).click(function(e) {
        e.preventDefault();
        self.submit();
      });
    },
    
    getAll: function(cb) {
      var self = this;
      S.browser.extension.sendRequest(
        {
          "topic": "get_search_engines"
        },
        function(resp) {
          _searchEngines = JSON.parse(JSON.stringify(resp.search_engines));
          self.setEnabled(_searchEngines);
          self.setLocale(resp.locale);
          cb(resp);
        }
      );
    },

    /**
     * Update cached search engines settings
     * @param {Object} settings {etao: true, amazoncn: false}
     */
    updateCached: function(settings) {
      var ses;
      var se;
      var seId;
      for (var locale in _searchEngines) {
        if ( _searchEngines.hasOwnProperty(locale) ) {
          ses = _searchEngines[locale];
          for (var i = 0, l = ses.length; i < l; i++) {
            se = ses[i];
            seId = se.name;
            if (settings.hasOwnProperty(seId)) {
              se.enabled = settings[seId];
            }
          }
        }
      }
    },

    setLocale: function(locale) {
      _currentLocal = locale;
      S.i18n.setLocale(locale);
    },

    getLocale: function() {
      return _currentLocal;
    },

    getCachedAll: function() {
      return _searchEngines;
    },

    filter: function(ses) {
      _noValidation = true;
      var domain = S.site.get_site(Util.getLocationProperty(window, 'hostname'));
      var result = [];

      for (var i = 0, l = ses.length; i < l; i++) {
        var se = ses[i];
        if ((se.host && domain.match(se.host)) || se.name == 'etao'
            || ((domain == 'paipai.com' || domain == 'eachnet.com') && se.name == 'taobao')) {
          // ses.splice(i, 1);
        } else {
          result.push(se);
        }
      }
      // _noValidation = false;
      return result;
    },

    sort: function(ses) {
      ses.sort(function(se1, se2) {
        if(se1.name == 'etao')return -1;
        if(se2.name == 'etao')return 1;
        return se1.order - se2.order;
      });
    },

    getCurrentLocaleSearchEngines: function() {
      var allSearchEngines = this.getCachedAll();
      var currentLocale = this.getLocale();
      var ses = [];
      for (var locale in allSearchEngines) {
        if ( allSearchEngines.hasOwnProperty(locale) && locale == currentLocale) {
          ses = Array.prototype.concat.apply(ses, allSearchEngines[locale]);
        }
      }
      return ses;
    },

    renderSearchEngineSettingHtml: function() {
      var ses = this.getCurrentLocaleSearchEngines();
      ses = this.filter(ses);

      var html = Tmpl.getSearchEngineSettingTemplate(ses, this.getLocale());
      $('#' + SELECTORS('merchant-list')).html(html);
    },

    renderEnabledSearchEngines: function() {
      var ses = this.getEnabled();
      this.sort(ses);
      var template = $('#' + SELECTORS('search-engine-item-template')).html();
      $.each(ses, function(index, se) {
        se.icon = se.icon ||
          Util.getURL('assets/images/search/se-icons/' + se.name + '.png');
      });
      var html = Tmpl.getSearchEnginesTemplate(ses);
      $('#' + SELECTORS('search-engines')).html(html);
    },

    setSearchEngineSettingPosition: function() {
      var $plusBtn = $('#' + SELECTORS('plus-btn'));
      var $searchEngineSetting = $('#' + SELECTORS('search-engines-setting'));
      var refLeft = $plusBtn.position().left + $plusBtn.width() / 2;
      var clientWidth = $searchEngineSetting.outerWidth();
      var left = refLeft - clientWidth / 2;
      if (left < 0)
        left = 0;
      $searchEngineSetting.css('left', left + 'px');
    },

    getEnabled: function() {
      return _enabledSearchEngines;
    },

    /**
     * Set enabled search engines.
     * @param {Object} ses {zh: [], us: []}
     */
    setEnabled: function(ses) {
      ses = ses || this.getCachedAll();
      var domain = S.site.get_site(Util.getLocationProperty(window, 'hostname'));
      var enabledSearchEngines = [];
      var addEnabledSearchEngines = function(locale) {
        var tmp = ses[locale];
        var i, len;
        for ( i = 0, len = tmp.length; i < len; i++ ) {
          var se = tmp[i];
          // 搜索引擎启用状态且域名不一样
          if (se.enabled && !(se.host && domain.match(se.host))) {
            if ((domain == 'paipai.com' || domain == 'eachnet.com') &&
                (se.name == 'taobao' || se.name == 'etao')) {

            } else {
              enabledSearchEngines.push(se);
            }
          }
        }
      };
      
      if (ses[_currentLocal]) {
        addEnabledSearchEngines(_currentLocal);
      }
      
      for (var locale in ses) {
        if ( ses.hasOwnProperty(locale) && locale != _currentLocal) {
          addEnabledSearchEngines(locale);
        }
      }
      _enabledSearchEngines = enabledSearchEngines;
    }
  }
})(exports, document);
/**
 * @fileOverview js组件基础
 * @import jQuery.js
 * @author pengkun 
 * @version  1.0
 */
(function(pkg) {
	var
	newp = function(p) {
		var F = function(){};
		F.prototype = p;
		return new F;
	},
	createClass = function(s, c) {
		if(!s) {
			s = Parent;
		} else if(typeof s != "function") {
			c = s;
			s = Parent;
		}
		
		var F = createClass2(s, function(){F.superclass.prototype.constructor.apply(this, arguments);});
		for(var k in c) {
			if(c[k] instanceof Function) {
				c[k].__name = k;
				c[k].__owner = F;
			}
			F.prototype[k] = c[k];
		}
		F.superclass = s;
		//为了兼容之前的版本
		F._super = s.prototype;
		return F;
	},
	createClass2 = function(s, F) {
		F.prototype = newp(s.prototype);
		F.prototype.constructor = F;
		
		return F;
	},
	getEventName = function(s) {
	  var arr = s.split(/ +/g);
	  for(var i=0, len=arr.length; i<len; i++) {
	    arr[i] = "__event_" + arr[i];
	  }
	  return arr.join(' ');
	},
	Parent = createClass(function(){this.init.apply(this, arguments);}, {
		//构造函数
		init : function(){},
		
		//子类调用父类相关函数
		parent : function() {
			return arguments.callee.caller.__owner.superclass;
		},
		parentProto : function() {
			return arguments.callee.caller.__owner.superclass.prototype;
		},
		callParent : function(methodName/*, callMethodParams ...*/) {
			var args = Array.prototype.slice.call(arguments);
			return arguments.callee.caller.__owner.superclass.prototype[args.shift(0)].apply(this, args);
		},
		callSuper : function(/*callMethodParams ...*/) {
			return arguments.callee.caller.__owner.superclass.prototype[arguments.callee.caller.__name].apply(this, arguments);
		},
		
		//事件的注册、取消
		bind : function (name, data, func) {
			arguments[0] = getEventName(arguments[0]);
			var _j_this = $(this);
			$(this).bind.apply(_j_this ,arguments);
			return this;
		},
		one : function (name, data, func) {
			arguments[0] = getEventName(arguments[0]);
			var _j_this = $(this);
			_j_this.one.apply(_j_this ,arguments);
			return this;
		},
		trigger : function (name, data) {
			arguments[0] = getEventName(arguments[0]);
			var _j_this = $(this);
			_j_this.trigger.apply(_j_this ,arguments);
			return this;
		},
		triggerHandler : function (name, data) {
			arguments[0] = getEventName(arguments[0]);
			var _j_this = $(this);
			_j_this.triggerHandler.apply(_j_this ,arguments);
			return this;
		},
		unbind : function (name, data) {
			arguments[0] = getEventName(arguments[0]);
			var _j_this = $(this);
			_j_this.unbind.apply(_j_this ,arguments);
			return this;
		}
	});
	
	/** 
	 * @description 创建命名空间
	 * @function
	 * @param {String|Object} [s] 命名空间字符串，例如：a.b.c
	 * @returns {Object|s} 命名空间对象,如果s不是字符串，不错处理返回s
	 */
	var createPackage = function(s) {
		if((typeof s == "string" || s instanceof String) && (s=$.trim(s)).length>0) {
			var topPack = window;
			var arr = s.split(".");
			for(var i=0; i<arr.length; i++) {
				if(typeof topPack[arr[i]] == "undefined") {
					topPack[arr[i]] = {};
				}
				topPack = topPack[arr[i]];
			}
			return topPack;
		}
		return s;
	};
	
	pkg = createPackage(pkg);
	
	$.extend(pkg, {
		Parent : Parent,
		/** 
		 * @description 创建类
		 * @function
		 * @param {Function} [superClass=default] 所创建类的父类
		 * @param {Map} newMethod 要创建类的方法和属性
		 * @returns {Function} 创建的新类
		 *			{Object} [_super] 新类的父类原型(prototype)
		 */
		createClass : createClass,
		/** 
		 * @description 将函数添加到数组
		 * @function
		 * @param {Array} [arr=[]] 将function添加到该数组
		 * @param {Function|Array} func 要添加的函数
		 * @returns {Array} 函数数组
		 */
		funcToArray : function (arr, func) {
			var array = arr || [];
			if (func) {
				if (func instanceof Array) {
					array = array.concact(func);
				} else if($.isFunction(func)) {
					array.push(func);
				}
			}
			return array;
		},
		/** 
		 * @description 创建命名空间
		 * @function
		 * @param {String} [s=null] 命名空间字符串，例如：a.b.c
		 * @returns {Object|null} 命名空间对象
		 */
		createPackage : createPackage
	});
})("ruyi.object");/**
 * @fileOverview aop功能,方法级拦截器
 * @import jQuery.js
 * @author pengkun 
 * @revision 1.0
 */

(function(pkg) {
	var
	_add = function(o, name, fn, isAfter) {
		var flag = $.isFunction(o), old, f;
		//重载，如果o是函数
		if(flag) {
			old = o;
			fn = name;
		} else {
			old = o[name];
		}
		if(isAfter) {
			//f = function(){var r = old.apply(this, arguments);fn.apply(this, arguments);return r;};
			f = getFunc(old, fn, 0);
		} else {
			//f = function(){fn.apply(this, arguments);return old.apply(this, arguments);};
			f = getFunc(fn, old, 1);
		}
		for(var k in old) {
			f[k] = fn[k] = old[k];
		}
		
		if(!flag) {
			o[name] = f;
		}
		
		return f;
	},
	/** 
	 * @description 方法前增加拦截
	 * @function
	 * @param {Object} obj 要增加拦截的对象
	 * @param {String} name 要增加拦截的方法
	 * @param {Function} func 执行的函数
	 * @returns {Function} 添加拦截器之前的函数
	 */
	addBefore = function(o, name, fn) {
		return _add(o, name, fn, false);
	},
	/** 
	 * @description 方法后增加拦截
	 * @function
	 * @param {Object} obj 要增加拦截的对象
	 * @param {String} name 要增加拦截的方法
	 * @param {Function} func 执行的函数
	 * @returns {Function} 添加拦截器之前的函数
	 */
	addAfter = function(o, name, fn) {
		return _add(o, name, fn, true);
	},
	getFunc = function(fn1, fn2, returnVal) {
		return function() {
			var
			v1 = fn1.apply(this, arguments),
			v2 = fn2.apply(this, arguments);
			return returnVal == 0 ? v1 : v2;
		};
	}
	;
	
	$.extend(pkg, {
		/** 
		 * @description 方法前增加拦截
		 * @function
		 * @param {Object} obj 要增加拦截的对象
		 * @param {String} methodName 要增加拦截的方法
		 * @param {Function} func 执行的函数
		 * @returns {Function} 添加拦截器之前的函数
		 */
		addBefore : addBefore,
		/** 
		 * @description 方法后增加拦截
		 * @function
		 * @param {Object} obj 要增加拦截的对象
		 * @param {String} methodName 要增加拦截的方法
		 * @param {Function} func 执行的函数
		 * @returns {Function} 添加拦截器之前的函数
		 */
		addAfter : addAfter
	});
})(ruyi.object.createPackage("ruyi.aop"));/**
 * @fileOverview 数据拉取
 * @import jQuery.js
 * @import ruyi.object.js
 * @author pengkun
 * @version 1.0
 */
(function(pkg, S) {
  /**
   * @description 数据源对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {Boolean} [arg0.defaultLoad=false] 实例化时是否加载数据
   * @param {Boolean} [arg0.autoAbort=true] 发起下一次数据请求前是否取消上一次请求
   * @param {Object} [arg0.conf={}] 发送请求的参数，同jQuery.ajax参数
   * @param {ruyi.data.Filter} [arg0.successFilter=null] 成功后数据过滤器
   */
  var DataSource = ruyi.object.createClass(null, {
    conf : null,
    xmlHttpRequest : null,
    _abortFlagArr : null,
    defaultLoad : false,
    autoAbort : true,
    successFilter : null,
    getData : null,

    init : function(arg0) {
      $.extend(this, arg0, {
        _abortFlagArr : {}
      });

      if ( typeof this.defaultLoad == "boolean" && this.defaultLoad) {
        this.load();
      }
    },
    load : function() {
      this.reload();
    },
    reload : function() {
      var _this = this;

      if (this.autoAbort) {
        this.abort();
      }

      var key = new Date().getTime();
      this._abortFlagArr[key] = false;

      var getFunction = function(oldFunc) {
        return $.isFunction(oldFunc) ? function() {
          if ( typeof _this._abortFlagArr[key] == "boolean" && !_this._abortFlagArr[key]) {
            oldFunc.apply(this, arguments);
          }
        } : null;
      };

      var successFunc = this.conf.success;
      if ($.isFunction(successFunc) && this.successFilter) {
        successFunc = function() {
          //将success callback设置为第一个参数, 并保持scope(this)
          var args = [$.proxy(_this.conf.success, this)];
          Array.prototype.push.apply(args, arguments);
          _this.successFilter.doFilter.apply(this.successFilter, args);
          //_this.conf.success.apply(this, arguments);
        };
      }

      var errorFunc = getFunction(this.conf.error);
      successFunc = getFunction(successFunc);
      var completeFunc = ruyi.aop.addBefore(getFunction(this.conf.complete) ||
      function() {
      }, function() {
        _this.xmlHttpRequest = null;
      });

      //如果读本地数据(非远程数据)
      /*if($.isFunction(this.getData)) {
       var data = undefined;
       try {
       data = this.getData(this.conf.data);
       if($.isFunction(successFunc)) {
       successFunc.call(this, data);
       }
       } catch(e) {
       if($.isFunction(errorFunc)) {
       errorFunc.call(this, e);
       }
       }

       if($.isFunction(completeFunc)) {
       completeFunc.call(this);
       }

       } else {*/
      this.getData(successFunc, errorFunc, completeFunc);
      //}
    },
    getData : function(successFunc, errorFunc, completeFunc) {
      this.xmlHttpRequest = $.ajax($.extend({}, this.conf, {
        error : errorFunc,
        success : successFunc,
        complete : completeFunc
      }));
    },
    abort : function() {
      var flag = false;
      try {
        if (this.xmlHttpRequest) {
          this.xmlHttpRequest.abort();
          this.xmlHttpRequest = null;
        } else {
          flag = true;
        }
      } catch(e) {
        flag = true;
      }
      if (flag) {
        for (var key in this._abortFlagArr) {
          try {
            delete this._abortFlagArr[key];
          } catch(e) {
            this._abortFlagArr[key] = undefined;
          }
        }
      }
    },
    setSuccessFilter: function(filter) {
      this.successFilter = filter;
    },
    getSuccessFilter: function() {
      return this.successFilter;
    }
  });
  
  var LocalDataSource = ruyi.object.createClass(DataSource, {
    getData : function(successFunc, errorFunc, completeFunc) {
      throw new Error('Please override abstract method "getData".');
    }
  });

  /**
   * @description 插件中用的数据源，需要访问background page
   * @constructor 构造器
   * @augments ruyi.data.DataSource
   */
  var ExtDS = ruyi.object.createClass(DataSource, {
    getData : function(successFunc, errorFunc, completeFunc) {
      S.browser.extension.sendRequest(this.conf.data, function() {
        if ($.isFunction(successFunc)) {
          successFunc.apply(this, arguments);
        }
        if ($.isFunction(completeFunc)) {
          completeFunc.apply(this, arguments);
        }
      });
    }
  });

  var Filter = ruyi.object.createClass({
    init : function(arg0) {
      $.extend(this, arg0);
    },
    doFilter : function(callback /*, args... */) {
      
    }
  });

  $.extend(pkg, {
    DataSource : DataSource,
    ExtDS : ExtDS,
    Filter : Filter
  });
})(ruyi.object.createPackage("ruyi.data"), exports);
/**
 * @fileOverview window窗口
 * @import jQuery.js
 * @import ruyi.object.js
 * @import ruyi.aop.js
 * @import ruyi.event.js
 * @author pengkun
 * @version 1.0
 */

(function(pkg) {
  // Window begin ****************************
  pkg.conf = {
    //窗口默认的样式名称
    WINDOW_DEFAULT_CLASSNAME : "ruyi_window"
  };

  /**
   * @description 窗口对象基类
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {Element|jQuery|selector} [arg0.dom=default] dom对象或jQuery支持的选择器字符串,默认在body下动态创建div
   * @param {String} [arg0.className=null] 附加到dom的样式表
   * @param {Map} [arg0.css=null] 附加到dom的css属性
   * @param {ruyi.window.Group|Array} [arg0.group=null] 窗口组对象或对象数组
   * @event showHandle
   * @event hideHandle
   */
  var Window = ruyi.object.createClass(null, {
    group : null,
    dom : null,
    /** @constructs */
    init : function(arg0) {
      var _this = this;
      this.dom = typeof arg0.dom == "undefined" ? this.getNewDom() : $(arg0.dom);
      this.dom.addClass(pkg.conf.WINDOW_DEFAULT_CLASSNAME);
      if ( typeof arg0.className == "string") {
        this.dom.addClass(arg0.className);
      }
      if ( typeof arg0.css == "object") {
        this.dom.css(arg0.css);
      }

      //取消事件传递
      //this.dom.click(function(){ruyi.event.cancelEvent();});
      //this.dom.get(0).onclick = function(){ruyi.event.cancelEvent();};

      //如果有窗口组，添加到组中
      this.group = arg0.group || this.group;
      if (this.group) {
        if (this.group instanceof Array) {
          $.each(this.group, function() {
            this.add(_this);
          });
        } else {
          this.group.add(this);
        }
      }
    },
    getNewDom : function() {
      return $("<div/>").hide().appendTo($(document.body));
    },
    isHide : function() {
      return this.dom.is(":hidden");
    },
    show : function() {
      this.dom.show();
      this.trigger("showHandle");
    },
    hide : function() {
      this.dom.hide();
      this.trigger("hideHandle");
    },
    toggle : function() {
      if (this.isHide()) {
        this.show();
      } else {
        this.hide();
      }
    },
    css : function(css) {
      this.dom.css(css);
    },
    addChild : function(jq) {
      var dom = this.dom;
      dom.append.apply(dom, arguments);
    },
    removeChild : function() {
      this.dom.empty();
    },
    destroy : function() {
      var _this = this;
      if (this.group) {
        if (this.group instanceof Array) {
          $.each(this.group, function() {
            this.del(_this);
          });
        } else {
          this.group.del(this);
        }
      }
      this.hide();
      this.dom.remove();
      delete this.dom;
    },
    toString : function() {
      return "ruyi.window.Window";
    }
  });

  /**
   * @description 依赖窗口对象
   * @constructor 构造器
   * @augments ruyi.window.Window
   * @param {Map} [arg0={}] 实例化参数
   * @param {Element|jQuery|selector} [arg0.dependDom=document.body] 窗口依赖的对象
   * @param {String} [arg0.align="right"] 水平对齐方式(可选值:right,center,left)
   * @param {String} [arg0.valign="bottom"] 垂直对齐方式(可选值:top,middle,bottom)
   * @param {Map} [arg0.offset={top:0, left:0}]  偏移设置
   * @param {Number} [arg0.offset.top=0] 偏移上边距
   * @param {Number} [arg0.offset.left=0] 偏移左边距
   * @param {Boolean} [arg0.inViewX=false] 横向调整时候是否自动显示在可视范围内
   * @param {Boolean} [arg0.inViewY=false] 纵向调整时候是否自动显示在可视范围内
   */
  var DependWindow = ruyi.object.createClass(Window, {
    dependDom : null,
    align : "right",
    valign : "bottom",
    offset : {
      top : 0,
      left : 0
    },
    inViewX : false,
    inViewY : false,
    /** @constructs */
    init : function(arg0) {
      DependWindow._super.init.apply(this, arguments);
      $.extend(this, arg0, {
        dependDom : typeof arg0.dependDom == "undefined" ? $(document.body) : $(arg0.dependDom),
        //align : arg0.align || this.align,
        //valign : arg0.valign || this.valign,
        offset : $.extend({}, this.offset, arg0.offset)
      });
    },
    show : function() {
      DependWindow._super.show.call(this);
      this.adjust();
    },
    /*toggle : function () {
     DependWindow._super.toggle.call(this);
     this.adjust();
     },*/
    setDependDom : function(dependDom) {
      if (dependDom) {
        this.dependDom = $(dependDom);
      }
    },
    /**
     * @description 调整位置
     * @function
     */
    adjust : function() {
      var align = this.align, valign = this.valign, position = this.getAdjustPosition(align, valign), jwindow = $(window);
      /*if (position.top < jwindow.scrollTop()) {
       position = this.getAdjustPosition(align, valign = this.getRelativeValign());
       } else if (position.top + this.dom.outerHeight() > jwindow.scrollTop() + jwindow.outerHeight()) {
       position = this.getAdjustPosition(align, valign = this.getRelativeValign());
       }*/
      if (this.inViewY) {
        var isChange = false, offset = null;
        if (position.top < jwindow.scrollTop()) {
          valign = this.getRelativeValign(valign, "top");
          isChange = true;
        } else if (position.top + this.dom.outerHeight() > jwindow.scrollTop() + jwindow.outerHeight()) {
          valign = this.getRelativeValign(valign, "bottom");
          isChange = true;
        }
        if (isChange) {
          offset = $.extend({}, this.offset, {
            top : -this.offset.top
          });
          this.trigger("adjustChangeY", [valign]);
        }
        position = this.getAdjustPosition(align, valign, offset);
      }

      if (this.inViewX) {
        if (position.left + this.dom.outerWidth() > jwindow.scrollLeft() + jwindow.width()) {
          align = this.getRelativeAlign(align, "right");
          position = this.getAdjustPosition(align, valign);
        } else if (position.left < jwindow.scrollLeft()) {
          align = this.getRelativeAlign(align, "left");
          position = this.getAdjustPosition(align, valign);
        }
      }

      this.dom.css({
        top : position.top,
        left : position.left
      });
    },
    getAdjustPosition : function(align, valign, offset) {
      offset = offset || this.offset;
      var dependDomOffset = this.dependDom.offset(), top = 0, left = 0;
      if (align == "right") {
        left = dependDomOffset.left;
      } else if (align == "left") {
        left = dependDomOffset.left + this.dependDom.outerWidth() - this.dom.outerWidth();
      } else if (align == "center") {
        left = dependDomOffset.left - Math.abs(this.dependDom.outerWidth() - this.dom.outerWidth()) / 2;
      } else if (align == "out_right") {
        left = dependDomOffset.left + this.dependDom.outerWidth();
      } else if (align == "out_left") {
        left = dependDomOffset.left - this.dom.outerWidth();
      }
      if (valign == "top") {
        top = dependDomOffset.top;
      } else if (valign == "bottom") {
        top = dependDomOffset.top + this.dependDom.outerHeight();
      } else if (valign == "middle") {
        top = dependDomOffset.top + (this.dependDom.outerHeight() - this.dom.outerHeight()) / 2;
      } else if (valign == "out_top") {
        top = dependDomOffset.top - this.dom.outerHeight();
      } else if (valign == "in_top") {
        top = dependDomOffset.top + this.dependDom.outerHeight() - this.dom.outerHeight();
        ;
      }
      return {
        top : top + offset.top,
        left : left + offset.left
      };
    },
    getRelativeValign : function(valign, way) {
      //valign = valign || this.valign;
      if (way == "top") {//上边超出可视范围
        return "bottom";
      } else {//下边超出可视范围
        return "out_top";
      }
    },
    getRelativeAlign : function(align, way) {
      align = align || this.align;
      if (way == "left") {
        //左边超出可视范围
        switch(align) {
          case "right":
          case "center":
          case "left":
            return "right";
          case "out_right":
          case "out_left":
            return "out_right";
          default:
            return align;
        }
      } else {
        //右边超出可视范围
        switch(align) {
          case "right":
          case "center":
          case "left":
            return "left";
          case "out_right":
          case "out_left":
            return "out_left";
          default:
            return align;
        }
      }
    },
    toString : function() {
      return "ruyi.window.DependWindow";
    }
  });
  // Window end ****************************

  // Group begin ****************************
  /**
   * @description 窗口组对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {String} [arg0.name=null] 组的名字
   * @param {ruyi.window.Window[]} [arg0.member=[]] 组内成员数组
   */
  var Group = ruyi.object.createClass(null, {
    name : null,
    member : null,
    /** @constructs */
    init : function(arg0) {
      arg0 = arg0 || {};
      this.member = [];
      var _member = arg0.member || [];
      for (var i = 0; i < _member.length; i++) {
        this.add(_member[i]);
      }
      this.name = arg0.name;
    },
    /**
     * @description 将窗口对象增加到组中
     * @function
     * @param {ruyi.window.Window} [win] 要增加的窗口
     * @return {Boolean} 是否添加（如果已经存在返回false）
     */
    add : function(win) {
      if (win) {
        var exist = false;
        for (var i = 0; i < this.member.length; i++) {
          exist = win == this.member[i];
          if (exist) {
            break;
          }
        }
        if (!exist) {
          this.member.push(win);
          return true;
        }
      }
      return false;
    },
    /**
     * @description 将窗口对象从组中删除
     * @function
     * @param {ruyi.window.Window} [win] 要删除的窗口
     */
    del : function(win) {
      this.member = $.grep(this.member, function(obj) {
        return win == obj;
      }, true);
    },
    toString : function() {
      return "ruyi.window.Group";
    }
  });

  /**
   * @description 单一打开窗口组对象
   * @constructor 构造器
   * @augments Group
   */
  var SingleOpenGroup = ruyi.object.createClass(Group, {
    /**
     * @description 将窗口对象增加到组中,对窗口的show和toggle方法增加拦截器实现该功能
     * @function
     * @param {ruyi.window.Window} [win] 要增加的窗口
     * @return {Boolean} 是否添加（如果已经存在返回false）
     */
    add : function(win) {
      var _this = this;
      var isAdd = false;
      if (win) {
        isAdd = SingleOpenGroup._super.add.call(this, win);
        if (isAdd) {
          ruyi.aop.addBefore(win, "show", function() {
            $.each(_this.member, function() {
              this.hide();
            });
          });
          ruyi.aop.addBefore(win, "toggle", function() {
            $.each(_this.member, function() {
              if (win != this) {
                this.hide();
              }
            });
          });
        }
      }
      return isAdd;
    }
  });

  /**
   * @description 空白处单击关闭窗口组对象
   * @constructor 构造器
   * @augments Group
   */
  var ClickCloseGroup = ruyi.object.createClass(Group, {
    /** @constructs */
    init : function() {
      var _this = this;
      ClickCloseGroup._super.init.apply(this, arguments);
      $(document).click(function(event) {
        //对火狐特殊处理，不是点击鼠标左键，返回。
        if ($.browser.mozilla && event.button != 0) {
          return;
        }
        _this.documentClickFunc(event);
      });
    },
    documentClickFunc : function(evt) {
      $.each(this.member, function() {
        this.hide();
      });
    }
  });

  /**
   * @description 自动调整窗口组对象
   * @constructor 构造器
   * @augments Group
   */
  var AdjustGroup = ruyi.object.createClass(Group, {
    adjust : function() {
      $.each(this.member, function() {
        if (this.adjust && !this.isHide()) {
          this.adjust();
        }
      });
    }
  });

  /**
   * @description 改变大小自动调整窗口组对象
   * @constructor 构造器
   * @augments AdjustGroup
   */
  var AutoAdjustGroup = ruyi.object.createClass(AdjustGroup, {
    /** @constructs */
    init : function() {
      var _this = this;
      AutoAdjustGroup._super.init.apply(this, arguments);
      $(window).resize(function() {
        _this.adjust();
      });
    }
  });

  /**
   * @description 滚动自动调整窗口组对象
   * @constructor 构造器
   * @augments AdjustGroup
   */
  var ScrollAdjustGroup = ruyi.object.createClass(AdjustGroup, {
    /** @constructs */
    init : function() {
      var _this = this;
      ScrollAdjustGroup._super.init.apply(this, arguments);
      $(window).scroll(function() {
        _this.adjust();
      });
    }
  });
  // Group end ****************************

  //将需要公开的类公开
  $.extend(pkg, {
    Window : Window,
    DependWindow : DependWindow,

    Group : Group,
    AdjustGroup : AdjustGroup,
    SingleOpenGroup : SingleOpenGroup,
    ClickCloseGroup : ClickCloseGroup,
    AutoAdjustGroup : AutoAdjustGroup,
    ScrollAdjustGroup : ScrollAdjustGroup
  });
})(ruyi.object.createPackage("ruyi.window")); /**
 * @fileOverview 提示功能
 * @import jQuery.js
 * @import ruyi.object.js
 * @import ruyi.window.js
 * @author pengkun 
 * @revision 1.0
 */
(function(pkg) {
	var argumentsToArr = function(arg0) {
		return Array.prototype.slice.call(arg0 || argumentsToArr.caller.arguments);
	};
	
	var SELECT_TYPE = {
		KEYBOARD : "KEYBOARD",
		MOUSEENTER : "MOUSEENTER",
		CLICK : "CLICK"
	};
	/** 
	 * @description 选择框对象
	 * @constructor 构造器
	 * @param {Map} [arg0={}] 实例化参数
	 * @param {Element|jQuery|selector} [dom=null] dom
	 * @param {String} [name=null] 名称
	 * @param {Element|jQuery|selector} [keyboardUpDownDom=null] 注册键盘上下键的dom
	 */
	var Select = ruyi.object.createClass({
		dom : null,
		keyboardUpDownDom : null,
		name : null,
		options : null,
		cursor : -1,
		_disabled : false,
		init : function(arg0) {
			$.extend(this, arg0, {
				options : [],
				dom : $(arg0.dom ? arg0.dom : this.getDefaultDom()),
				keyboardUpDownDom : $(arg0.keyboardUpDownDom ? arg0.keyboardUpDownDom : $("<span/>"))
			});
			this.initUpDown();
		},
		disable : function() {
		  this._disabled = true;
		},
		enable : function() {
      this._disabled = false;
    },
		initUpDown : function() {
			var _this = this;
			this.keyboardUpDownDom.keyup(function(evt) {
			  if(_this._disabled) return;
				if(evt.keyCode == 38) {
					_this.up(SELECT_TYPE.KEYBOARD);
				} else if(evt.keyCode == 40) {
					_this.down(SELECT_TYPE.KEYBOARD);
				}
			});
		},
		getDefaultDom : function() {
			return $("<div/>").appendTo(document.body);
		},
		addOption : function(option) {
			var _this = this;
			
			var l = this.options.push(option) - 1;
			
			option.dom.bind("mouseenter", function() {
				_this.moveTo(l, SELECT_TYPE.MOUSEENTER);
			});
			
			option.dom.bind("click", function() {
				_this.moveTo(l, SELECT_TYPE.CLICK);
			});
			
			this.dom.append(option.dom);
		},
		addLine : function() {
			this.dom.append($("<hr/>"));
		},
		clear : function() {
			for(var i=0; i<this.options.length; i++) {
				this.options[i].destroy();
				this.options[i] = undefined;
				delete this.options[i];
			}
			delete this.options;
			this.options = [];
			this.cursor = -1;
			
			this.dom.empty();
		},
		moveTo : function(index, selectType) {
			if(this.options[index]) {
				if(typeof this.cursor == "number" && this.options[this.cursor]) {
					this.options[this.cursor].unselect(selectType);
				}
				this.cursor = index;
				this.options[this.cursor].select(selectType);
				
				return true;
			}
			return false;
		},
		up : function(selectType) {
			var index = this.options.length - 1;
			if(typeof this.cursor == "number") {
				index = this.cursor - 1;
				if(index < 0) {
					index = this.options.length - 1;
				}
			}
			
			var argumentsArr = argumentsToArr();
			argumentsArr.unshift(index);
			return this.moveTo.apply(this, argumentsArr);
		},
		down : function(selectType) {
			var index = this.cursor + 1;
			if(index > this.options.length - 1) {
				index = 0;
			}
			
			var argumentsArr = argumentsToArr();
			argumentsArr.unshift(index);
			return this.moveTo.apply(this, argumentsArr);
		},
		getPrev : function() {
			if(this.cursor == -1) return null;
			return this.getOption(this.cursor-1);
		},
		getNext : function() {
			if(this.cursor == -1) return null;
			return this.getOption(this.cursor+1);
		},
		getFirst : function() {
			return this.getOption(0);
		},
		getLast : function() {
			return this.getOption(this.cursor.length-1);
		},
		getOption : function(index) {
			if(index<0 || index>=this.options.length) {
				return null;
			}
			return this.options[index];
		},
		getCurrOption : function() {
			return this.getOption(this.cursor);
		}
	});
	
	/** 
	 * @description window选择框对象
	 * @constructor 构造器
	 * @augments ruyi.select.Select
	 * @param {Map} [arg0={}] 实例化参数
	 * @param {ruyi.window.Window} [window=null] 窗口对象
	 */
	var WindowSelect = ruyi.object.createClass(Select, {
		window : null,
		init : function(arg0) {
			arg0.dom = arg0.window.dom;
			WindowSelect._super.init.apply(this, arguments);
		}
	});
	
	/** 
	 * @description 选择框选项对象
	 * @constructor 构造器
	 * @param {Map} [arg0={}] 实例化参数
	 * @param {Element|jQuery|selector} [dom=null] dom
	 * @param {String} [name=null] 名称
	 * @param {String} [value=null] 值
	 * @param {String} [highlightClass=null] 选中后高亮显示的样式表名称
	 * @param {String} [highlightClass=null] 非选中时的样式表名称
	 * @event selectHandle 选择后触发的事件
	 * @param {Object} [id] 文件的ID
	 * @event unselectHandle 取消选中后触发的事件
	 * @param {Object} [id] 文件的ID
	 */
	var Option = ruyi.object.createClass({
		dom : null,
		name : null,
		value : null,
		highlightClass : null,
		unhighlightClass : null,
		selected : false,
		init : function(arg0) {
			var _this = this;
			$.extend(this, arg0);
			this.dom = $(this.dom ? this.dom : this.getDefaultDom());
		},
		getDefaultDom : function() {
			return $("<div/>");
		},
		select2 : function() {
			this.selected = true;
			this.highlight();
		},
		select : function(selectType) {
			this.select2();
			this.trigger("selectHandle", [selectType]);
		},
		unselect : function(triggerFlag) {
			this.selected = false;
			this.unhighlight();
			
			if(typeof triggerFlag == "undefined" || triggerFlag) {
				this.trigger("unselectHandle");
			}
		},
		highlight : function() {
			this.dom.removeClass(this.unhighlightClass).addClass(this.highlightClass);
		},
		unhighlight : function() {
			this.dom.removeClass(this.highlightClass).addClass(this.unhighlightClass);
		},
		destroy : function() {
			this.dom.remove();
			
			this.dom = undefined;
			delete this.dom;
		}
	});
	
	$.extend(pkg, {
		Select : Select,
		WindowSelect : WindowSelect,
		
		Option : Option,
		
		SELECT_TYPE : SELECT_TYPE
	});
})(ruyi.object.createPackage("ruyi.select"));/**
 * @fileOverview 提示功能
 * @import jQuery.js
 * @import ruyi.object.js
 * @import ruyi.data.js
 * @import ruyi.window.js
 * @import ruyi.select.js
 * @author pengkun
 * @version 1.0
 */
(function(pkg) {
  /**
   * @description suggest选择框对象
   * @constructor 构造器
   * @augments ruyi.select.Select
   * @param {Map} [arg0={}] 实例化参数
   * @param {ruyi.window.Window} [arg0.window=null] 窗口对象
   */
  var SuggestSelect = ruyi.object.createClass(ruyi.select.Select, {
    init : function() {
      var _this = this;
      SuggestSelect._super.init.apply(this, arguments);
      this.window.bind('showHandle', function() {
        _this.enable();
      });
      this.window.bind('hideHandle', function() {
        _this.disable();
      });
    },
    show : function() {
      this.window.show();
    },
    hide : function() {
      this.window.hide();
    }
  });

  /**
   * @description 默认suggest选择框对象
   * @constructor 构造器
   * @augments ruyi.select.Select
   */
  var DefaultSuggestSelect = ruyi.object.createClass(ruyi.select.Select, {
    init : function() {
      DefaultSuggestSelect._super.init.apply(this, arguments);
    },
    addOption : function(option) {
      var _this = this;
      option.bind("selectHandle", function(evt, selectType) {
        if (selectType == ruyi.select.SELECT_TYPE.KEYBOARD) {
          _this.keyboardUpDownDom.val(this.getTextValue());
        } else if (selectType == ruyi.select.SELECT_TYPE.CLICK) {
          _this.keyboardUpDownDom.val(this.getTextValue());

          _this.hide();
        }
      });

      DefaultSuggestSelect._super.addOption.apply(this, arguments);
    },
    show : function() {
      this.dom.show();
    },
    hide : function() {
      this.dom.hide();
    }
  });

  /**
   * @description suggest选择框选项对象
   * @constructor 构造器
   * @augments ruyi.select.Option
   */
  var SuggestOption = ruyi.object.createClass(ruyi.select.Option, {
    init : function() {
      SuggestOption._super.init.apply(this, arguments);

    },
    getTextValue : function() {
      return this.value;
    }
  });

  /**
   * @description suggest对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {ruyi.data.DataSource} [arg0.dataSource=null] 数据源对象
   * @param {Number} [arg0.time=200] 文本框输入后取数据的时间间隔
   * @param {Element|jQuery|selector} [arg0.textDom=null] 输入文本框DOM
   * @param {ruyi.suggest.SuggestSelect} [arg0.select=null] 选择框对象
   * @param {String} [message=null] 提示信息
   */
  var Suggest = ruyi.object.createClass(null, {
    dataSource : null,
    _loadTimer : null,
    time : 200,
    textDom : null,
    _oldValue : null,
    select : null,
    message : null,
    init : function(arg0) {
      var _this = this;
      $.extend(this, arg0, {
        textDom : $(arg0.textDom)
      });

      this.dataSource.conf.success = function() {
        _this.reload.apply(_this, arguments);
      };

      this.textDom
      .focus(function(evt) {
        if(this.value == _this.message) {
          this.value = '';
          _this.trigger("hideMessageHandle");
        }
      })
      .blur(function(evt) {
        if(jQuery.trim(this.value) == '') {
          this.value = _this.message;
          _this.trigger("showMessageHandle");
        }
      })
      .keyup(function(evt) {
        if (evt.keyCode == 13) {
          _this.trigger("textEnterHandle", _this.textDom.val());
          return;
        }
        
        if (evt.keyCode == 38 || evt.keyCode == 40) {
          return;
        }
        
        _this.__triggerByValue();
        
        if (_this.textDom.val().length <= 0) {
          _this._oldValue = _this.textDom.val();
          return;
        }
        
        if (_this._oldValue == _this.textDom.val()) {
          return;
        }
        
        _this.stop();
        _this._loadTimer = setTimeout(function() {
          _this._oldValue = _this.textDom.val();
          _this.dataSource.conf.url = _this.getUrl(_this.textDom.val());
          _this.dataSource.conf.data = _this.getData(_this.textDom.val());
          _this.dataSource.reload();
        }, _this.time || 0);
      });
    },
    __triggerByValue : function() {
      if (this.textDom.val().length <= 0) {
        this.trigger("textEmptyHandle");
      } else {
        this.trigger("textFullHandle", this.textDom.val());
      }
    },
    clearTimer: function() {
      if(this._loadTimer) {
        clearTimeout(this._loadTimer);
        this._loadTimer = null;
      }
    },
    getUrl : function(str) {
      return this.dataSource.conf.url;
    },
    getData : function(str) {
      return null;
    },
    reload : function() {
      this.select.clear();
      var arr = this.getOptions.apply(this, arguments);
      for (var i = 0; i < arr.length; i++) {
        this.select.addOption(arr[i]);
      }

      if (this.select.options.length > 0) {
        this.select.show();
      } else {
        this.select.hide();
      }
    },
    getOptions : function() {
      return [];
    },
    clearInput : function() {
      this.textDom.val(this._oldValue = "");
    },
    setValue: function(val, focus) {
      if(focus != false) {
        this.textDom.focus();
      }
      this.textDom.val(this._oldValue = val);
      this.__triggerByValue();
    },
    setMessage: function(msg) {
      this.message = msg;
    },
    getMessage: function(msg) {
      return this.message;
    },
    stop: function() {
      this.clearTimer();
      this.dataSource.abort();
    }
  });

  $.extend(pkg, {
    SuggestSelect : SuggestSelect,
    SuggestOption : SuggestOption,
    DefaultSuggestSelect : DefaultSuggestSelect,
    Suggest : Suggest
  });
})(ruyi.object.createPackage("ruyi.suggest")); /**
 * @fileOverview 分页
 * @import jQuery.js
 * @import ruyi.object.js
 * @author pengkun
 * @revision 1.0
 */
(function(pkg) {
  /**
   * @description 分页类
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {Number} [arg0.count=0] 总记录数
   * @param {Number} [arg0.ps=10] 每页记录数
   * @param {Number} [arg0.pn=1] 当前页
   * @param {Number} [arg0.vn=7] 显示页码的数量
   */
  var Page = ruyi.object.createClass(null, {
    init : function(arg0) {
      //count 总记录数
      this._count = arg0.count || 0;
      //pageSize 每页记录数
      this._ps = arg0.ps || 10;
      //pageCount 总页数
      this._pc = 0;
      //pageNum 当前页
      this._pn = arg0.pn || 1;
      //viewNum 显示页码的数量
      this._vn = arg0.vn || 7;

      this.adjust();
    },
    getStart : function() {
      return (this.getPN() - 1) * this.getPS();
    },
    getBeginPage : function() {
      var i = Math.max(this.getPN() - Math.floor(this._vn / 2), 1);
      /*if(i + this._vn > this.getPC()) {
       i = this.getPC() - this._vn;
       }*/
      return i;
    },
    getEndPage : function() {
      return Math.min(this.getBeginPage() + Math.max(0, this._vn - 1), this._pc);
    },
    getNextPage : function() {
      return this._pn + 1 > this.getPC() ? null : this._pn + 1;
    },
    getPrevPage : function() {
      return this._pn - 1 < 1 ? null : this._pn - 1;
    },
    getPC : function() {
      return this._pc;
    },
    setPN : function(pn) {
      this._pn = pn;
    },
    getPN : function() {
      return this._pn;
    },
    setPS : function(ps) {
      this._ps = ps;
      return adjust();
    },
    getPS : function() {
      return this._ps;
    },
    setVN : function(vn) {
      this._vn = vn;
    },
    getVN : function() {
      return this._vn;
    },
    getCount : function() {
      return this._count;
    },
    setCount : function(count) {
      this._count = count;
      this.adjust();
      return this;
    },
    adjust : function() {
      this._pc = Math.ceil(this._count / this._ps);
      return this;
    }
  });

  //将需要公开的类公开
  $.extend(pkg, {
    Page : Page
  });
})(ruyi.object.createPackage("ruyi.page")); /**
 * @fileOverview 列表
 * @import jQuery.js
 * @import ruyi.object.js
 * @import ruyi.page.js
 * @author pengkun 
 * @revision 1.0
 */
(function(pkg) {
	/** 
	 * @description 列表
	 * @constructor 构造器
	 * @param {Map} [arg0={}] 实例化参数
	 * @param {String|Element|jQuery} [arg0.dom] dom
	 * @param {ruyi.page.Page} [arg0.page=new ruyi.page.Page({})] 分页信息对象
	 */
	var List = ruyi.object.createClass(null, {
		dom : null,
		page : null,
		init : function(arg0) {
			$.extend(this, arg0, {
				dom : $(arg0.dom),
				page : arg0.page || this.page || new ruyi.page.Page({})
			});
		},
		pageTo : function(pn) {
			this.show.apply(this, arguments);
		},
		nextPage : function() {
			var np = this.page.getNextPage();
			if(this.page.getPN() < np) {
				this.pageTo(np);
			}
		},
		refresh : function() {
			this.pageTo(this.page.getPN());
		},
		show : function(pn) {
			
		},
		showListByArr : function(arr) {
			this.empty();
			this.addItems(arr);
		},
		empty : function() {
			this.dom.empty();
		},
		addItem : function(obj, n) {
			var dom = this.getItemDom(obj, n);
			if(dom instanceof Array) {
				this.dom.append.apply(this.dom, dom);
			} else {
				this.dom.append(dom);
			}
		},
		addItems : function(arr, n) {
			var domArr = this.getItemDomArr(arr, n);
			if($.isArray(domArr)) {
				var dom = this.dom;
				dom.append.apply(dom, domArr);
				domArr = null;
			}
		},
		getItemDom : function(obj, n) {
			
		},
		getItemDomArr : function(arr, n) {
			var len = arr.length;
			if(len > 0) {
				n = n||0;
				var domArr = [];
				for(var i=0; i<len; i++) {
					var dom = this.getItemDom(arr[i], n+i);
					if(dom instanceof Array) {
						domArr.push.apply(domArr, dom);
					} else {
						domArr.push(dom);
					}
				}
				return domArr;
			}
			return null;
		},
		destroy : function() {
			this.dom.remove();
			this.dom = null;
		}
	});
	
	//将需要公开的类公开
	$.extend(pkg, {
		List : List
	});
})(ruyi.object.createPackage("ruyi.list"));/**
 * @fileOverview tab
 * @import jQuery.js
 * @import ruyi.object.js
 * @author pengkun
 * @revision 1.0
 */
(function(pkg) {

  /**
   * @description Tab对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {String} [arg0.name] {String} 名字
   * @param {Array} [arg0.items=[]]  TabItem对象的数组
   * @param {String|Number} [arg0.defaultShow=null] 默认显示的TabItem的名字或序号
   * @event showHandle
   * @event changeHandle
   */
  var Tab = ruyi.object.createClass(null, {
    name : null,
    showItem : null,
    showItemNum : -1,
    items : null,
    /** @constructs */
    init : function(arg0) {
      arg0 = arg0 || {};
      var _this = this;

      $.extend(this, {
        name : arg0.name,
        items : []
      });

      $.each(arg0.items || [], function(i, item) {
        _this.addItem(item);
      });

      if (arg0.defaultShow) {
        this.show(arg0.defaultShow);
      }
    },
    /**
     * @description 添加TabItem
     * @funciton
     * @param {ruyi.tab.TabItem} arg0 详见TabItem
     */
    addItem : function(arg0) {
      this.items.push(arg0);
    },

    /**
     * @description 显示指定名称或索引的 TabItem 实例
     * @param  {String|Number} itemName tab item 名称或索引
     */
    show : function(itemName) {
      var fromItem,
          fromItemNum,
          showItem = null, 
          showItemNum = -1;
      if ( typeof itemName == "string") {
        $.each(this.items, function(i, item) {
          // 显示所有 name 为 itemName 的 tab item
          if (itemName == item.name) {
            item.show();
            showItem = item;
            showItemNum = i;
          } else {
            item.hide();
          }
        });
      } else if ( typeof itemName == "number") {
        $.each(this.items, function(i, item) {
          if (itemName == i) {
            item.show();
            showItem = item;
            showItemNum = i;
          } else {
            item.hide();
          }
        });
      }

      // 更新 fromItem 和 showItem
      if (showItem) {
        fromItem = this.showItem;
        fromItemNum = this.showItemNum;
        this.showItem = showItem;
        this.showItemNum = showItemNum;
        if(fromItem !== showItem) {
          // 若 tabItem 有改变则触发 changeHandle 事件
          this.trigger("changeHandle", [fromItem, fromItemNum, showItem, showItemNum]);
        }

        // showItem 有值的情况下则肯定显示了，触发 showHandle 事件
        this.trigger("showHandle", [fromItem, fromItemNum, showItem, showItemNum]);
      }
    },
    getItem : function(itemName) {
      if ( typeof itemName == "string") {
        for (var i = 0; i < this.items.length; i++) {
          var item = this.items[i];
          if (itemName == item.name) {
            return item;
          }
        }
      } else if ( typeof itemName == "number") {
        if (this.items.length > itemName) {
          return this.items[itemName];
        }
      }

      return null;
    }
  });

  /**
   * @description TabItem对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {String} [arg0.name] 名字
   * @param {Element|jQuery|selector} [arg0.dom] dom对象或jQuery支持的选择器字符串
   * @event showHandle
   * @event hideHandle
   */
  var TabItem = ruyi.object.createClass(null, {
    name : null,
    dom : null,
    /** @constructs */
    init : function(arg0) {
      $.extend(this, arg0, {
        name : arg0.name,
        dom : $(arg0.dom)
      });
    },
    show : function() {
      this.dom.show();
      this.trigger("showHandle");
    },
    hide : function() {
      this.dom.hide();
      this.trigger("hideHandle");
    }
  });

  //将需要公开的类公开
  $.extend(pkg, {
    Tab : Tab,
    TabItem : TabItem
  });
})(ruyi.object.createPackage("ruyi.tab")); /**
 * @fileOverview job
 * @import jQuery.js
 * @import ruyi.object.js
 * @author pengkun 
 * @revision 1.0
 */
(function(pkg) {
  /**
   * @description Job对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {String} [arg0.name=''] 名称
   * @event executeHandle
   * @param {Function} [callback] 回调函数
   */
  var Job = ruyi.object.createClass({
    _name: '',
    _exeTime: null,
    _exeCount: 0,
    init: function(arg0) {
      $.extend(this, arg0, {
        _name: arg0.name
      });
    },
    getName: function() {
      return this._name;
    },
    getExeTime: function() {
      return this._exeTime;
    },
    getExeCount: function() {
      return this._exeCount;
    },
    execute: function() {
      this._exeTime = new Date();
      this._exeCount++;
      this.trigger('executeHandle', Array.prototype.slice.apply(arguments));
    }
  });
  
	/**
   * @description Job管理对象
   * @constructor 构造器
   * @augments ruyi.job.Job
   * @param {Map} [arg0={}] 实例化参数
   */
  var JobManager = ruyi.object.createClass(Job, {
    _members: null,
    _name: '',
    init: function(arg0) {
      this.callSuper.apply(this, arguments);
      this._members = {};
    },
    execute: function(name, data, callback) {
      var job = this.get(name);
      if(job) {
        job.execute(data, callback);
      }
      this.callSuper.apply(this, arguments);
    },
    add: function(job) {
      this._members[job.getName()] = job;
    },
    get: function(name) {
      return name ? (this._members[name] || null) : this.getMembers();
    },
    getMembers: function() {
      var arrr = [];
      for(var name in this._members) {
        this._members.hasOwnProperty(name) && arr.push(this._members[name]);
      }
      return arr;
    }
  });
  
	//将需要公开的类公开
	$.extend(pkg, {
		JobManager : JobManager,
		Job : Job
	});
})(ruyi.object.createPackage("ruyi.job"));/**
 * @fileOverview module
 * @import jQuery.js
 * @import ruyi.object.js
 * @author pengkun
 * @revision 1.0
 */
(function(pkg) {
  /**
   * @description Modules对象
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {String} [arg0.name] {String} 名字
   */
  var Modules = new ruyi.object.createClass({
    _members: null,
    /** @constructs */
    init: function(arg0) {
      $.extend(this, arg0, {
        _members: []
      });
    },
    broadcast: function(moduleName, msg, data) {
      if(this.has(moduleName)) {
        for(var k in this._members) {
          var module2 = this._members[k];
          if(module2.name != moduleName && this._members.hasOwnProperty(k)) {
            module2.__trigger.apply(module2, arguments);
          }
        }
      }
    },
    add: function(module) {
      if(module != this) {
        this._members[module.name] = module;
        module.setManager(this);
      }
    },
    get: function(name) {
      return this._members[name];
    },
    has: function(name) {
      return !!this.get(name);
    }
  });
  
  var modules = new Modules({
    name: 'global'
  });
  
  /**
   * @description Module对象
   * @constructor 构造器
   * @augments Modules
   * @param {Map} [arg0={}] 实例化参数
   */
  var Module = ruyi.object.createClass(Modules, {
    _manager: null,
    name: null,
    /** @constructs */
    init: function(arg0) {
      this.callSuper.apply(this, arguments);
      modules.add(this);
    },
    broadcast: function(msg, data) {
      var args = [this.name];
      Array.prototype.push.apply(args, arguments);
      this._manager.broadcast.apply(this._manager, args);
    },
    __trigger: function(moduleName, msg, data) {
      this.trigger(moduleName + ':' + msg, Array.prototype.slice.call(arguments, 2));
    },
    setManager: function(m) {
      this._manager = m;
    }
  });
  
  //将需要公开的类公开
  $.extend(pkg, {
    modules: modules,
    Module: Module
  });
})(ruyi.object.createPackage("ruyi.module")); 
(function(pkg, S) {
  
})(ruyi.object.createPackage("ruyi.popup.util"), exports); (function(pkg, S) {
  /**
   * @description 商品搜索数据源
   * @constructor 构造器
   * @augments ruyi.data.ExtDS
   * @param {Map} [arg0={}] 实例化参数
   * @param {Object} [arg0.conf={}] 参数
   * @param {ruyi.page.Page} [arg0.page={}] 分页对象
   */
  var ItemSearchDS = ruyi.object.createClass(ruyi.data.ExtDS, {
    keyword: '',
    searchEngine: 'etao',
    _reset: function(arg0) {
      var 
      _this = this,
      generator = (function() {
        var pageNum = 1;
        var totalPages = undefined;
        var ds = new ruyi.data.ExtDS({
          conf: {}
        });
        return function(callback) {
          if (typeof totalPages == "undefined" || pageNum <= totalPages) {
            ds.conf.data = {
              topic: 'item_search',
              Keyword: _this.getKeyword(),
              SearchEngine: _this.getSearchEngine(),
              ItemPage: pageNum
            };
            ds.conf.success = function(response) {
              pageNum++;
              if ("Code" in response) {
                S.console.debug(response.Message);
                callback([]);
              } else {
                totalPages = response.TotalPages;
                if (totalPages)
                  return callback(response.Items||[]);
                else
                  return callback([]);
              }
            };
            ds.load();
          } else {
            callback([]);
          }
        };
      })(),
      productNumPerPage = this.page.getPS();
      this.pageCache = S.PageCache(generator, { PageSize: productNumPerPage }, true);
    },
    getData: function(success, error, complete) {
      this.pageCache.get(this.page.getPN(), success);
    },
    getKeyword: function() {
      return this.keyword;
    },
    setKeyword: function(kw) {
      try {
        this.keyword = decodeURIComponent(kw);
      } catch (e) {
        this.keyword = '';
      }
      this._reset();
    },
    getSearchEngine: function() {
      return this.searchEngine;
    },
    setSearchEngine: function(se) {
      this.searchEngine = se;
      this._reset();
    }
  });
  
  /** 
   * @description 商品列表基础类
   * @constructor 构造器
   * @augments ruyi.list.List
   * @param {Map} [arg0={}] 实例化参数
   * @param {ruyi.data.DataSource} [dataSource=null] 数据源对象 
   */
  var ProductListBase = ruyi.object.createClass(ruyi.list.List, {
    _data : null,
    init : function(arg0) {
      this.callSuper.apply(this, arguments);
      
      this.bindEvents();
    },
    bindEvents: function() {
      this.dom.delegate('.ruyitao-selector-prefix-product-item', 'click', $.proxy(function(evt) {
        var index = $(evt.currentTarget).attr('data-index');
        this.trigger('selectHandle', [this.getData(index)]);
        //Util.sendLog('click_product', url + '|' + rel);
      }, this));
    },
    show : function(pn) {
      var _this = this, page = this.page;
      page.setPN(pn||page.getPN()||1);
      
      this.dataSource.conf.success = function(response) {
        if(response) {
          var data = response.Entries||[];
          _this.showListByArr(data);
        }
      };
      this.dataSource.load();
    },
    showListByArr : function(arr) {
      this._data = arr;
      this.callSuper.apply(this, arguments);
    },
    getData: function(index) {
      if(isNaN(index)) return this._data;
      return this._data[index];
    },
    getItemDom : function(obj, index) {
      /*
            一淘数据
      Book: false
      DetailPageURL: "http://s.etao.com/search?uniqid=300000024296420&tb_lm_id=ryt_ext"
      Epid: "300000024296420"
      FastTrack: "最近销量803件"
      Popup: "http://ruyi.taobao.com/ext/etaoSearchProduct/epid/300000024296420/version/3.2.9.12/pid/rc001"
      Price: "￥99.00-￥99.00"
      SmallImageUrl: "http://img03.taobaocdn.com/bao/uploaded/i3/T1VRrOXghdXXbn.tEV_020215.jpg_80x80.jpg"
      Stars: "共2个商家"
      Title: "大放axe男装秋款 原创男士纯棉卫衣 圆领套头卫衣潮af"
      
            其他站点
      ASIN: "B006M9ZL6G"
      ClickUrl: "http://ruyi.taobao.com/ext/clickurl?url=http%3A%2F%2Fwww.amazon.cn%2FSAMSUNG%25E4%25B8%2589%25E6%2598%259FI509-3G%25E6%2599%25BA%25E8%2583%25BD%25E6%2589%258B%25E6%259C%25BA%2Fdp%2FB006M9ZL6G%2Fref%3Dsr_1_1%3Fie%3DUTF8%26qid%3D1351476870%26sr%3D8-1&pid=rc001"
      DetailPageURL: "http://www.amazon.cn/SAMSUNG%E4%B8%89%E6%98%9FI509-3G%E6%99%BA%E8%83%BD%E6%89%8B%E6%9C%BA/dp/B006M9ZL6G/ref=sr_1_1?ie=UTF8&qid=1351476870&sr=8-1&tag=zhushou-23"
      FastTrack: ""
      ImageUrl: "http://ec4.images-amazon.com/images/I/41TqfGjiohL._AA160_.jpg"
      LargeImageUrl: "http://ec4.images-amazon.com/images/I/41TqfGjiohL._AA300_.jpg"
      Price: " ￥499.00"
      SmallImageUrl: "http://ec4.images-amazon.com/images/I/41TqfGjiohL._AA75_.jpg"
      Stars: "<div name="B006M9ZL6G" ref="sr_cr_" class="asinReviewsSummary">↵            <a target="_blank" href="http://www.amazon.cn/SAMSUNG%E4%B8%89%E6%98%9FI509-3G%E6%99%BA%E8%83%BD%E6%89%8B%E6%9C%BA/product-reviews/B006M9ZL6G/ref=sr_1_1_cm_cr_acr_img?ie=UTF8&showViewpoints=1" target="_blank"><img height="12" width="55" align="absbottom"↵                            alt="平均4 星" src="http://g-ec4.images-amazon.com/images/G/28/x-locale/common/customer-reviews/ratings/stars-4-0._V192562255_.gif" /></a></div>"
      Title: "SAMSUNG&#19977;&#26143;I509 3G&#26234;&#33021;&#25163;&#26426; (&#38082;&#38134;&#33394;,&#22825;&#32764;&#23450;&#21046;)"
      UsedPrice: "￥1080.00" 
      */
      var 
      Title = this.encodeHTML(obj.Title) || '',
      Price = obj.Price || '',
      SmallImageUrl = obj.SmallImageUrl || '';
      
      var imageOnloadString = ''

      return [
        '<li class="ruyitao-selector-prefix-product-item" data-index="' + index + '">',
        '  <span class="ruyitao-selector-prefix-product-image-wrapper" title="' + Title + '"><img' + imageOnloadString + ' class="ruyitao-selector-prefix-product-image" src="' + SmallImageUrl + '"><b class="ruyitao-selector-prefix-line-height-setter"></b></span>',
        '  <div class="ruyitao-selector-prefix-product-title" title="' + Title + '">' + (Title||'&nbsp;') + '</div>',
        '  <div class="ruyitao-selector-prefix-product-price" title="">' + (Price||'&nbsp;') + '</div>',
        '</li>'
      ].join('');
    },
    encodeHTML: function(s) {
      return typeof s != "string" ? s :
              s.replace(/"|&|'|<|>/g, function(s) {
                return '&#' + s.charCodeAt(0) + ';';
              });
    }
  });
  
  /** 
   * @description 搜索列表和搜索历史的Tab管理对象
   */
  var historyAndResultTab = new ruyi.tab.Tab({
    name: 'historyAndResultTab'
  });
  
  // 全局注册 historyAndResultTab 的 changeHandle 事件
  historyAndResultTab.bind('changeHandle', function(evt, fromItem, fromItemNum, showItem, showItemNum) {
    showItem.dom.hide().fadeIn(200);
  });
  
  //切换searchView和比价的tab
  var globalTab = new ruyi.tab.Tab({
    name: 'globalTab'
  });
  
  //点击logo回历史页面
  $('#ruyitao-selector-prefix-toolbar-logo').click(function() {
    globalTab.show('searchView');
    historyAndResultTab.show('searchHistory');
  });
  //点击选项按钮打开options页面
  $('#ruyitao-selector-prefix-toolbar-options').click(function() {
    var optionUrl = S.SearchBox.Util.getURL('views/options.html');
    S.SearchBox.Util.openTab(optionUrl, true);
  });

  $('#ruyitao-selector-prefox-toolbar-ivy-home').click(function() {
    new ruyi.data.ExtDS({
      conf: {
        data: {
          topic: "item_like_open_homepage"
        }
      }
    }).load()
  })
  //点击关闭按钮关闭页面
  $('#ruyitao-selector-prefix-toolbar-close').click(function() {
    try {
      external.quit();
    } catch(e) {
      window.close();
    }
  });

  
  $.extend(pkg, {
    ItemSearchDS: ItemSearchDS,
    ProductListBase: ProductListBase,
    historyAndResultTab: historyAndResultTab,
    globalTab: globalTab
  });
})(ruyi.object.createPackage("ruyi.popup.global"), exports);(function(pkg, S) {
  
  /* suggest begin */
  /**
   * @description suggest对象
   * @augments ruyi.select.Select
   * @constructor 构造器
   * @param {Map} [arg0={}] 实例化参数
   * @param {ruyi.data.DataSource} [arg0.dataSource=null] 数据源对象
   * @param {Number} [arg0.time=200] 文本框输入后取数据的时间间隔
   * @param {Element|jQuery|selector} [arg0.textDom=null] 输入文本框DOM
   * @param {Element|jQuery|selector} [arg0.windowDom=null] 选择框DOM
   * @param {Element|jQuery|selector} [arg0.closeDom=null] 关闭按钮DOM
   */
  var SearchSuggest = ruyi.object.createClass(ruyi.suggest.Suggest, {
    init : function(arg0) {
      arg0.select = new ruyi.suggest.SuggestSelect({
        window : new ruyi.window.DependWindow({
          group : [new ruyi.window.ClickCloseGroup(), new ruyi.window.AutoAdjustGroup()],
          dom : $(arg0.windowDom),
          dependDom : $(arg0.textDom)
        }),
        keyboardUpDownDom : arg0.textDom,
        dom : jQuery("<ol/>").appendTo(arg0.windowDom)
      });
      arg0.dataSource = arg0.dataSource || new ruyi.data.ExtDS({
        conf : {}
      });
      
      //this.parentProto().init.apply(this, arguments);
      this.callSuper.apply(this, arguments);
      
      //清空时，暂时记录上一个和下一个也一同清空
      ruyi.aop.addAfter(this.select, "clear", function() {
        this.next = undefined;
        this.prev = undefined;
      });
      
      //关闭按钮
      this.closeDom = $(arg0.closeDom);
      
      this.bindEvents();
    },
    bindEvents: function() {
      //如果输入框为空，关闭window
      this.bind("textEmptyHandle", function() {
        this.select.window.hide();
      });
      
      this.bind('textFullHandle', function(evt, keyword) {
        this.closeDom.show();
      });
      this.bind('showMessageHandle textEmptyHandle', function(evt, keyword) {
        this.closeDom.hide();
      });
      
      this.closeDom.click($.proxy(function() {
        this.setValue('');
      }, this));
      
      this.bind('textEnterHandle textEmptyHandle', $.proxy(this.stop, this));
    },
    getOptions : function(data) {
      var arr = [],
          result = data.result;
      for (var i = 0, len = result.length; i<len; i++) {
        arr.push(this.getOption(result[i]));
      }
      return arr;
    },
    getOption : function(obj) {
      var 
      _this = this
      option = new ruyi.suggest.SuggestOption({
        value : obj,
        highlightClass : "ruyitao-selector-prefix-suggestion-selected",
        //unhighlightClass : "unhighlight",
        getDefaultDom : function() {
          return jQuery("<li/>").html(this.getTextValue()).click($.proxy(function() {
            _this.textDom.val(this.getTextValue());
          }, this));
        },
        getTextValue : function() {
          return this.value[0];
        }
      });
      option.bind("selectHandle", function(evt, selectType) {
        if (selectType == ruyi.select.SELECT_TYPE.KEYBOARD) {
          _this.textDom.val(this.getTextValue());
        } else if (selectType == ruyi.select.SELECT_TYPE.CLICK) {

        } else if (selectType == ruyi.select.SELECT_TYPE.MOUSEENTER) {

        }
        _this.trigger("selectHandle", [selectType, this]);
      });
      return option;
    },
    getData : function(str) {
      return {
        topic: 'suggest_search',
        keyword: str
      };
    }
  });
  
  var 
  textDom = $('#ruyitao-selector-prefix-toolbar-searchbox-text').click(function(evt) {
    evt.stopPropagation();
  }), 
  searchSuggest = new SearchSuggest({
    time: 50,
    message: textDom.val(),
    textDom: textDom,
    windowDom: '#ruyitao-selector-prefix-suggestion-box',
    closeDom: '#ruyitao-selector-prefix-toolbar-searchbox-close'
  });
  
  searchSuggest.bind('hideMessageHandle', function() {
    this.textDom.addClass('ruyitao-selector-prefix-toolbar-searchbox-text-active');
  });
  searchSuggest.bind('showMessageHandle', function() {
    this.textDom.removeClass('ruyitao-selector-prefix-toolbar-searchbox-text-active');
  });
  searchSuggest.bind('selectHandle', function(evt, selectType, option) {
    if (selectType == ruyi.select.SELECT_TYPE.KEYBOARD) {
      
    } else if (selectType == ruyi.select.SELECT_TYPE.CLICK) {
      //显示商品搜索列表
      module.search(option.getTextValue());
    } else if (selectType == ruyi.select.SELECT_TYPE.MOUSEENTER) {
      
    }
  });
  searchSuggest.bind('textEnterHandle', function(evt, keyword) {
    keyword = keyword || this.textDom.val();
    if(keyword && keyword != this.message) {
      //关闭下拉选择框
      this.select.hide();
      //显示商品搜索列表
      module.search(keyword||textDom.val());
    }
    this.textDom.focus();
  });
  //当输入框为空时，广播事件
  searchSuggest.bind('textEmptyHandle', function() {
    module.textEmpty();
  });
  
  //搜索按钮
  $('#ruyitao-selector-prefix-toolbar-searchbox-button').click(function() {
    searchSuggest.trigger('textEnterHandle');
    return false;
  });
  /* suggest end */
  
  // module begin
  var module = new ruyi.module.Module({
    name: 'suggest',
    BROADCAST_TYPE: {
      SEARCH: 'search',
      EMPTY: 'empty'
    },
    search: function(keyword) {
      this.broadcast(this.BROADCAST_TYPE.SEARCH, keyword);
    },
    textEmpty: function() {
      this.broadcast(this.BROADCAST_TYPE.EMPTY);
    }
  });
  //点击搜索历史列表 和 根据历史状态进行搜索
  module.bind('searchHistory:search status:search', function(evt, searchBean) {
    searchSuggest.setValue(searchBean.keyword);
  });
  //i18n ready
  module.bind('i18n:ready', function(evt, locale) {
    if(locale != 'zh') {
      searchSuggest.dataSource.setSuccessFilter(new ruyi.data.Filter({
        doFilter: function(callback, data) {
          var result = [],
              textArr = data[1];
          for(var i=0, len=textArr.length; i<len; i++) {
            result.push([textArr[i]]);
          }
          callback({
            result: result
          });
        }
      }));
    }
    searchSuggest.setMessage(textDom.val());
  });
  // module end
})(ruyi.object.createPackage("ruyi.popup.suggest"), exports); (function(pkg, S) {
  /* SearchHistoryList begin */
  
  /**
   * @description 从searchBean到productList转换过滤器
   */
  var searchBeanFilter = new ruyi.data.Filter({
    doFilter: function(callback, searchBeanArr) {
      /*
      keyword: '',
      se: '',
      img: '',
      minPrice: '',
      maxPrice: '',
      time: 1
      */
      var arr = [],
          i = 0,
          len = searchBeanArr.length,
          searchBean;
      for(; i<len; i++) {
        searchBean = searchBeanArr[i];
        arr.push({
          Title: searchBean.keyword,
          Price: '',
          SmallImageUrl: searchBean.img,
          searchBean: searchBean
        });
      }
      
      callback({
        Entries: arr
      });
    }
  });
  
  /**
   * @description 搜索历史列表类
   * @constructor 构造器
   * @augments ruyi.popup.global.ProductListBase
   * @param {Map} [arg0={}] 实例化参数
   * @param {String||Element} [arg0.containerDom=null] 最外层容器dom
   */
  var SearchHistoryList = ruyi.object.createClass(ruyi.popup.global.ProductListBase, {
    containerDom: null,
    init : function(arg0) {
      this.callSuper.apply(this, arguments);
      this.containerDom = $(arg0.containerDom);
      this.setDataSource();
    },
    showListByArr: function(arr) {
      this.callSuper.apply(this, arguments);
      //如果无数据需要隐藏
      if(!arr || arr.length <= 0) {
        this.containerDom.hide();
      } else {
        this.containerDom.show();
      }
    },
    hide: function() {
      this.containerDom.hide();
    },
    setDataSource: function() {
      this.dataSource = new ruyi.data.ExtDS({
        conf: {
          data: {
            topic: 'search_history',
            begin: 0,
            num: this.page.getPS()
          }
        },
        successFilter: searchBeanFilter
      });
    }
  });
  var searchHistoryList = new SearchHistoryList({
    page: new ruyi.page.Page({
      ps: 10
    }),
    dom: '#ruyitao-selector-prefix-toolbar-history-search .ruyitao-selector-prefix-product-list',
    containerDom: '#ruyitao-selector-prefix-toolbar-history-search'
  });
  //在showListByArr方法执行后判断，如果无数据需要隐藏
  /*ruyi.aop.addAfter(searchHistoryList, 'showListByArr', function(arr) {
    if(!arr || arr.length <= 0) {
      $('#ruyitao-selector-prefix-toolbar-history-search').hide();
    } else {
      $('#ruyitao-selector-prefix-toolbar-history-search').show();
    }
  });*/
  //当用户点击搜索历史时，显示搜索页面，并进行搜索
  searchHistoryList.bind('selectHandle', function(evt, product) {
    var searchBean = product.searchBean;
    module.search(searchBean);    
  });
  
  //清空历史记录
  $('#ruyitao-selector-prefix-toolbar-history-clear').click(function() {
    new ruyi.data.ExtDS({
      conf: {
        data: {
          topic: 'clear_search_history'
        },
        success: function() {
          searchHistoryList.show();
        }
      }
    }).load();
  });
  /* SearchHistoryList end */
  
  /**
   * @description 热门搜索列表类
   * @constructor 构造器
   * @augments SearchHistoryList
   * @param {Map} [arg0={}] 实例化参数
   */
  var PopularSearchList = ruyi.object.createClass(SearchHistoryList, {
    data: null,
    setDataSource: function() {
      var _this = this;
      this.dataSource = new ruyi.data.DataSource({
        conf: {},
        getData: function(successFunc, errorFunc, completeFunc) {
          successFunc(_this.data || []);
        },
        successFilter: searchBeanFilter
      });
    },
    setData: function(data) {
      this.data = data;
    }
  });
  var popularSearchList = new PopularSearchList({
    page: new ruyi.page.Page({
      ps: 10
    }),
    dom: '#ruyitao-selector-prefix-toolbar-popular-search .ruyitao-selector-prefix-product-list',
    containerDom: '#ruyitao-selector-prefix-toolbar-popular-search'
  });
  //当用户点击搜索历史时，显示搜索页面，并进行搜索
  popularSearchList.bind('selectHandle', function(evt, product) {
    var searchBean = product.searchBean;
    module.search(searchBean);    
  });
  //如果搜索历史列表无数据，显示热门搜索列表
  ruyi.aop.addAfter(searchHistoryList, 'showListByArr', function(arr) {
    if(!arr || arr.length <= 0) {
      popularSearchList.show();
    } else {
      popularSearchList.hide();
    }
  });
  
  //tab begin
  //增加到tab，管理界面切换
  var tab = ruyi.popup.global.historyAndResultTab,
      tabName = 'searchHistory',
      tabItem = new ruyi.tab.TabItem({
        name: tabName,
        dom: '#ruyitao-selector-prefix-toolbar-history'
      });
      tabItem.bind('showHandle', function() {
        searchHistoryList.show();
      });
  tab.addItem(tabItem);
  //tab begin
  
  // module begin
  var module = new ruyi.module.Module({
    name: 'searchHistory',
    BROADCAST_TYPE: {
      SEARCH: 'search'
    },
    search: function(searchBean) {
      this.broadcast(this.BROADCAST_TYPE.SEARCH, searchBean);
    }
  });
  //如果输入框为空，显示搜索历史页
  module.bind('suggest:empty', function(evt, keyword) {
    tab.show(tabName);
  });
  module.bind('i18n:ready', function(evt, locale, conf) {
    popularSearchList.setData(conf.popular_search_data);
  });
  // module end
})(ruyi.object.createPackage("ruyi.popup.searchHistory"), exports); (function(pkg, S) {
  /* search begin */
  /** 
   * @description 商品列表
   * @constructor 构造器
   * @augments ruyi.popup.global.ProductListBase
   * @param {Map} [arg0={}] 实例化参数
   */
  var ProductList = ruyi.object.createClass(ruyi.popup.global.ProductListBase, {
    _showLoadingTimer: null,
    LOADING_CLASS: 'ruyitao-selector-prefix-loading',
    NODATA_CLASS: 'ruyitao-selector-prefix-nodata',
    bindEvents: function() {
      this.callSuper.apply(this, arguments);
      this.page.bind('changeHandle', $.proxy(function(evt, pn) {
        this.show(pn);
      }, this));
    },
    showListByArr : function(arr) {
      var page = this.page;
      
      this.hideLoading();
      if(!arr || arr.length <= 0) {
        this.showNoData();
        page.setCount((page.getPN()-1) * page.getPS());
        if(page.getMaxPC() == Number.MAX_VALUE) {
          page.setMaxPC(Math.max(page.getPN()-1, 0));
        }
      } else {
        page.setCount(page.getPN() * page.getPS());
      }
      page.show(arr && arr.length || 0);
      this.callSuper.apply(this, arguments);
      //由于ie6下执行jQuery opacity动画,会增加zoom:1,导致页面变乱
      //去掉ie6 7动画
      if(!($.browser.msie && $.browser.version <= 7)) {
        this.dom.hide().fadeIn(200);
      }
    },
    show: function(pn, keyword, se) {
      this.resetPage(keyword, se);
      typeof keyword == 'string' && this.dataSource.setKeyword(keyword);
      typeof se == 'string' && this.dataSource.setSearchEngine(se);
      this.dom.empty();
      this.hideNoData();
      this.showLoading();
      this.callSuper.apply(this, arguments);
    },
    resetPage: function(keyword, se) {
      if(this.dataSource.getKeyword() != keyword
          || this.dataSource.getSearchEngine() != se) {
        this.page.reset();
      }
    },
    showLoading: function() {
      this.clearShowLoading();
      this._showLoadingTimer = setTimeout($.proxy(function() {
        this.dom.addClass(this.LOADING_CLASS);
        //隐藏分页按钮
        this.page.hide();
      }, this), 100);
    },
    hideLoading: function() {
      this.clearShowLoading();
      this.dom.removeClass(this.LOADING_CLASS);
    },
    clearShowLoading: function() {
      if(this._showLoadingTimer) {
        clearTimeout(this._showLoadingTimer);
        this._showLoadingTimer = null;
      }
    },
    showNoData: function() {
      this.dom.addClass(this.NODATA_CLASS);
    },
    hideNoData: function() {
      this.dom.removeClass(this.NODATA_CLASS);
    },
    getSearchBean: function() {
      return {
        keyword: this.dataSource.getKeyword(),
        se: this.dataSource.getSearchEngine(),
        pageNum: this.page.getPN() || 1
      };
    }
  });
  
  /** 
   * @description 分页类
   * @constructor 构造器
   * @augments ruyi.page.Page
   */
  var ProductPage = ruyi.object.createClass(ruyi.page.Page, {
    _maxPC: Number.MAX_VALUE,
    init: function(arg0) {
      this.callSuper.apply(this, arguments);
      this.dom = $(arg0.dom);
      
      this._bindEvents();
    },
    _bindEvents: function() {
      this.dom.delegate('a.ruyitao-selector-prefix-page-prev.ruyitao-selector-prefix-page-active,a.ruyitao-selector-prefix-page-next.ruyitao-selector-prefix-page-active', 'click', $.proxy(function(evt) {
        evt.preventDefault();
        var dom = $(evt.currentTarget),
            n = this.getPN();
        if(dom.hasClass('ruyitao-selector-prefix-page-next')) {
          n = Math.min(n+1, this.getMaxPC());
        } else if(dom.hasClass('ruyitao-selector-prefix-page-prev')) {
          n = Math.max(n-1, 1);
        } else {
          n = +dom.html()
        }
        
        this.trigger('changeHandle', n);
      }, this));
    },
    setCount: function(n, flag) {
      if(flag || this.getCount() < n) {
        this.callSuper.apply(this, arguments);
      }
    },
    getBeginPage : function() {
      if(this.getMaxPC() == Number.MAX_VALUE) {
        return Math.max(1, this.getPN() - this.getVN() + 1);
      } else {
        return this.callSuper.apply(this, arguments);
      }
    },
    setMaxPC: function(n) {
      this._maxPC = n;
    },
    getMaxPC: function() {
      return this._maxPC;
    },
    show: function(len) {
      /*this.dom.empty();
      if(this.getPC() >= 1) {
        var beginPage = this.getBeginPage(), 
            endPage = this.getEndPage(), 
            pc = this.getPC(),
            pn = this.getPN(),
            html = [];
        
        //上一页
        if(pn > 1) {
          html.push('<a href="#" class="ruyitao-selector-prefix-page-prev"></a>');
        }
        for(var i=beginPage; i<=endPage; i++) {
          html.push('<a href="#" ' + (i==pn?'class="ruyitao-selector-prefix-page-selected"':'') + '>' + i + '</a>');
        }
        if(pn < this.getMaxPC()) {
          //下一页
          html.push('<a href="#" class="ruyitao-selector-prefix-page-next"></a>');
        }
        
        this.dom.html(html.join(''));
      }*/
      
      this.setBtn('prev', this.getPN() > 1);
      this.setBtn('next', len >= this.getPS());
    },
    hide: function() {
      this.setBtn('prev', false);
      this.setBtn('next', false);
    },
    reset: function() {
      this.setPN(1);
      this.setCount(0, true);
      this.setMaxPC(Number.MAX_VALUE);
    },
    setBtn: function(name, status) {
      var className = 'ruyitao-selector-prefix-page-active',
          btnDom = $('a.ruyitao-selector-prefix-page-' + name, this.dom);
          if(status) {
            !btnDom.hasClass(className) && btnDom.addClass(className);
          } else {
            btnDom.removeClass(className);
          }
    }
  });
  
  //商品搜索列表对象
  var 
  productPage = new ProductPage({
    ps: 8,
    vn: 5,
    dom: '#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-product-container-searchresult'
  }),
  productList = new ProductList({
    page: productPage,
    dom: '#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-product-list',
    dataSource: new ruyi.popup.global.ItemSearchDS({
      page: productPage,
      conf: {},
      successFilter: new ruyi.data.Filter({
        doFilter: function(callback, data) {
          if(data && data.Entries) {
            var i = 0,
                entries = data.Entries, 
                len = entries.length,
                price,
                index;
            for(; i<len; i++) {
              price = entries[i].Price;
              if(price && (index = price.indexOf('-')) > 0) {
                entries[i].Price = $.trim(price.substring(0, index));
              }
            }
          }
          callback(data);
        }
      })
    })
  });
  ruyi.aop.addAfter(productList, 'showNoData', function() {
    $('#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-nodata-box').show();
  });
  ruyi.aop.addAfter(productList, 'hideNoData', function() {
    $('#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-nodata-box').hide();
  });
  productList.bind('selectHandle', function(evt, product) {
    // S.SearchBox.Util.openTab(product.ClickUrl || product.DetailPageURL, true);
    module.selectProduct(product)
  });
  /* search end */
  
  /* SearchEngineList begin */
  /** 
   * @description 搜索引擎列表类
   * @constructor 构造器
   * @augments ruyi.list.List
   * @param {Map} [arg0={}] 实例化参数
   */
  var SearchEngineListBase = ruyi.object.createClass(ruyi.list.List, {
    __readyCBArr: null,
    //DEFAULT: 'etao',
    currentSeId: null,
    SELECTED_CLASS: 'ruyitao-selector-prefix-shop-selected',
    init : function(arg0) {
      this.callSuper.apply(this, arguments);
      this.dataSource = arg0.dataSource || new ruyi.data.DataSource({
        conf: {},
        __getDataFlag: false,
        getData: function(success, error, complete) {
          if(!this.__getDataFlag) {
            var func = arguments.callee, args = arguments;
            S.SearchBox.SearchEngines.getAll($.proxy(function() {
              this.__getDataFlag = true;
              func.apply(this, args);
            }, this));
            return;
          }
          var ses = S.SearchBox.SearchEngines.getCurrentLocaleSearchEngines();
          S.SearchBox.SearchEngines.sort(ses);
          success(ses);
        }
      });
      this.__readyCBArr = [];
      this._bindEvents();
    },
    _bindEvents: function() {
      this.dom.delegate('li:not(.' + this.SELECTED_CLASS + ')', 'click', $.proxy(function(evt) {
        this.select($(evt.currentTarget));
      }, this));
    },
    ready: function(callback) {
      if(this.dataSource.__getDataFlag) {
        callback.apply(this);
      } else {
        this.__readyCBArr.push(callback);
      }
    },
    __doReady: function() {
      for(var i=0, len=this.__readyCBArr.length; i<len; i++) {
        var callback = this.__readyCBArr[0];
        this.__readyCBArr.shift();
        callback.apply(this);
      }
    },
    select: function(seId/*|| toDom*/, data) {
      if(seId == null) {
        seId = this.currentSeId || this.getSEId(0);
      }
      
      var toDom = seId;
      if(typeof seId == 'string') {
        toDom = this.getDomBySE(seId);
      }
      if(toDom && toDom.length > 0) {
        var fromDom = $('li.' + this.SELECTED_CLASS, this.dom).removeClass(this.SELECTED_CLASS);
        toDom.addClass(this.SELECTED_CLASS);
        
        this.currentSeId = seId;
        
        this.trigger('selectHandle', [{
          name: toDom.attr('data-se-id'),
          title: toDom.attr('data-se-name')
        }, fromDom, toDom, data]);
      }/* else if(this.getDomBySE(DEFAULT).length > 0) {
        this.select(this.getDomBySE(DEFAULT));
      }*/
    },
    show : function(pn) {
      var _this = this;
      
      this.dataSource.conf.success = function(response) {
        if(response) {
          _this.showListByArr(response||[]);
        }
      };
      this.dataSource.load();
    },
    showListByArr : function(arr) {
      this._data = arr;
      this.callSuper.apply(this, arguments);
      this.__doReady();
    },
    getItemDom : function(obj, i) {
      /*
      enabled: true
      homepage: "http://www.etao.com"
      host: "etao\.com"
      name: "etao"
      order: 1021
      title: "一淘"
      */
      var 
      title = obj.title=='一淘'?'所有':obj.title,
      name = obj.name;
      
      return [
        '<li ' + (i==0?'class="' + this.SELECTED_CLASS + '"':'') + 'data-se-id="' + name + '" data-se-name="' + title + '">' + title + '</li>'
      ].join('');
    },
    getDomBySE: function(se) {
      return $('li[data-se-id="' + se + '"]', this.dom);
    },
    getSE: function(n) {
      return this._data && this._data[n];
    },
    getSEId: function(n) {
      var se = this.getSE(n);
      return se && se.name;
    }
  });
  /** 
   * @description 搜索引擎列表类
   * @constructor 构造器
   * @augments ruyi.list.List
   * @param {Map} [arg0={}] 实例化参数
   */
  var SearchEngineList = ruyi.object.createClass(SearchEngineListBase, {
    cursorDom: null,
    init: function() {
      this.callSuper.apply(this, arguments);
      this.cursorDom = $(this.cursorDom);
      this.bind('selectHandle', $.proxy(function(evt, obj, fromDom, toDom) {
        this.animate(fromDom, toDom);
      }, this));
    },
    animate: function(fromDom, toDom) {
      var top = this.getOffset(toDom).top;
      //如果是ie6 7取消动画
      if($.browser.msie && $.browser.version <= 7) {
        this.cursorDom.css({marginTop: top});
      } else {
        this.cursorDom.animate({marginTop: top}, 100);
      }
    },
    getOffset: function(dom) {
      var offset1 = dom.offset(),
          offset2 = this.dom.offset();
      return {
        top: offset1.top - offset2.top,
        left: offset1.left - offset2.left
      };
    }
  });
  
  //search engine list
  var seList = new SearchEngineList({
    dom: '#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-shop-container ul', 
    cursorDom: '#ruyitao-selector-prefix-toolbar-searchresult .ruyitao-selector-prefix-shop-container .ruyitao-selector-prefix-shop-cursor'
  });
  seList.bind('selectHandle', function(evt, seObj, fromDom, toDom, data) {
    productList.show((data && data.page && data.page.getPN()) || 1, null, seObj.name);
  });
  
  seList.show();
  /* SearchEngineList end */
  
  //tab begin
  //增加到tab，管理界面切换
  var tab = ruyi.popup.global.historyAndResultTab,
      tabName = 'searchResult',
      tabItem = new ruyi.tab.TabItem({
        name: tabName,
        dom: '#ruyitao-selector-prefix-toolbar-searchresult'
      });
  tab.addItem(tabItem);
  //tab end
  
  // module begin
  var module = new ruyi.module.Module({
    name: 'searchResult',
    BROADCAST_TYPE: {
      SHOW_PRODUCT_LIST: 'showProductList',
      SELECT_PRODUCT: 'selectProduct'
    },
    showProductList: function(searchBean) {
      /*
       searchBean: {
         keyword,
         se,
         pageNum
       }
      */
      this.broadcast(this.BROADCAST_TYPE.SHOW_PRODUCT_LIST, searchBean);
    },

    selectProduct: function(product) {
      this.broadcast(this.BROADCAST_TYPE.SELECT_PRODUCT, product);
    }
  });
  ruyi.aop.addAfter(productList, 'show', function() {
    module.showProductList(this.getSearchBean());
  });
  module.bind('suggest:search', function(evt, keyword) {
    tab.show(tabName);
    //productList.show(1, keyword);
    productList.dataSource.setKeyword(keyword);
    seList.ready(function() {
      this.select(null);
    });
  });
  module.bind('searchHistory:search', function(evt, searchBean) {
    tab.show(tabName);
    productList.dataSource.setKeyword(searchBean.keyword);
    seList.ready(function() {
      this.select(searchBean.se);
    });
  });
  module.bind('status:search', function(evt, searchBean) {
    tab.show(tabName);
    productList.dataSource.setKeyword(searchBean.keyword);
    productList.dataSource.setSearchEngine(searchBean.se);
    productList.page.setPN(searchBean.pageNum || 1);
    seList.ready(function() {
      this.select(searchBean.se, {page: productList.page});
    });
  });
  // module end
})(ruyi.object.createPackage("ruyi.popup.searchResult"), exports); (function(pkg, S) {
  var globalTab = ruyi.popup.global.globalTab,
      showNum = 0;
  //点击head上的tab
  $('#nav-search').click(function() {
    globalTab.show('searchView');
    //historyAndResultTab.show('searchHistory');
  });
  
  var tabItem = new ruyi.tab.TabItem({
    name: 'searchView',
    dom: '#ruyitao-selector-prefix-search-view'
  });
  tabItem.bind('showHandle', function() {
    $('#nav-search').addClass('active').removeClass('hidden');
    module.show();
  });
  tabItem.bind('hideHandle', function() {
    $('#nav-search').removeClass('active').removeClass('hidden');
  });
  globalTab.addItem(tabItem);
  
  // module begin
  var module = new ruyi.module.Module({
    name: 'searchView',
    BROADCAST_TYPE: {
      SHOW: 'show'
    },
    show: function() {
      this.broadcast(this.BROADCAST_TYPE.SHOW, ++showNum);
    }
  });
  // module end
})(ruyi.object.createPackage("ruyi.popup.searchView"), exports); (function(pkg, S) {
var Util = S.SearchBox.Util;
var CommodityDetail = ruyi.object.createClass({
  currentProductInfo: null,
  currentIsBook: null,
  priceCurve: null,
  currentProductLink: '',

  init: function(priceCurve) {
    this.priceCurve = priceCurve;
    this.bindEvents();
  },

  bindEvents: function() {
    var self = this
    $('#ruyitao-selector-prefix-share-btn').click(function() {
      if (self.currentProductInfo) {
        self.share(self.currentProductInfo, self.currentIsBook)
      }
    });
    
    //标题 图片 去购买 增加统计
    //更多 纠错 增加统计
	$('#ruyitao-selector-prefix-buy-btn,#ruyitao-selector-prefix-photo-btn,#ruyitao-selector-prefix-title-btn,' + 
      '#ruyitao-selector-prefix-more-results-link,#ruyitao-selector-prefix-report-bug-link').click(function() {
      Util.sendLog('click_popup', $(this).attr('href'));
    });
    //商家链接增加统计
    $('#ruyitao-selector-prefix-comparation-prices').delegate('a', 'click', function() {
      Util.sendLog('click_popup', $(this).attr('href'));
    });

    // 想买按钮
    $('#ruyitao-selector-prefix-toolbar-ivy-want-btn').click(function() {
      self.wantThis(self.currentProductLink)
    });

    $('#ruyitao-selector-prefix-toolbar-ivy-wants-text').delegate('.ruyitao-selector-prefix-ivy-wants-count', 'click', function() {
      self.openUserHomepage()
    });
	 
  },

  fetchDataAndRender: function(url, fromSearchResult) {
    var self = this
    var detailSearcher = new ruyi.data.ExtDS({
      conf : {
        data : {
          topic : 'get_price_comparation_and_history_prices_data',
          link: url
        },
        success : function(res) {
          var currentProductInfo = res.Item;
          var etaoProductInfo = res.Product;
          if (res && typeof currentProductInfo == 'object') {

            globalTab.show('detail')
            self.currentProductInfo = currentProductInfo
            self.currentIsBook = etaoProductInfo && etaoProductInfo.Book
            self.renderBaseInfo(currentProductInfo, !fromSearchResult)
            self.renderPriceComparation(res.Items, etaoProductInfo)
            self.priceCurve.render(currentProductInfo.Prices, currentProductInfo)
          } else if (fromSearchResult) {
            Util.sendLog('click_popup', url);
            Util.openTab(url, true);
          } else {
            // 产品库没节点，显示搜索视图
            S.console.debug('Not fetched current product data.')
            module.showSearchView()
          }
        }
      }
    });

    this.currentProductLink = url;
    this.getWantCounts(url)
    detailSearcher.load();
  },

  isSameProduct: function(product) {
    //Epid >= 3E14
    return product && product.Epid && product.Epid.length > 14 && product.Epid.charAt(0) >= 3;      
  },

  renderBaseInfo: function(product, fromDetailPage) {
    var imageUrl = product.LargeImageUrl;
    var title = product.Title;

    // 从搜索结果页跳转过来的话考虑使用搜索得到的价格
    var price = product.Price;

    // 购买链接
    var buyLink = product.ClickUrl || product.DetailPageURL;

    $('#ruyitao-selector-prefix-title-btn').text(title).attr('title', title)
    if (!fromDetailPage) {
      $('#ruyitao-selector-prefix-shopname').text(product.ShopName + '：')
      $('#ruyitao-selector-prefix-price').html(price)
    }
    $('#ruyitao-selector-prefix-photo img').attr('src', imageUrl)
    $('#ruyitao-selector-prefix-buy-btn,#ruyitao-selector-prefix-photo-btn,#ruyitao-selector-prefix-title-btn').attr('href', buyLink)
  },

  MAX_PRICE_COMPARATION_COMMODITY_NUM: 5,

  renderPriceComparation: function(products, currentProduct) {
    var $priceComparationContainer = $('#ruyitao-selector-prefix-comparation-prices').hide()
    var $noPriceComparationInfo = $('#ruyitao-selector-prefix-no-price-comparation-info').hide()
    var $otherLinks = $('#ruyitao-selector-prefix-other-links').hide()

    if (products && products.length && !this.isSameProduct(currentProduct)) {
      var l = products.length < this.MAX_PRICE_COMPARATION_COMMODITY_NUM ? products.length : this.MAX_PRICE_COMPARATION_COMMODITY_NUM
      var product
      var html = '';
      var url;
      for (var i = 0; i < l; i++) {
        product = products[i]
        url = product.ClickUrl || DetailPageURL;
        html += '<li><a href="' + url + '" target="_blank">' +
          '<div class="ruyitao-selector-prefix-merchant-name">' + product.SiteName + '</div>' +
          '<div class="ruyitao-selector-prefix-comparation-price">' + product.Price + '</div>' +
          '</a></li>';
      }

      $priceComparationContainer.show().html(html)
      var epid = currentProduct.Epid;
      var reportUrl = 'http://ruyi.taobao.com/bug/item/' + epid
      $otherLinks.show();
      $('#ruyitao-selector-prefix-more-results-link').attr('href', currentProduct.DetailPageURL)
      $('#ruyitao-selector-prefix-report-bug-link').attr('href', reportUrl)
    } else {
      // 没有商品比价信息
      $noPriceComparationInfo.show();
    }
  },


  getWantCounts: function(url) {
    var self = this
    new ruyi.data.ExtDS({
      conf: {
        data: {
          topic: "item_like_count",
          url: url
        },
        success: function(response) {
          if (response.error) {
            $('#ruyitao-selector-prefix-toolbar').addClass('ruyitao-selector-prefix-fetch-like-count-error')
            return;
          } else {
            $('#ruyitao-selector-prefix-toolbar').removeClass('ruyitao-selector-prefix-fetch-like-count-error')
          }

          var isSaved = response.is_saved;
          var savedCount = response.saved_count;

          self.updateWantsStatus(savedCount, isSaved);
        }
      }
    }).load();
  },

  wantThis: function(url) {
    var self = this
    new ruyi.data.ExtDS({
      conf: {
        data: {
          topic: "item_like_add",
          url: url
        },

        success: function(response) {
          if (response && response.success && typeof response.saved_count != "undefined" ) {
            self.updateWantsStatus(response.saved_count, true)
          }
        }
      }
    }).load();
  },

  updateWantsStatus: function(count, isSaved) {
    var html = '';
    var anchor = '<a class="ruyitao-selector-prefix-ivy-wants-count" target="_blank">'
    $('#ruyitao-selector-prefix-toolbar-ivy-want-btn').removeClass('ruyitao-selector-prefix-bought')
    count = parseInt(count);
    if ( isNaN(count) || count < 0 ) {
      count = 0;
    }
    if ( count == 0 ) {
      html = '成为第 ' + anchor + '1 个</a>想买的如意淘用户';
    } else {
      if ( isSaved ) {
        if ( count == 1 ) {
          html = '你是第' + anchor + ' 1 个</a>想买的如意淘用户';
        } else {
          html = '你与其他' + anchor + (count-1) +' 个</a>如意淘用户都想买';
        }

        $('#ruyitao-selector-prefix-toolbar-ivy-want-btn').addClass('ruyitao-selector-prefix-bought');
        
      } else {
        html = '如意淘用户中有' + anchor + count + ' 人</a>想买';
      }
    }

    $('#ruyitao-selector-prefix-toolbar-ivy-wants-text').html(html)
  },

  openUserHomepage: function() {
    new ruyi.data.ExtDS({
      conf: {
        data: {
          topic: "item_like_open_homepage"
        }
      }
    }).load()
  },


  share: function(product, isBook) {
    var quote = isBook ? ['\u300a', '\u300b'] : ['\u201c', '\u201d'];
    var url = product.ClickUrl || product.DetailPageURL
    var title = '\u64e6\uff01\u5982\u610f\u6dd8\u771f\u662f\u8d2d\u7269\u795e\u5668\uff01' +
      '\u770b\u5230\u5546\u54c1\u5c31\u80fd\u6bd4\u4ef7\uff0c\u4e0d\u6bd4\u4e0d\u77e5' +
      '\u9053\uff0c\u4e00\u6bd4\u7701\u4e0d\u5c11\uff01\u521a\u7528@\u5982\u610f\u6dd8 \u67e5\u4e86' +
      quote[0] + product.Title + quote[1] + '\uff0c\uff08\u5b98\u65b9\u7f51\u7ad9\uff1ahttp://t.cn/aeDbuE\uff09'
    var imageUrl = product.LargeImageUrl;

    var shareData = {
      url: url,
      title: title,
      pic: imageUrl
    };

    var e = encodeURIComponent,
      s = window.screen,
      p = [],
      f = 'http://v.t.sina.com.cn/share/share.php?';
    for (name in shareData) {
      if (shareData.hasOwnProperty(name)) {
        p.push(name + '=' + e(shareData[name]));
      }
    }
    p.push('appkey=1965387856');
    f += p.join('&');
    window.open(f, 'mb',
      ['toolbar=0,status=0,resizable=1,width=620,height=450,left=',
        (s.width - 620) / 2, ',top=', (s.height - 450) / 2].join(''));
  }
})

var PriceCurve = ruyi.object.createClass({
  init: function() {
    this.bindEvents();
  },

  bindEvents: function() {
    var prevPoint = null;
    var self = this;
    $('#ruyitao-selector-prefix-price-curve').bind('plothover', function(event, pos, item) {
      if (item) {
        if (prevPoint != item.dataIndex) {
          prevPoint = item.dataIndex;
          self.hideTip(); 
          
          var date = new Date(item.datapoint[0]);
          date = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
          var price = item.datapoint[1].toFixed(2);
          price = '\uffe5 ' + Util.addThousandSeparator(price)
          self.showTip(date, price, item.pageX, item.pageY);
        }
      } else {
        self.hideTip();
        prevPoint = null;
      }
    });
  },

  filterPriceHistoryData: function(data, currentPrice) {
    var noPriceCounter = 0;
    if (data) {
      var latestTime = 0;
      var i = 0;
      var l = data.length;
      for (; i < l; i++) {
        data[i][0] *= 1000;
        if (data[i][0] > latestTime)
          latestTime = data[i][0];
        if (data[i][1] == null) {
          data[i][1] = undefined;
          noPriceCounter++;
        }
      }

      // 添加当前价格
      var now = new Date();
      var price = currentPrice || ''//this.site.getCurrentPrice();
      if ( !price ) {
        price = data[data.length-1][1];
      }
      var latest = new Date(parseInt(latestTime));
      if (price) {
        // 避免重复添加当天价格数据
        if (now.getMonth() == latest.getMonth()) {
          if (now.getDate() != latest.getDate()) {
            data[i] = [now.getTime(), price];
          }
        } else {
          data[i] = [now.getTime(), price];
        }
      }

      // 防止只有一个数据或数据中所有价格都为 null 的情况
      // if (data.length < 2 || noPriceCounter == l ) {
      //   data = null;
      // }
    }

    return data;
  },

  render: function(data, currentProductInfo) {
    var currentPrice = currentProductInfo.Price.replace(/\uffe5|\s/g, '')
    currentPrice = parseInt(currentPrice)
    data = this.filterPriceHistoryData(data, currentPrice)
    if (data && data.length > 0) {
      var $plotWrapper = $('#ruyitao-selector-prefix-price-curve');
      var self = this;
      
      try {
        this.drawPlot(data, $plotWrapper);
      } catch (e) {
        S.console.debug("draw plot error: " + e.message);
        setTimeout(function() {
          try {
            self.drawPlot(data, $plotWrapper);
          } catch (e) {
            S.console.debug("draw plot error again: " + e.message);
            // $('#' + SELECTORS('price-curve')).remove();
          }
        }, 0);
      }

      var maxPrice = this.getPrice(data, 'max');
      var minPrice = this.getPrice(data, 'min');
      this.setPrices(minPrice, maxPrice, currentProductInfo.nid);
    } else {
      // 没有历史价格数据
    }
  },

  getPrice: function(data, type) {
    var prices =[];
    for (var i = 0, l = data.length; i < l; i++) {
      if (data[i][1])
        prices.push(data[i][1]);
    }
    return Math[type].apply(null, prices);
  },

  setPrices: function(minPrice, maxPrice, nid) {
    var priceInfoTemplate = this.getPriceInfoTemplate(this.formatNum(minPrice), this.formatNum(maxPrice), nid);
    $('#ruyitao-selector-prefix-pc-price-info').html(priceInfoTemplate);
  },

  drawPlot: function(data, $wrapper) {


    var now = new Date();
    var max = now.getTime();
    now.setMonth(now.getMonth() - 3);
    now.setDate(now.getDate() - 1);
    var min = now.getTime();

    var maxPrice = this.getPrice(data, 'max');
    var minPrice = this.getPrice(data, 'min');
    
    var tickDecimals;
    if (maxPrice - minPrice < 1)
      tickDecimals = 2;

    var options = {
      series: {
        lines: {
          show: true,
          lineWidth: 1,
          steps: true
        },
        points: {
          show: true,
          radius: 2,
          lineWidth: 0,
          fillColor: '#faaa2b'
        },
        color: '#fab13c', // #7bafd3
        shadowSize: 1
      },
      grid: {
        hoverable: true,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1e3ea',
        tickColor:'#d1e3ea',
        labelMargin: 8
      },
      xaxis: {
        min: min,
        max: max,
        mode: "time",
        // tickLength: 5, 加了这个属性后默认不加竖线
        timeformat: '%0m/%0d',
        tickSize: [15, 'day']
      },
      yaxis: {
        minTickSize: 5,
        tickDecimals: tickDecimals,
        tickFormatter: this.formatNum
      }
    };

    $.plot($wrapper, [data], options);
  },

  showTip: function(date, price, x, y) {
    var tipTemplate = this.getPriceCurveTipTemplate();
    $(document.body).append(tipTemplate);
    date = '\u65e5\u671f\uff1a' + date;
    price = '\u4ef7\u683c\uff1a' + price;
    $('#ruyitao-selector-prefix-current-point-date').text(date);
    $('#ruyitao-selector-prefix-current-point-price').text(price);
    var $tip = $('#ruyitao-selector-prefix-price-curve-tip');
    var outerWidth = $tip.outerWidth();
    var outerHeight = $tip.outerHeight();
    var topOffset = 15;
    var arrowWidth = 8;
    var left = x - (outerWidth / 2);
    var top = y - outerHeight - topOffset;
    var arrowLeft = (outerWidth - arrowWidth) / 2
    var viewPortWidth = document.documentElement.clientWidth

    if (left + outerWidth > viewPortWidth) {
      left = viewPortWidth - outerWidth
      arrowLeft = outerWidth - (viewPortWidth - x) - 4
    }

    $tip.css({
      top: top,
      left: left
    }).addClass('ruyitao-selector-prefix-tip-visible');
    $('#ruyitao-selector-prefix-price-curve-arrow-down').css('left', arrowLeft);
  },

  hideTip: function() {
    $('#ruyitao-selector-prefix-price-curve-tip').remove();
  },
  
  formatNum: function(num) {
    num = Math.round(num * 100) / 100;
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  },

  getPriceCurveTipTemplate: function() {
    var tmpl = '<div id="ruyitao-selector-prefix-price-curve-tip" >' +
      '<div id="ruyitao-selector-prefix-current-point-date"></div>' +
      '<div id="ruyitao-selector-prefix-current-point-price"></div>' +
      '<div id="ruyitao-selector-prefix-price-curve-arrow-down"></div></div>';
    return tmpl;
  },

  getPriceInfoTemplate: function(minPrice, maxPrice, nid) {
    return '<span>\u6700\u9ad8\u4ef7\uff1a<span class="ruyitao-selector-prefix-highest-price">\uffe5' + maxPrice + '</span></span>' +
      '<span>\u6700\u4f4e\u4ef7\uff1a<span class="ruyitao-selector-prefix-lowest-price">\uffe5' + minPrice + '</span></span>';
  }
})

var priceCurve = new PriceCurve()
var commodityDetail = new CommodityDetail(priceCurve)

var globalTab = ruyi.popup.global.globalTab;
var tabItem = new ruyi.tab.TabItem({
  name: 'detail',
  dom: '#ruyitao-selector-prefix-detail-wrapper'
})
tabItem.bind('showHandle', function() {
  $('#nav-detail').addClass('active').removeClass('hidden');
})
globalTab.bind('changeHandle', function(e, fromItem, fromItemNum, showItem, showItemNum) {
  //如果是hide比价的tab，使用changeHandle避免hideHandle在hide时也会触发
  if(fromItem && fromItem.name == tabItem.name) {
    var dom = $('#nav-detail');
    if(dom.hasClass('active')) {
      dom.removeClass('active');
    } else {
      dom.addClass('hidden');
    }
  }
})
globalTab.addItem(tabItem);

$('#nav-detail').click(function() {
  globalTab.show(tabItem.name);
});

var module = new ruyi.module.Module({
  name: 'detail',
  showSearchView: function() {
    this.broadcast('showSearchView')
  }
})

/*
ASIN: "B002SST5J4"
ClickUrl: "http://ruyi.taobao.com/ext/clickurl?url=http%3A%2F%2Fwww.amazon.cn%2F%25E6%259E%2597%25E8%2582%25AF%25E5%2585%25AC%25E5%259B%25ADLinkin-Park-%25E7%2589%25B9%25E5%2588%25AB%25E7%25BA%25AA%25E5%25BF%25B5%25E7%258F%258D%25E8%2597%258F%25E7%2589%2588%2Fdp%2FB002SST5J4%2Fref%3Dsr_1_1%3Fie%3DUTF8%26qid%3D1352172740%26sr%3D8-1&pid=rc001"
DetailPageURL: "http://www.amazon.cn/%E6%9E%97%E8%82%AF%E5%85%AC%E5%9B%ADLinkin-Park-%E7%89%B9%E5%88%AB%E7%BA%AA%E5%BF%B5%E7%8F%8D%E8%97%8F%E7%89%88/dp/B002SST5J4/ref=sr_1_1?ie=UTF8&qid=1352172740&sr=8-1"
FastTrack: ""
ImageUrl: "http://ec4.images-amazon.com/images/I/51ywMZrxdnL._AA160_.jpg"
LargeImageUrl: "http://ec4.images-amazon.com/images/I/51ywMZrxdnL._AA300_.jpg"
Price: " ￥49.00"
SmallImageUrl: "http://ec4.images-amazon.com/images/I/51ywMZrxdnL._AA75_.jpg"
Stars: "<div name="B002SST5J4" ref="sr_cr_" class="asinReviewsSummary">↵            <a target="_blank" href="http://www.amazon.cn/%E6%9E%97%E8%82%AF%E5%85%AC%E5%9B%ADLinkin-Park-%E7%89%B9%E5%88%AB%E7%BA%AA%E5%BF%B5%E7%8F%8D%E8%97%8F%E7%89%88/product-reviews/B002SST5J4/ref=sr_1_1_cm_cr_acr_img?ie=UTF8&showViewpoints=1" target="_blank"><img height="12" width="55" align="absbottom"↵                            alt="平均3.5 星" src="http://g-ec4.images-amazon.com/images/G/28/x-locale/common/customer-reviews/ratings/stars-3-5._V192281577_.gif" /></a></div>"
Title: "&#26519;&#32943;&#20844;&#22253;Linkin Park:&#29305;&#21035;&#32426;&#24565;&#29645;&#34255;&#29256;(4CD+1DVD)"
UsedPrice:
 */
module.bind('searchResult:selectProduct', function(e, product) {
  commodityDetail.fetchDataAndRender(product.DetailPageURL, true)
});

module.bind('status:showDetail', function(e, url) {
  commodityDetail.fetchDataAndRender(url)
})

})(ruyi.object.createPackage("ruyi.popup.detail"), exports); (function(pkg, S) {
  var globalTab = ruyi.popup.global.globalTab;
  var tab = ruyi.popup.global.historyAndResultTab,
      StatusManager = ruyi.object.createClass(ruyi.job.JobManager),
      statusManager = new StatusManager({}),
      searchResultJob = new ruyi.job.Job({
        name : 'searchResult',
        getStatus: function() {
          return {
            name: 'searchResult'
          }
        }
      });
      
  searchResultJob.bind('executeHandle', function(evt, searchBean, callback) {
    module.search(searchBean);
  });
  statusManager.add(searchResultJob);
  
  var searchHistoryJob = new ruyi.job.Job({
    name : 'searchHistory',
    getStatus: function() {
      return {
        name: 'searchHistory'
      }
    }
  });
  searchHistoryJob.bind('executeHandle', function(evt, searchBean, callback) {
    tab.show('searchHistory');
  });
  statusManager.add(searchHistoryJob);
  
  /*
  status {
    name: '',
    data: {}
  }
  */
  var statusDS = new (ruyi.object.createClass(ruyi.data.ExtDS, {
    add: function(status) {
      this.conf.data.status = status;
      this.load();
    }
  }))({
    conf : {
      data : {
        topic : 'add_popup_status'
      },
      success : function(response) {
        
      }
    }
  });
  
  var getStatusDS = new ruyi.data.ExtDS({
    conf : {
      data : {
        topic : 'get_popup_status'
      },
      success : function(response) {
        globalTab.show('searchView')
        if (response && response.length > 0 && response[0].name && response[0].data) {
          statusManager.execute(response[0].name, response[0].data);
        } else {
          statusManager.execute('searchHistory');
        }
      }
    }
  });

  var PageTypeDS = ruyi.object.createClass(ruyi.data.ExtDS, {
    setUrl: function(url) {
      this.conf.data.url = url
    },

    setTitle: function(title) {
      this.conf.data.title = title
    }
  })

  var pageTypeDS = new PageTypeDS({
    conf: {
      data: {
        topic: 'is_detail_site'
      },

      success: function(res) {
        if (typeof res.locale != "undefined") {
          // 初始化产品详情视图
          //globalTab.show('detail')
          module.showDetail(pageTypeDS.conf.data.url)
        } else {
          // 根据 popup 状态初始化搜索视图
          getStatusDS.load();
        }
      }
    }
  });
  
  tab.bind('showHandle', function(evt, fromItem, fromItemNum, showItem, showItemNum) {
    var status;
    switch(showItem.name) {
      case 'searchHistory': 
          status = searchHistoryJob.getStatus();
          break;
      case 'searchResult': 
          status = searchResultJob.getStatus();
          break;
    }
    statusDS.add(status);
  });

  
  // module begin
  var module = new ruyi.module.Module({
    name: 'status',
    BROADCAST_TYPE: {
      SEARCH: 'search',
      SHOW_DETAIL: 'showDetail'
    },
    search: function(searchBean) {
      this.broadcast(this.BROADCAST_TYPE.SEARCH, searchBean);
    },

    showDetail: function(url, title) {
      this.broadcast(this.BROADCAST_TYPE.SHOW_DETAIL, url, title)
    }
  });

  module.bind('searchResult:showProductList', function(evt, searchBean) {
    var status = searchResultJob.getStatus();
    status.data = searchBean;
    statusDS.add(status);
  });

  module.bind('i18n:ready', function(evt, locale) {
    if (locale == 'zh') {
      $('#ruyitao-selector-prefix-navbar').show()
      new ruyi.data.ExtDS({
        conf: {
          data: {
            topic: 'get_current_tab'
          },

          success: function(tab) {
            if (tab) {
              pageTypeDS.setUrl(tab.url);
              pageTypeDS.setTitle(tab.title);
              pageTypeDS.load();
            } else {
              // 初始化搜索视图
              getStatusDS.load();
            }
          }
        }
      }).load();
    } else { 
      getStatusDS.load();
    }
  });

  module.bind('detail:showSearchView', function(e) {
    getStatusDS.load();
  });
  module.bind('searchView:show', function(e, showNum) {
    if(showNum == 1) {
      getStatusDS.load();
    }
  });
  // module end
})(ruyi.object.createPackage("ruyi.popup.status"), exports); (function(pkg, S) {
  var msg = {
    zh: {
      search_history: '搜索历史',
      search_history_clear: '清除',
      search_history_clear_title: '清除历史',
      view_history: '浏览过的商品',
      input_message: '请输入你想搜索的商品',
      search_btn: '',
      no_results: '抱歉，未找到结果！',
      popular_search: '热门搜索',
      popular_search_data: [
        {
          keyword: '数码相机',
          img: 'http://img04.taobaocdn.com/bao/uploaded/i8/T1RGmQXmVeXXafPp_X_113847.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '三星手机',
          img: 'http://img01.taobaocdn.com/bao/uploaded/i5/T1ZGR_XcxfXXbio5rX_115516.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '内衣',
          img: 'http://img04.taobaocdn.com/bao/uploaded/i4/T1DyOiXepmXXcFc.g8_071808.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '平板电脑',
          img: 'http://img01.taobaocdn.com/bao/uploaded/i1/T1KSnIXmhgXXXfQJc7_064152.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '取暖器',
          img: 'http://img03.taobaocdn.com/bao/uploaded/i3/T1CPCsXnpLXXbHVfjX_114819.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '莫言',
          img: 'http://img03.taobaocdn.com/bao/uploaded/i3/T1bHvUXehfXXXBfTPa_092432.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '护手霜',
          img: 'http://img01.taobaocdn.com/bao/uploaded/i1/T1q9YYXoBdXXXI6A3__110256.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '电视',
          img: 'http://img03.taobaocdn.com/bao/uploaded/i3/T1oJreXgJfXXbgEoEZ_034019.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: '加湿器',
          img: 'http://img02.taobaocdn.com/bao/uploaded/i2/T13_5vXnXzXXbB1BI3_051105.jpg_b.jpg',
          se: 'etao'
        },
        {
          keyword: 'zippo',
          img: 'http://img02.taobaocdn.com/bao/uploaded/i2/T1CteQXahcXXcO7ck1_040430.jpg_b.jpg',
          se: 'etao'
        }
      ]
    },
    en: {
      search_history: 'Search History',
      search_history_clear: 'Clear',
      search_history_clear_title: 'Clear history',
      input_message: 'Please enter the product name',
      search_btn: 'Search',
      no_results: 'Oops, no result!',
      popular_search: 'Hot keywords',
      popular_search_data: [
        {
          keyword: 'Camera',
          img: 'http://ecx.images-amazon.com/images/I/41gEcoG2qJL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'GPS',
          img: 'http://ecx.images-amazon.com/images/I/41QNJqpZ6PL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'LCD TV',
          img: 'http://ecx.images-amazon.com/images/I/41q9kKNWVFL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Laptop',
          img: 'http://ecx.images-amazon.com/images/I/41Y4QtahKcL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Oral-B',
          img: 'http://ecx.images-amazon.com/images/I/21LqYBMwDGL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Xbox 360',
          img: 'http://ecx.images-amazon.com/images/I/411d9xAlGRL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Mouse',
          img: 'http://ecx.images-amazon.com/images/I/415joSK9hkL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Razor',
          img: 'http://ecx.images-amazon.com/images/I/41evRiKZvTL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Perfume',
          img: 'http://ecx.images-amazon.com/images/I/51kavLfdFVL._AA115_.jpg',
          se: 'amazon'
        },
        {
          keyword: 'Smarthone',
          img: 'http://ecx.images-amazon.com/images/I/51JOaE64EFL._AA115_.jpg',
          se: 'amazon'
        }
      ]
    },
    uk: {
      search_history: 'Search History en_gb',
      search_history_clear: 'Clear',
      search_history_clear_title: 'Clear history',
      view_history: 'Products',
      input_message: 'Please enter the product name',
      search_btn: 'Search',
      no_results: 'Oops, no result!',
      popular_search: 'Hot keywords',
      popular_search_data: [
        {
          keyword: 'Camera',
          img: 'http://ecx.images-amazon.com/images/I/41gEcoG2qJL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'GPS',
          img: 'http://ecx.images-amazon.com/images/I/41QNJqpZ6PL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'LCD TV',
          img: 'http://ecx.images-amazon.com/images/I/41q9kKNWVFL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Laptop',
          img: 'http://ecx.images-amazon.com/images/I/41Y4QtahKcL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Oral-B',
          img: 'http://ecx.images-amazon.com/images/I/21LqYBMwDGL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Xbox 360',
          img: 'http://ecx.images-amazon.com/images/I/411d9xAlGRL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Mouse',
          img: 'http://ecx.images-amazon.com/images/I/415joSK9hkL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Razor',
          img: 'http://ecx.images-amazon.com/images/I/41evRiKZvTL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Perfume',
          img: 'http://ecx.images-amazon.com/images/I/51kavLfdFVL._AA115_.jpg',
          se: 'amazonuk'
        },
        {
          keyword: 'Smarthone',
          img: 'http://ecx.images-amazon.com/images/I/51JOaE64EFL._AA115_.jpg',
          se: 'amazonuk'
        }
      ]
    },
    fr: {
      search_history: 'Mots-clés',
      search_history_clear: 'Effacer',
      search_history_clear_title: "Effacer l'historique",
      view_history: 'Produits',
      input_message: "S'il vous plaît entrez le nom du produit",
      search_btn: 'Go',
      no_results: 'Oups, pas de résultat!',
      popular_search: 'Hot mots-clés',
      popular_search_data: [
        {
          keyword: 'Appareils Photo',
          img: 'http://ecx.images-amazon.com/images/I/41gEcoG2qJL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'GPS',
          img: 'http://ecx.images-amazon.com/images/I/41QNJqpZ6PL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'TV',
          img: 'http://ecx.images-amazon.com/images/I/41q9kKNWVFL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Smartphone',
          img: 'http://ecx.images-amazon.com/images/I/51JOaE64EFL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Oral-B',
          img: 'http://ecx.images-amazon.com/images/I/21LqYBMwDGL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Xbox 360',
          img: 'http://ecx.images-amazon.com/images/I/411d9xAlGRL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Souris',
          img: 'http://ecx.images-amazon.com/images/I/415joSK9hkL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Rasoir',
          img: 'http://ecx.images-amazon.com/images/I/41evRiKZvTL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'Parfum',
          img: 'http://ecx.images-amazon.com/images/I/51kavLfdFVL._AA115_.jpg',
          se: 'amazonfr'
        },
        {
          keyword: 'iPod',
          img: 'http://ecx.images-amazon.com/images/I/51fsAvTyvXL._AA115_.jpg',
          se: 'amazonfr'
        }
      ]
    },
    de: {
      search_history: 'Schlüsselwörter',
      search_history_clear: 'Löschen',
      search_history_clear_title: 'Verlauf löschen',
      view_history: 'Produkte',
      input_message: 'Bitte geben Sie den Produktnamen',
      search_btn: 'Lot',
      no_results: 'Oops, kein Ergebnis!',
      popular_search: 'Hot Stichworte',
      popular_search_data: [
        {
          keyword: 'Kamera',
          img: 'http://ecx.images-amazon.com/images/I/41gEcoG2qJL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'GPS',
          img: 'http://ecx.images-amazon.com/images/I/41QNJqpZ6PL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Notebook',
          img: 'http://ecx.images-amazon.com/images/I/41KHT2W6raL._AA115.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'TV',
          img: 'http://ecx.images-amazon.com/images/I/515N7H5Q6nL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Oral-B',
          img: 'http://ecx.images-amazon.com/images/I/21LqYBMwDGL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Xbox 360',
          img: 'http://ecx.images-amazon.com/images/I/411d9xAlGRL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Maus',
          img: 'http://ecx.images-amazon.com/images/I/415joSK9hkL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Rasierer',
          img: 'http://ecx.images-amazon.com/images/I/41evRiKZvTL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Parfüm',
          img: 'http://ecx.images-amazon.com/images/I/51kavLfdFVL._AA115_.jpg',
          se: 'amazonde'
        },
        {
          keyword: 'Smartphone',
          img: 'http://ecx.images-amazon.com/images/I/51JOaE64EFL._AA115_.jpg',
          se: 'amazonde'
        }
      ]
    }
  };
  
  var i18n = new (ruyi.object.createClass({
    messages: null,
    locale: 'en',
    init: function(arg0) {
      $.extend(this, arg0);
    },
    setLocale: function(locale) {
      if (!(locale in this.messages)) {
        return;
      }
      this.locale = locale;
    },
    getLocale: function() {
      return this.locale;
    },
    getMessages: function(locale) {
      return this.messages[locale || this.locale];
    },
    getMessage: function(name) {
      var messages = this.getMessages();
      if(messages && name in messages) {
        return messages[name];
      } else {
        return '';
      }
    },
    render: function(locale) {
      var _this = this;
      
      locale && this.setLocale(locale);
      
      $('[rel^=i18n],[i18n]').each(function() {
        var match, i18nAttr;
        if (match = ($(this).attr('rel') || '').match(/i18n\[(.*?)\]/)) {
          var jq = $(this);
          if(jq.is('input')) {
            jq.val(_this.getMessage(match[1]));
          } else {
            jq.html(_this.getMessage(match[1]));
          }
        }
        
        //如果有i18n属性，进行属性设置
        //格式为 i18n="title:search_history_clear" 多个以逗号分隔
        (i18nAttr = $(this).attr('i18n')) 
        && $.each(i18nAttr.split(','), $.proxy(function(i, str) {
          var arr = str.split(':');
          arr.length == 2 
          && (arr[1] = _this.getMessage(arr[1])) 
          && this.attr.apply(this, arr);
        }, $(this)));
      });
    }
  }))({
    messages: msg
  });
  
  // module begin
  var module = new ruyi.module.Module({
    name: 'i18n',
    BROADCAST_TYPE: {
      READY: 'ready'
    },
    ready: function() {
      this.broadcast(this.BROADCAST_TYPE.READY, i18n.getLocale(), i18n.getMessages());
    }
  });
  // module end
  
  (new ruyi.data.ExtDS({
    conf: {
      data: {
        topic: 'get_locale'
      },
      success: function(locale) {
        i18n.render(locale||'zh');
        //因为html中默认为zh的样式，所以如果是zh就不用做处理，否则要先删除zh样式
        if(i18n.getLocale() != 'zh') {
          $('#ruyitao-selector-prefix-toolbar').removeClass('ruyitao-selector-prefix-toolbar-i18n-zh').addClass('ruyitao-selector-prefix-toolbar-i18n-' + i18n.getLocale());
        }
        module.ready();
      }
    }
  })).load();
})(ruyi.object.createPackage("ruyi.popup.i18n"), exports); })(window, exports);
