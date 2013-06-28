if ( !exports ) var exports = {};
(function(S, undefined) {
    Components.utils.import("resource://ruyitao/util.js", S);
    S.exports.extend(S, S.exports);
    Components.utils.import("resource://ruyitao/options.js", S);
    S.options = S.exports.options;
    Components.utils.import("resource://ruyitao/factory.js", S);
    S.factory = S.exports.factory;
    Components.utils.import("resource://ruyitao/constants.js", S);
    S.constants = S.exports.constants;
    Components.utils.import("resource://ruyitao/console.js", S);
    S.console = S.exports.console;
  var DynamicFunction = {
    _functions: [],
    register: function(args, body){
      var func = {
        "args": args.split(/\s*,\s*/),
        "func": body
      };
      this._functions.push(func);
      return this._functions.length-1;
    },
    call: function(id){
      var func = this._functions[id];
      if ( func ) {
        var wrappedJS = "function executeJS() {" + func.func + "}; executeJS();"
        var context = {};
        for ( var i=0, len=func.args.length; i<len; i++ ) {
          context[func.args[i]] = arguments[i+1];
        }
        var sandbox = new Components.utils.Sandbox("http://ruyi.taobao.com", { sandboxPrototype: context });
        return Components.utils.evalInSandbox(wrappedJS, sandbox);
      } else {
        throw Error("Undefined function " + id);
      }
    }
  };

  var setTimeout = function(callback, delay) {
    var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    return timer.initWithCallback(callback, delay, timer.TYPE_ONE_SHOT);
  };
    var se = {
        search_engines: {}
    };
    /**
     * 构造搜索链接
     * @param options 构造搜索链接参数
     *   - urlfunc 构造搜索链接函数，参数为 options, exports。
     *   - url 搜索链接模板，模板中可以包括 {key} 占位符，key 是 options 中的参数名，
     *         例如 http://search.360buy.com/?keyword={K}，而 options.K = ipad
     *         则生成链接 http://search.360buy.com/?keyword=ipad。特殊参数包括：
     *         K 搜索关键字，P 页码，A 应用
     *   - encoding 链接参数编码形式，目前只支持 gb。如果不指定或不是 gb，则不做编码
     *   - callback 成功构造搜索链接后回调函数
     */
    se.search_url = function(options) {
        if ( options.encoding == 'gb' ) {
            Components.utils.import("resource://ruyitao/encode.js", S);
            S.encode = S.exports.encode;
            options.Keyword = S.encode.gb2312.encode(options.Keyword);
        } else {
            options.Keyword = encodeURIComponent(options.Keyword);
        }
        if ( typeof options["urlfunc"] != "undefined" ) {
            var url = typeof options.urlfunc == "function"
                ? options.urlfunc(options, exports)
                : DynamicFunction.call(options.urlfunc, options, exports);
            if ( url ) {
                options.callback(url);
            }
        } else if ( typeof options["url"] != "undefined" ) {
            options.K = options.Keyword;
            options.P = options.ItemPage;
            options.F = S.constants.pid;
            options.U = S.constants.uid;
            options.C = S.constants.cnaCookie;
            var url = options.url.replace(/{(\w+)}/g, function(str, key) {
                return typeof options[key] != "undefined" ? options[key] : '';
            });
            options.callback(url);
        }
    };

    /**
     * Examples:
     *  get_match('hello', /(h)/)             // == 'h'
     *  get_match('hello', [/(h)(e)/, e])     // == 'e'
     *  get_match('hello', function(str) {}) 
     *
     * @param String str string to match
     * @param exp 
     *    - regexp: return the first match string
     *    - [regexp, index]: return match string at the index
     *    - function: call with given string
     */
    se.get_match = function(str, exp) {
        if ( typeof exp.exec == "function" ) { // is RegExp
            var match = exp.exec(str);
            if ( match ) {
                return match[1];
            }
        } else if ( typeof exp == "function" ) {
            return exp(str);
        } else {
            var match = exp[0].exec(str);
            if ( match ) {
                return match[exp[1]];
            }
        }
        return null;
    };

    /**
     * @param options
     *   - valid function to check html valid
     *   - ASIN: regexp or function
     *   - ...
     */
    se.parse_item = function(html, options) {
        var item = {};
        if ( typeof options.valid == "function" && !options.valid(html) ) {
            return null;
        }
        for ( var name in options ) {
            if ( name == 'valid' ) {
                continue;
            }
            var match = se.get_match(html, options[name]) || '';
            if ( match && typeof match == "object" ) {
                S.extend(item, match);
            } else {
                item[name] = match;
            }
        }
        if ( !item.ASIN ) return null;
        return item;
    };

    /**
     * @param options
     *   - total_pages
     *   - separator
     *   - item
     */
    se.parse = function (html, options) {
        var results = { TotalPages:0, Items:[] };
        if ( (results.TotalPages = se.get_match(html, options.total_pages)) > 0 ) {
            var last_pos = undefined;
            var match;
            var item;
            var chunk;
            while ( (match = options.separator.exec(html)) != null ) {
                var pos = match.index;
                if ( last_pos ) {
                    chunk = html.substr(last_pos, pos-last_pos+1).replace(/\n/g, '');
                    item = se.parse_item(chunk, options.item);
                    if ( item ) results.Items.push(item);
                }
                last_pos = pos;
            }
            if ( last_pos ) {
                chunk = html.substr(last_pos).replace(/\n/g, '');
                item = se.parse_item(chunk, options.item);
                if ( item ) results.Items.push(item);
            }
        } else {
            S.console.debug("page not match");
        }
        return results;
    };

    /**
     * 构造点击链接
     */
    se.click_url = function(url){
        return S.options.get_api_url() + "/ext/clickurl"
            + "?url=" + encodeURIComponent(url)
            + "&pid=" + S.constants.pid;
    };

    se.add_css_prefix = function(str, prefix) {
        if ( typeof prefix == "undefined" ) prefix = 'ruyitao-';
        return str.replace(/class="([^"]+)"/g, function(str, classes) {
            var classes = classes.split(/\s+/);
            for ( var i=0; i<classes.length; i++ ) {
                classes[i] = prefix + classes[i];
            }
            return 'class="'+ classes.join(" ") + '"';
        });
    };

    /**
     * 安装搜索引擎
     * @param search_engine 搜索引擎包括以下参数：
     *  - name 必须，全局唯一
     *  - url 搜索链接模板
     *  - urlfunc 搜索链接函数，url, urlfunc 至少需要提供1个
     *  - encoding 搜索参数编码形式
     *  - parse 解析函数，可选。如果未提供，则使用 JSON 解析。
     *  - selected 值为 true 时默认启用
     *  - enabled 1 可用于前端显示， 0 只提供后端调用。
     * 对于可用于前端显示的搜索引擎必须提供以下参数：
     *  - homepage 网站链接
     *  - title 前端显示时的 TAB 标题
     *  - locales locale 分组
     *  - order 排序
     */
    se.install = function(search_engine) {
        try {
            if ( typeof search_engine.name == "undefined" ) {
                throw Error("Search engine name not defined");
            }
            if ( typeof search_engine.urlfunc == "undefined" ) {
                if ( typeof search_engine.url == "undefined" ) {
                    throw Error("Search engine url not defined");
                }
            } else {
                search_engine.urlfunc = DynamicFunction.register('options,exports', search_engine.urlfunc);
            }
            search_engine.selected = (typeof search_engine.selected == "undefined") || (search_engine.selected == 1);
            search_engine.enabled = (search_engine.enabled == 1);
            search_engine.submit_data = (search_engine.submit_data == 1);
            search_engine.order = parseInt(search_engine.order);
            if ( search_engine.enabled ) {
                if ( typeof search_engine.title == "undefined" ) {
                    throw Error("Search engine title not defined");
                }
            }
            if ( typeof search_engine.parse == "undefined" ) {
                search_engine.parse = function(html, exports) {
                    return JSON.parse(html);
                };
            } else {
                search_engine.parse = DynamicFunction.register('html, exports', search_engine.parse);
            }
            se.search_engines[search_engine.name] = search_engine;
        } catch ( e ) {
            S.console.error("install search engine "+ search_engine.name +" failed: " + e.message);
        }
    };

    /**
     * 从服务器获得搜索引擎配置进行初始化
     * @param callback 成功初始化后回调函数
     */
    se.init = function(callback) {
        var cache = S.factory.getCache();
        var init = function(data) {
            se.search_engines = {};
            for ( var i=0; i<data.length; i++ ) {
                se.install(data[i]);
            }
            if ( typeof callback == "function" ) callback();
        };
        var search_engines = cache.get('search_engines');
        if ( search_engines ) {
            init(search_engines);
        } else {
            init(se._search_engines);
            S.ajax({
                url: S.options.get_secure_api_url() + '/ext/searchengines',
                data: {
                    version: S.constants.version,
                    application: S.constants.application,
                    pid: S.constants.pid,
                    locale: S.options.get_locale()
                },
                dataType: 'json',
                success: function(data) {
                    cache.set('search_engines', data);
                    init(data);
                },
                error: function() {
                    // 如果失败，1 分钟后重试
                    setTimeout(function() {
                        se.init();
                    }, 60*1000);
                }
            });
        }
    };

    /**
     * 执行搜索并获得搜索结果
     * @param name 搜索引擎名字
     * @param options 搜索参数。一般提供 Keyword, ItemPage
     * @param callbacks 搜索回调，包括 success 和 error 两种回调
     */
    se.search = function(name, options, callbacks){
        if ( typeof se.search_engines[name] == "undefined" ) {
            callbacks.error(null, null, "Unknown search engine");
            return;
        }
        var search_engine = se.search_engines[name];
        options.callback = function(url) {
            S.ajax({
                url: url,
                dataType: 'text',
                success: function(html) {
                  var refreshMeta = /<meta\s+http-equiv="refresh"\s+content="\d+;url=(http:\/\/.+)"/;
                  var matchRefreshMeta = html.match(refreshMeta);
                  if (matchRefreshMeta && matchRefreshMeta[1]) {
                    options.callback(matchRefreshMeta[1]);
                    return;
                  }
                    options.callbacks = {
                        success: function(results) {
                          callbacks.success(results);
                          if (search_engine.name == 'jingdong' ||
                              search_engine.name == 'suning') {
                            se.parseImagePrice(search_engine.homepage, results.Items, function(items) {
                              results.Items = items;
                              se.submit(search_engine, url, results)
                            })
                          } else {
                            se.submit(search_engine, url, results);
                          }
                        },
                        error: callbacks.error
                    };
                    se.options = options;
                    var results = typeof search_engine.parse == "function"
                        ? search_engine.parse(html, exports)
                        : DynamicFunction.call(search_engine.parse, html, exports);
                    if ( results ) {
                        options.callbacks.success(results);
                    }
                },
                error: callbacks.error
            });
        };
        if ( search_engine.urlfunc ) {
            options.urlfunc = search_engine.urlfunc;
        } else {
            options.url = search_engine.url;
        }
        options.encoding = search_engine.encoding;
        se.search_url(options);
    };

    se.parseImagePrice = function(domain, items, callback) {
      var l = items.length
      var item;
      var price;
      var priceImgUrl;
      var counter = 0;
      for (var i = 0; i < l; i++) {
        item = items[i];
        price = item.Price;
        if (price.indexOf('<img') >= 0) {
          priceImgUrl = /<img\s+.*src="(.+png)".*\s*\/>/.exec(price)
          if (priceImgUrl && priceImgUrl[1]) {
            (function(index, imgUrl) {
              S.service.helper.parseImagePrice(domain, imgUrl, function(price) {
                if (price) {
                  items[index].Price = price
                  S.console.debug('Parsed image price: ' + index + ' - ' + price)
                }

                counter++;
                if (counter == l) {
                  callback(items)
                }
              })
            })(i, priceImgUrl[1])
            continue;
          }
        }
        // 当价格没有识别为 IMG 元素的时候保留原始值
        counter++
        if (counter == l) {
          callback(items)
        }
      }
    };

    se.has = function(name){
        return name in se.search_engines;
    };
    
    se.get = function(name){
        return se.search_engines[name];
    };

    se.submit = function(search_engine, url, data) {
      if ( !search_engine.submit_data ) {
        return;
      }
        if ( typeof data != "object" || typeof data.Items != "object"
             || typeof data.Items.length == "undefined" || data.Items.length == 0 ) {
            return;
        }
        data.source_url = url;
        S.ajax({
            url: S.options.get_api_url() + '/ext/submit',
            data: {
                uid: S.constants.uid,
                data: JSON.stringify(data)
            },
            type: 'post'
        });
    };

    se._search_engines = [
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.suning.com",
      "host" : "suning\\.com",
      "locales" : "zh",
      "name" : "suning",
      "order" : 1010,
      "selected" : false,
      "title" : {
         "en" : "Suning",
         "zh" : "\u82cf\u5b81"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=suning&page={P}&pid={F}"
   },
   {
      "enabled" : false,
      "encoding" : "def",
      "locales" : "zh",
      "name" : "product_search",
      "order" : 1007,
      "selected" : true,
      "url" : "http://ruyi.taobao.com/ext/productSearch?q={K}&pid={F}&u={U}&c={C}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.etao.com",
      "host" : "",
      "locales" : "zh",
      "name" : "etao",
      "order" : 1021,
      "selected" : true,
      "title" : {
         "en" : "Etao",
         "zh" : "\u4e00\u6dd8"
      },
      "url" : "http://ruyi.taobao.com/ext/etaoSearch?q={K}&application={A}&pid={F}&page={P}&version=3.3.2"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.amazon.cn",
      "host" : "amazon\\.cn",
      "locales" : "zh",
      "name" : "amazoncn",
      "order" : 1002,
      "selected" : true,
      "title" : {
         "en" : "Amazon Cn",
         "zh" : "\u4e9a\u9a6c\u900a"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=amazon&page={P}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.yihaodian.com",
      "host" : "yihaodian\\.com",
      "locales" : "zh",
      "name" : "yihaodian",
      "order" : 1009,
      "selected" : false,
      "title" : {
         "en" : "Yihaodian",
         "zh" : "\u4e00\u53f7\u5e97"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=yihaodian&page={P}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.dangdang.com",
      "host" : "dangdang\\.com",
      "locales" : "zh",
      "name" : "dangdang",
      "order" : 1005,
      "selected" : true,
      "title" : {
         "en" : "DangDang",
         "zh" : "\u5f53\u5f53"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=dangdang&page={P}&pid={F}"
   },
   {
      "enabled" : false,
      "encoding" : "def",
      "locales" : "zh",
      "name" : "amazoncn_book",
      "selected" : true,
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=amazon&page={P}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.360buy.com",
      "host" : "360buy\\.com",
      "locales" : "zh",
      "name" : "jingdong",
      "order" : 1004,
      "selected" : true,
      "title" : {
         "en" : "JingDong",
         "zh" : "\u4eac\u4e1c"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=360buy&page={P}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.tmall.com",
      "host" : "tmall\\.com",
      "locales" : "zh",
      "name" : "taobao",
      "order" : 1001,
      "selected" : true,
      "title" : {
         "en" : "Tmall",
         "zh" : "\u5929\u732b"
      },
      "url" : "http://ruyi.taobao.com/ext/taobaoSearch?keyword={K}&application={A}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.coo8.com",
      "host" : "coo8\\.com",
      "locales" : "zh",
      "name" : "coo8",
      "order" : 1009,
      "selected" : false,
      "title" : {
         "en" : "Coo8",
         "zh" : "\u5e93\u5df4"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=coo8&page={P}&pid={F}"
   },
   {
      "enabled" : true,
      "encoding" : "def",
      "homepage" : "http://www.51buy.com",
      "host" : "51buy\\.com",
      "locales" : "zh",
      "name" : "icson",
      "order" : 1006,
      "selected" : false,
      "title" : {
         "en" : "YiXun",
         "zh" : "\u6613\u8fc5"
      },
      "url" : "http://ruyi.taobao.com/ext/search?q={K}&seller=51buy&page={P}&pid={F}"
   }
]
;
    S.SearchEngine = se;
})(exports);
var EXPORTED_SYMBOLS = ["exports"];
