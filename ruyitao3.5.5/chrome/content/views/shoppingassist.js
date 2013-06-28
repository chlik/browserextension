(function(win, S, undefined) {
    var exports = S;
S.browser.extension.sendRequest = function(request, callback) {
  S.browser.extension.sendRequestInternal(request, function(data) {
    if ( data && typeof data == 'object' && typeof data['response'] != "undefined" ) {
      callback && callback(JSON.parse(data['response']));
    } else {
      callback && callback(data);
    }
  });
};

S.browser.extension.onRequest.addListener = function(listener) {
  S.browser.extension.onRequest.addListenerInternal(function(data, callback) {
    if (data && typeof data == 'object' && typeof data.response != 'undefined') {
      data = JSON.parse(data.response)
    }
    listener(data, callback)
  })
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
(function(S) {
  if (!S.SearchBox)
      S.SearchBox = {};
  var SELECTORS = S.transform_selector;
  S.SearchBox.Tmpl = {
    getSearchEngineSettingTemplate: function(ses, currentLocale) {
      var length = ses.length;
      var tmpl = [];
      var se;
      var name;
      var html;
      ses.reverse();
      for (var i = 0; i < length; i++) {
        se = ses[i];
        name = se.name;
        html = '<li id="' + SELECTORS('se-' + se.name) + '" class="' + SELECTORS('merchant-item') +
          '" data-se-id="' + se.name + '">' + se.title + '</li>';
        tmpl.push(html);
      }

      if (currentLocale == 'zh') {
        html = '<li id="' + SELECTORS('se-etao') + '" class="' + SELECTORS('merchant-item') + ' ' +
          SELECTORS('merchant-selected') + '" data-se-id="etao">\u6240\u6709\u5546\u57ce</li>'
        tmpl.push(html);
      }
      return tmpl.join('');
    },

    getSearchEnginesTemplate: function(ses) {
      var l = ses.length;
      var tmpl = [];
      var se;
      for (var i = 0; i < l; i++) {
        se = ses[i];
        tmpl.push('<li id="' + SELECTORS('se-' + se.name) + '" data-se-id="'
          + se.name + '" class="' + SELECTORS('se') + '" data-se-name="' + se.title + '">');
        tmpl.push('<img src="' + se.icon + '" /></li>');
        if(i == 0) {
          tmpl.push('<li class="' + SELECTORS('separator-se') + ' '
                    + SELECTORS('separator-small') + ' ' + SELECTORS('ib') + '"></li>');
        }
      }

      return tmpl.join('');
    },

    getProductsTemplate: function(products) {
      var l = products.length;
      var li;
      var loadingImg = S.SearchBox.Util.getURL('assets/images/loading.gif');
      var span = '<span class="' + SELECTORS('product-image-wrapper') + '">'
        + '<img class="' + SELECTORS('product-image') + '" src="' + loadingImg + '" />'
        + '<b class="' + SELECTORS('line-height-setter') + '"></b></span>';
      var div;
      var tmpl = [];
      var product;
      var price;
      var title;
      for (var i = 0; i < l; i++) {
        product = products[i];
        price = product.preferredPrice;
        li = '<li class="' + SELECTORS('product-item') + '" data-click-url="'
          + product.detailUrl + '">';
        if (price.substring(0, 4) != '<img') {
          price = '<span class="' + SELECTORS('product-price-wrapper') + '">' + price +'</span>';
        }
        div = '<div class="' + SELECTORS('product-price') + '">' + price + '</div>';
        tmpl.push(li + span + div + '</li>');
      }

      return tmpl.join('');
    },

    getProductDetailTemplate: function(product) {
      var tmpl = [];
      var Util = S.SearchBox.Util;
      var title = product.Title;
      var usedPrice = product.productUsedPrice;
      var price = product.productPrice;
      var fastTrack = product.productFastTrack;
      var ratingStars = product.productRatingStars;

      tmpl.push('<div id="' + SELECTORS('product-title') + '">');
      tmpl.push('<span id="' + SELECTORS('product-page-link') + '" title="'
        + title + '" data-href="'
        + product.productDetailUrl+ '">' + title + '</span>');
      tmpl.push('</div><div id="' + SELECTORS('product-price') + '">');
      tmpl.push('<span id="' + SELECTORS('product-used-price') + '">' + usedPrice + '</span>');
      tmpl.push('<span id="' + SELECTORS('product-now-price') + '">' + price + '</span>');
      tmpl.push('</div><div id="' + SELECTORS('product-image') + '">');
      tmpl.push('<img data-href="' + product.productDetailUrl
        + '" src="' + product.productImageUrl + '" />');
      tmpl.push('<span class="' + SELECTORS('line-height-setter') + '"></span></div>');
      tmpl.push('<div id="' + SELECTORS('product-fast-trick') + '">' + fastTrack + '</div>');
      tmpl.push('<div id="' + SELECTORS('product-rating-stars') + '">' + ratingStars + '</div>');

      return tmpl.join('');
    },

    getMarketsTemplate: function(markets, currentMerchantIndex) {
      var tmpl = [],
          bSeller,
          changed = false,
          market;
      for (var i = 0, l = markets.length; i < l; i++) {
        market = markets[i];
        /*tmpl.push('<li class="' + SELECTORS('market-item') + '" data-href="'
          + market.DetailUrl + '" title="' + market.Title + '">');
        if (i == 0) {
          tmpl.push('<div class="' + SELECTORS('market-name') + ' ' + SELECTORS('market-name-hightlight') + '">' + market.ShopName + '</div>');
        } else {
          tmpl.push('<div class="' + SELECTORS('market-name') + '">' + market.ShopName + '</div>');
        }
        tmpl.push('<div class="' + SELECTORS('price') + '">' + market.Price + '</div></li>');
        */
        
        if(i > 0 && !changed && market.BSeller != bSeller) {
          changed = true;
          tmpl.push('<li class="' + SELECTORS('market-icon') + ' ' + SELECTORS('market-unimportant') + '"></li>');
        }
        bSeller = market.BSeller;
        tmpl.push(this.getMarketTemplate(market, i, currentMerchantIndex));
      }
      //如果有非重点商家
      if(changed) {
        tmpl.unshift('<li class="' + SELECTORS('market-icon') + ' ' + SELECTORS('market-important') + '"></li>');
      }
      
      return tmpl.join('');
    },
    getMarketTemplate: function(market, num, currentMerchantIndex) {
      var tmpl = [];
      var currentMerchantIndexClass = '';
      if (num === currentMerchantIndex) {
        currentMerchantIndexClass = ' ' + SELECTORS('current-merchant');
      }
      tmpl.push('<li class="' + SELECTORS('market-item') + currentMerchantIndexClass +'" data-href="'
        + market.DetailUrl + '" >');
      tmpl.push('<div class="' + SELECTORS('price') + '">' + market.Price + '</div>');
      if (num == 0) {
        tmpl.push('<div class="' + SELECTORS('market-name') + ' ' + SELECTORS('market-name-hightlight') + '">' + market.ShopName + '</div>');
      } else {
        tmpl.push('<div class="' + SELECTORS('market-name') + '">' + market.ShopName + '</div>');
      }
      tmpl.push('</li>');
      
      return tmpl.join('');
    },

    getLikeItemsTemplate: function(items) {
      var tmpl = [];
      var l = items.length;
      var item;
      for (var i = 0; i < l; i++) {
        item = items[i];
        tmpl.push('<li class="ruyitao-like-product-item" data-large-image-url="' + item.LargeImageUrl +
                  '" data-title="' + item.Title + '">');
        tmpl.push('<a hideFocus="true" href="' + item.DetailPageURL + '" target="_blank" class="ruyitao-like-product-image ruyitao-log">');
        tmpl.push('<img class="ruyitao-small-image" src="' + item.SmallImageUrl + '" />');
        tmpl.push('<b class="ruyitao-line-height-setter"></b></a></li>');
      }
      return tmpl.join('');
    },

    getPriceCurveTipTemplate: function() {
      var tmpl = [];
      tmpl.push('<div id="' + SELECTORS('price-curve-tip') + '">');
      tmpl.push('<div id="' + SELECTORS('current-point-date') + '"></div>');
      tmpl.push('<div id="' + SELECTORS('current-point-price') + '"></div>');
      tmpl.push('<div id="' + SELECTORS('price-curve-arrow-down') + '"></div></div>');
      return tmpl.join('');
    },

    getPriceInfoTemplate: function(minPrice, maxPrice, nid) {
      //var selectors = SELECTORS('price-curve');
      return '\u6700\u9ad8\u4ef7\uff1a<span class="' + SELECTORS('highest-price') + '">\uffe5' + maxPrice +
        '</span>\u6700\u4f4e\u4ef7\uff1a<span class="' + SELECTORS('lowest-price') + '">\uffe5' + minPrice + '</span>';
    },

    getTopTipContentTemplate: function(type, opts) {
      var template = ''
      var moreMerchantsLinkHTML = '<a class="' + SELECTORS('check-out-more-merchants-in-tip') + '"' +
        'target="_blank" href="${moreMerchantsLink}">\u67e5\u770b\u66f4\u591a\u5546\u5bb6</a>'
      if (type == 'cheap') {
        template = '\u672c\u7f51\u7ad9\u5728\u91cd\u70b9\u5546\u5bb6\u4e2d\u4ef7\u683c' +
          '<strong>\u6700\u4f4e\uff01</strong>' + moreMerchantsLinkHTML
      } else if (type == 'expensive') {
        template = '<strong>${relativeMerchantName}</strong>\u8981\u4fbf\u5b9c<strong>' +
          '\uffe5${priceDiff}\u5143\uff01</strong><a target="_blank" href="${relativeMerchantLink}">' +
          '\u53bb\u770b\u770b</a>' + moreMerchantsLinkHTML
      }

      if (template) {
        for (var key in opts) {
          template = template.replace('${' + key + '}', opts[key])
        }
      }

      return template
    }
  }
})(exports);(function(S, win, doc, undefined) {
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
(function(S, win, undefined) {
  if (!S.SearchBox)
    S.SearchBox = {};
  var SearchBox = S.SearchBox;
  var SELECTORS = S.transform_selector;
  
  SearchBox.UI = {
    visibleProductNum: null,
    init: function() {
      
    },

    activateControlIcon: function(elem) {
      $(elem).addClass('' + SELECTORS('active-control-icon'));
      if ($(elem).hasClass('' + SELECTORS('se'))) {
        this.updateSearchEngineTitle(elem, true);
      }
    },

    inactivateControlIcon: function(elem) {
      $(elem).removeClass('' + SELECTORS('active-control-icon'));
      if ($(elem).hasClass('' + SELECTORS('se'))) {
        this.updateSearchEngineTitle(elem, false);
      }
    },

    isActiveControlIcon: function(elem) {
      return $(elem).hasClass('' + SELECTORS('active-control-icon'));
    },

    updateSearchEngineTitle: function(seElem, active) {
      var $seElem = $(seElem);
      var seName = $seElem.attr('data-se-name');
      var kw = SearchBox.App.getKeyword();
      var title = S.i18n.getMessage('search_product_in', seName, kw);
      if (active) {
        title = S.i18n.getMessage('click_to_hide');
      }
      $seElem.attr('title', title);
    },

    showOptionList: function() {
      $('#' + SELECTORS('option-list-content')).show();
    },
    hideOptionList: function() {
      $('#' + SELECTORS('option-list-content')).hide();
    },

    showSearchBar: function() {
      $('#' + SELECTORS('search-bar')).show();
      this.activateControlIcon($('#' + SELECTORS('search-icon')));
    },
    hideSearchBar: function() {
      $('#' + SELECTORS('search-bar')).hide();
      this.inactivateControlIcon($('#' + SELECTORS('search-icon')));
    },
    focusSearch: function() {
      $('#' + SELECTORS('search')).get(0).focus();
    },
    focusSearchBar: function() {
      $('#' + SELECTORS('search-bar')).addClass('' + SELECTORS('search-focus'));
    },
    blurSearchBar: function() {
      $('#' + SELECTORS('search-bar')).removeClass('' + SELECTORS('search-focus'));
    },
    searchBarStatus: function() {
      return $('#' + SELECTORS('search-bar')).is(':visible');
    },

    showSearchEngineSetting: function() {
      $('#' + SELECTORS('search-engines-setting')).show();
      this.activateControlIcon($('#' + SELECTORS('plus-btn')));
    },
    hideSearchEngineSetting: function() {
      $('#' + SELECTORS('search-engines-setting')).hide();
      this.inactivateControlIcon($('#' + SELECTORS('plus-btn')));
    },
    showSearchEngineSettingMsg: function() {
      $('#' + SELECTORS('ses-msg')).show();
    },
    hideSearchEngineSettingMsg: function() {
      $('#' + SELECTORS('ses-msg')).hide();
    },

    hideOtherPopups: function(currentPopupId) {
      $('.' + SELECTORS('popup')).filter('[id!="' + currentPopupId + '"]').hide();
    },

    hidePopups: function() {
      this.hideOptionList();
      //this.hideSearchBar();
      this.hideSearchEngineSetting();
      //var searchTitle = S.i18n.getMessage('search');
      var sesTitle = S.i18n.getMessage('search_engine_setting');
      $('#' + SELECTORS('plus-btn')).attr('title', sesTitle);
      //$('#' + SELECTORS('search-icon')).attr('title', searchTitle);
    },

    showControlBar: function() {
      if ($.browser.msie && parseInt($.browser.version) < 9) {
        $('#' + SELECTORS('controller-bar')).css('filter', '');
      } else {
        $('#' + SELECTORS('controller-bar')).css('opacity', 1);
      }
    },

    enableSearchEngineHover: function() {
      $('#' + SELECTORS('search-engines')).addClass('' + SELECTORS('se-hover-enabled'));
    },

    disableSearchEngineHover: function() {
      $('#' + SELECTORS('search-engines')).removeClass('' + SELECTORS('se-hover-enabled'));
    }
  }
})(exports, window);(function(S, doc) {
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
})(exports, document);(function(S, win) {
  if (!S.SearchBox)
    S.SearchBox = {};
  var SearchBox = S.SearchBox;
  var Util = SearchBox.Util;
  var UI = SearchBox.UI;
  var Tmpl = SearchBox.Tmpl;
  var SELECTORS = S.transform_selector;

  var MAX_PAGE_NUM_LIMIT = 10;
  
  var Products = SearchBox.Products = {
    DEFAULT_SEARCH_ENGINE: 'etao',
    BOOK_AUTHOR_SEARCH_ENGINE: 'amazoncn_book',
    SAME_PRODUCTS_SEARCH_ENGINE: 'product_search',
    keyword: '',
    searchEngine: '',
    productNumPerPage: 0,
    pageCache: null,
    maxPageNum: undefined,
    loading: false,
    arrowManualDisabled: false,
    prevArrowValid: true,
    nextArrowValid: true,
    arrowValidDelay: 200,
    
    init: function() {
      var productNum = ProductsView.calcProductNumByViewPortWidth();
      this.setProductNumPerPage(productNum);
      this.reset();
      this.registerEvents();
    },

    sendClickLog: function(url) {
      var action;
      switch (S.currentViewType) {
        case 'same':
          action = 'click_same';
          break;
        case 'recommend':
          action = 'click_like';
          break;
        case 'related':
        case 'search':
          action = 'click_search';
          break;
      }
      if (action) {
        Util.sendLog(action, url+'|'+Util.getLocationHref());
      } else {
        S.console.debug('Ready to send log but no action.');
      }
    },

    registerEvents: function() {
      var self = this;
      var $productList = $('#' + SELECTORS('product-list'));
      
      $productList.delegate('.' + SELECTORS('product-item'), 'click', function() {
        var clickUrl = $(this).attr('data-click-url');
        Util.openTab(clickUrl);
        self.sendClickLog(clickUrl);
      });

      $productList.delegate('.' + SELECTORS('product-item'), 'mouseenter', function() {
        clearTimeout(Popup.timer);
        var index = $productList.find('.' + SELECTORS('product-item')).index(this);
        var product = self.productsData[index];
        Popup.render(product);
        Popup.show(this);
      }).delegate('.' + SELECTORS('product-item'), 'mouseleave', function() {
        Popup.timer = setTimeout(function() {
          Popup.hide();
        }, Popup.delay);
      });

      $('#' + SELECTORS('prev-page-btn')).click(function() {
        if (self.hasPrevPage() && self.prevArrowValid) {
          self.prevArrowValid = false;
          var productNumPerPage = self.getProductNumPerPage();
          ProductsView.setProductListWrapperWidthByProductNum(productNumPerPage);
          ProductsView.moveProductList('prev');
          self.currentPageNum--;
          self.setArrowStatus();
          
          setTimeout(function() {
            self.prevArrowValid = true;
          }, self.arrowValidDelay);
        }
      });

      $('#' + SELECTORS('next-page-btn')).click(function() {
        if (self.hasNextPage() && self.nextArrowValid) {
          self.nextArrowValid = false;
          self.searchNextPage(function() {
            ProductsView.moveProductList('next');
            self.setArrowStatus();
            setTimeout(function() {
              self.nextArrowValid = true;
            }, self.arrowValidDelay);
          });
        }
      });
    },

    reset: function () {
      var self = this;
      this.productsData = [];
      this.maxPageNum = 0;
      this.currentPageNum = 0;
      this.loading = false;
      Clearable.cancel('searchbox_next');
      this.setSearchEngine('');
      this.setKeyword('');
      var generator = (function() {
        var pageNum = 1;
        var totalPages = undefined;
        return function(callback) {
          if (typeof totalPages == "undefined" || pageNum <= totalPages) {
            S.browser.extension.sendRequest({
              topic: 'item_search',
              Keyword: self.getKeyword(),
              SearchEngine: self.getSearchEngine(),
              ItemPage: pageNum
            }, function(response) {
              pageNum++;
              if ("Code" in response) {
                S.console.debug(response.Message);
                callback([]);
              } else {
                totalPages = response.TotalPages;
                if (totalPages)
                  return callback(response.Items);
                else
                  return callback([]);
              }
            });
          } else {
            callback([]);
          }
        };
      })();

      var productNumPerPage = this.getProductNumPerPage();
      this.pageCache =
        S.PageCache(generator, { PageSize: productNumPerPage }, true);
    },

    searchNextPage: function(cb) {
      var renderedProductsNum =
        $('#' + SELECTORS('product-list') + ' .' + SELECTORS('product-item')).length;
      var productNumPerPage = this.getProductNumPerPage();
      var frontProductsNum = productNumPerPage * this.currentPageNum;
      if (frontProductsNum < renderedProductsNum) {
        this.currentPageNum++;
        var shownProductNumber =
          Math.min(renderedProductsNum - frontProductsNum, productNumPerPage);
        ProductsView.setProductListWrapperWidthByProductNum(shownProductNumber);
        cb();
      } else {
        var searchEngine = this.getSearchEngine();
        var kw = this.getKeyword();
        this.search(searchEngine, kw, this.currentPageNum + 1, null, cb);
      }
    },

    /**
     * Search product with different search engine or keyword.
     */
    doNewSearch: function(searchEngine, kw) {
      if(searchEngine && kw) {
        this.reset();
        this.search(searchEngine, kw, 1, function() {
          ProductsView.clear();
          ProductsView.reset();
        });
      } else {
        this.renderByData(this.productsData);
      }
    },
    
    renderByData: function(productsData) {
      this.reset();
      ProductsView.hideNoResult();
      this.manualDisableAllArrow();
      ProductsView.showLoading();
      
      this.maxPageNum = 1;
      ProductsView.clear();
      ProductsView.reset();
      this.searchSuccess(productsData);
    },

    search: function(searchEngine, keyword, pageNum, beforeSuccess, afterSuccess) {
      var self = this;
      this.setSearchEngine(searchEngine);
      this.setKeyword(keyword);
      ProductsView.hideNoResult();
      this.manualDisableAllArrow();
      ProductsView.showLoading();
      
      var callback = Clearable.register('searchbox_next',
        function(results) {
          self.maxPageNum = results.TotalPages || MAX_PAGE_NUM_LIMIT;
          beforeSuccess && beforeSuccess();
          self.searchSuccess(results.Entries, afterSuccess);
        }
      );
      this.pageCache.get(pageNum, callback);
    },

    searchSuccess: function(productList, afterSuccess) {
      var self = this;
      ProductsView.hideLoading();
      this.manualEnableAllArrow();
      var productNum = productList.length;
      if (productNum) {
        productList = this.filter(productList);
        this.productsData = this.productsData.concat(productList);
        ProductsView.render(productList);
        ProductsView.setProductListWrapperWidthByProductNum(productNum);
        afterSuccess && afterSuccess();
        this.currentPageNum++;
      } else {
        this.maxPageNum = this.currentPageNum;
        setTimeout(function() {
          self.nextArrowValid = true;
        }, self.arrowValidDelay);
        if (this.currentPageNum == 0) {
          // New search.
          ProductsView.showNoResult();
        }
      }
      this.setArrowStatus();
    },

    filter: function(productList) {
      $.each(productList, function(index, item) {
        item.SmallImageUrl = item.SmallImageUrl ||
          S.browser.extension.getURL('assets/images/no_image_available.png');

        // Filter price for amazon.
        var preferredPrice = item.Price || '';
        if (preferredPrice.match(/too low/i)) {
          preferredPrice = 'Too low';
        } else if (preferredPrice.indexOf('-') != -1) {
          preferredPrice = $.trim(preferredPrice.split('-')[0]) || '&nbsp;';
        } else {
          preferredPrice = $.trim(preferredPrice) || '&nbsp;';
        }

        item.preferredPrice = preferredPrice;
      });
      return productList;
    },

    setArrowStatus: function() {
      ProductsView.disableAllArrow();
      if (this.hasPrevPage()) {
        ProductsView.enableArrowBtn('prev');
      }
      
      if (this.hasNextPage()) {
        ProductsView.enableArrowBtn('next');
      }
    },

    hasPrevPage: function() {
      return !this.arrowManualDisabled && this.currentPageNum > 1;
    },

    hasNextPage: function() {
      return !this.arrowManualDisabled && this.currentPageNum < this.maxPageNum;
    },

    manualDisableAllArrow: function() {
      this.arrowManualDisabled = true;
      ProductsView.disableAllArrow();
    },

    manualEnableAllArrow: function() {
      this.arrowManualDisabled = false;
    },

    getKeyword: function() {
      return this.keyword;
    },

    setKeyword: function(kw) {
      try {
        this.keyword = decodeURIComponent(kw);
      } catch (e) {
        this.keyword = kw;
      }
    },

    getSearchEngine: function() {
      return this.searchEngine;
    },

    setSearchEngine: function(se) {
      this.searchEngine = se;
    },

    getProductNumPerPage: function() {
      return this.productNumPerPage;
    },

    setProductNumPerPage: function(num) {
      this.productNumPerPage = num;
    }
  };

  var BAR_MARGIN_LEFT = 20;
  var BAR_MARGIN_RIGHT = 20;
  var ARRAY_BTN_WIDTH = 30;
  var PRODUCT_ITEM_WIDTH = 90;
  var MIN_PRODUCT_NUM = 3;
  var MAX_PRODUCT_NUM = 20;
  var MAX_PRODUCT_IMAGE_SIZE = 50;
  //搜索列表外框的最小宽度
  var MIN_PRODUCT_LIST_WRAPPER_WIDTH = 203;
  
  var ProductsView = SearchBox.ProductsView = {
    viewPortWidth: 0,
    resizeTimer: null,
    resizeDelay: 100,
    init: function() {
      this.viewPortWidth = Util.getViewPortWidth();
      this.registerEvents();
      Popup.init();
    },

    reset: function() {
      $('#' + SELECTORS('product-list')).hide().css('left', 0).show();
      this.disableAllArrow();
    },

    registerEvents: function() {
      var self = this;
      Util.addEvent(window, 'resize', function() {
        clearTimeout(self.resizeTimer);
        self.resizeTimer = setTimeout(function() {
          if (Util.getViewPortWidth() != self.viewPortWidth) {
            self.viewPortWidth = Util.getViewPortWidth();
            var productNum = self.calcProductNumByViewPortWidth();
            Products.setProductNumPerPage(productNum);
            var searchEngine = Products.getSearchEngine();
            var kw = Products.getKeyword();
            Products.doNewSearch(searchEngine, kw);
          }
        }, self.resizeDelay);
      });
      // self.handleClose();
    },
    
    calcProductNumByViewPortWidth: function() {
      var vpWidth = Util.getViewPortWidth();
      var plWidth =
        vpWidth - BAR_MARGIN_LEFT - BAR_MARGIN_RIGHT - ARRAY_BTN_WIDTH * 2;
      var productNum = Math.floor(plWidth / PRODUCT_ITEM_WIDTH);
      if (productNum < MIN_PRODUCT_NUM)
        productNum = MIN_PRODUCT_NUM;
      else if (productNum > MAX_PRODUCT_NUM)
        productNum = MAX_PRODUCT_NUM;
      return productNum;
    },

    setProductListWrapperWidthByProductNum: function(num) {
      var width = num * PRODUCT_ITEM_WIDTH;
      this.setProductListWrapperWidth(width);
    },
    
    show: function() {
      $('#' + SELECTORS('products-wrapper')).show();
    },

    hide: function() {
      $('#' + SELECTORS('products-wrapper')).hide();
    },
    
    render: function(productList) {
      var template = $('#' + SELECTORS('product-item-template')).html();
      var regexp = /\.(taobao|tmall)\.com/;
      var pageUrl = Util.getLocationHref(win);
      var isTB = regexp.test(pageUrl);
      $.each(productList, function(index, item) {
        var detailUrl = item.DetailPageURL;
        if (isTB && regexp.test(detailUrl)) {
          item.detailUrl = detailUrl;
        } else {
          item.detailUrl = item.ClickUrl || detailUrl;
        }
      });

      var html = Tmpl.getProductsTemplate(productList);
      S.SearchBox.Util.sanitizeHTML(html, function(html) {
        var $productList = $('#' + SELECTORS('product-list'));
        $productList.append(html);

        var $images = $productList.find('.' + SELECTORS('product-image'));
        var maxIndex = $images.length;
        var minIndex = $images.length - productList.length;
        var index = 0;
        $images.each(function(i) {
          if (i >= minIndex && i < maxIndex) {
            if ($.browser.msie && $.browser.version == '6.0')
              S.IE6Patch.fixImageMaxSize($(this), MAX_PRODUCT_IMAGE_SIZE);
            $(this).attr('src', productList[index++].SmallImageUrl);
          }
        });
      });
    },
    
    clear: function() {
      $('#' + SELECTORS('product-list')).html('');
    },
    
    showLoading: function() {
      $('#' + SELECTORS('product-list-overlay')).show();
    },

    hideLoading: function() {
      $('#' + SELECTORS('product-list-overlay')).hide();
    },

    showNoResult: function() {
      $('#' + SELECTORS('message')).show();
    },
    
    hideNoResult: function() {
      $('#' + SELECTORS('message')).hide();
    },

    hidePageTurningBtns: function() {
      $('.' + SELECTORS('arrow')).hide();
    },

    /**
     * Enable arrow button.
     * @param {String} type prev or next
     */
    enableArrowBtn: function(type) {
      $('#' + SELECTORS(type + '-page-btn')).addClass('' + SELECTORS('active-arrow'));
    },

    disableArrowBtn: function(type) {
      $('#' + SELECTORS(type + '-page-btn')).removeClass('' + SELECTORS('active-arrow'));
    },

    disableAllArrow: function() {
      this.disableArrowBtn('prev');
      this.disableArrowBtn('next');
    },

    setProductListWrapperWidth: function(width) {
      if (width < MIN_PRODUCT_LIST_WRAPPER_WIDTH && $.browser.msie && $.browser.version == '6.0') {
        width = MIN_PRODUCT_LIST_WRAPPER_WIDTH;
      }
      $('#' + SELECTORS('product-list-wrapper')).width(width);
    },

    getProductListWrapperWidth: function() {
      $('#' + SELECTORS('product-list-wrapper')).width();
    },

    /**
     * Move product list.
     * @param {String} type left or right
     */
    moveProductList: function(type) {
//      var $productListWrapper = $('#' + SELECTORS('product-list-wrapper'));
      var $productList = $('#' + SELECTORS('product-list'));
//      var width = $productListWrapper.css('width');
      var left = $productList.position().left;
      var offset = PRODUCT_ITEM_WIDTH * Products.getProductNumPerPage();
      if (type == 'next') {
        left = left - offset;
      } else if (type == 'prev') {
        left = left + offset;
      }
      $productList.css('left', left);
    }
  };

  var Popup = SearchBox.Popup = {
    timer: null,
    delay: 200,
    init: function() {
      var self = this;
      $('#' + SELECTORS('product-detail-container')).mouseenter(function() {
        clearTimeout(self.timer);
      }).mouseleave(function() {
        self.hide();
      });

      $('#' + SELECTORS('product-detail-container')).delegate(
        '#' + SELECTORS('product-page-link') + ', #' + SELECTORS('product-image') + ' > img',
        'click',
        function() {
          var url = $(this).attr('data-href');
          Util.openTab(url);
          Products.sendClickLog(url);
        });
    },

    setPosition: function(refProductItem) {
      var $productDetail = $('#' + SELECTORS('product-detail-container'));
      var offsetWidth = $productDetail.outerWidth();
      var relLeft = $(refProductItem).offset().left + PRODUCT_ITEM_WIDTH / 2;
      var left = relLeft - offsetWidth / 2 - BAR_MARGIN_LEFT;
      var viewPortWidth = Util.getViewPortWidth();
      if (left < 0)
        left = -1;
      var tmpLeft = viewPortWidth - offsetWidth - BAR_MARGIN_RIGHT - BAR_MARGIN_LEFT;
      if (left > tmpLeft)
        left = tmpLeft;
      $productDetail.css('left', left + 'px');
    },

    show: function(refProductItem) {
      $('#' + SELECTORS('product-detail-container')).show();
      this.setPosition(refProductItem);
    },

    hide: function() {
      $('#' + SELECTORS('product-detail-container')).hide();
    },

    filter: function(product) {
      product.productImageUrl = product.LargeImageUrl || product.SmallImageUrl;
      product.productUsedPrice = product.UsedPrice || '';
      product.productPrice = product.Price || '';
      product.productRatingStars = product.Stars || '';
      product.productFastTrack = product.FastTrack || '';
      var regexp = /\.(taobao|tmall)\.com/;
      var pageUrl = Util.getLocationHref(win);
      var isTB = regexp.test(pageUrl);
      var detailUrl = product.DetailPageURL;
      if (isTB && regexp.test(detailUrl)) {
        product.productDetailUrl = detailUrl;
      } else {
        product.productDetailUrl = product.ClickUrl || detailUrl;
      }
      return product;
    },

    render: function(product) {
      var $productDetail = $('#' + SELECTORS('product-detail-container'));
      var $imageContainer;
      var maxImageSize = 240;
      if (product.Popup) {
        $productDetail.addClass(SELECTORS('product-detail-container-for-etao'));
        this.renderForEtao(product);
        $imageContainer = $('#' + SELECTORS('product-image-for-etao') + ' img');
        maxImageSize = 100;
      } else {
        $productDetail.removeClass(SELECTORS('product-detail-container-for-etao'));
        product = this.filter(product);
        var template = $('#' + SELECTORS('product-detail-template')).html();
        var html = Tmpl.getProductDetailTemplate(product);
        S.SearchBox.Util.sanitizeHTML(html, function(html) {
          $('#' + SELECTORS('product-detail-container')).html('').append(html);
          $imageContainer = $('#' + SELECTORS('product-image') + ' img');
        })
      }

      if ($.browser.msie && $.browser.version == '6.0')
        S.IE6Patch.fixImageMaxSize($imageContainer, maxImageSize);
    },

    renderForEtao: function(product) {
      var popup = product.Popup;
      var $productDetail = $('#' + SELECTORS('product-detail-container'));
      if ($.trim(product.popupHTML)) {
        renderPopupForEtao(product.popupHTML);
      } else if (popup.indexOf('http://') == 0) {
        $productDetail.html('<div class="' + SELECTORS('popup-loading') + '"></div>');
        S.browser.extension.sendRequest({
          topic: "ajax",
          url: popup,
          dataType: 'text'
        }, function(html) {
          html = $.trim(html);
          if (html && typeof html == "string") {
            html = S.SearchBox.Util.replaceTemplateSelectors(html);
            S.SearchBox.Util.sanitizeHTML(html, function(html) {
              product.popupHTML = html;
              renderPopupForEtao(html);
            });
          } else {
            $productDetail.hide();
          }
        });
      } else {
        renderPopupForEtao(popup);
      }

      function renderPopupForEtao(html) {
        $productDetail.html('').append(html);
      }
    }
  };

  var Clearable = {
    callback_id: 1,
    callbacks: {},
    keys: function(obj) {
      var keys = [];
      for (var k in obj) {
        keys.push(k);
      }
      return keys;
    },

    register: function(namespace, callback) {
      var self = this;
      this.cancel(namespace);
      var callback_id = this.callback_id++;
      this.callbacks[namespace][callback_id] = callback;
      return function() {
        var callback = self.get(namespace, callback_id);
        if (callback) {
          callback.apply(callback, arguments);
          self.cancel(namespace);
        }
      }
    },

    cancel: function(namespace) {
      this.callbacks[namespace] = {};
    },

    get: function(namespace, callback_id) {
      if (typeof this.callbacks[namespace] == "object"
        && typeof this.callbacks[namespace][callback_id] == "function") {
        return this.callbacks[namespace][callback_id];
      }
    }
  };
})(exports, window);
(function(S, win, doc) {
  if (!S.SearchBox)
    S.SearchBox = {};
  var SearchBox = S.SearchBox;
  var UI = SearchBox.UI;
  var Util = SearchBox.Util;
  var SearchEngines = SearchBox.SearchEngines;
  var Products = SearchBox.Products;
  var ProductsView = SearchBox.ProductsView;

  var TEMPLATE_FILE = 'views/searchbox.html';
  var _currentSearchEngineId = null;
  var _activeControllerIcon = null;
  var _prevKeyword = null;
  var _keyword;
  var CONTROL_BAR_BOTTOM_ACTIVE = 76;
  var CONTROL_BAR_BOTTOM_INACTIVE = 0;
  var SELECTORS = S.transform_selector;
  S.SearchBox.App = {
    searchEngine: '',
    isFirstShown: false,
    expanded: true,
    
    run: function(chain) {
      var self = this;
      var domain = S.site.get_domain(doc);
      var site = S.site.get_site(domain);
      var mutationObserverRegistered = false;
      
      var siteConfigReady = function(siteConfig) {
        if (!siteConfig.config) {
          chain.run();
          return;
        }
        var searchTerm = self.getSearchTerm(siteConfig);
        S.console.debug("get search term '" + searchTerm + "'");
        if (searchTerm) {
          Util.loadJQuery();
          /*if ( !mutationObserverRegistered ) {
            mutationObserverRegistered = true;
            $('.' + SELECTORS('searchbox-protection')).registerMutationObserver({
              removedNodes: true,
              subtree: true,
              characterData: true,
              attributes: ['style', 'class']
            }, function(type, oldValue, attrName) {
              if (type == 'removedNodes') {
                self.destory();
                initSearchComparation()
              } else if (type == 'characterData') {
                $(this).html(oldValue)
              } else if (type == 'attributes') {
                $(this).attr(attrName, oldValue)
              }
            })
          }*/
          self.init(searchTerm, siteConfig.status);
        } else {
          chain.run();
        }
        self.handleAjaxSearch(domain);
      };

      function initSearchComparation() {
        SearchEngines.getAll(function() {
          if (SearchEngines.getEnabled().length > 0) {
            self.getSiteConfig(site, siteConfigReady);
          }
        });
      }

      initSearchComparation()
    },

    destory: function() {
      $('.' + SELECTORS('searchbox-protection')).remove()
    },

    getSiteConfig: function(site, cb) {
      S.browser.extension.sendRequest(
        {
          "topic": "get_site_config",
          "domain": site
        },
        cb
      );
    },

    getSearchTerm: function(siteConfig) {
      return S.site.get_search_term(siteConfig.config, doc);
    },

    getKeyword: function() {
      return _keyword;
    },

    setKeyword: function(kw) {
      _prevKeyword = _keyword;
      try {
        _keyword = decodeURIComponent(kw);
      } catch (e) {
        _keyword = '';
      }
      $('#' + SELECTORS('search')).val(_keyword);
    },

    handleAjaxSearch: function(domain) {
      var self = this;
      if (domain == 'www.amazon.cn') {
        var $kwField = $('#twotabsearchtextbox');
        var searchForm = $kwField.get(0).form;

        // 监听表单提交
        $(searchForm).submit(handleKeywordChange);

        // 监听点击搜索建议
        $kwField.change(handleKeywordChange)
        
        // 监听“相关搜索链接”
        $('#rightResultsATF').delegate('#relatedSearches a', 'mousedown', handleKeywordChange)

        // 监听浏览器前进后退
        if (history.pushState) {
          $(window).bind('popstate', handleKeywordChange)
        } else if ('onhashchange') {
          $(window).bind('hashchange', handleKeywordChange)
        }

        function handleKeywordChange() {
          setTimeout(function() {
            var keyword = $kwField.val();
            if (keyword && keyword != _keyword) {
              var searchEngine = self.getCurrentSearchEngine();
              self.setKeyword(keyword);
              if (searchEngine) {
                self.selectSearchEngine(searchEngine);
              }
            }
          }, 200)
        }
      }
    },

    init: function(searchTerm, siteStatus) {
      if ($('#' + SELECTORS('controller-bar')).length ||
          $('#' + SELECTORS('products-wrapper')).length)
        return;
      var self = this;

      this.fixFlash();
      S.SearchBox.Util.getTemplate("views/searchbox.html", function(template) {
        Util.randomAppend(document.body, template);
        SearchEngines.init();
        self.doI18n();
        self.registerEvents();
        S.currentViewType = 'search'

        var firstSearchEngine = SearchEngines.getEnabled()[0].name;
        Products.init();
        ProductsView.init();
        Util.handleSogou();

        var setKeywordAndInitSearch = function (keyword) {
          self.setKeyword(keyword);
          SearchEngines.renderSearchEngineSettingHtml();

          if ($.browser.msie && $.browser.version == '6.0') {
            S.IE6Patch.init();
          }

          self.selectSearchEngine(firstSearchEngine);
          if (!siteStatus) {
            Products.doNewSearch(firstSearchEngine, keyword);
            self.hideControlBar();
            ProductsView.hide();
            self.showShrinkBar();
          } else {
            ProductsView.show();
            self.showControlBar();
          }

          Util.sendLog('show_search', Util.getLocationHref());
        };

        if (typeof searchTerm == "object" &&
          typeof searchTerm.getUnicode == "function") {
          searchTerm.getUnicode(setKeywordAndInitSearch);
        } else {
          setKeywordAndInitSearch(searchTerm);
        }
      });
    },

    fixFlash: function() {
      // fix flash overlay
      var embeds = $('embed[type="application/x-shockwave-flash"]');
      var embedClone = null;
      $.each(embeds, function(aIndex, aNode) {
        embedClone = $(aNode).clone(true);
        embedClone.attr("wmode", "transparent");
        $(aNode).replaceWith(embedClone);
      });
    },

    showControlBar: function() {
      $('#' + SELECTORS('controller-bar')).show();
    },

    hideControlBar: function() {
      $('#' + SELECTORS('controller-bar')).hide();
    },

    showShrinkBar: function() {
      $('#' + SELECTORS('shrink-bar')).show();
    },

    hideShrinkBar: function() {
      $('#' + SELECTORS('shrink-bar')).hide();
    },

    registerEvents: function() {
      var self = this;

      $('#' + SELECTORS('close-btn')).click(function() {
        self.hideControlBar();
        ProductsView.hide();
        self.setSiteStatus('search', false);
        self.showShrinkBar();
      });

      $(document).click(function(e) {
        var target = e.target;
        if (!$(target).is('.' + SELECTORS('popup')) &&
            !$(target).parents('.' + SELECTORS('popup')).is('.' + SELECTORS('popup'))) {
          self.resetPopups();
        }
      });

      $('#' + SELECTORS('search-form')).submit(function(e) {
        e.preventDefault();
        var kw = $.trim($('#' + SELECTORS('search')).val());
        if (kw) {
          self.setKeyword(kw);
          self.selectSearchEngine(self.searchEngine);
          clearTimeout(self.hideControlBarTimer);
        }
      });
      this._registerSearchBarEvents();

      var merchantsSelectionTimer = null;
      var $merchantsSelectionWrapper = $('#' + SELECTORS('merchants-selection-wrapper'));

      // 显示商城列表
      $('#' + SELECTORS('merchants-selection-handler')).mouseenter(function() {
        $merchantsSelectionWrapper.show();
      }).mouseleave(function() {
        merchantsSelectionTimer = setTimeout(function() {
          $merchantsSelectionWrapper.hide()
        }, 0)
      })

      $merchantsSelectionWrapper.mouseenter(function() {
        clearTimeout(merchantsSelectionTimer)
      }).mouseleave(function() {
        $(this).hide();
      });

      // Handle logo click
      $('#' + SELECTORS('search-logo')).click(function() {
        var url = 'http://ruyi.taobao.com/?utm_medium=ext&utm_source=ruyi';
        S.SearchBox.Util.openTab(url, true);
      });

      $('#' + SELECTORS('merchant-list')).delegate('.' + SELECTORS('merchant-item'), 'click', function() {
        var merchantSelectedClass = SELECTORS('merchant-selected')
        var $this = $(this)
        $this.siblings('.' + merchantSelectedClass).removeClass(merchantSelectedClass);
        $this.addClass(merchantSelectedClass);
        $('#' + SELECTORS('current-merchant-name')).text($this.text())

        // 切换商城搜索
        var searchEngineId = $this.attr('data-se-id');
        if (searchEngineId != self.getCurrentSearchEngine()) {
          self.setSiteStatus('search', true);
          self.selectSearchEngine(searchEngineId);
        }
      });

      $('#' + SELECTORS('shrink-bar')).click(function() {
        self.hideShrinkBar();
        ProductsView.show();
        self.showControlBar();
        self.setSiteStatus('search', true);
      })
    },

    _registerSearchBarEvents: function() {
      var timer, 
          delayTime = 200;
      $('#' + SELECTORS('search')).focus(function(e) {
        UI.focusSearchBar();
      }).blur(function(e) {
        if(timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(function() {
          UI.blurSearchBar();
        }, delayTime);
      });
      $('#' + SELECTORS('search-btn')).click(function() {
        if(timer) {
          clearTimeout(timer);
        }
        UI.focusSearch();
      });
    },
    
    /**
     * Set control bar position.
     * @param {String} type Control bar position, active or inactive.
     */
    setPosition: function(type) {
      if ($.browser.msie && $.browser.version == '6.0') {
        var barPosition;
        if (type == 'active') {
          barPosition = CONTROL_BAR_BOTTOM_ACTIVE;
        } else if (type == 'inactive') {
          barPosition = CONTROL_BAR_BOTTOM_INACTIVE;
        }
        S.IE6Patch.setBarPosition(barPosition);
        S.IE6Patch.resetPosition();
      } else {
        var positionClass = SELECTORS(type + '-position');
        var className = SELECTORS('wrapper') + ' ' + SELECTORS('searchbox-protection') + ' ' + positionClass;
        $('#' + SELECTORS('controller-bar')).attr('class', className);
      }
    },

    getSiteStatus: function(type, cb) {
      S.browser.extension.sendRequest({
        topic: 'get_site_status',
        type: type,
        domain: S.site.get_site(S.site.get_domain(doc))
      }, function(status) {
        // status: false means the product list is hidden; true is visible.
        cb(status);
      });
    },

    setSiteStatus: function(type, status) {
      S.browser.extension.sendRequest({
        topic: 'set_site_status',
        domain: S.site.get_site(S.site.get_domain(doc)),
        type: type,
        status: status
      });
    },

    checkCurrentSearchEngineIsEnabled: function() {
      var enabledSearchEngines = SearchEngines.getEnabled();
      var currentSearchEngine = this.getCurrentSearchEngine();
      for (var i = 0, l = enabledSearchEngines.length; i < l; i++) {
        if (enabledSearchEngines[i].name == currentSearchEngine)
          return true;
      }
      return false;
    },

    selectSearchEngine: function(seId) {
      this.searchEngine = seId;
      var $seElem = $('#' + SELECTORS('se-' + seId));
      if (seId != Products.getSearchEngine() ||
          _prevKeyword != this.getKeyword()) {
        $seElem.addClass(SELECTORS('merchant-selected'));
        $('#' + SELECTORS('current-merchant-name')).text($seElem.text())
        Products.doNewSearch(seId, this.getKeyword());
      }
      ProductsView.show();
      this.setCurrentSearchEngine(seId);
    },

    resetPopups: function() {
      UI.hidePopups();
      this.setActiveControllerIcon(null);
    },

    getActiveControllerIcon: function() {
      return _activeControllerIcon;
    },

    setActiveControllerIcon: function(iconId) {
      _activeControllerIcon = iconId;
    },

    getCurrentSearchEngine: function() {
      return _currentSearchEngineId;
    },
    setCurrentSearchEngine: function(seId) {
      _currentSearchEngineId = seId;
    },

    doI18n: function () {
      var locale = SearchEngines.getLocale();
      var i18nAttr;
      var i18nType;
      var i18nMsg;
      var self = this;

      // Global i18n
      $('.' + SELECTORS('wrapper') + ' [data-i18n]').each(function() {
        i18nAttr = $(this).attr('data-i18n');
        i18nType = i18nAttr.split('->');
        i18nMsg = i18nType[1];
        if (i18nType[0] == 'content') {
          $(this).html(S.i18n.getMessage(i18nMsg));
        } else if (i18nType[0] == 'attribute') {
          i18nMsg = i18nMsg.split(':');
          $(this).attr(i18nMsg[0], S.i18n.getMessage(i18nMsg[1]));
        }
      });

      if (locale == 'zh') {
        var imgSrc = Util.getURL('assets/images/search/search-cn.png');
        $('#' + SELECTORS('search-icon') + ' img').attr('src', imgSrc);
      } else {
        $('#' + SELECTORS('search-logo')).hide();
        $('#' + SELECTORS('non-zh-logo')).show();
        $('#' + SELECTORS('shrink-bar')).addClass(SELECTORS('shrink-bar-en'))
          .attr('title', 'Click to show Shopping Assistant');
        $('#' + SELECTORS('merchants-selection-wrapper')).css('left', '76px');
      }
    }
  }
})(exports, window, document);;(function(S, win) {
  var doc = win.document;
  var SELECTORS = S.transform_selector;
  S.ControlBar = {

    init: function(barPositionType) {
      this.bindEvents();
      this.setPosition(barPositionType);
      if ($.browser.msie && $.browser.version == '6.0') {
        S.IE6Patch.init();
      }
    },

    bindEvents: function() {
      $('#' + SELECTORS('products-close-btn')).click(function() {
        $('#' + SELECTORS('products-wrapper')).hide();
      });
      
      this._registerSearchBarEvents();
    },

    _registerSearchBarEvents: function() {
      var self = this,
          timer, 
          delayTime = 200;
      $('#' + SELECTORS('search')).focus(function(e) {
        self.focusSearchBar();
      }).blur(function(e) {
        if(timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(function() {
          self.blurSearchBar();
        }, delayTime);
      });
      $('#' + SELECTORS('search-btn')).click(function() {
        if(timer) {
          clearTimeout(timer);
        }
        self.focusSearch();
      });
    },

    CONTROL_BAR_BOTTOM_WITH_PRICE_COMPARATION: 46,
    CONTROL_BAR_BOTTOM_WITH_SEARCH: 76,
    CONTROL_BAR_BOTTOM_WITH_NOTHING: 0,

    /**
     * Set controller bar's position
     * @param {String} type product, search or hide
     */
    setPosition: function(type) {
      if ($.browser.msie && $.browser.version == '6.0') {
        var barPosition;
        if (type == 'product') {
          barPosition = this.CONTROL_BAR_BOTTOM_WITH_PRICE_COMPARATION;
        } else if (type == 'search') {
          barPosition = this.CONTROL_BAR_BOTTOM_WITH_SEARCH;
        } else if (type == 'hide') {
          barPosition = this.CONTROL_BAR_BOTTOM_WITH_NOTHING;
        }
        S.IE6Patch.setBarPosition(barPosition);
        S.IE6Patch.resetPosition();
      } else {
        var addedClass = SELECTORS(type + '-bottom');
        var className = SELECTORS('wrapper') + ' ' + SELECTORS('products-protection') + ' ' + addedClass;
        $('#' + SELECTORS('controller-bar')).attr('class', className)
          
      }
    },

    showSearchBar: function() {
      $('#' + SELECTORS('search-bar')).show();
      //$('#' + SELECTORS('search')).get(0).focus();
    },

    hideSearchBar: function() {
      $('#' + SELECTORS('search-bar')).hide();
    },
    focusSearch: function() {
      $('#' + SELECTORS('search')).get(0).focus();
    },
    focusSearchBar: function() {
      $('#' + SELECTORS('search-bar')).addClass('' + SELECTORS('search-focus'));
    },
    blurSearchBar: function() {
      $('#' + SELECTORS('search-bar')).removeClass('' + SELECTORS('search-focus'));
    },
    
    setKeyword: function(kw) {
      $('#' + SELECTORS('search')).val(kw);
    }
  };
})(exports, window);(function(win, S) {
  // rely on shoppingassist.js
  var site = S.site;
  var extension = S.browser.extension;
  var doc = win.document;
  var Util = S.SearchBox.Util;
  var SELECTORS = S.transform_selector;

  function debug() {
    // console.log.apply(console, arguments);
  }

  function extractItem(category) {
    var result,
      nodeList,
      i = category.length,
      c,
      regexp;

    for (; i--;) {
      c = category[i];
      nodeList = $(c.xpath);
      regexp = new RegExp(c.regexp, "i");

      $.each(nodeList, function() {
        var html = this.innerHTML || '',
          tmp;

        if ((tmp = html.match(regexp))) {
          result = tmp[1];
          return false; // break loop
        }
      });
    }
    return result;
  }

  function extractInfo(conf) {
    var p,
      book_meta = {};
    if (!conf) {
      return;
    }
    for (p in conf) {
      if ( conf.hasOwnProperty(p) ) {
        book_meta[p] = extractItem(conf[p]);
      }
    }
    debug(book_meta);
    return book_meta;
  }

  S.shareWeibo = function(params) {
    var e = encodeURIComponent,
      s = window.screen,
      p = [],
      f = 'http://v.t.sina.com.cn/share/share.php?';
    for (name in params) {
      if (params.hasOwnProperty(name)) {
        p.push(name + '=' + e(params[name]));
      }
    }
    p.push('appkey=1965387856');
    f += p.join('&');
    window.open(f, 'mb',
      ['toolbar=0,status=0,resizable=1,width=620,height=450,left=',
        (s.width - 620) / 2, ',top=', (s.height - 450) / 2].join(''));
  };

  var LOGO_WIDTH = 97;
  var MARGIN_WIDTH = 20;
  //var MARKET_ITEM_WIDTH = 155;
  var MORE_RESULTS_WRAPPER_WIDTH = 260;
  var MIN_MARKET_NUM = 2;
  //var MAX_MARKET_NUM = 20;
  
  var pcUI = S.PriceComparationsUI = {
    viewPortWidth: 0,
    _ICON_CLASSNAME: SELECTORS('market-icon'),
    /*每一个Item累加的宽度
     * [
     *   {
     *     isIcon:Boolean,//是否为icon分隔符
     *     width:Number//宽度
     *   }
     *   ...
     * ]
     */
    _widthArr: null,
    init: function(/*num*/) {
      this.viewPortWidth = document.documentElement.clientWidth;
      //var marketNum = this.calcMarketNumByViewPortWidth(num);
      //this.setMarketListWrapperWIdthByMarketNum(marketNum);
      this._widthArr = this._getMarketListWidthArr();
      this.adjustMarketListWidth();
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;
      var handler = S.debounce(function() {
        if (document.documentElement.clientWidth != self.viewPortWidth) {
          self.viewPortWidth = document.documentElement.clientWidth;
          /*var marketNum =
            self.calcMarketNumByViewPortWidth(S.ItemBar.productNum);
          self.setMarketListWrapperWIdthByMarketNum(marketNum);*/
          self.adjustMarketListWidth();
          S.ItemBar.markCurrentMerchant();
        }
      });
      Util.addEvent(window, 'resize', handler);
    },
    
    _getMarketListWidthArr: function() {
      var self = this,
          isHide = $('#' + SELECTORS('price-comparation-wrapper')).is(':hidden'),
          width = 0,
          arr = [];
      if(isHide) {
        $('#' + SELECTORS('price-comparation-wrapper')).css({visible:'hidden'}).show();
      }
      $('#' + SELECTORS('market-list') + ' li').each(function(i, li) {
        width += $(li).outerWidth(true);
        arr.push({isIcon:$(li).hasClass(self._ICON_CLASSNAME), width:width});
      });
      if(isHide) {
        $('#' + SELECTORS('price-comparation-wrapper')).hide().css({visible:''});
      }
      return arr;
    },
    
    adjustMarketListWidth: function() {
      var self = this,
          width,
          temp,
          vpWidth = document.documentElement.clientWidth,
          mlWidth = vpWidth - LOGO_WIDTH - MARGIN_WIDTH - MORE_RESULTS_WRAPPER_WIDTH,
          hideIconFlag = false;
      for(var i = this._widthArr.length-1; i>=0; i--) {
        temp = this._widthArr[i];
        width = temp.width;
        hideIconFlag = hideIconFlag || temp.isIcon;
        //如果this._widthArr[0]为重点商家的图标，隐藏后需要减掉该宽度
        if(hideIconFlag && this._widthArr[0].isIcon) {
          width -= this._widthArr[0].width;
        }
        if(i < MIN_MARKET_NUM || width <= mlWidth) {
          //如果是图标分隔符，宽度需要设置到上一个商品
          if(temp.isIcon) {
            continue;
          }
          break;
        }
      }
      if(hideIconFlag) {
        self.hideIcon();
      } else {
        self.showIcon();
      }
      this.setMarketListWidth(width + 2);
    },
    
    showIcon: function() {
      $('#' + SELECTORS('price-comparation-wrapper') + ' .' + this._ICON_CLASSNAME).show();
    },

    hideIcon: function() {
      $('#' + SELECTORS('price-comparation-wrapper') + ' .' + this._ICON_CLASSNAME).hide();
    },
    
    setMarketListWidth: function(width) {
      $('#' + SELECTORS('market-list')).width(width);
    },

    show: function() {
      $('#' + SELECTORS('price-comparation-wrapper')).show();
    },

    hide: function() {
      $('#' + SELECTORS('price-comparation-wrapper')).hide();
    }
  };

  S.ItemBar = {
    _max_items: undefined,
    _loading: false,
    _page_size: undefined,
    _total_pages: undefined,
    _page: 0,

    _has_more_books: false,

    moreBooksOfAuthor: null,
    productNum: 0,
    priceComparationInfo: {
      valid: false,
      type: '', // expensive or cheap
      currentPrice: undefined,
      currentMerchantName: '',
      productTitle: '',
      relativeMerchantName: '',
      priceDiff: undefined
    },

    destory: function() {
      $('#' + SELECTORS('products-style')).remove()
      $('#' + SELECTORS('controller-bar')).remove()
      $('#' + SELECTORS('products-wrapper')).remove()
      $('#' + SELECTORS('price-comparation-wrapper')).remove()
    },

    initPriceComparation: function(options) {
      var self = this;
      var productList = options.productList;
      var product = options.product;
      this.productNum = productList.length;
      S.SearchBox.Util.getTemplate("views/products.html", function(template) {
        Util.randomAppend(document.body, template);
        setTimeout(function() {

          // 修复 IE 下 STYLE 或 LINK 超过 31 个的时候如意淘样式表失效的问题
          if ($.browser.msie) {
            var mergeResult = Util.mergeStyleSheets();
            if (!mergeResult) {
              self.destory()
            }
            if ($.browser.version == '6.0') {
              S.IE6Patch.init();
            }
          }

          S.SearchBox.Products.init();
          S.SearchBox.ProductsView.init();

          var currentMerchantIndex = self.calcCurrentMerchantIndex(productList, product);
          self.renderMarketList(productList, currentMerchantIndex);

          /*var productNumber = productList.length;
          if (options._max_items)
            productNumber = Math.min(productNumber, self._max_items);*/
          pcUI.init(/*productNumber*/);
          pcUI.show();
          self.markCurrentMerchant();

          S.SearchBox.App.getSiteStatus('price_compare', function(status) {
            if (!status) {
              pcUI.hide();
              self.showShrinkBar();
            } else {
              self.sendShowLog('show_product', productList);
            }
          });

          self.bindEvents(product, productList);
          self.checkMoreBooksOfAuthor(options.book_author);
          
          Util.handleSogou();

        }, 0);
      });
    },

    calcCurrentMerchantIndex: function(productList, product) {
      var currentMerchantIndex;
      for (var i = 0, l = productList.length; i < l; i++) {
        if (product.ItemNid && product.ItemNid == productList[i].nid) {
          currentMerchantIndex = i;
          break;
        }
      }
      return currentMerchantIndex;
    },

    markCurrentMerchant: function() {
      var merchantItemWidth = 120;
      var downArrowWidth = 12;
      var $currentMerchantItem = $('.' + SELECTORS('current-merchant')).eq(0);
      var $currentMerchantCursor = $('#' + SELECTORS('current-merchant-cursor'));
      var $marketList = $('#' + SELECTORS('market-list'));
      var $merchants = $marketList.find('.' + SELECTORS('market-item'));
      var maxVisibleMerchantsNumber = parseInt($marketList.width() / merchantItemWidth);

      if ($currentMerchantItem.length &&
          $merchants.index($currentMerchantItem) <= maxVisibleMerchantsNumber - 1) {
        var position = $currentMerchantItem.position();
        var left = position.left + (merchantItemWidth - downArrowWidth) / 2;
        $currentMerchantCursor.show().css('left', left + 'px');
      } else {
        $currentMerchantCursor.hide();
      }
    },

    isSameProduct: function(product) {
      //Epid >= 3E14
      return product && product.Epid && product.Epid.length > 14 && product.Epid.charAt(0) >= 3;
    },

    initSame: function(options) {
      var self = this;
      var productList = options.productList;
      this.productNum = productList.length;
      this.sameProductsKeyword = options.Keyword;

      S.SearchBox.Util.getTemplate("views/products.html", function(template) {
        Util.randomAppend(document.body, template);
        self.updateLogo('same');
        S.currentViewType = 'same';
        S.SearchBox.ProductsView.hidePageTurningBtns();

        // 修复 IE 下 STYLE 或 LINK 超过 31 个的时候如意淘样式表失效的问题
        if ($.browser.msie) {
          Util.mergeStyleSheets();
          if ($.browser.version == '6.0') {
            S.IE6Patch.init();
          }
        }
        
        S.SearchBox.Products.init();
        S.SearchBox.ProductsView.init();
        S.SearchBox.Products.doNewSearch(S.SearchBox.Products.SAME_PRODUCTS_SEARCH_ENGINE, self.sameProductsKeyword);
        
        self.handleLogoClick()

        S.SearchBox.App.getSiteStatus('price_compare', function(status) {
          if (status) {
            S.SearchBox.ProductsView.show();
            self.sendShowLog('show_same', productList);
          } else {
            S.SearchBox.ProductsView.hide();
            self.showShrinkBar();
          }
        });
        
        self.checkMoreBooksOfAuthor(options.book_author);
        Util.handleSogou();
        self.handleShrink('same', productList);
      });
    },

    sendShowLog: function(type, productList) {
      var url = Util.getLocationHref();
      if ( productList && typeof productList[0] == "object" && typeof productList[0].DetailPageURL != "undefined" ) {
        Util.sendLog(type, Util.appendTraceParameter(url, productList[0].DetailPageURL));
      } else {
        Util.sendLog(type, url);
      }
    },

    initLike: function(options) {
      var self = this;
      var productList = options.productList;
      this.productNum = productList.length;

      //this.sameProductsKeyword = options.Keyword;
      S.SearchBox.Util.getTemplate('views/products.html', function(template) {
        Util.randomAppend(document.body, template);
        self.updateLogo('recommend');
        S.currentViewType = 'recommend';
        S.SearchBox.ProductsView.hidePageTurningBtns();

        // 修复 IE 下 STYLE 或 LINK 超过 31 个的时候如意淘样式表失效的问题
        if ($.browser.msie) {
          Util.mergeStyleSheets();
          if ($.browser.version == '6.0') {
            S.IE6Patch.init();
          }
        }
        
        S.SearchBox.Products.init();
        S.SearchBox.ProductsView.init();
        S.etaoLike.render(productList);
        self.handleLogoClick()
        
        S.SearchBox.App.getSiteStatus('price_compare', function(status) {
          if (status) {
            S.SearchBox.ProductsView.show();
            self.sendShowLog('show_like', productList);
          } else {
            S.SearchBox.ProductsView.hide();
            self.showShrinkBar();
          }
        });

        self.checkMoreBooksOfAuthor(options.book_author);
        Util.handleSogou();
        self.handleShrink('like', productList);
      });
    },

    initRelated: function(kw) {
      var self = this;

      S.SearchBox.Util.getTemplate("views/products.html", function(template) {
        Util.randomAppend(document.body, template);
        self.updateLogo('similar');
        S.currentViewType = 'related';

        if ($.browser.msie) {
          var mergeResult = Util.mergeStyleSheets();
          if (!mergeResult) {
            self.destory()
          }
          if ($.browser.version == '6.0') {
            S.IE6Patch.init();
          }
        }

        S.SearchBox.Products.init();
        S.SearchBox.ProductsView.init();

        if ( kw.length > 0 ) {
          S.SearchBox.Products.doNewSearch(S.SearchBox.Products.DEFAULT_SEARCH_ENGINE, kw);
          self.handleLogoClick();
          S.SearchBox.App.getSiteStatus('price_compare', function(status) {
            if (status) {
              S.SearchBox.ProductsView.show();
              self.sendShowLog('show_product');
            } else {
              S.SearchBox.ProductsView.hide();
              self.showShrinkBar();
            }
          });
        }

        Util.handleSogou();
        self.handleShrink('related');
      });
    },

    initSearch: function() {
      var self = this;
      S.SearchBox.Util.getTemplate("views/products.html", function(template) {
        Util.randomAppend(document.body, template);
        
        // 更新 logo
        $('#' + SELECTORS('price-comparation-logo')).addClass(SELECTORS('search-logo')).attr('title', '\u5982\u610f\u6dd8 - \u641c\u7d22');

        // 更改搜索表单样式
        $('#' + SELECTORS('price-comparation-wrapper')).height(30)
        $('#' + SELECTORS('search-wrapper')).show();

        // 隐藏无关元素
        $('#' + SELECTORS('more-results-link')).hide();
        $('#' + SELECTORS('func-btns-wrapper')).hide();

        if ($.browser.msie) {
          var mergeResult = Util.mergeStyleSheets();
          if (!mergeResult) {
            self.destory()
          }
          if ($.browser.version == '6.0') {
            S.IE6Patch.init();
          }
        }

        pcUI.show();

        self.handleSearch();
        self.handleLogoClick();
        self.handleClose();
        // Util.sendLog('show_product', document.location.href);
        Util.handleSogou();
        $('#' + SELECTORS('search-field')).focus();
      });
    },

    /**
     * Change the logo at the front of product list.
     * @param {String} type Can be recommend, same or similar
     */
    updateLogo: function(type) {
      var logoNames = {
        same: '\u540c\u6b3e\u5546\u54c1',
        recommend: '\u5546\u54c1\u63a8\u8350',
        similar: '\u76f8\u5173\u5546\u54c1'
      }
      $('#' + SELECTORS('logo')).attr('title', '\u5982\u610f\u6dd8 - ' + logoNames[type])
        .addClass(SELECTORS(type + '-logo'));
    },

    bindEvents: function(product, productList) {
      var self = this;
      var rel = Util.getLocationHref();
      $('#' + SELECTORS('market-list')).delegate('.' + SELECTORS('market-item'), 'click', function() {
        if (!$(this).hasClass(SELECTORS('current-merchant'))) {
          var url = $(this).attr('data-href');
          Util.openTab(url);
          Util.sendLog('click_product', url + '|' + rel);
        }
      });

      $('#' + SELECTORS('more-results-link')).click(function() {
        S.SearchBox.Util.openTab(product.DetailPageURL, true);
        Util.sendLog('click_product', product.DetailPageURL + '|' + rel);
      });

      var quote = product.book ? ['\u300a', '\u300b'] : ['\u201c', '\u201d'];
      var url = product.DetailPageURL;
      var imageUrl;
      if ( product.SmallImageUrl ) {
        imageUrl = product.SmallImageUrl.replace('_80x80.jpg', '');
      }

      var productTitle = product.Title;
      var options
      
      this.shareWeiboImpl = function() {
        if (!options) {
          var shareText = S.Share.getContentTemplate('ca', {
            productTitle: quote[0] + productTitle + quote[1]
          });

          var tmplType
          var pci = self.priceComparationInfo
          if (pci.valid) {
            if (pci.priceDiff != 0) {
              tmplType = 'pk_' + pci.type
              shareText = S.Share.getContentTemplate(tmplType, pci)
            }
          }

          options = {
            siteId: 'sina_weibo',
            text: shareText,
            url: url,
            imageType: 'simple',
            imageUrl: imageUrl
          };
        }

        if (S.Share.supportSimpleShare) {
          options.custom = true;
        }
        S.Share.handleRequest(options);
      };
      
      //纠错链接
      $('#' + SELECTORS('error-link')).click(function() {
        var nid = '';
        if ( typeof product.ItemNid != "undefined" ) {
          nid = product.ItemNid;
        }
        S.SearchBox.Util.openFeedback(product.Epid, nid);
      });
      
      //价格曲线中的分享
      S.PriceCurve.triggerShareWeibo();

      var replaceBracketsRe = /(?:\(|\uff08)[^(^)^\uff08^\uff09]+(?:\)|\uff09)/g;
      var replacedProductTitle = productTitle.replace(replaceBracketsRe, '');
      var searchInTaobaoUrl = 'http://s.taobao.com/search?tb_lm_id=ryt_ext&q=';
      S.browser.extension.sendRequest({
        topic: 'encode_gbk',
        str: replacedProductTitle
      }, function(encodedStr) {
        if (encodedStr) {
          searchInTaobaoUrl += encodedStr;
        }
      });

      var searchInTaobaoTitle = '\u5728\u6dd8\u5b9d\u641c\u7d22\u201c' + replacedProductTitle + '\u201d';
      $('#' + SELECTORS('search-in-taobao-icon')).attr('title', searchInTaobaoTitle).click(function() {
        S.SearchBox.Util.openTab(searchInTaobaoUrl, true);
        Util.sendLog('click_product', searchInTaobaoUrl + '|' + rel);
      });

      this.handleLogoClick();
      this.handleShrink('price_compare', productList);
    },

    showShrinkBar: function() {
      $('#' + SELECTORS('shrink-bar')).show();
    },

    hideShrinkBar: function() {
      $('#' + SELECTORS('shrink-bar')).hide();
    },

    handleShrink: function(type, productList) {
      var self = this;
      $('#' + SELECTORS('price-comparation-close-btn')).click(function() {
        $('#' + SELECTORS('price-comparation-wrapper')).hide();
        self.showShrinkBar();
        S.SearchBox.App.setSiteStatus('price_compare', false);
      });

      $('#' + SELECTORS('products-close-btn')).click(function() {
        S.SearchBox.ProductsView.hide();
        self.showShrinkBar()
        S.SearchBox.App.setSiteStatus('price_compare', false);
      });

      $('#' + SELECTORS('shrink-bar')).click(function() {
        self.hideShrinkBar();
        if (type == 'price_compare') {
          pcUI.show();
          self.sendShowLog('show_product', productList);
        } else {
          S.SearchBox.ProductsView.show();
          if (type == 'same') {
            self.sendShowLog('show_same', productList);
          } else if (type == 'related') {
            self.sendShowLog('show_product', productList);
          } else if (type == 'like') {
            self.sendShowLog('show_like', productList);
          }
        }
        S.SearchBox.App.setSiteStatus('price_compare', true);
      });
    },

    handleClose: function() {
      $('#' + SELECTORS('price-comparation-close-btn')).click(function() {
        $('#' + SELECTORS('price-comparation-wrapper')).remove();
      });
    },

    handleSearch: function() {
      var self = this;
      var searchFieldBlurTimer = null;
      var etaoSearchBaseUrl = 'http://s.etao.com/search?tb_lm_id=ryt_ext&q=';

      $('#' + SELECTORS('search-field')).focus(function() {
        $(this).addClass(SELECTORS('search-field-focused'));
      }).blur(function() {
        var $this = $(this);
        searchFieldBlurTimer = setTimeout(function() {
          $this.removeClass(SELECTORS('search-field-focused'));
        }, 100);
      });

      // 搜索框提交事件
      $('#' + SELECTORS('search-form')).submit(function(e) {
        e.preventDefault();
        clearTimeout(searchFieldBlurTimer);
        var keyword = $('#' + SELECTORS('search-field')).val();
        keyword = $.trim(keyword);
        if (keyword) {
          S.SearchBox.Util.openTab(etaoSearchBaseUrl + keyword, true);
        } else {
          $('#' + SELECTORS('search-btn')).blur();
          $('#' + SELECTORS('search-field')).focus();
        }
      });
    },

    handleLogoClick: function() {
      var url = 'http://ruyi.taobao.com/?utm_medium=ext&utm_source=ruyi';
      $('.' + SELECTORS('logo')).click(function() {
        S.SearchBox.Util.openTab(url, true);
      })
    },
    
    /*checkShareWeibo: function() {
      var ele = $('#ruyitao-forward-link'),
          events;
      return ele.length > 0 
              && (events=ele.data('events')) 
              && events.click
              && events.click.length > 0;
    },*/
    shareWeiboImpl: null,
    shareWeibo: function() {
      if (this.shareWeiboImpl && typeof this.shareWeiboImpl == 'function') {
        this.shareWeiboImpl();
      }
    },
    
    renderMarketList: function(items, currentMerchantIndex) {
      $.each(items, function(index, item) {
        item.DetailUrl = item.ClickUrl || item.DetailPageURL;
      });
      var html = S.SearchBox.Tmpl.getMarketsTemplate(items, currentMerchantIndex);
      $('#' + SELECTORS('market-list')).html(html);
    },

    fillMoreBookList: function(books) {
      var books = this.moreBooksOfAuthor;
      var $bookList = $('#' + SELECTORS('book-list'));
      var i = 0;
      var len = Math.min(books.length, 6);
      var bookListHTML = [];
      for (; i < len; i++) {
        var book = books[i];
        bookListHTML.push('<li class="' + SELECTORS('book-item') + '">');
        bookListHTML.push('<a target="_blank" href="'
          + (book.ClickUrl || book.DetailPageURL)
          + '">' + book.Title + '</a>');
        bookListHTML.push('</li>');
        if (i != len - 1)
          bookListHTML.push('<li class="' + SELECTORS('book-separater') + '"></li>');
      }
      $bookList.html(bookListHTML.join(''));
    },

    hideAuthorIcon: function() {
      $('#' + SELECTORS('author-icon')).hide();
    },

    checkMoreBooksOfAuthor: function(author) {
      var self = this
      if (!author) {
        self.hideAuthorIcon();
        return;
      }

      S.console.debug('Has author: ' + author);

      // 搜索是否有更多该作者的书
      extension.sendRequest({
        topic: 'item_search',
        Keyword: author,
        SearchEngine: S.SearchBox.Products.BOOK_AUTHOR_SEARCH_ENGINE,
        ItemPage: 1
      }, function(response) {
        if (typeof response.Items == "object" && response.Items.length > 0) {
          S.console.debug(author + ' wroted ' + response.Items.length + ' books.');
          S.ItemBar._has_more_books = true;
          S.ItemBar.moreBooksOfAuthor = response.Items;
          S.ItemBar.author = author;


          var amazonBaseSearchUrl = 'http://www.amazon.cn/s?tag=ruyita-23&ie=UTF8&search-alias=books&field-author=';
          // 显示图标并绑定点击事件
          $('#' + SELECTORS('author-icon')).click(function() {
            S.SearchBox.Util.openTab(amazonBaseSearchUrl + author, true);
          });
        } else {
          self.hideAuthorIcon();
        }
      });
    },

    parseCurrentProductPrice: function(callback) {
      extension.sendRequest({
        "topic": "get_detail_config",
        "domain": Util.getLocationProperty(win, 'hostname')
      }, function(config) {
        if (config && config.length) {
          var configItem;
          var pattern
          var $price
          var priceParsed = false
          for (var i = 0; !priceParsed && i < config.length; i++) {
            configItem = config[i]
            if (!new RegExp(configItem.url).test(Util.getLocationHref(win))) {
              continue;
            }

            for (var j = 0; j < configItem.patterns.length; j++) {
              pattern = configItem.patterns[j]
              if (pattern.price) {
                $price = $(pattern.price)
                if ($price.length) {
                  if ($price.get(0).tagName == 'IMG') {
                    Util.parseImagePrice($price, function(price) {
                      handleParsedPrice(price)
                    })
                  } else {
                    handleParsedPrice($price.text())
                  }
                  break
                }
              }
            }
          }
        }

        function handleParsedPrice(price) {
          price = Util.parsePriceString(price)
          callback(price)
        }
      });
    },

    /**
     * 比较当前商品与搜索得到的其他商城的价格，并将结果保存在
     *   S.ItemBar.priceComparationInfo
     * @param  {Number} currentPrice   页面解析得到的当前商品价格
     * @param  {Object} currentProduct 搜索得到的当前商品数据
     * @param  {Array} products       搜索得到的当前商品在其他商家数据
     */
    constructPriceComparationInfo: function(currentPrice, currentProduct, products) {
      var priceComparationInfo = this.priceComparationInfo
      
      if (!currentPrice || !currentProduct || !products) {
        priceComparationInfo.valid = false
        return
      }

      // 该商品在其他B2C价格已排序所以直接取第一个最低价
      var lowestPriceProduct = products[0];
      if ( !lowestPriceProduct.BSeller ) {
        priceComparationInfo.valid = false;
        return;
      }
      var currentMerchant = Util.getSiteMetaInfo(Util.getLocationProperty(win, 'hostname'))
      if (currentMerchant) {
        priceComparationInfo.currentMerchantName = currentMerchant.name
      } else {
        priceComparationInfo.valid = false
        return
      }

      var relativeMerchantPrice = Util.parsePriceString(lowestPriceProduct.Price)
      if (relativeMerchantPrice) {
        var priceDiff = currentPrice - relativeMerchantPrice
        priceComparationInfo.priceDiff = Math.abs(priceDiff).toFixed(1)
        if (priceDiff > 0) {
          priceComparationInfo.type = 'expensive'
        } else if (priceDiff < 0) {
          priceComparationInfo.type = 'cheap'
        }
      } else {
        priceComparationInfo.valid = false
        return
      }
      var quote = currentProduct.book ? ['\u300a', '\u300b'] : ['\u201c', '\u201d'];
      priceComparationInfo.productTitle = quote[0] + currentProduct.Title + quote[1]
      priceComparationInfo.currentPrice = currentPrice
      priceComparationInfo.relativeMerchantName = lowestPriceProduct.ShopName
      priceComparationInfo.relativeMerchantLink =
        lowestPriceProduct.DetailUrl || lowestPriceProduct.ClickUrl || lowestPriceProduct.DetailPageURL
      priceComparationInfo.moreMerchantsLink = currentProduct.DetailPageURL
      priceComparationInfo.valid = true

    }
  };

  var getKeyword = function(isbn) {
    return JSON.stringify({
      url: Util.getLocationHref(win),
      title: win.document.title,
      isbn: isbn
    });
  };

  // create new object
  S.sameBookAssist = {};
  S.sameBookAssist.run = function(chain) {
    var url = site.get_url(doc);
    var domain = site.get_domain(doc);
    var self = this;
    extension.sendRequest({
      topic: 'is_book_site',
      domain: domain,
      url: url
    }, function(conf) {
      if (!conf) {
        chain.run();
        return;
      }
      if (typeof S.loadJQuery == "function") {
        $ = S.loadJQuery();
      }
      var book_meta = extractInfo(conf);
      if (book_meta.isbn) {
        S.IvyWantBuy.init();
        var keyword = getKeyword(book_meta.isbn);
        
        function compareBookPrices() {
          S.browser.extension.sendRequest({
            topic: 'item_search',
            Keyword: keyword,
            SearchEngine: 'product_search',
            ItemPage: 1
          }, function(response) {
            if (typeof response.Items == "object" && response.Items.length > 0) {
              response.Product.book = book_meta;
              if(S.ItemBar.isSameProduct(response.Product)) {
                S.ItemBar.initSame({
                  productList: response.Items,
                  product: response.Product,
                  Keyword: S.productSearch.getKeyword(),
                  book_author: book_meta.author
                });
              } else {
                // 有商品比价结果
                S.ItemBar.initPriceComparation({
                  productList: response.Items,
                  max_items: 8,
                  book_author: book_meta.author,
                  product: response.Product
                });
              }
              S.ItemBar.constructPriceComparationInfo(book_meta.price, response.Product, response.Items)
              S.console.debug('Current product price: ' + book_meta.price)
            } else {
              S.ItemBar.initSearch();
            }
          });
        }

        compareBookPrices()

        /*$('.' + SELECTORS('products-protection')).registerMutationObserver({
          removedNodes: true,
          subtree: true,
          characterData: true,
          attributes: ['style', 'class']
        }, function(type, oldValue, attrName) {
          if (type == 'removedNodes') {
            S.ItemBar.destory();
            compareBookPrices()
          } else if (type == 'characterData') {
            $(this).html(oldValue)
          } else if (type == 'attributes') {
            $(this).attr(attrName, oldValue)
          }
        })*/
      } else {
        chain.run();
      }
    });
  }
})(window, exports);
(function(win, S) {
  var Util = S.SearchBox.Util;
  var SELECTORS = S.transform_selector;
  S.productSearch = {
    getKeyword : function() {
      return JSON.stringify({url: Util.getLocationHref(win), title: win.document.title});
    }
  };
  S.productSearch.run = function(chain) {
    var self = this;
    S.browser.extension.sendRequest({
      topic: 'is_detail_site',
      url: Util.getLocationHref(win),
      title: win.document.title
    }, function(conf) {
      if (typeof conf.locale != "undefined") {
        S.IvyWantBuy.init();
        var kw;
        function initProductPriceComparation() {
          if (conf.product) {
            kw = self.getKeyword();
            S.browser.extension.sendRequest({
              topic: 'item_search',
              Keyword: kw,
              SearchEngine: 'product_search',
              ItemPage: 1
            }, function(response) {
              S.console.debug('1. ' + response.Items.length)
              // 有商品比价结果
              if (typeof response.Items == "object" &&
                  response.Items.length > 0) {
                // 同款
                if(S.ItemBar.isSameProduct(response.Product)) {
                  S.ItemBar.initSame({
                    productList: response.Items,
                    product: response.Product,
                    Keyword: kw
                  });
                } else {
                  // 比价
                  S.ItemBar.initPriceComparation({
                    productList: response.Items,
                    product: response.Product
                  });
                }

                S.ItemBar.parseCurrentProductPrice(function(price) {
                  if (price) {
                    S.ItemBar.constructPriceComparationInfo(price, response.Product, response.Items)
                    S.console.debug('Current product price: ' + price)
                  }
                });
              }
            });
          } else if (conf.likeItems) {
            S.ItemBar.initLike({
              productList: conf.likeItems
            });
          } else if (conf.keyword) {
            S.ItemBar.initRelated(conf.keyword);
          } else {
            S.ItemBar.initSearch();
          }
        }

        S.SearchBox.Util.loadJQuery();
        initProductPriceComparation()

        /*$('.' + SELECTORS('products-protection')).registerMutationObserver({
          removedNodes: true,
          subtree: true,
          characterData: true,
          attributes: ['style', 'class']
        }, function(type, oldValue, attrName) {
          S.ItemBar.destory();
          initProductPriceComparation()
        })*/
      }
    });
  };
})(window, exports);
(function(win, S, undefined) {
  S.etaoLike = {
    _productList: null,
    render: function(productList) {
      productList = this._productList = productList || this._productList;
      if(!productList) return;
      
      S.SearchBox.Products.renderByData(productList);
    }
  };
})(window, exports);(function(S, win, doc) {
  var Util = S.SearchBox.Util;
  var SELECTORS = S.transform_selector;
  S.SrpCompare = {
    initialized: false,
    hideTimer: undefined,
    templateInserted: false,
    
    init: function() {
      var self = this;
      if ( this.initialized ) {
        return;
      }
      this.initialized = true;
      S.browser.extension.sendRequest({
        "topic": "get_srp_config",
        "domain": Util.getLocationProperty(win, 'hostname')
      }, function(config) {
        if ( config ) {
          Util.loadJQuery();
          self.bindEvents(config);
          /*$('.' + SELECTORS('fast-compare-protection')).registerMutationObserver({
            removedNodes: true,
            subtree: true,
            characterData: true,
            attributes: ['style', 'class']
          }, function(type, oldValue, attrName) {
            if (type == 'removedNodes') {
              self.destory();
              self.bindEvents(config);
            } else if (type == 'characterData') {
              $(this).html(oldValue)
            } else if (type == 'attributes') {
              $(this).attr(attrName, oldValue)
            }
          })*/
        }
      });
    },

    destory: function() {
      $('.' + SELECTORS('fast-compare-protection')).remove()
    },

    registeredAnchorAndImg: [],

    bindEvents: function(allConfig) {
      var self = this;
      for ( var i=0, len=allConfig.length; i<len; i++ ) {
        var config = allConfig[i];
        if ( typeof config.url != "undefined" ) {
          var re = new RegExp(config.url);
          if ( !re.test(Util.getLocationHref(win)) ) {
            continue;
          }
        }
        if ( typeof config.patterns != "undefined" ) {
          var matchPattern = false;
          var patterns = config.patterns;
          for ( var j=0, l=patterns.length; j<l; j++ ) {
            var pattern = patterns[j];
            var hasList = (typeof pattern.list != "undefined");
            var resultlist = hasList ? $(pattern.list) : $(document.body);
            if ( resultlist.size() > 0
                 && pattern.img //&& $(pattern.img, resultlist).size() > 0
                 && pattern.a /*&& $(pattern.a, resultlist).size() > 0*/
                 && !Util.elemInArray(pattern.img + '|' + pattern.a, this.registeredAnchorAndImg)) {
              this.registeredAnchorAndImg.push(pattern.img + '|' + pattern.a);
              var hideDelay = 200;
              var showIcon = (function(pattern, elem) {
                return function(evt) {
                  self.showIcon($(evt.target), pattern, elem);
                };
              })(pattern, resultlist);
              if ( hasList ) {
                resultlist.delegate(pattern.img, "mouseenter", showIcon)
                  .delegate(pattern.img, "mouseleave", function(evt) {
                    self.hideTimer = setTimeout(function() {
                      if (!self.mouseentered) {
                        self.hideIcon();
                        self.hidePopup();

                      }
                    }, hideDelay);
                  });
              } else {
                $(pattern.img, resultlist).mouseenter(showIcon)
                  .mouseleave(function(evt) {
                    self.hideTimer = setTimeout(function() {
                      if (!self.mouseentered) {
                        self.hideIcon();
                        self.hidePopup();
                      }
                    }, hideDelay);
                  });
              }
              matchPattern = true;
            }
          }
          if ( matchPattern ) {
            break;
          }
        }
      }
    },

    parseCurrentProductPrice: function(pricePattern, $img, callback) {
      var $price
      var $item
      for (var i = 0; i < pricePattern.length; i++) {
        $item = $img
        // 递归得到 item
        for (var j = 0; j < pricePattern[i].imgToItemLevel; j++) {
          $item = $item.parent()
        }

        $price = $(pricePattern[i].selector, $item).eq(0)
        if ($price.length) {
          break
        }
      }

      if ($price.length) {
        if ($price.get(0).tagName == 'IMG') {
          S.SearchBox.Util.parseImagePrice($price, function(price) {
            handlePriceParsed(price, $img, $price)
          })
        } else {
          handlePriceParsed($price.text(), $img, $price)
        }
      }

      function handlePriceParsed(price, $target, $price) {
        price = S.SearchBox.Util.parsePriceString(price)
        callback(price, $target, $price)
      }
    },

    priceComparationInfo: {
      valid: false,
      type: '', // expensive or cheap
      currentPrice: undefined,
      currentMerchantName: '',
      productTitle: '',
      relativeMerchantName: '',
      priceDiff: undefined
    },

    constructPriceComparationInfo: function(currentPrice, currentProduct, lowestPriceProduct) {
      var priceComparationInfo = this.priceComparationInfo

      if (!currentPrice || !currentProduct || !lowestPriceProduct) {
        priceComparationInfo.valid = false
        return
      }

      var currentMerchant = Util.getSiteMetaInfo(Util.getLocationProperty(win, 'hostname'))
      if (currentMerchant) {
        priceComparationInfo.currentMerchantName = currentMerchant.name
      } else {
        priceComparationInfo.valid = false
        return
      }

      var relativeMerchantPrice = Util.parsePriceString(lowestPriceProduct.Price)
      if (relativeMerchantPrice) {
        var priceDiff = currentPrice - relativeMerchantPrice
        priceComparationInfo.priceDiff = Math.abs(priceDiff).toFixed(1)
        if (priceDiff > 0) {
          priceComparationInfo.type = 'expensive'
        } else if (priceDiff < 0) {
          priceComparationInfo.type = 'cheap'
        }
      } else {
        priceComparationInfo.valid = false
        return
      }
      var quote = currentProduct.Book ? ['\u300a', '\u300b'] : ['\u201c', '\u201d'];
      priceComparationInfo.productTitle = quote[0] + currentProduct.Title + quote[1]
      priceComparationInfo.currentPrice = currentPrice
      priceComparationInfo.relativeMerchantName = lowestPriceProduct.SiteName
      priceComparationInfo.valid = true
    },

    currentImageElement: null,
    selectorPattern: null,
    matchedResultList: null,
    popupVisible: false,

    showIcon: function($img, pattern, resultlist) {
      var self = this;

      if (this.popupVisible) {
        return;
      }

      if ( self.hideTimer ) {
        clearTimeout(self.hideTimer);
        self.hideTimer = undefined;
      }

      var idx = $(pattern.img, resultlist).index($img);
      if ( idx == -1 ) {
        return;
      }

      var $anchor = $(pattern.a, resultlist).eq(idx);
      if ( $anchor.size() == 0 ) {
        return;
      }

      // 首次插入模板
      if ( !self.templateInserted ) {
        self.insertTemplateAndBindEvents(function() {
          showIconAndSetPosition();
        });
      } else {
        showIconAndSetPosition();
      }

      var currentProductLink = this.currentProductLink = $anchor.get(0).href
      this.currentImageElement = $img;
      this.selectorPattern = pattern;
      this.matchedResultList = resultlist;

      this.getWantCounts(currentProductLink);
      function showIconAndSetPosition() {
        // 预加载数据，在有比价数据的情况下才显示火眼金睛icon
        S.browser.extension.sendRequest({
          topic: "get_price_comparation_and_history_prices_data",
          link: $anchor.get(0).href
        }, function(data) {
          if (!data || !data.Item) {
            return;
          }

          var $icon = $('#' + SELECTORS('huoyan-icon'));
          var offset = $img.offset();
          var imageWidth = $img.outerWidth();
          var imageHeight = $img.outerHeight();
          var iconWidth = $icon.width();
          var iconHeight = $icon.height();
          var left = offset.left + (imageWidth - iconWidth) / 2;
          var top = offset.top + imageHeight - iconHeight - 1;
          $icon.css({
            top: top + 'px',
            left: left + 'px'
          }).show();
        });
      }
    },

    hideIcon: function() {
      $('#' + SELECTORS('huoyan-icon')).hide();
    },

    showPopup: function($img, pattern, resultlist) {
      var $img = this.currentImageElement;
      var pattern = this.selectorPattern;
      var resultlist = this.matchedResultList;
      if (!$img || !pattern || !resultlist) {
        return;
      }

      var self = this;
      this.currentImageElement = $img;

      if ( self.hideTimer ) {
        clearTimeout(self.hideTimer);
        self.hideTimer = undefined;
      }
      var idx = $(pattern.img, resultlist).index($img);
      if ( idx == -1 ) {
        return;
      }
      var $anchor = $(pattern.a, resultlist).eq(idx);
      if ( $anchor.size() == 0 ) {
        return;
      }

      var showCompare = function() {
        self.hidePopup();
        S.browser.extension.sendRequest({
          topic: "get_price_comparation_and_history_prices_data",
          link: $anchor.get(0).href
        }, function(data) {
          if (!data || !data.Item) {
            return;
          }

          var items = data.Items
          var currentProductInfo = data.Item

          if (typeof currentProductInfo != 'undefined') {
            self.searchResult = data;
            var $popup = $('#' + SELECTORS('huoyan-wrapper')).show();
            S.SearchBox.Util.sendLog("show_compare", Util.getLocationHref(win));
            this.popupVisible = true;
            // self.hideIcon();

            var $fastCompare = $('#' + SELECTORS('fast-compare'));//.hide()
            var $noPriceComparation = $('#' + SELECTORS('no-price-comparation-info')).hide()
            var $header = $("#" + SELECTORS('huoyan-header'));
            var $body = $('#' + SELECTORS('huoyan-body'));
            var $ivyBar = $('#' + SELECTORS('hy-ivy-bar'))
            var popupOuterWidth;
            if (items && items.length > 0) {
              var html = [];
              var item;
              var itemClass;


              // 渲染比价列表
              for ( var i=0,len=items.length; i< len; i++ ) {
                item = items[i];
                itemClass = '' + SELECTORS('fc-item');
                html.push('<li class="' + itemClass + '" title="'+ item.SiteName +'">'
                          + '<a class="' + SELECTORS('fc-item-link') + '" href="javascript:void(0);" data-click-url="' + item.ClickUrl + '">'
                          + '<img width="16" height="16" class="' + SELECTORS('fc-item-img') + '" alt="'+ item.SiteName + '" src="' + item.SiteLogo + '" />'
                          + '<span class="' + SELECTORS('fc-item-price') + '">' + item.Price + '</span>'
                          + '</a>'
                          + '</li>' );
              }
              $('#' + SELECTORS('fc-list')).empty().append(html.join("\n"));
              $fastCompare.show();
              // FIX IE7 下 header 宽度不对的问题
              $header.width(425);
              $body.width(425);
              $ivyBar.width(425);
              popupOuterWidth = 427;
            } else {
              // 无比价数据
              // $noPriceComparation.show()
              $header.width(314);
              $body.width(314);
              $ivyBar.width(314);

              // 使用 setTimeout 修正 IE7 下的渲染问题
              setTimeout(function() {
                $fastCompare.hide();
              }, 0)
              popupOuterWidth = 316;
            }

            // 渲染历史价格曲线
            self.renderPlot(currentProductInfo.Prices, currentProductInfo)

            // 解析图片价格
            var pricePattern = pattern.price
            var currentPrice = $img.attr(SELECTORS('detected-price'))
            var currentProduct = data.Product
            var lowestPriceProduct;
            if (items) {
              lowestPriceProduct = items[0]
            }

            if (!currentPrice) {
              if (pricePattern && pricePattern.length) {

                // 解析当前商品价格并保存在商品元素属性 price 中
                self.parseCurrentProductPrice(pricePattern, $img, function(price, $target, $price) {
                  $img.attr(SELECTORS('detected-price'), price)
                  self.constructPriceComparationInfo(price, currentProduct, lowestPriceProduct)

                  // var a = $('<em>' + price + '</em>')
                  // $price.after(a)
                })
              }
            } else {
              self.constructPriceComparationInfo(currentPrice, currentProduct, lowestPriceProduct)
            }

            // 设置位置
            var $arrow = $('#' + SELECTORS('huoyan-wrapper') + ' .' + SELECTORS('fc-arrow'));
            arrow_width = $arrow.width();
            var img_offset = $img.offset();
            var arrow_top = ($popup.outerHeight() - parseInt($arrow.css('height')))/2;
            var popup_top = img_offset.top + $img.outerHeight()/2 - $popup.outerHeight()/2;
            var popup_left = img_offset.left + $img.outerWidth() + arrow_width;
            var viewport_right = $(document.body).scrollLeft() + document.documentElement.clientWidth;
            if ( popup_left + popupOuterWidth < viewport_right ) {
              $arrow.removeClass(SELECTORS('fc-arrow-right'));
              $arrow.css({ left: -1 * arrow_width});
              $fastCompare.addClass(SELECTORS('float-right-layout'))
            } else {
              // popup显示在图片左侧
              $arrow.addClass('' + SELECTORS('fc-arrow-right'));
              popup_left = img_offset.left - arrow_width - popupOuterWidth;
              $arrow.css({ left: popupOuterWidth - 2});
              $fastCompare.removeClass(SELECTORS('float-right-layout'))
            }

            $popup.css({ top: popup_top, left: popup_left });
          }
        });
      };

      showCompare();
    },
    
    hidePopup: function(evt) {
      $('#' + SELECTORS('huoyan-wrapper')).hide();
      this.popupVisible = false;
    },

    insertTemplateAndBindEvents: function(callback) {
      var self = this;
      S.SearchBox.Util.getTemplate("views/srp-compare.html", function (template) {
        if (self.templateInserted) {
          return;
        }

        self.templateInserted = true;
        S.SearchBox.Util.randomAppend(document.body, template);

        $('#' + SELECTORS('huoyan-wrapper')).mouseenter(function() {
          if ( self.hideTimer ) {
            self.mouseentered = true;
            clearTimeout(self.hideTimer);
            self.hideTimer = undefined;
          }
        }).mouseleave(function() {
          self.mouseentered = false;
          self.hidePopup();
          self.hideIcon();
        });

        $('#' + SELECTORS('fast-compare')).delegate('.' + SELECTORS('fc-item-link'), "click", function() {
          var url = $(this).attr('data-click-url');
          S.browser.extension.sendRequest({
            topic: "tab_open",
            url: url
          });
          S.SearchBox.Util.sendLog("click_compare", url + "|" + Util.getLocationHref(win));
        });

        $('#' + SELECTORS('fc-product-link')).click(function() {
          if ( self.searchResult && typeof self.searchResult.Product != "undefined"
               && typeof self.searchResult.Product.DetailPageURL != "undefined" ) {
            S.SearchBox.Util.sendLog("click_compare", self.searchResult.Product.DetailPageURL);
            window.open(self.searchResult.Product.DetailPageURL);
          }
        });

        $('#' + SELECTORS('fc-error-link')).click(function() {
          if ( self.searchResult && typeof self.searchResult.Product != "undefined"
               && typeof self.searchResult.Product.Epid != "undefined" ) {
            var nid = '';
            if ( typeof self.searchResult.Item !== "undefined"
                 && typeof self.searchResult.Item.nid !== "undefined" ) {
              nid = self.searchResult.Item.nid;
            }
            S.SearchBox.Util.openFeedback(self.searchResult.Product.Epid, nid);
          }
        });

        var prevPoint = null;
        $('#' + SELECTORS('hy-price-curve-plot')).bind('plothover', function(event, pos, item) {
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

        $('#' + SELECTORS('fc-share')).click(function() {
          if ( self.searchResult && typeof self.searchResult.Item != "undefined"
               && typeof self.searchResult.Item.DetailPageURL != "undefined" ) {
            var product = self.searchResult.Item;
            
            var url = product.DetailPageURL;
            var imageUrl = product.SmallImageUrl.replace('_80x80.jpg', '');

            var shareText = S.Share.getContentTemplate('ca', {
              productTitle: '“' + product.Title + '”'
            });

            var tmplType
            var pci = self.priceComparationInfo
            if (pci.valid) {
              if (pci.priceDiff != 0) {
                tmplType = 'pk_' + pci.type
                shareText = S.Share.getContentTemplate(tmplType, pci)
              }
            }

            var options = {
              custom: true,
              siteId: 'sina_weibo',
              text: shareText,
              url: url
            };

            // 检查当前浏览器是否支持截屏
            var Share = S.Share;
            if (Share.supportCaptureShare) {
              options.imageType = 'capture';
              S.Share.calcCaptureDataForFastCompare(self.currentImageElement, function(captureData) {
                options.imageWidth = captureData.width;
                options.imageHeight = captureData.height;
                options.top = captureData.top;
                options.left = captureData.left;
                S.Share.handleRequest(options);
              });
            } else {
              options.imageUrl = imageUrl;
              if (Share.supportSimpleShare) {
                options.imageType = 'simple';
              } else {
                options.custom = false;
              }
              S.Share.handleRequest(options);
            }
          }
        });
    
        //关注降价增加统计
        // $('#' + SELECTORS('hy-pc-price-info')).delegate('.'+ SELECTORS('hy-follow-price'), 'click', function() {
        //   Util.sendLog('click_compare', $(this).attr('href'));
        // });

        $('#' + SELECTORS('huoyan-icon')).click(function() {
          self.showPopup();
        }).mouseenter(function() {
          if ( self.hideTimer ) {
            self.mouseentered = true;
            clearTimeout(self.hideTimer);
            self.hideTimer = undefined;
          }
        }).mouseleave(function() {
          self.mouseentered = false;
          self.hideTimer = setTimeout(function() {
            self.hidePopup();
          }, 0)
        });

        $('#' + SELECTORS('hy-ivy-wants-text')).delegate('.' + SELECTORS('ivy-wants-count'), 'click', function() {
          self.openUserHomepage()
        });

        $('#' + SELECTORS('hy-ivy-want-btn')).click(function() {
          if ($(this).hasClass(SELECTORS('bought'))) {
            return;
          }

          self.wantThis(self.currentProductLink)
        })
        if (callback && typeof callback == 'function') {
          callback();
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

    renderPlot: function(data, currentProductInfo) {
      var currentPrice = currentProductInfo.Price.replace(/\uffe5|\s/g, '')
      currentPrice = parseInt(currentPrice)
      data = this.filterPriceHistoryData(data, currentPrice)
      if (data && data.length > 0) {
        var $plotWrapper = $('#' + SELECTORS('hy-price-curve-plot'));
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
      $('#' + SELECTORS('hy-pc-price-info')).html(priceInfoTemplate);
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
      
      try {
        var plotObj = $wrapper.data("plot");
        if(plotObj) {
          //plotObj.shutdown();
        }
      } catch(e) {
        S.console.debug("destroy plot error: " + e.message);
      }
      $.plot($wrapper, [data], options);
    },

    showTip: function(date, price, x, y) {
      var tipTemplate = this.getPriceCurveTipTemplate();
      $(document.body).append(tipTemplate);
      date = '\u65e5\u671f\uff1a' + date;
      price = '\u4ef7\u683c\uff1a' + price;
      $('#' + SELECTORS('hy-current-point-date')).text(date);
      $('#' + SELECTORS('hy-current-point-price')).text(price);
      var $tip = $('#' + SELECTORS('hy-price-curve-tip'));
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
      }).addClass(SELECTORS('hy-tip-visible'));
      $('#'+ SELECTORS('hy-price-curve-arrow-down')).css('left', arrowLeft);
    },

    hideTip: function() {
      $('#' + SELECTORS('hy-price-curve-tip')).remove();
    },
    
    formatNum: function(num) {
      num = Math.round(num * 100) / 100;
      return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    },

    getPriceCurveTipTemplate: function() {
      var tmpl = '<div id="' + SELECTORS('hy-price-curve-tip') + '" >' +
        '<div id="' + SELECTORS('hy-current-point-date') + '"></div>' +
        '<div id="' + SELECTORS('hy-current-point-price') + '"></div>' +
        '<div id="' + SELECTORS('hy-price-curve-arrow-down') + '"></div></div>';
      return tmpl;
    },


    getWantCounts: function(url) {
      var self = this
      S.browser.extension.sendRequest({
        topic: "item_like_count",
        url: url
      }, function(response) {
        if (response.error) {
          $('#' + SELECTORS('huoyan-wrapper')).addClass(SELECTORS('fetch-like-count-error'))
          return;
        } else {
          $('#' + SELECTORS('huoyan-wrapper')).removeClass(SELECTORS('fetch-like-count-error'))
        }

        var isSaved = response.is_saved;
        var savedCount = response.saved_count;

        self.updateWantsStatus(savedCount, isSaved);
      })
    },

    wantThis: function(url) {
      var self = this
      S.browser.extension.sendRequest({
        topic: "item_like_add",
        url: url
      }, function(response) {
        if (response && response.success && typeof response.saved_count != "undefined" ) {
          self.updateWantsStatus(response.saved_count, true)
        }
      });
    },

    updateWantsStatus: function(count, isSaved) {
      var html = '';
      var anchor = '<a class="' + SELECTORS('ivy-wants-count') + '" target="_blank">'
      $('#' + SELECTORS('hy-ivy-want-btn')).removeClass(SELECTORS('bought'))
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

          $('#' + SELECTORS('hy-ivy-want-btn')).addClass(SELECTORS('bought'))
          
        } else {
          html = '如意淘用户中有' + anchor + count + ' 人</a>想买';
        }
      }

      $('#' + SELECTORS('hy-ivy-wants-text')).html(html)
    },

    openUserHomepage: function() {
      S.browser.extension.sendRequest({
        topic: "item_like_open_homepage"
      });
    },
    getPriceInfoTemplate: function(minPrice, maxPrice, nid) {
      return '<span>\u6700\u9ad8\u4ef7\uff1a<span class="' + SELECTORS('hy-highest-price') + '">\uffe5' +maxPrice + '</span></span>' +
        '<span>\u6700\u4f4e\u4ef7\uff1a<span class="' + SELECTORS('hy-lowest-price') + '">\uffe5' + minPrice + '</span></span>';
    }
  };
})(exports, window, document);
(function(S, win, undefined) {
  var Util = S.SearchBox.Util;
  S.CnaCookie = {
    hostRegexp: /\b(taobao|etao|tmall)\.com/,
    init: function() {
      if ( this.hostRegexp.test( Util.getLocationProperty(win, 'hostname') ) ) {
        var cnaCookie = S.get_cookie('cna');
        if ( cnaCookie ) {
          S.browser.extension.sendRequest({
            topic: "set_cna_cookie",
            value: cnaCookie
          });
        }
      }
    }
  };
})(exports, window);
/*global exports */
/**
 * @fileoverview This file is used for define the EventProxy library.
 * @author <a href="mailto:shyvo1987@gmail.com">Jackson Tian</a>
 * @version 0.1.0
 */
(function (S) {
    /**
     * @description EventProxy. A module that can be mixed in to *any object* in order to provide it with
     * custom events. You may `bind` or `unbind` a callback function to an event;
     * `trigger`-ing an event fires all callbacks in succession.
     * @constructor
     * @name EventProxy
     * @class EventProxy. An implementation of task/event based asynchronous pattern.
     * @example
     * var render = function (template, resources) {};
     * var proxy = new EventProxy();
     * proxy.assign("template", "l10n", render);
     * proxy.trigger("template", template);
     * proxy.trigger("l10n", resources);
     */
    var EventProxy = function () {
        if (!(this instanceof EventProxy)) {
            return new EventProxy();
        }
        this._callbacks = {};
        this._fired = {};
    };

    /**
     * @description Bind an event, specified by a string name, `ev`, to a `callback` function.
     * Passing `"all"` will bind the callback to all events fired.
     * @memberOf EventProxy#
     * @param {string} eventName Event name.
     * @param {function} callback Callback.
     */
    EventProxy.prototype.addListener = function (ev, callback) {
        this._callbacks = this._callbacks || {};
        this._callbacks[ev] = this._callbacks[ev] || [];
        this._callbacks[ev].push(callback);
        return this;
    };
    EventProxy.prototype.bind = EventProxy.prototype.addListener;
    EventProxy.prototype.on = EventProxy.prototype.addListener;
    EventProxy.prototype.await = EventProxy.prototype.addListener;

    /**
     * @description Remove one or many callbacks. If `callback` is null, removes all
     * callbacks for the event. If `ev` is null, removes all bound callbacks
     * for all events.
     * @memberOf EventProxy#
     * @param {string} eventName Event name.
     * @param {function} callback Callback.
     */
    EventProxy.prototype.removeListener = function (ev, callback) {
        var calls = this._callbacks, i, l;
        if (!ev) {
            this._callbacks = {};
        } else if (calls) {
            if (!callback) {
                calls[ev] = [];
            } else {
                var list = calls[ev];
                if (!list) {
                    return this;
                }
                l = list.length;
                for (i = 0; i < l; i++) {
                    if (callback === list[i]) {
                        list[i] = null;
                        break;
                    }
                }
            }
        }
        return this;
    };
    EventProxy.prototype.unbind = EventProxy.prototype.removeListener;

    /**
     * @description Remove all listeners.
     * It equals unbind(); Just add this API for as same as Event.Emitter.
     * @memberOf EventProxy#
     * @param {string} event Event name.
     */
    EventProxy.prototype.removeAllListeners = function (event) {
        return this.unbind(event);
    };

    /**
     * @description Trigger an event, firing all bound callbacks. Callbacks are passed the
     * same arguments as `trigger` is, apart from the event name.
     * Listening for `"all"` passes the true event name as the first argument.
     * @param {string} eventName Event name.
     * @param {mix} data Pass in data. 
     */
    EventProxy.prototype.trigger = function (eventName, data) {
        var list, calls, ev, callback, args, i, l;
        var both = 2;
        if (!(calls = this._callbacks)) {
            return this;
        }
        while (both--) {
            ev = both ? eventName : 'all';
            list = calls[ev];
            if (list) {
                for (i = 0, l = list.length; i < l; i++) {
                    if (!(callback = list[i])) {
                        list.splice(i, 1); i--; l--;
                    } else {
                        args = both ? Array.prototype.slice.call(arguments, 1) : arguments;
                        callback.apply(this, args);
                    }
                }
            }
        }
        return this;
    };
    EventProxy.prototype.emit = EventProxy.prototype.trigger;
    EventProxy.prototype.fire = EventProxy.prototype.trigger;

    /**
     * @description Bind an event like the bind method, but will remove the listener after it was fired.
     * @param {string} ev Event name.
     * @param {function} callback Callback.
     */
    EventProxy.prototype.once = function (ev, callback) {
        var self = this,
            wrapper = function () {
                callback.apply(self, arguments);
                self.unbind(ev, wrapper);
            };
        this.bind(ev, wrapper);
        return this;
    };
    
    /**
     * @description Bind an event, and trigger it immediately.
     * @param {string} ev Event name.
     * @param {function} callback Callback.
     * @param {mix} data The data that will be passed to calback as arguments.
     */
    EventProxy.prototype.immediate = function (ev, callback, data) {
        this.bind(ev, callback);
        this.trigger(ev, data);
        return this;
    };

    var _assign = function (eventname1, eventname2, cb, once) {
        var proxy = this, length, index = 0, argsLength = arguments.length,
            bind, _all,
            callback, events, isOnce, times = 0, flag = {};

        // Check the arguments length.
        if (argsLength < 3) {
            return this;
        }

        events = Array.prototype.slice.apply(arguments, [0, argsLength - 2]);
        callback = arguments[argsLength - 2];
        isOnce = arguments[argsLength - 1];

        // Check the callback type.
        if (typeof callback !== "function") {
            return this;
        }

        length = events.length;
        bind = function (key) {
            var method = isOnce ? "once" : "bind";
            proxy[method](key, function (data) {
                proxy._fired[key] = proxy._fired[key] || {};
                proxy._fired[key].data = data;
                if (!flag[key]) {
                    flag[key] = true;
                    times++;
                }
            });
        };

        for (index = 0; index < length; index++) {
            bind(events[index]);
        }

        _all = function () {
            if (times < length) {
                return;
            }
            var data = [];
            for (index = 0; index < length; index++) {
                data.push(proxy._fired[events[index]].data);
            }
            if (isOnce) {
                proxy.unbind("all", _all);
            }
            callback.apply(null, data);
        };
        proxy.bind("all", _all);
    };

    /**
     * @description Assign some events, after all events were fired, the callback will be executed once.
     * @example
     * proxy.all(ev1, ev2, callback);
     * proxy.all([ev1, ev2], callback);
     * proxy.all(ev1, [ev2, ev3], callback);
     * @param {string} eventName1 First event name.
     * @param {string} eventName2 Second event name.
     * @param {function} callback Callback, that will be called after predefined events were fired.
     */
    EventProxy.prototype.all = function (eventname1, eventname2, cb) {
        var args = Array.prototype.concat.apply([], arguments);
        args.push(true);
        _assign.apply(this, args);
        return this;
    };
    EventProxy.prototype.assign = EventProxy.prototype.all;

    /**
     * @description Assign some events, after all events were fired, the callback will be executed first time.
     * then any event that predefined be fired again, the callback will executed with the newest data.
     * @example
     * proxy.tail(ev1, ev2, callback);
     * proxy.tail([ev1, ev2], callback);
     * proxy.tail(ev1, [ev2, ev3], callback);
     * @memberOf EventProxy#
     * @param {string} eventName1 First event name.
     * @param {string} eventName2 Second event name.
     * @param {function} callback Callback, that will be called after predefined events were fired.
     */
    EventProxy.prototype.tail = function () {
        var args = Array.prototype.concat.apply([], arguments);
        args.push(false);
        _assign.apply(this, args);
        return this;
    };
    EventProxy.prototype.assignAll = EventProxy.prototype.tail;
    EventProxy.prototype.assignAlways = EventProxy.prototype.tail;

    /**
     * @description The callback will be executed after the event be fired N times.
     * @memberOf EventProxy#
     * @param {string} eventName Event name.
     * @param {number} times N times.
     * @param {function} callback Callback, that will be called after event was fired N times.
     */
    EventProxy.prototype.after = function (eventName, times, callback) {
        if (times === 0) {
            callback.call(null, []);
            return this;
        }
        var proxy = this,
            firedData = [],
            all;
        all = function (name, data) {
            if (name === eventName) {
                times--;
                firedData.push(data);
                if (times < 1) {
                    proxy.unbind("all", all);
                    callback.apply(null, [firedData]);
                }
            }
        };
        proxy.bind("all", all);
        return this;
    };

    /**
     * @description The callback will be executed after any registered event was fired. It only executed once.
     * @memberOf EventProxy#
     * @param {string} eventName1 Event name.
     * @param {string} eventName2 Event name.
     * @param {function} callback The callback will get a map that has data and eventName attributes.
     */
    EventProxy.prototype.any = function () {
        var proxy = this,
            index,
            _bind,
            len = arguments.length,
            callback = arguments[len - 1],
            events = Array.prototype.slice.apply(arguments, [0, len - 1]),
            count = events.length,
            _eventName = events.join("_");

        proxy.once(_eventName, callback);

        _bind = function (key) {
            proxy.bind(key, function (data) {
                proxy.trigger(_eventName, {"data": data, eventName: key});
            });
        };

        for (index = 0; index < count; index++) {
            _bind(events[index]);
        }
    };

    /**
     * @description The callback will be executed when the evnet name not equals with assigned evnet.
     * @memberOf EventProxy#
     * @param {string} eventName Event name.
     * @param {function} callback Callback.
     */
    EventProxy.prototype.not = function (eventName, callback) {
        var proxy = this;
        proxy.bind("all", function (name, data) {
            if (name !== eventName) {
                callback(data);
            }
        });
    };
    
    /**
     * Create a new EventProxy
     * @example
     *     var ep = EventProxy.create();
     *     ep.assign('user', 'articles', function(user, articles) {
     *       // do something...
     *     });
     * 
     *     // or one line ways: Create EventProxy and Assign
     *     
     *     var ep = EventProxy.create('user', 'articles', function(user, articles) {
     *       // do something...
     *     });
     * 
     * @returns {EventProxy}
     */
    EventProxy.create = function () {
        var ep = new EventProxy();
        if (arguments.length) {
            ep.assign.apply(ep, Array.prototype.slice.call(arguments));
        }
        return ep;
    };

    S.EventProxy = EventProxy;
}(exports));
(function(S, win, doc) {
var Util = S.SearchBox.Util;
var Tmpl = S.SearchBox.Tmpl;
var SELECTORS = S.transform_selector;
S.PriceCurve = {
  proxy: null,
  expandClass: SELECTORS('price-curve-expanded'),
  site: null,

  /**
   * 实现：
   *  bool isDetailPage();
   *  bool insertTemplate(template);
   */
  sites: {
    "360buy.com" : {
      isDetailPage: function() {
        var href = win.location.href;
        return href.match(/^http:\/\/www\.(360buy|jd)\.com\/product\/\d+\.html/)
          || href.match(/^http:\/\/book\.(360buy|jd)\.com\/\d+\.html/)
          || href.match(/^http:\/\/item\.jd\.com\/\d+\.html/);
      },
      getCurrentPrice: function(){
      },
      insertTemplate: function(template) {
        var $priceBlock = $("#summary-price");
        if (!$priceBlock.length) {
          $priceBlock = $('#priceinfo').parent()
        }

        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<li></li>");
          $wrapper.addClass(SELECTORS('price-curve-protection'))
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "dangdang.com": {
      isDetailPage: function() {
        var regexp = /^http:\/\/product\.dangdang\.com\/(?:main2?\/)?(?:p|P)roduct.aspx/
        return win.location.href.match(regexp);
      },
      getCurrentPrice: function(){
      },
      insertTemplate:function(template) {
        var $priceBlock = $("#d_price").size() > 0
          ? $("#d_price").parent()
          : $(".show_info .m_price").parent();
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<div></div>");
          $wrapper.addClass(SELECTORS('price-curve-protection'))
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "suning.com": {
      isDetailPage: function() {
        return win.location.href.match(/suning\.com\/emall\/prd_[\d_-]+\.html/);
      },
      getCurrentPrice: function(){
          var price = $("#headerBook").size() > 0
          ? $("#bookprdprice em").text()
          : $("#mainPrice em").text();
          if ( price && price.match(/\d+\.\d+/) ) {
            return price;
          }
      },
      insertTemplate:function(template) {
        var $priceBlock = $("#headerBook").size() > 0
          ? $("#yg")
          : $("#_main_price");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<li></li>");
          $wrapper.addClass(SELECTORS('price-curve-protection'))
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "gome.com.cn": {
      isDetailPage: function() {
        return win.location.href.match(/^http:\/\/www\.gome\.com\.cn\/ec\/homeus\/jump\/product\/\d+\.html/)
        || win.location.href.match(/^http:\/\/www\.gome\.com\.cn\/product\/[a-zA-Z0-9-]+\.html/);
      },
      getCurrentPrice: function() {
        var $priceBlock = $(".info .price b"),
            price = $priceBlock.size() > 0 ? $priceBlock.text() : '';
        if ( price && price.match(/\d+\.\d+/) ) {
          return price;
        }
      },
      insertTemplate:function(template) {
        var $priceBlock = $("#amount");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<div/>");
          $wrapper.addClass(SELECTORS('price-curve-protection'));
          S.PriceCurve.copyStyle($wrapper, $priceBlock, ['float', 'marginBottom']);
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "coo8.com": {
      isDetailPage: function() {
        return win.location.href.match(/^http:\/\/www\.coo8\.com\/product\/[a-zA-Z0-9]+\.html/);
      },
      getCurrentPrice: function() {
      },
      insertTemplate:function(template) {
        var $priceBlock = $("#c8InfoData");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<li/>");
          $wrapper.addClass(SELECTORS('price-curve-protection'));
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "yihaodian.com": {
      isDetailPage: function() {
        return win.location.href.match(/^http:\/\/www\.yihaodian\.com\/(?:product|item)\/\d+/);
      },
      getCurrentPrice: function() {
        var price = $("#productFacadePrice").size() > 0
                    ? $("#productFacadePrice").text()
                    : $("#nonMemberPrice").text();
        if ( price && price.match(/\d+\.\d+/) ) {
          return price;
        }
      },
      insertTemplate:function(template) {
        var $priceBlock = $(".specific_info1:first");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<div></div>");
          $wrapper.addClass(SELECTORS('price-curve-protection'));
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "1mall.com": {
      isDetailPage: function() {
        return win.location.href.match(/^http:\/\/www\.1mall\.com\/(?:product|item)\/\d+/);
      },
      getCurrentPrice: function() {
        var price = $("#productFacadePrice").size() > 0
                    ? $("#productFacadePrice").text()
                    : $("#nonMemberPrice").text();
        if ( price && price.match(/\d+\.\d+/) ) {
          return price;
        }
      },
      insertTemplate:function(template) {
        var $priceBlock = $(".specific_info1:first");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<div></div>");
          $wrapper.addClass(SELECTORS('price-curve-protection'));
          $wrapper.css({
            marginLeft: 14
          });
          $wrapper.insertAfter($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    },
    "51buy.com": {
      isDetailPage: function() {
        return win.location.href.match(/^http:\/\/item\.51buy\.com\/item-\d+\.html/);
      },
      getCurrentPrice: function() {
        var price = $("#goods_detail_mate .item_icson .price_font").size() > 0
                    ? $("#goods_detail_mate .item_icson .price_font").text()
                    : '';
        if ( price && price.match(/\d+\.\d+/) ) {
          return price;
        }
      },
      insertTemplate:function(template) {
        var $priceBlock = $("#goods_detail_mate .item_icson");
        if ( $priceBlock.size() > 0 ) {
          var $wrapper = this.templateWrapper = $("<div/>");
          $wrapper.addClass(SELECTORS('price-curve-protection'));
          $wrapper.css({
            marginTop: 10,
            marginLeft: '-' + $priceBlock.css('paddingLeft')
          });
          $wrapper.appendTo($priceBlock).append(template);
          return true;
        } else {
          return false;
        }
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove()
        }
      }
    }
  },
  copyStyle: function(targetDom, sourceDom, styleNames) {
    var 
    css = {},
    i = 0
    len = styleNames.length;
    for(;i<len;i++) {
      css[styleNames[i]] = sourceDom.css(styleNames[i]);
    }
    targetDom.css(css);
  },
  
  init: function() {
    var self = this;
    var domain = S.site.get_site(S.site.get_domain(doc));
    this.sites["jd.com"] = this.sites["360buy.com"];
    if ( !this.sites.hasOwnProperty(domain) ) {
      return;
    }
    this.site = this.sites[domain];
    if ( !this.site.isDetailPage(win.location.href) ) {
      return;
    }
    S.SearchBox.Util.loadJQuery();

    function insertTemplate() {
      S.SearchBox.Util.getTemplate("views/price-curve.html", function(template) {
        var insertResult = self.site.insertTemplate(template);
        // 插入成功的情况下再插入图表
        if (insertResult) {
          var url = win.location.href
          self.getWantCounts(url)
          self.proxy = new S.EventProxy();
          self.proxy.assign('priceHistoryData', 'priceCurveStatus', function() {
            self.render.apply(self, arguments);
            self.bindEvents.apply(self);
          });
          self.getPriceHistoryData();
          self.getSiteStatus();
        }
      });
    }

    insertTemplate()

    /*$('.' + SELECTORS('price-curve-protection')).registerMutationObserver({
      removedNodes: true,
      subtree: true,
      characterData: true,
      attributes: ['style', 'class']
    }, function() {
      self.destory()
      self.site.destoryTemplateWrapper()
      insertTemplate()
    })*/
  },

  destory: function() {
    $('#' + SELECTORS('price-curve')).remove()
    $('#' + SELECTORS('price-curve-style')).remove()
  },

  render: function(data, setting) {
    this.hideLoading();
    if (data) {
      var $plotWrapper = $('#' + SELECTORS('price-curve-plot')),
          self = this,
          priceArr = this.filterPriceHistoryData(data.Item.Prices);
      
      try {
        this.drawPlot(priceArr, $plotWrapper);
      } catch (e) {
        S.console.debug("draw plot error: " + e.message);
        setTimeout(function() {
          try {
            self.drawPlot(priceArr, $plotWrapper);
          } catch (e) {
            S.console.debug("draw plot error again: " + e.message);
            $('#' + SELECTORS('price-curve')).remove();
          }
        }, 0);
      }

      var maxPrice = this.getPrice(priceArr, 'max');
      var minPrice = this.getPrice(priceArr, 'min');
      this.setPrices(minPrice, maxPrice, data.Item.nid);

      // 默认展开价格趋势 
      if (setting) {
        this.expand();
      }
    } else {
      this.handleNoPriceData();
      this.expandClass = '' + SELECTORS('price-curve-no-data');
    }
  },

  getSiteStatus: function() {
    var self = this;
    var domain = S.site.get_site(S.site.get_domain(doc));
    S.browser.extension.sendRequest({
      topic: 'get_price_curve_status',
      domain: domain
    }, function(status) {
      self.proxy.trigger('priceCurveStatus', status);
    });
  },

  setSiteStatus: function(status) {
    var domain = S.site.get_site(S.site.get_domain(doc));
    S.browser.extension.sendRequest({
      topic: 'set_price_curve_status',
      domain: domain,
      status: status
    });
  },

  getPriceHistoryData: function() {
    var self = this;
    S.browser.extension.sendRequest({
      topic: 'get_price_history_data',
      url: win.location.href
    }, function(data) {
      self.proxy.trigger('priceHistoryData', data);
    });
  },

  filterPriceHistoryData: function(data) {
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
      var price = this.site.getCurrentPrice();
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
      if (data.length < 2 || noPriceCounter == l ) {
        data = null;
      }
    }

    return data;
  },

  /**
   * Get min or max price
   * @param  {Array<Array>} data Data of price and time
   * @param  {Enum<String>} type min|max
   * @return {String}      Max or min price
   */
  getPrice: function(data, type) {
    var prices =[];
    for (var i = 0, l = data.length; i < l; i++) {
      if (data[i][1])
        prices.push(data[i][1]);
    }
    return Math[type].apply(null, prices);
  },

  setPrices: function(minPrice, maxPrice, nid) {
    var priceInfoTemplate = Tmpl.getPriceInfoTemplate(this.formatNum(minPrice), this.formatNum(maxPrice), nid);
    $('#' + SELECTORS('pc-price-info')).html(priceInfoTemplate);
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

  bindEvents: function() {
    var self = this;

    $('#' + SELECTORS('price-curve-header')).click(function() {
      var $wrapper = $('#' + SELECTORS('price-curve'));
      if ($wrapper.hasClass(self.expandClass)) {
        self.collapse();
      } else {
        self.expand();
      }
    });

    var prevPoint = null;

    $('#' + SELECTORS('price-curve-plot')).bind('plothover', function(event, pos, item) {
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
    
    //share weibo
    $('#'+ SELECTORS('share-price-curve')).click(function(evt) {
      evt.stopPropagation();
      S.ItemBar.shareWeibo();
    });

    // 想买按钮
    $('#' + SELECTORS('price-curve-ivy-want-btn')).click(function() {
      self.wantThis(win.location.href)
    })

    $('#' + SELECTORS('price-curve-ivy-wants-text')).delegate('.' + SELECTORS('ivy-wants-count'), 'click', function() {
      self.openUserHomepage()
    });
	//关注降价增加统计
	// $('#' + SELECTORS('pc-price-info')).delegate('.'+SELECTORS('follow-price'), 'click', function() {
 //    Util.sendLog('click_priceTrack', $(this).attr('href'));
 //    });
  },

  handleNoPriceData: function() {
    $('#' + SELECTORS('no-price-history-info')).show();
    $('#' + SELECTORS('price-curve-plot')).hide();
  },

  hideLoading: function() {
    $('#' + SELECTORS('price-curve-loading')).hide();
  },

  expand: function() {
    $('#' + SELECTORS('price-curve')).addClass(this.expandClass);
    this.showCollapseBtn();
    this.setSiteStatus(true);
  },

  collapse: function() {
    $('#' + SELECTORS('price-curve')).removeClass(this.expandClass);
    this.showExpandBtn();
    this.setSiteStatus(false);
  },
  
  _btnFlag: null,
  _BTN_FLAG_Expand: 'ExpandBtn',
  _BTN_FLAG_COLLAPSE: 'CollapseBtn',
  showExpandBtn: function() {
    $('#' + SELECTORS('expand-price-curve')).show();
    $('#' + SELECTORS('collapse-price-curve')).hide();
    $('#' + SELECTORS('share-price-curve')).hide();
    this._btnFlag = this._BTN_FLAG_Expand;
  },

  showCollapseBtn: function() {
    $('#' + SELECTORS('expand-price-curve')).hide();
    $('#' + SELECTORS('collapse-price-curve')).show();
    if(this._shareWeiboFlag) {
      $('#' + SELECTORS('share-price-curve')).show();
    }
    this._btnFlag = this._BTN_FLAG_COLLAPSE;
  },
  refreshBtn: function() {
    if(this._btnFlag == this._BTN_FLAG_Expand) {
      this.showExpandBtn();
    } else if(this._btnFlag == this._BTN_FLAG_COLLAPSE) {
      this.showCollapseBtn();
    }
  },

  showTip: function(date, price, x, y) {
    var tipTemplate = Tmpl.getPriceCurveTipTemplate();
    $(doc.body).append(tipTemplate);
    date = '\u65e5\u671f\uff1a' + date;
    price = '\u4ef7\u683c\uff1a' + price;
    $('#' + SELECTORS('current-point-date')).text(date);
    $('#' + SELECTORS('current-point-price')).text(price);
    var $tip = $('#' + SELECTORS('price-curve-tip'));
    var outerWidth = $tip.outerWidth();
    var outerHeight = $tip.outerHeight();
    var topOffset = 15;
    var arrowWidth = 8;
    var left = x - (outerWidth / 2);
    var top = y - outerHeight - topOffset;
    $tip.css({
      top: top,
      left: left
    }).addClass(SELECTORS('tip-visible'));
    $('#' + SELECTORS('price-curve-arrow-down')).css('left', (outerWidth - arrowWidth) / 2);
  },

  hideTip: function() {
    $('#' + SELECTORS('price-curve-tip')).remove();
  },
  
  _shareWeiboFlag: false,
  triggerShareWeibo: function() {
    this._shareWeiboFlag = true;
    this.refreshBtn();
  },


  getWantCounts: function(url) {
    var self = this
    S.browser.extension.sendRequest({
      topic: "item_like_count",
      url: url
    }, function(response) {
      if (response.error) {
        $('#' + SELECTORS('price-curve')).addClass(SELECTORS('fetch-like-count-error'))
        return;
      } else {
        $('#' + SELECTORS('price-curve')).removeClass(SELECTORS('fetch-like-count-error'))
      }

      var isSaved = response.is_saved;
      var savedCount = response.saved_count;

      self.updateWantsStatus(savedCount, isSaved);
    })
  },

  wantThis: function(url) {
    var self = this
    S.browser.extension.sendRequest({
      topic: "item_like_add",
      url: url
    }, function(response) {
      if (response && response.success && typeof response.saved_count != "undefined" ) {
        self.updateWantsStatus(response.saved_count, true)
      }
    });
  },

  updateWantsStatus: function(count, isSaved) {
    var html = '';
    var anchor = '<a class="' + SELECTORS('ivy-wants-count') + '" target="_blank">'
    if ( count == 0 ) {
      html = '成为第 ' + anchor + '1 个</a>想买的如意淘用户';
    } else {
      if ( isSaved ) {
        if ( count == 1 ) {
          html = '你是第' + anchor + ' 1 个</a>想买的如意淘用户';
        } else {
          html = '你与其他' + anchor + count +' 个</a>如意淘用户都想买';
        }

        $('#' + SELECTORS('price-curve-ivy-want-btn')).addClass(SELECTORS('bought'))
        
      } else {
        html = '如意淘用户中有' + anchor + count + ' 人</a>想买';
      }
    }

    $('#' + SELECTORS('price-curve-ivy-wants-text')).html(html)
  },

  openUserHomepage: function() {
    S.browser.extension.sendRequest({
      topic: "item_like_open_homepage"
    });
  },
  formatNum: function(num) {
    num = Math.round(num * 100) / 100;
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  }
}
})(exports, window, document);(function(S, win, doc) {
var Util = S.SearchBox.Util;
var Tmpl = S.SearchBox.Tmpl;
var SELECTORS = S.transform_selector;
var locationHref = Util.getLocationHref(win);
function imgDomainFilter(url) {
  return url && url.replace(/^(https?:\/\/)img\d+\.(taobaocdn|tbcdn)\.com/g, '$1cdn.s.aliyun.com');
}
S.SerpDetail = {
  maskDom: '#' + SELECTORS('serp-list-mask'),
  popupDom: '#' + SELECTORS('serp-list-detail-popup'),
  init: function() {
    if($(this.maskDom).length) return;
    $('<div></div>').attr('id', SELECTORS('serp-list-mask')).appendTo(document.body);
    $(this.popupDom).appendTo(document.body);
    this.bindEvents();
  },
  bindEvents: function() {
    var self = this;
    //关闭按钮和黑色蒙版的点击事件
    $(this.maskDom + ',#' + SELECTORS('serp-list-product-detail-close-btn')).click($.proxy(function() {
      this.hide();
      return false;
    }, this));
    
    //统计去购买按钮，title，图片
    $('#' + SELECTORS('serp-list-buy-btn') +
      ',#' + SELECTORS('serp-list-product-title') + ' a' +
      ',.' + SELECTORS('serp-list-product-image') + ' a').click(function() {
      Util.sendLog('click_searchengine', $(this).attr('href'));
    });
    
    //价格曲线
    this.prices.bindEvents();
    
    //想买按钮
    this.ivy.bindEvents();
    
    //比价列表
    this.marketList.bindEvents();
  },
  render: function(obj) {
    this.init();
    var 
    Title = S.SerpList.encodeHTML(S.SerpList.substring(obj.Title || '', 90, '...')),
    Price = obj.Price || '',
    SmallImageUrl = imgDomainFilter(obj.SmallImageUrl || ''),
    LargeImageUrl = imgDomainFilter(obj.LargeImageUrl || ''),
    ImageUrl = LargeImageUrl || SmallImageUrl,
    ShopName = obj.ShopName || '',
    DetailPageURL = obj.DetailPageURL || '',
    ClickUrl = obj.ClickUrl || ''
    ;
    $('.' + SELECTORS('serp-list-product-image') + ' a').attr('href', ClickUrl);
    $('#' + SELECTORS('serp-list-product-detail-image')).attr('src', ImageUrl);
    $('#' + SELECTORS('serp-list-product-title') + ' a').attr('href', ClickUrl).html(Title);
    $('#' + SELECTORS('serp-list-detail-price')).html(Price);
    $('#' + SELECTORS('serp-list-homepage-link')).html(ShopName);
    $('#' + SELECTORS('serp-list-buy-btn')).attr('href', DetailPageURL);
    $('#' + SELECTORS('serp-list-want-btn')).attr('href', DetailPageURL);
    
    this.loading();
    //加载价格曲线和比价列表
    this.loadData(DetailPageURL, $.proxy(function(data) {
      //prices
      this.prices.render(data && data.Item && data.Item.Prices || [], data && data.Item && data.Item.Price || obj.Price);
      //比价
      data && data.Items && data.Items.length && this.marketList.render(data.Items.slice(0, 5), data.Item, data.Product);
    }, this));
    
    this.ivy.getWantCounts(DetailPageURL);
  },
  ie6: {
    init: function() {
      this.setMaskSize();
      this._setPosition();
      this.bindEvents();
    },
    bindEvents: function() {
      this.unbindEvents();
      $(window)
      .scroll(this._doScroll = $.proxy(this.setPosition, this))
      .resize(this._doResize = $.proxy(function() {
        this.setPosition();
        this.setMaskSize();
      }, this));
    },
    unbindEvents: function() {
      if(this._setPositionTimer) {
        clearTimeout(this._setPositionTimer);
        delete this._setPositionTimer;
      }
      
      if(this._doScroll) {
        $(window).unbind('scroll', this._doScroll);
      }
      delete this._doScroll;
      
      if(this._doResize) {
        $(window).unbind('resize', this._doResize);
      }
      delete this._doResize;
    },
    setMaskSize: function() {
      $(S.SerpDetail.maskDom)
      .width($(document.body).outerWidth(true))
      .height($(document.body).outerHeight(true));
    },
    setPosition: function() {
      clearTimeout(this._setPositionTimer);
      this._setPositionTimer = setTimeout(this._setPosition, 10);
    },
    _setPosition: function() {
      var $window = $(window),
          $body = $(document.body),
          $popup = $(S.SerpDetail.popupDom),
          top = $window.scrollTop() + ($window.height() - $popup.outerHeight(true))/2//,
          //left = $window.scrollLeft() + ($window.width() - $popup.outerHeight(true))/2
          ;
      $(S.SerpDetail.popupDom).css({
        top: top + 'px'//,
        //left: left
      });
    },
    destroy: function() {
      this.unbindEvents();
    }
  },
  show: function(item) {
    this.render(item);
    $(this.maskDom).show();
    $(this.popupDom).show();
    
    if ($.browser.msie && $.browser.version == '6.0') {
      this.ie6.init();
    }
  },
  loadData: function(url, cb) {
    S.browser.extension.sendRequest({
      topic: "get_price_comparation_and_history_prices_data",
      link: url
    }, function(response) {
      $.isFunction(cb) && cb(response);
    })
  },
  hide: function() {
    this.ie6.destroy();
    $(this.maskDom).hide();
    $(this.popupDom).hide();
  },
  destory: function() {
    this.hide();
    $(this.maskDom).remove();
    $(this.popupDom).remove();
  },
  loading: function() {
    this.prices.loading(true);
    this.marketList.loading(true);
  },
  
  //比价列表
  marketList: {
    loading: function(flag) {
      $('.' + SELECTORS('price-comparation-box'))[flag?'removeClass':'addClass'](SELECTORS('price-comparation-box-show'));
      setTimeout(function(){
        $('.' + SELECTORS('price-comparation-box'))[flag?'removeClass':'addClass'](SELECTORS('price-comparation-box-animate'));
      }, 0);
      if(flag) {
        $('#' + SELECTORS('market-list')).empty();
      }
    },
    bindEvents: function() {
      $('#' + SELECTORS('market-list')).delegate('.' + SELECTORS('market-item'), 'click', function() {
        if (!$(this).hasClass(SELECTORS('current-merchant'))) {
          var url = $(this).attr('data-href');
          if(url) {
            Util.openTab(url);
            Util.sendLog('click_searchengine', url);
          }
        }
      });
      $('#' + SELECTORS('more-results-link')).click(function() {
        var url = $(this).attr('data-href');
        if(url) {
          Util.openTab(url, true);
          Util.sendLog('click_searchengine', url);
        }
      });
      
      this.handleLogoClick();
    },
    render: function(items, item, product) {
      this.loading(false);
      $.each(items, function(index, item) {
        item.DetailUrl = item.ClickUrl || item.DetailPageURL;
        item.ShopName = item.SiteName;
      });
      var html = S.SearchBox.Tmpl.getMarketsTemplate(items, this.calcCurrentMerchantIndex(items, item));
      $('#' + SELECTORS('market-list')).html(html);
      
      $('#' + SELECTORS('more-results-link')).attr('data-href', product.DetailPageURL||'')
      
      this.markCurrentMerchant();
    },
    calcCurrentMerchantIndex: function(items, item) {
      var currentMerchantIndex;
      for (var i = 0, l = items.length; i < l; i++) {
        if (item.nid && item.nid == items[i].nid) {
          currentMerchantIndex = i;
          break;
        }
      }
      return currentMerchantIndex;
    },
    markCurrentMerchant: function() {
      var merchantItemWidth = 120;
      var downArrowWidth = 12;
      var $currentMerchantItem = $('.' + SELECTORS('current-merchant')).eq(0);
      var $currentMerchantCursor = $('#' + SELECTORS('current-merchant-cursor'));
      var $marketList = $('#' + SELECTORS('market-list'));
      var $merchants = $marketList.find('.' + SELECTORS('market-item'));
      var maxVisibleMerchantsNumber = parseInt($marketList.width() / merchantItemWidth);
  
      if ($currentMerchantItem.length &&
          $merchants.index($currentMerchantItem) <= maxVisibleMerchantsNumber - 1) {
        var position = $currentMerchantItem.position();
        var left = position.left + (merchantItemWidth - downArrowWidth) / 2;
        $currentMerchantCursor.show().css('left', left + 'px');
      } else {
        $currentMerchantCursor.hide();
      }
    },
    handleLogoClick: function() {
      var url = 'http://ruyi.taobao.com/?utm_medium=ext&utm_source=ruyi';
      $('.' + SELECTORS('logo')).click(function() {
        S.SearchBox.Util.openTab(url, true);
      });
    }
  },
  prices: {
    loading: function(flag) {
      $('#' + SELECTORS('serp-list-price-curve'))[flag?'addClass':'removeClass'](SELECTORS('serp-list-price-curve-loading'));
      if(flag) {
        $('#' + SELECTORS('serp-list-price-curve')).empty();
      }
    },
    bindEvents: function() {
      var self = this;
      //价格曲线
      var prevPoint = null;
      $('#' + SELECTORS('serp-list-price-curve')).bind('plothover', function(event, pos, item) {
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
    render: function(Prices, currentPrice) {
      this.loading(false);
      currentPrice = (currentPrice||'').toString().replace(/\uffe5|\s/g, '');
      currentPrice = parseFloat(currentPrice);
      var $plotWrapper = $('#' + SELECTORS('serp-list-price-curve')),
          self = this,
          priceArr = this.filterPriceHistoryData(Prices, currentPrice);
      
      try {
        this.drawPlot(priceArr, $plotWrapper);
      } catch (e) {
        S.console.debug("draw plot error: " + e.message);
        setTimeout(function() {
          try {
            self.drawPlot(priceArr, $plotWrapper);
          } catch (e) {
            S.console.debug("draw plot error again: " + e.message);
            $('#' + SELECTORS('serp-list-price-curve')).empty();
          }
        }, 0);
      }
    },
    filterPriceHistoryData: function(data, price) {
      //var noPriceCounter = 0;
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
            //noPriceCounter++;
          }
        }
  
        // 添加当前价格
        var now = new Date();
        //var price = this.site.getCurrentPrice();
        if ( !price && data.length) {
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
        //if (data.length < 2 || noPriceCounter == l ) {
        //  data = null;
        //}
      }
  
      return data;
    },
  
    /**
     * Get min or max price
     * @param  {Array<Array>} data Data of price and time
     * @param  {Enum<String>} type min|max
     * @return {String}      Max or min price
     */
    getPrice: function(data, type) {
      var prices =[];
      for (var i = 0, l = data.length; i < l; i++) {
        if (data[i][1])
          prices.push(data[i][1]);
      }
      return Math[type].apply(null, prices);
    },
  
    /*setPrices: function(minPrice, maxPrice, nid) {
      var priceInfoTemplate = Tmpl.getPriceInfoTemplate(this.formatNum(minPrice), this.formatNum(maxPrice), nid);
      $('#' + SELECTORS('pc-price-info')).html(priceInfoTemplate);
    },*/
  
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
          backgroundColor: '',
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
    
    /*handleNoPriceData: function() {
      $('#' + SELECTORS('no-price-history-info')).show();
      $('#' + SELECTORS('price-curve-plot')).hide();
    },*/
  
    /*hideLoading: function() {
      $('#' + SELECTORS('price-curve-loading')).hide();
    },*/
  
    showTip: function(date, price, x, y) {
      var tipTemplate = Tmpl.getPriceCurveTipTemplate();
      $(doc.body).append(tipTemplate);
      date = '\u65e5\u671f\uff1a' + date;
      price = '\u4ef7\u683c\uff1a' + price;
      $('#' + SELECTORS('current-point-date')).text(date);
      $('#' + SELECTORS('current-point-price')).text(price);
      var $tip = $('#' + SELECTORS('price-curve-tip'));
      var outerWidth = $tip.outerWidth();
      var outerHeight = $tip.outerHeight();
      var topOffset = 15;
      var arrowWidth = 8;
      var left = x - (outerWidth / 2);
      var top = y - outerHeight - topOffset;
      $tip.css({
        top: top,
        left: left
      }).addClass(SELECTORS('tip-visible'));
      $('#' + SELECTORS('price-curve-arrow-down')).css('left', (outerWidth - arrowWidth) / 2);
    },
  
    hideTip: function() {
      $('#' + SELECTORS('price-curve-tip')).remove();
    },
    
    formatNum: function(num) {
      num = Math.round(num * 100) / 100;
      return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    }
  },
  ivy: {
    bindEvents: function() {
      var self = this;
      $('#' + SELECTORS('serp-list-want-btn')).click(function() {
        self.wantThis($(this).attr('href'));
        return false;
      });
      $('#' + SELECTORS('serp-list-ivy-wants-text')).delegate('.' + SELECTORS('serp-list-saved-and-bought-count'), 'click', function() {
        self.openUserHomepage();
      });
    },
    getWantCounts: function(url) {
      var self = this;
      S.browser.extension.sendRequest({
        topic: "item_like_count",
        url: url
      }, function(response) {
        //console.log(response);
        if (response.error) {
          $(this.popupDom).addClass(SELECTORS('fetch-like-count-error'))
          return;
        } else {
          $(this.popupDom).removeClass(SELECTORS('fetch-like-count-error'))
        }
        
        var isSaved = response.is_saved;
        var savedCount = response.saved_count;
  
        self.updateWantsStatus(savedCount, isSaved);
      })
    },
  
    wantThis: function(url) {
      //console.log('wantThis', url);
      var self = this;
      S.browser.extension.sendRequest({
        topic: "item_like_add",
        url: url
      }, function(response) {
        //console.log(response);
        if (response && response.success && typeof response.saved_count != "undefined" ) {
          self.updateWantsStatus(response.saved_count, true)
        }
      });
    },
  
    updateWantsStatus: function(count, isSaved) {
      $('#' + SELECTORS('serp-list-want-btn')).removeClass(SELECTORS('serp-list-want-btn-bought'));
      var html = '';
      var anchor = '<a class="' + SELECTORS('serp-list-saved-and-bought-count') + '" target="_blank">'
      if ( count == 0 ) {
        html = '成为第' + anchor + '1 个</a>想买的如意淘用户';
      } else {
        if ( isSaved ) {
          if ( count == 1 ) {
            html = '你是第' + anchor + '1 个</a>想买的如意淘用户';
          } else {
            html = '你与其他' + anchor + (count-1) +' 个</a>如意淘用户都想买';
          }
  
          $('#' + SELECTORS('serp-list-want-btn')).addClass(SELECTORS('serp-list-want-btn-bought'));
          
        } else {
          html = '如意淘用户中有' + anchor + count + ' 人</a>想买';
        }
      }
      
      $('#' + SELECTORS('serp-list-ivy-wants-text')).html(html);
    },
  
    openUserHomepage: function() {
      S.browser.extension.sendRequest({
        topic: "item_like_open_homepage"
      });
    }
  }
};
S.SerpList = {
  //proxy: null,
  //expandClass: SELECTORS('serp-list-expanded'),
  site: null,
  items: null,
  /**
   * 实现：
   *  bool isSERP();
   *  string getKeyword();
   *  [string] getURL();
   *  bool insertTemplate(template);
   */
  sites: {
    "baidu.com" : {
      isSERP: function() {
        return locationHref.match(/^http:\/\/www\.baidu\.com\/s\?/);
      },
      getKeyword: function() {
        return $('#kw').val();
      },
      getURL: function() {
        var urlArr = [];
        $(//普通网页
          'td.f span.g, ' + 
          'td.f span.c-showurl, ' + 
          //百度贴吧
          'td.f div.c-showurl, ' + 
          //百度知道 百度图片
          "td.f>font[color='#008000'], " + 
          //百度图片,需要取a标签的href属性
          'td.f #ala_img_results a:not([href^="http://www.baidu.com/link?url="]):not([href^="http://www.baidu.com/baidu.php?url="])' + 
          'td.f #ala_img_desc a:not([href^="http://www.baidu.com/link?url="]):not([href^="http://www.baidu.com/baidu.php?url="])' + 
          //例如：搜索i9308 中关村在线的相关链接
          'td.f .op_digital_base_moreInfo_l a, td.f .op_digital_moreLink_p a.op_digital_base_moreLink_a, ' + 
          //不是以http://www.baidu.com/link?url=开始的结果标题链接，例如：百度购物搜索gouwu.baidu.com
          'td.f h3.t a:not([href^="http://www.baidu.com/link?url="]):not([href^="http://www.baidu.com/baidu.php?url="])'
          ).each($.proxy(function(i, dom) {
          var jdom = $(dom);
          if(jdom.length) {
            var url = jdom.text();
            //需要取a标签的href属性
            if(dom.tagName && dom.tagName.toLowerCase() === 'a') {
              url = jdom.attr('href');
            }
            url = this.filterURL(url);
            url && urlArr.push(url);
          }
        }, this));
        return urlArr;
      },
      filterURL: function(url) {
        //1.替换&nbsp;为空格 2.trim 3.取第1个空格前的内容（如果没有取全部）（ascii码32和160都是空格）
        return $.trim(url.replace(/&nbsp;/g, ' ')).split(new RegExp(String.fromCharCode(32)+'|'+String.fromCharCode(160), 'g'))[0];
      },
      insertTemplate: function(template) {
        //console.log(template);
        var $block = $("#content_right td:first");
        if($block.size() > 0) {
          var $wrapper = this.templateWrapper = $("<div></div>");
          $wrapper.addClass(SELECTORS('serp-list-protection'));
          S.SerpList.copyStyle($wrapper, $(':not(style):not(script):not(link):not(meta):first', $block), ['paddingLeft']);
          $wrapper.prependTo($block).append(template);
          return true;
        }
        return false;
      },

      templateWrapper: null,

      destoryTemplateWrapper: function() {
        if (this.templateWrapper) {
          this.templateWrapper.remove();
          try {
            delete this.templateWrapper;
          } catch(e) {
            this.templateWrapper = undefined;
          }
        }
      }
    }
  },
  copyStyle: function(targetDom, sourceDom, styleNames) {
    var 
    css = {},
    i = 0
    len = styleNames.length;
    for(;i<len;i++) {
      css[styleNames[i]] = sourceDom.css(styleNames[i]);
    }
    targetDom.css(css);
  },
  filterKeyword: function(keyword) {
    //过滤以 官网|官方网站|旗舰店|官方旗舰店 结尾的关键词
    return $.trim(keyword.replace(/(\u5B98\u7F51|\u5B98\u65B9\u7F51\u7AD9|\u65D7\u8230\u5E97|\u5B98\u65B9\u65D7\u8230\u5E97)+$/gm, ''));
  },
  init: function() {
    var self = this;
    var domain = S.site.get_site(S.site.get_domain(doc));
    if ( !this.sites.hasOwnProperty(domain) ) {
      return;
    }
    this.site = this.sites[domain];
    if ( !this.site.isSERP() ) {
      return;
    }
    S.SearchBox.Util.loadJQuery();
    
    
    //load data
    //self.proxy = new S.EventProxy();
    //self.proxy.assign('getData', );
    self.getSiteStatus(function(status) {
      if(!status) return;
      var keyword = self.filterKeyword(self.site.getKeyword() || ''),
          urls = self.site.getURL();
      //S.console.debug(keyword, urls);
      keyword && self.getData(keyword, urls, function(data) {
        data && data.Items && self.insertTemplate(function(insertResult) {
          if(insertResult) {
            self.render(data);
            self.bindEvents();
            //ie6不执行动画
            if (!($.browser.msie && $.browser.version == '6.0')) {
              $('#' + SELECTORS('serp-list')).hide().slideDown(400);
            }
            Util.sendLog('show_searchengine', locationHref);
          }
        });
      });
    });
    
  },
  insertTemplate: function(cb) {
    S.SearchBox.Util.getTemplate("views/serp-list.html", $.proxy(function(template) {
      var insertResult = this.site.insertTemplate(template);
      $.isFunction(cb) && cb(insertResult);
    }, this));
  },
  destory: function() {
    $('#' + SELECTORS('serp-list')).remove();
    $('#' + SELECTORS('serp-list-style')).remove();
    
    delete this.items;
    
    this.__unBindCloseHandle();
    
    this.listview && this.listview.destroy && this.listview.destroy();
    delete this.listview;
    
    try {
      this.site && this.site.destoryTemplateWrapper();
    } catch(e){}
    try {
      S.SerpDetail.destory();
    } catch(e){}
  },
  substring: function(str, len, suffix) {
    return str && (str.length > len && str.substring(0, len) + suffix) || str;
  },
  getTemplate: function(items) {
    var arr = [];
    $.each(items, $.proxy(function(i, item) {
      arr.push(this.getItemTemplate(item, i));
    }, this));
    return arr.join('');
  },
  getItemTemplate: function(obj, index) {
    var 
    Title = this.encodeHTML(this.substring(obj.Title || '', 40, '...')),
    Price = obj.Price || '',
    SmallImageUrl = imgDomainFilter(obj.SmallImageUrl || ''),
    LargeImageUrl = imgDomainFilter(obj.LargeImageUrl || ''),
    ImageUrl = LargeImageUrl || SmallImageUrl,
    ShopName = obj.ShopName || ''
    ;
    return [
      '<a href="javascript:void(0)" class="' + SELECTORS('serp-list-listview-item') + '" data-index="' + index + '">',
      '  <span class="' + SELECTORS('serp-list-image-wrapper') + '">',
      '    <img class="' + SELECTORS('serp-list-image') + '" src="' + ImageUrl + '">',
      '    <b class="' + SELECTORS('line-height-setter') + '"></b>',
      '  </span>',
      '  <div class="' + SELECTORS('serp-list-listview-item-base-info') + '">',
      '    <div class="' + SELECTORS('serp-list-listview-item-title') + '">' + Title + '</div>',
      '    <div class="' + SELECTORS('serp-list-listview-item-shopname') + '">\u5546\u57ce\uff1a' + ShopName + '</div>',
      '  </div>',
      '  <div class="' + SELECTORS('serp-list-listview-item-price') + '"><span>' + Price + '</span></div>',
      '</a>'
    ].join('');
  },
  encodeHTML: function(s) {
    return typeof s != "string" ? s :
            s.replace(/"|&|'|<|>/g, function(s) {
              return '&#' + s.charCodeAt(0) + ';';
            });
  },
  _fixImageMaxSize: function($img, maxSize) {
    if ($img.width() > maxSize || $img.height() > maxSize) {
      if ($img.width() > $img.height())
        $img.width(maxSize);
      else
        $img.height(maxSize);
    }
  },
  fixImageMaxSize: function($img, maxSize) {
    if($img.width() > 28) {//ie下已经加载的时候
      this._fixImageMaxSize($img, maxSize);
      $img.unbind('load.fixImageMaxSize');
    } else {
      $img.bind('load.fixImageMaxSize', $.proxy(function(){this._fixImageMaxSize($img, maxSize);}, this));
    }
  },
  render: function(data) {
    if(data && data.Items) {
      this.items = data.Items;
      var self = this,
          $wrapper = $('.' + SELECTORS('serp-list-listview')),
          class_width_arr = [0, 268, 438],
          class_item_small = SELECTORS('serp-list-listview-item-small');
          //console.log($wrapper);
      $wrapper.html(this.getTemplate(data.Items.slice(0, 8)));
      
      this.listview = new S.Listview($wrapper, {
        listviewItemSelector: '.' + SELECTORS('serp-list-listview-item'),
        listviewAdjustPositionBefore: function(adjustType, element) {
          //删除所有serp-list-listview-width-XX的class
          for(var i=class_width_arr.length-1; i>=0; i--) {
            $(element).removeClass(SELECTORS('serp-list-listview-width-' + class_width_arr[i]));
          }
          
          var width = $(element).outerWidth(true);
          for(var i=class_width_arr.length-1; i>=0; i--) {
            //增加小于并且最接近width的class，只增加一次
            if(class_width_arr[i] <= width) {
              $(element).addClass(SELECTORS('serp-list-listview-width-' + class_width_arr[i]));
              break;
            }
          }
        },
        listviewAdjustPositionComplete: function(adjustType, element) {
          //处理ie6图片的maxWidth
          if ($.browser.msie && $.browser.version == '6.0') {
            $('img', $wrapper).each(function(i) {
              self.fixImageMaxSize($(this), $(this).parent().width());
            });
          }
        },
        listviewDirection: function(index, obj) {
          //console.log(index, obj);
          index > 1 && obj.element.addClass(class_item_small);
          return 'y';
        }
      });
    }
  },

  getSiteStatus: function(cb) {
    var self = this;
    //var domain = S.site.get_site(S.site.get_domain(doc));
    S.browser.extension.sendRequest({
      topic: 'get_serp_list_status'//,
      //domain: domain
    }, cb);
  },

  setSiteStatus: function(status) {
    //var domain = S.site.get_site(S.site.get_domain(doc));
    S.browser.extension.sendRequest({
      topic: 'set_serp_list_status',
      //domain: domain,
      status: status
    });
  },

  getData: function(keyword, urls, cb) {
    S.browser.extension.sendRequest({
      topic: 'get_serp_list_data',
      //topic: 'item_search',Keyword: keyword,SearchEngine:'etao',
      keyword: keyword,
      url: locationHref,
      urls: urls
    }, function(data) {
      $.isFunction(cb) && cb(data);
    });
  },
  /* 处理点击空白处关闭"关闭选项框" */
  __unBindCloseHandle: function() {
    if(this.__closeHandle)
    $(document).unbind('click', this.__closeHandle);
    this.__closeHandle = null;
  },
  __bindCloseHandle: function() {
    this.__unBindCloseHandle();
    $(document).click(this.__closeHandle = $.proxy(this.toggleClose, this));
  },
  toggleClose: function() {
    if($('#' + SELECTORS('serp-list-close-options')).toggle().is(':visible')) {
      this.__bindCloseHandle();
    } else {
      this.__unBindCloseHandle();
    }
  },
  bindEvents: function() {
    var self = this;
    //关闭按钮
    $('.' + SELECTORS('serp-list-close')).click($.proxy(function() {
      //如果关闭选项悬浮层存在，目前在搜狗下没有该悬浮层
      if($('#' + SELECTORS('serp-list-close-options')).length) {
        //显示/隐藏悬浮层
        this.toggleClose();
      } else {
        //销毁
        this.destory();
      }
      return false;
    }, this));
    $('#' + SELECTORS('serp-list-close-options-dismiss')).click(function() {
      self.destory();
      return false;
    });
    $('#' + SELECTORS('serp-list-close-options-dismiss-forever')).click(function() {
      self.setSiteStatus(false);
      self.destory();
      return false;
    });
    
    //绑定查看更多的href
    $('a.' + SELECTORS('serp-list-more')).attr('href', 'http://s.etao.com/search?tb_lm_id=ryt_ext&q=' + encodeURIComponent(this.site.getKeyword())).click(function() {
      Util.sendLog('click_searchengine', $(this).attr('href'));
    });
    
    //绑定item click事件
    $('.' + SELECTORS('serp-list-listview')).delegate('.' + SELECTORS('serp-list-listview-item'), 'click', function(evt) {
      var index = parseInt($(evt.currentTarget).attr('data-index')),
          item = self.items[index];
      //console.log(item);
      if(item) {
        S.SerpDetail.show(item);
        Util.sendLog('show_item_searchengine', item.DetailPageURL);
      }
      return false;
    });
  }
}
})(exports, window, document);(function(S) {
  S.IvyWantBuy = {};
  S.IvyWantBuy.init = function() {
    var url = S.SearchBox.Util.getLocationHref(window);
    var host = S.SearchBox.Util.getLocationProperty(window, 'hostname');
    if ( !host.match(/(item|detail)\.(taobao|tmall)\.com/) ) {
      return;
    }

    var Util = S.SearchBox.Util;
    var SELECTORS = S.transform_selector;
    S.browser.extension.sendRequest({
      topic: "item_like_count",
      url: url
    }, function(response) {
      // response: { "saved_count": "13", "is_saved": true }
      if ( response.error ) {
        return;
      }
      Util.loadJQuery();
      if ( $('#'+SELECTORS("like-button")).size() > 0 ) {
        // 防止重复加载
        return;
      }
      Util.getTemplate("views/like-button.html", function(template){
        var elem = $(template);
        if ( response.is_saved ) {
          $("#"+SELECTORS("like-button-outer"), elem)
            .addClass(SELECTORS('like-button-disabled'));
        } else {
          $("#"+SELECTORS('like-button-outer'), elem).click(onClickLikeButton);
        }
        $("#"+SELECTORS('like-button-spec'), elem).html(getButtonSpec(response.saved_count, response.is_saved));
        $("#"+SELECTORS('like-button-home'), elem).click(openUserHomepage);

        if (host.indexOf('taobao.com') != -1) {
          $("#detail .tb-gallery").append(elem);
        } else if (host.indexOf('tmall.com') != -1) {
          $('#J_DetailMeta .tb-gallery').append(elem)
        }
      });

      var getButtonSpec = function(count, is_liked) {
        var html = '';
        var anchor = '<a href="javascript:;" id="'+SELECTORS('like-button-home')+'">';
        count = parseInt(count);
        if ( isNaN(count) || count < 0 ) {
          count = 0;
        }
        if ( count == 0 ) {
          html = '成为第 '+anchor+'1 个</a>想买的如意淘用户';
        } else {
          if ( is_liked ) {
            if ( count == 1 ) {
              html = '你是第'+anchor+' 1 个</a>想买的如意淘用户';
            } else {
              html = '你与其他'+anchor+' '+(count-1)+' 个</a>如意淘用户都想买';
            }
          } else {
            html = '如意淘用户中有 '+anchor+count+' 人</a>想买';
          }
        }
        return html;
      };

      var onClickLikeButton = function() {
        S.browser.extension.sendRequest({
          topic: "item_like_add",
          url: url
        }, function(response) {
          // response: { "success": true, "saved_count": 12}
          if ( typeof response.saved_count != "undefined" ) {
            $('#'+SELECTORS('like-button-outer')).unbind('click')
              .addClass(SELECTORS('like-button-disabled'));
            $("#"+SELECTORS('like-button-spec')).html(getButtonSpec(response.saved_count, true));
            $("#"+SELECTORS('like-button-home')).click(openUserHomepage);
          }
        });
      };

      var openUserHomepage = function() {
        S.browser.extension.sendRequest({
          topic: "item_like_open_homepage",
          url: url
        });
      }
    });


  }
})(exports);

(function(S, win, doc) {
var ACCESS_TOKEN_CALLBACK_URL =
  'http://ruyi.taobao.com/service/access-token-callback.html';
var Util = S.SearchBox.Util;
var SELECTORS = S.transform_selector;
var Share = S.Share = {
  currentSiteId: '',
  popupShowed: false,
  shortUrl: '',
  imageUrl: '',
  supportCaptureShare: false,
  supportSimpleShare: false,

  contentTemplates: {
    ca: '\u5546\u5BB6\u4FC3\u9500\u8FF7\u4EBA\u773C\uFF0C\u5F3A\u70C8\u63A8\u8350\u5927\u5BB6\u4F7F\u7528@\u5982\u610F\u6DD8\uFF0C' +
      '\u770B\u5B8C\u5386\u53F2\u4EF7\u683C\u66F2\u7EBF\uFF0C\u8FD8\u80FD\u8FDB\u884C\u591A\u7AD9\u6BD4\u4EF7\uFF0C\u4ECE\u6B64\u4E0D\u518D\u88AB\u5FFD\u60A0\u3002' +
      '\u6211\u521A\u7528@\u5982\u610F\u6DD8 \u67E5\u4E86' +
      '${productTitle}' +
	  ' #\u5982\u610F\u6DD8OK\u8D2D#\uFF08\u4E0B\u8F7D\u5730\u5740\uFF1Ahttp://t.cn/aeDbuE\uFF09 {{{url}}}',
    pk_expensive: '\u5751\u7239\u554a\uff0c\u521a\u7528\u6bd4\u4ef7\u795e\u5668@\u5982\u610f\u6dd8 ' +
      '\u53d1\u73b0${currentMerchantName}\u7684${productTitle}\u5356' +
      '${currentPrice}\u5143\uff0c\u6bd4${relativeMerchantName}\u8d35\u4e86${priceDiff}' +
      '\u5143\u554a\uff01{{{url}}} \u62d2\u82b1\u51a4\u6789\u94b1\uff0c\u6bd4\u51fa\u771f\u5b9e\u60e0' +
      ' #\u5982\u610F\u6DD8OK\u8D2D#\uFF08\u4E0B\u8F7D\u5730\u5740\uFF1Ahttp://t.cn/aeDbuE\uFF09',
    pk_cheap: '\u6211\u561e\u4e2a\u53bb\uff01\u521a\u7528\u6bd4\u4ef7\u795e\u5668' +
      '@\u5982\u610f\u6dd8 \u53d1\u73b0${currentMerchantName}\u7684${productTitle}' +
      '\u6700\u4fbf\u5b9c\uff0c\u5356${currentPrice}\u5143\uff0c\u6bd4\u7b2c' +
      '\u4e8c\u540d${relativeMerchantName}\u4fbf\u5b9c\u4e86${priceDiff}\u5143\uff01' +
      '{{{url}}} \u62d2\u82b1\u51a4\u6789\u94b1\uff0c\u6bd4\u51fa\u771f\u5b9e\u60e0' +
      ' #\u5982\u610F\u6DD8OK\u8D2D#\uFF08\u4E0B\u8F7D\u5730\u5740\uFF1Ahttp://t.cn/aeDbuE\uFF09 {{{url}}}'
  },

  init: function() {
    var self = this;
    var href = Util.getLocationHref(window);
    if (href !== ACCESS_TOKEN_CALLBACK_URL && href.indexOf(ACCESS_TOKEN_CALLBACK_URL) == 0) {
      S.browser.extension.sendRequest({
        topic: 'callback_share_authorization',
        url: href
      });
    }

    // 先检查当前浏览器支持的自定义分享类型，并保存状态
    this.checkCustomShareSupport(function(result) {
      self.supportSimpleShare = result.simple;
      self.supportCaptureShare = result.capture;
    });

    S.browser.extension.onRequest.addListener(function(request, sender) {
      switch (request.topic) {
      case 'short_url':
        self.shortUrl = request.shortUrl;
        self.handleResponse();
        break;
      case 'capture_image_data':
        self.imageUrl = request.imageData;
        self.handleResponse();
        break;
      }
    });

    /*$('.' + SELECTORS('share-protection')).registerMutationObserver({
      removedNodes: true,
      subtree: true,
      characterData: true,
      attributes: ['style', 'class']
    }, function(type, oldValue, attrName) {
      if (type == 'removedNodes') {
        self.destory();
        self.insertTemplate()
      } else if (type == 'characterData') {
        $(this).html(oldValue)
      } else if (type == 'attributes') {
        $(this).attr(attrName, oldValue)
      }
    })*/
  },

  destory: function() {
    $('.' + SELECTORS('share-protection')).remove()
  },

  insertTemplate: function(callback) {
    if (!$('#' + SELECTORS('share-wrapper')).length) {
      Util.getTemplate("views/share.html", function (template) {
        $(doc.body).append(template);
        // Util.randomAppend(doc.body, template); 
        S.Share.View.bindEvents();
        callback && callback();
      });
    } else {
      callback && callback();
    }
  },

  getContentTemplate: function(templateType, data) {
    var template = this.contentTemplates[templateType];
    if (template) {
      for (var key in data) {
        template = template.replace('${' + key + '}', data[key]);
      }
    } else {
      template = ''
    }
    return template;
  },

  checkCustomShareSupport: function(callback) {
    S.browser.extension.sendRequest({
      topic: 'support_custom_share'
    }, callback);
  },

  /**
   * 处理分享请求
   * @param {Object} options 分享选项，包含文字，url，图片等；
 *   options = {
 *    custom (String): 是否是自定义分享
      siteId (String): 分享的目标站点，例如：sina_weibo
      text (String): 分享的文字
      url (String): 分享的 url，需要 shorten
      imageType (String): simple | capture 图片类型，simple 代表图片 url，capture 代表从当前页面截取
      imageUrl (String): 图片 url，在 imageType: simple 时可用
      imageWidth (Number): 要截取的图片宽度，在 imageType: capture 时可用
      imageHeight (Number): 要截取的图片高度，在 imageType: capture 时可用
      top (Number): 要截取的区域相对于视口的 top 值，在 imageType: capture 时可用
      left (Number): 要截取的区域相对于视口的 left 值，在 imageType: capture 时可用
    }
   */
  handleRequest: function(opts) {
    if (opts.custom) {
      if (this.popupShowed) {
        return;
      }

      var self = this;
      this.insertTemplate(function() {
        self.currentSiteId = opts.siteId;
        self.text = opts.text;

        if (opts.imageType == 'simple') {
          self.imageUrl = opts.imageUrl;
          self.handleResponse();
        }

        if (opts.imageType == 'capture' || opts.url) {
          opts.topic = 'handle_share_request';
          S.browser.extension.sendRequest(opts);
        }
      });
    } else {
      this.nativeShare(opts);
    }
  },

  handleResponse: function() {
    if (this.shortUrl && this.imageUrl) {
      var content = this.text.replace('{{{url}}}', this.shortUrl);
      Share.View.setContent(content);
      Share.View.setImage(this.imageUrl);
      Share.View.show();
      Share.View.showForm();
      Share.View.enableShareBtn();
      Share.View.setPosition();

      this.shortUrl = '';
      this.imageUrl = '';
    }
  },

  countLetterNumber: function(content) {
    content = $.trim(content);
    var count = 0;
    for (var i = 0, l = content.length; i < l; i++) {
      if (content.charCodeAt(i) <= 127) {
        count += 0.5;
      } else {
        count += 1;
      }
    }
    return Math.ceil(count);
  },

  getZoomLevel: function() {
    if (document.width) {
      return document.width / $(doc).width()
    } else {
      return $(doc).width() /document.documentElement.clientWidth
    }
  },

  calcCaptureDataForFastCompare: function($srcElement, callback) {
    var $comparePopup = $('#' + SELECTORS('huoyan-wrapper'));
    var padding = 10;
    var popupArrowWidth = 6;
    var zoom = this.getZoomLevel();

    var viewPortWidth = Util.getViewPortWidth() * zoom;
    var viewPortHeight = Util.getViewPortHeight() * zoom;

    var scrollPosition = Util.getScrollPosition();
    var scrollTop = scrollPosition.top;
    var scrollLeft = scrollPosition.left;

    var srcElementOuterWidth = $srcElement.outerWidth() * zoom;
    var srcElementOuterHeight = $srcElement.outerHeight() * zoom;
    var popupOuterWidth = $comparePopup.outerWidth() * zoom;
    var popupOuterHeight = $comparePopup.outerHeight() * zoom;
    var srcElementOffset = $srcElement.offset();
    var popupOffset = $comparePopup.offset();

    var captureHeight = Math.max(srcElementOuterHeight, popupOuterHeight) + padding * 6;
    var captureWidth = srcElementOuterWidth + popupOuterWidth + popupArrowWidth + padding * 2;
    var captureTop = Math.min(srcElementOffset.top * zoom, popupOffset.top * zoom) - scrollTop * zoom - padding * 1.5;
    var captureLeft;
    if (popupOffset.left < srcElementOffset.left) {
      captureLeft = popupOffset.left * zoom - scrollLeft * zoom - padding;
    } else {
      captureLeft = srcElementOffset.left * zoom - scrollLeft * zoom - padding;
    }

    // 处理要截图的区域在视口以外的情况
    if (captureLeft < 0) {
      scrollLeft += captureLeft;
      captureLeft = 0;
    }

    if (captureTop < 0) {
      scrollTop += captureTop;
      captureTop = 0;
    }


    // 处理要截图的区域下半部分超出视口，这时候 chrome 的截图 API 无法正常工作
    if (captureLeft + captureWidth > viewPortWidth) {
      // captureWidth = viewPortWidth - captureLeft;
      scrollLeft += captureLeft + captureWidth - viewPortWidth
      captureLeft = viewPortWidth - captureWidth
    }

    if (captureTop + captureHeight > viewPortHeight) {
      // captureHeight = viewPortHeight - captureTop;
      scrollTop += captureTop + captureHeight - viewPortHeight
      captureTop = viewPortHeight - captureHeight
    }

    // 使要截图的区域滚动到可截图区域
    win.scrollTo(scrollLeft, scrollTop);

    // 延迟使得可以滚动以后截图
    setTimeout(function() {
      callback({
        width: captureWidth,
        height: captureHeight,
        top: captureTop,
        left: captureLeft
      });
    }, 50);
  },

  validate: function() {
    var content = $('#' + SELECTORS('share-text')).val();
    var letterNumber = this.countLetterNumber(content);
    if (letterNumber <= 0 || letterNumber > 140) {
      return false;
    }
    return true;
  },

  getImageData: function() {
    var imageUrl = $('#' + SELECTORS('share-image')).attr('src');
    var base64Index = imageUrl.indexOf('base64,');
    return atob(imageUrl.substr(base64Index + 7));
  },

  getTextContent: function() {
    return $.trim($('#' + SELECTORS('share-text')).val());
  },

  share: function() {
    var valid = this.validate();
    if (valid) {
      var options = {
        topic: 'share',
        siteId: this.currentSiteId,
        followRuyitao: $('#' + SELECTORS('follow-us')).get(0).checked
      };
      var imageUrl = $('#' + SELECTORS('share-image')).attr('src');
      if (imageUrl.indexOf('data:') == 0) {
        options.imageData = this.getImageData();
      } else {
        options.imageUrl = imageUrl;
      }
      options.textContent = this.getTextContent();

      S.browser.extension.sendRequest(options, function(result) {
        Share.View.hideForm();
        Share.View.enableShareBtn();
        if (result.success) {
          Share.View.showSuccessResult(result.shareLink);
        } else {
          var reason = result.reason;
          Share.View.showFailureResult(reason.text);
          if (reason.id == 'invalid_access_token') {

          }
        }
      });
    } else {
      Share.View.warn();
      Share.View.enableShareBtn();
    }
  },

  nativeShare: function(opts) {
    var siteId = opts.siteId;
    if (siteId == 'sina_weibo') {
      var params = {};
      params.title = opts.text;
      params.pic = opts.imageUrl;
      params.url = opts.url;
      var e = encodeURIComponent,
        s = window.screen,
        p = [],
        f = 'http://v.t.sina.com.cn/share/share.php?';
      for (name in params) {
        if (params.hasOwnProperty(name)) {
          p.push(name + '=' + e(params[name]));
        }
      }
      p.push('appkey=1965387856');
      f += p.join('&');
      window.open(f, 'mb',
        ['toolbar=0,status=0,resizable=1,width=620,height=450,left=',
          (s.width - 620) / 2, ',top=', (s.height - 450) / 2].join(''));
    }
  }
};

S.Share.View = {
  bindEvents: function() {
    var self = this;
    $('#' + SELECTORS('share-btn')).click(function() {
      if (Share.View.shareBtnEnabled) {
        Share.View.disableShareBtn();
        Share.share();
      }
    });

    $('.' + SELECTORS('share-close-btn')).click(function() {
      Share.popupShowed = false;
      self.hide();
      self.hideSuccessResult();
      self.hideFailureResult();
    });

    $('#' + SELECTORS('share-return-btn')).click(function() {
      self.showForm();
      self.hideFailureResult();
    });

    // IE8及以下不支持 input 和 paste 事件
    var $shareText = $('#' + SELECTORS('share-text'));
    if ($shareText.get(0).oninput) {
      $shareText.on('input', inputHandler);
    } else {
      $shareText.keyup(inputHandler);
    }

    function inputHandler() {
      var content = $(this).val();
      var letterNumber = Share.countLetterNumber(content);
      self.setRemainLetterNumber(letterNumber);
    }

    var resizeTimer = null;
    $(win).resize(function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        self.setPosition();
        self.setOverlaySize();
      }, 200);
    });
  },

  warn: function() {
    $('#' + SELECTORS('share-text')).addClass('' + SELECTORS('warning')).focus();
    setTimeout(function() {
      $('#' + SELECTORS('share-text')).removeClass('' + SELECTORS('warning'));
    }, 800);
  },

  setRemainLetterNumber: function(letterNumber) {
    var letterNumberTip = '';
    var remainLetterNumber = 140 - letterNumber;
    if (remainLetterNumber < 0) {
      letterNumberTip = '已经超过<span id="' + SELECTORS('remain-letter-number') + '"' +
        'class="' + SELECTORS('letter-overflow') + '">' + -remainLetterNumber + '</span>字';
    } else {
      letterNumberTip = '还可输入<span id="' + SELECTORS('remain-letter-number') + '">' +
        remainLetterNumber + '</span>字';
    }

    $('#' + SELECTORS('remain-letter')).html(letterNumberTip);
  },

  setImage: function(url) {
    $('#' + SELECTORS('share-image')).attr('src', url);
  },

  setContent: function(text) {
    $('#' + SELECTORS('share-text')).val(text);
    var letterNumber = Share.countLetterNumber(text);
    this.setRemainLetterNumber(letterNumber);
  },

  show: function() {
    Share.popupShowed = true;
    var $wrapper = $('#' + SELECTORS('share-wrapper'));
    $wrapper.show();
    setTimeout(function() {
      $wrapper.removeClass('' + SELECTORS('share-wrapper-hidden'))
        .addClass('' + SELECTORS('share-wrapper-visible'));
    }, 0);
    this.showOverlay();
  },

  hide: function() {
    var $wrapper = $('#' + SELECTORS('share-wrapper'));
    $wrapper.removeClass('' + SELECTORS('share-wrapper-visible'))
        .addClass('' + SELECTORS('share-wrapper-hidden'));
    setTimeout(function() {
      $wrapper.hide();
    }, 200);
    this.hideOverlay();
  },

  setPosition: function() {
    var $wrapper = $('#' + SELECTORS('share-wrapper'));
    var viewPortWidth = Util.getViewPortWidth();
    var viewPortHeight = Util.getViewPortHeight();
    var offsetWidth = $wrapper.outerWidth();
    var offsetHeight = $wrapper.outerHeight();
    var scrollPosition = Util.getScrollPosition();
    var scrollTop = scrollPosition.top;
    var scrollLeft = scrollPosition.left;

    if ($wrapper.css('position') == 'fixed') {
      scrollTop = 0;
      scrollLeft = 0;
    }

    var left = Math.max(((viewPortWidth - offsetWidth) / 2 + scrollLeft), 0);
    var top = Math.max(((viewPortHeight - offsetHeight) / 2 + scrollTop), 0);
    $wrapper.css({
      top: top + 'px',
      left: left + 'px'
    });
  },

  showOverlay: function() {
    var $overlay = $('#' + SELECTORS('share-overlay'));
    $overlay.show();
    setTimeout(function() {
      $overlay.removeClass('' + SELECTORS('overlay-hidden')).addClass('' + SELECTORS('overlay-visible'));
    }, 0);
    this.setOverlaySize();
  },
  
  hideOverlay: function() {
    var $overlay = $('#' + SELECTORS('share-overlay'));
    $overlay.removeClass('' + SELECTORS('overlay-visible')).addClass('' + SELECTORS('overlay-hidden'));
    setTimeout(function() {
      $('#' + SELECTORS('share-overlay')).hide();
    }, 200);
  },

  setOverlaySize: function() {
    var width = Util.getViewPortWidth();
    var height = Util.getViewPortHeight();
    $('#' + SELECTORS('share-overlay')).width(width).height(height);
  },

  showForm: function() {
    $('#' + SELECTORS('share-form')).show();
  },

  hideForm: function() {
    $('#' + SELECTORS('share-form')).hide();
  },

  showSuccessResult: function(shareLink) {
    $('#' + SELECTORS('check-out-share')).attr('href', shareLink);
    $('#' + SELECTORS('share-success')).show();
  },

  hideSuccessResult: function() {
    $('#' + SELECTORS('share-success')).hide();
  },

  showFailureResult: function(reason) {
    $('#' + SELECTORS('share-failure-reason')).text(reason);
    $('#' + SELECTORS('share-failure')).show();
  },

  hideFailureResult: function() {
    $('#' + SELECTORS('share-failure')).hide();
  },

  shareBtnEnabled: true,

  enableShareBtn: function() {
    this.shareBtnEnabled = true;
    $('#' + SELECTORS('share-btn')).removeClass('' + SELECTORS('share-btn-disabled'))
      .addClass('' + SELECTORS('share-btn-enabled'));
  },

  disableShareBtn: function() {
    this.shareBtnEnabled = false;
    $('#' + SELECTORS('share-btn')).removeClass('' + SELECTORS('share-btn-enabled'))
      .addClass('' + SELECTORS('share-btn-disabled'));
  }
};

})(exports, window, document);(function(S) {
  var Util = S.SearchBox.Util;
  var list = [];
  var sync_order = function(config) {
    if ( !config ) {
      return;
    }
    // config 结构：
    //  cart: [{
    //    "url": "",        // 检查页面 URL 是否匹配此正则表达式，忽略大小写
    //    "selector": "",   // 提取这个选择器的 html
    //    "wait": "",       // 等待一段时间才运行
    //    "repeat": ""      // 反复检查元素是否存在
    //  }]
    var href = Util.getLocationHref(window);
    for ( var type in config ) {
      if ( config.hasOwnProperty(type) ) {
        var siteConfig = config[type];
        for ( var i=0,len=siteConfig.length; i<len; i++ ) {
          var conf = siteConfig[i];
          var re = new RegExp(conf.url, "i");
          if ( re.test(href) ) {
            Util.loadJQuery();
            if ( conf.wait ) {
              delay_send_list_content(conf, href, type, conf.wait);
            } else if ( conf.repeat ) {
              repeat_send_list_content(conf, href, type, conf.repeat);
            } else {
              send_list_content(conf, href, type);
            }
          }
        }
      }
    }
  };

  var delay_send_list_content = function(config, href, type, interval) {
    setTimeout(function() {
      send_list_content(config, href, type);
    }, interval);
  };

  var repeat_send_list_content = function(config, href, type, interval) {
    setTimeout(function() {
      send_list_content(config, href, type);
      repeat_send_list_content(config, href, type, interval);
    }, interval);
  };

  var send_list_content = function(config, href, type) {
    if ( $(config.selector).size() == 0 ) {
      return;
    }
    var htmls = [];
    $.each($(config.selector), function(i, elm) {
      if ( $.inArray(elm, list) == -1 ) {
        list.push(elm);
        htmls.push(elm.innerHTML);
      }
    });
    if ( htmls.length > 0 ) {
      S.browser.extension.sendRequest({
        "topic": "ivy_send_user_collection",
        "type": type,
        "source_url": href,
        "collections": htmls
      });
    }
  };
  
  var check_sync_order = function () {
    S.browser.extension.sendRequest({
      "topic": "oauth_is_authorized"
    }, function(authorized) {
      if ( authorized ) {
        S.browser.extension.sendRequest({
          "topic": "options_get",
          "options": ["sync_order"]
        }, function(options) {
          if ( options.sync_order_result_setting ) {
            S.browser.extension.sendRequest({
              "topic": "get_ivy_config",
              "domain": Util.getLocationProperty(window, 'hostname')
            }, sync_order);
          }
        });
      }
    });
  };

  S.SyncOrder = { init : check_sync_order };
})(exports);
(function(S, win, undefined) {
  var Util = S.SearchBox.Util;
  S.Notification = {
    TEMPLATE_URL: "http://ruyi.taobao.com/extension/ruyitao-notification",
    init: function() {
      if ( win.navigator.userAgent.match(/msie/i) && document.compatMode == 'BackCompat' ) {
        return;
      }
      var self = this;
      S.browser.extension.sendRequest({
        topic: "get_notification",
        url: Util.getLocationHref(win)
      }, function(notification) {
        if ( notification ) {
          S.SearchBox.Util.loadJQuery();
          self.showNotification(notification);
        }
      });
    },

    renderNotification: function(notification) {
      $("#ruyitao-notify-title").text(notification.title);
      $("#ruyitao-notify-body").html(notification.content);
      $("#ruyitao-notify").show();
      if ( typeof notification.width != "undefined" )  {
        var width = parseInt(notification.width) || 160;
        var height = parseInt(notification.height) || 75;
        $("#ruyitao-notify-body").css({ width: width, height: height });
        $("#ruyitao-notify").css({
          bottom: -1 * (height + 41),
          width: $("#ruyitao-notify-body").outerWidth()
        });
      }
    },

    bindEvents: function(notification) {
      $("#ruyitao-notify-cb").click(function() {
        S.browser.extension.sendRequest({
          topic: "set_notification",
          id: notification.id,
          status: $(this).is(':checked') ? 'close' : ''
        });
      });
      $("#ruyitao-notify-hide").click(function() {
        $("#ruyitao-notify").slideUp(500);
        S.browser.extension.sendRequest({
          topic: "set_notification",
          id: notification.id,
          status: "hide"
        });
      });
    },

    slideUp: function() {
      var bottom = parseInt($("#ruyitao-notify").css('bottom'));
      var animate_timer = null;
      var interval = 50;
      var step = Math.abs(bottom) / 30;
      var hide_timer;
      var duration = 10*1000; // 消息展示停留时间 10s
      
      var move_up = function() {
        if ( bottom < 0 ) {
          bottom += step;
          $("#ruyitao-notify").css({ bottom: bottom });
          animate_timer = setTimeout(move_up, interval);
        } else if ( animate_timer ) {
          clearTimeout(animate_timer);
        }
      };
      animate_timer = setTimeout(move_up, interval);

      var hideNotification = function() {
        if ( hide_timer ) {
          clearTimeout(hide_timer);
        }
        hide_timer = setTimeout(function() {
          $("#ruyitao-notify").slideUp(500);
        }, duration);
      };
      $("#ruyitao-notify").mouseenter(function() {
        if ( hide_timer ) {
          clearTimeout(hide_timer);
          hide_timer = undefined;
        }
      }).mouseleave(hideNotification);
      hideNotification();
    },

    trackEvents: function(notification) {
      S.SearchBox.Util.sendLog("showad_" + notification.campaign + "_" + notification.id, Util.getLocationHref(win));
      $("#ruyitao-notify .ruyitao-track-ad").click(function() {
        S.SearchBox.Util.sendLog("clickad_" + notification.campaign + "_" + notification.id, this.href + '|' + Util.getLocationHref(win));
      });
    },

    showNotification: function(notification) {
      var self = this;
      S.SearchBox.Util.getTemplate(notification.template || self.TEMPLATE_URL, function(template) {
        $(document.body).append(template);
        self.renderNotification(notification);
        self.bindEvents(notification);
        self.slideUp();
        self.trackEvents(notification);
      });
    }
  };
})(exports, window);
(function() {
  var href = S.SearchBox.Util.getLocationHref();
  if ( href.indexOf('ruyi.taobao.com') == -1 ) {
    return;
  }
  var oauth_apps = [
    {
      "app": "ruyitao",
      "redirect_uri": "http://ruyi.taobao.com/service/access-token-callback.html?app=ruyitao"
    }
  ];
  for ( var i=0,len=oauth_apps.length; i<len; i++ ) {
    if ( href.indexOf(oauth_apps[i].redirect_uri) == 0 ) {
      S.browser.extension.sendRequest({
        topic: "oauth_callback",
        redirect_url: href,
        application: oauth_apps[i].app
      });
      break;
    }
  }
})();
'use strict';
if ( !exports ) var exports = {};
(function(S) {
  var adjustPosition = function (element, getDirection, maxWidth, itemSelector) {
    var maxHeight = $(element).height(),
        //如果初始的宽度不为0，需重新计算
        maxWidth = maxWidth > 0 ? $(element).width() : maxWidth,
        position = [],
        maxTop = 0,
        maxLeft = 0;
        //console.log('maxWidth', maxWidth);
    function getLastPosition(direction) {
      if(direction)
        for(var i=position.length-1; i>=0; i--) {
          if(position[i].direction === direction) {
            return position[i];
          }
        }
      else 
        return position[position.length-1];
    }
    $(itemSelector, element).each(function(i, obj) {
      //格式，String|{direction：'x|y', width: Number, height: Number}
      var directionObj = (typeof getDirection == 'function' ? getDirection(i, {maxWidth: maxWidth, maxHeight: maxHeight, element: $(obj)}) : getDirection);
      var direction = directionObj, width, height;
      if(typeof directionObj != 'string') {
        direction = directionObj && directionObj.direction || 'y';
      }
      //计算width和height
      $(obj).removeClass('hide');
      //console.log($(obj).outerWidth(true), $(obj).is(':hidden'));
      width = directionObj && directionObj.width || $(obj).outerWidth(true);
      height = directionObj && directionObj.height || $(obj).outerHeight(true);
      //console.log(i, direction);
      //console.log($(obj).width(), $(obj).outerWidth(true), $(obj).outerWidth());
      var lastPosition = getLastPosition() || {top: 0, left: 0, width: 0, height: 0};
      
      var currentPosition = {
        direction: direction,
        top: 0,
        left: 0,
        width: width,
        height: height
      };
      
      switch(direction) {
        case 'x': 
          currentPosition.left = lastPosition.left + lastPosition.width;
          currentPosition.top = lastPosition.top;
          break;
        case 'y':
        default: 
          currentPosition.left = lastPosition.left;
          currentPosition.top = lastPosition.top + lastPosition.height;
      }
      //如果上一个是X方向，当前是Y方向，需要获取上一个Y方向left作为当前的left
      if(lastPosition.direction == 'x' && currentPosition.direction == 'y') {
        var yPosition = getLastPosition('y');
        if(yPosition) currentPosition.left = yPosition.left;
      }
      
      //如果是Y方向，并且Y方向放不下该元素，则需另起一列
      //console.log('maxHeight', maxHeight);
      if(direction == 'y' && currentPosition.top+currentPosition.height > maxHeight) {
        currentPosition.top = 0;
        currentPosition.left = maxLeft;
      }
      //如果是X方向，并且设置了maxWidth，并且X方向放不下该元素，则从下方另起一列
      if(direction == 'x' && maxWidth > 0 && currentPosition.left+currentPosition.width > maxWidth) {
        currentPosition.top = maxTop;
        currentPosition.left = 0;
      }
      
      //S.console.log('maxWidth:', maxWidth);
      //S.console.log('maxHeight', maxHeight);
      $(element).show();
      //console.log('display', $(element).is(':hidden'), $(element).height());
      //console.log(currentPosition.left, currentPosition.width, maxWidth);
      if((maxWidth>0 && currentPosition.left+currentPosition.width>maxWidth)
          || (currentPosition.top+currentPosition.height>maxHeight)
          ) {
        $(obj).addClass('hide');
      }// else {
        //$(obj).removeClass('hide');
      //}
      
      var objPosition = $(obj).position(),
          isChanged = objPosition.top != currentPosition.top || objPosition.left != currentPosition.left;
      //isChanged && $(obj).removeClass('animate');
      $(obj).css({
        left: currentPosition.left,
        top: currentPosition.top
      });
      //setTimeout(function(){$(obj).addClass('animate');}, 0);
      
      //计算后如果该元素还是隐藏的，则忽略该元素（目前列表页的loading有使用）
      //不能使用$(obj).is(':hidden')，因为如果该节点的祖先元素有hidden的就返回ture
      //应当只判断当前节点是否hidden
      if($(obj).css('display') === 'none') {
        return;
      }
      
      //添加到position数组中，以便后边的元素进行计算
      position.push(currentPosition);
      
      //设置top和left最大值，以便后边的元素进行计算
      maxTop = Math.max(maxTop, currentPosition.top + currentPosition.height);
      maxLeft = Math.max(maxLeft, currentPosition.left + currentPosition.width);
      
    });
    
    //如果初始的宽度为0，设置实际的宽度
    maxWidth<=0 && $(element).width(maxLeft);
  };
  
  var defaultOptions = {
    
  };
  /**
   * @name listview
   * @element ANY
   * @param {Boolean} listviewDisabled resize时是否进行调整位置的计算
   * @param {String} listviewDirection 根据index返回方向（x或y）的函数或'x'|'y'
   * @param {Function} listviewAdjustPositionBefore 调整位置前触发的事件
   * @param {Function} listviewAdjustPositionComplete 调整位置后触发的事件
   * @param {String} listviewItemSelector item选择器
   * @description 列表
   **/
  var Listview = function(element, attr) {
    if($(element).length <= 0) return null;
    
    this._element = element;
    this._attr = $.extend({}, defaultOptions, attr);
    this._maxWidth = $(element).width();
    //S.console.log('maxWidth', this._maxWidth);
    
    this._bindEvents();
    //调整每个item的位置
    this.adjustPosition(this.ADJUST_TYPE.INIT);
  };
  Listview.prototype = {
    constructor: Listview,
    ADJUST_TYPE: {
      INIT: 'init',
      RESIZE: 'resize'
    },
    _triggerEvent: function(fn, args) {
      typeof fn === 'function' && fn.apply(this, args||[]);
    },
    adjustPosition: function(adjustType) {
      var element = this._element, attr = this._attr;
      if(!attr.listviewDisabled) {
        this._triggerEvent(attr.listviewAdjustPositionBefore, [adjustType, element]);
        adjustPosition(element, attr.listviewDirection, this._maxWidth, attr.listviewItemSelector);
        this._triggerEvent(attr.listviewAdjustPositionComplete, [adjustType, element]);
      }
    },
    //_resizeTimer: null,
    cancelTimer: function() {
      this._resizeTimer && clearTimeout(this._resizeTimer);
      delete this._resizeTimer;
    },
    resize: function() {
      var self = this;
      this.cancelTimer();
      this._resizeTimer = setTimeout(function() {
        self.adjustPosition(self.ADJUST_TYPE.RESIZE);
      }, 20);
    },
    _bindEvents: function() {
      $(window).resize(this._resize = $.proxy(this.resize, this));
    },
    _unbindEvents: function() {
      $(window).unbind('resize', this._resize);
      delete this._resize;
    },
    destroy: function() {
      this.cancelTimer();
      this._unbindEvents();
      delete this._element;
      delete this._attr;
      delete this._maxWidth;
    }
  };
  
  S.Listview = Listview;
})(exports);

var chain = new S.filterChain(S.SearchBox.App, S.sameBookAssist, S.productSearch);
chain.run();
S.SrpCompare.init();
S.CnaCookie.init();
S.PriceCurve.init();
S.SerpList.init();
S.Notification.init();
S.Share.init();
S.SyncOrder.init();
})(window, exports);
