if ( !exports ) var exports = {};

(function(S, undefined) {
  S.constants = {
    // open_after_install_page 可选值：
    //  - never 从不打开页面
    //  - installing 只在安装时打开
    //  - upgrading 只在更新时打开
    //  - always 安装和升级时都打开
    open_after_install_page: "always",
    cache_size: 70,
    cache_expire_time: 3600 * 2,
    site_config: {
      book: {
        'product.dangdang.com' : {
          index: 1, // 1, dangdang; 2: jingdong: 3: douban
          patterns: [{
            url:'product.aspx(?:\\?|.+&)product_id=(?:\\d+)',
            meta: {
              isbn: [{
                xpath: '.book_detailed li span',
                regexp: 'I S B N\uff1a(\\w+)'
              }],
              author : [{
                xpath: '.book_detailed p',
                regexp: '\u4f5c\u3000\u3000\u8005\uff1a[^<]*<a [^>]+>([^<]+)<'
              }],
              price: [{
                xpath: '.book_r .price_d span',
                regexp: '\uffe5([\\d\\.]+)'
              }]
            }
          }]
        },
        'book.360buy.com' : {
          index: 2,
          patterns: [{
            url: '.',
            meta: {
              isbn: [{
                xpath: '#summary li',
                regexp: '\uff29\uff33\uff22\uff2e\uff1a</span>(\\w+)'
              }],
              author : [{
                xpath: '#summary li',
                regexp: "\u4f5c\u3000\u3000\u8005\uff1a[\\s\\S]+?<a [^>]+>(?:\\[[^\\]]+\\]\\s*)?([^<]+)<"
              }],
              price: [{
                xpath: '#priceinfo',
                regexp: '([\\d\\.]+)'
              }]
            }
          }]
        },
        'book.douban.com' : {
          index: 3,
          patterns: [{
            url: '.',
            meta: {
              isbn: [{
                xpath: "#info",
                regexp: "ISBN:</span>\\s+(\\w+)"
              }],
              author: [{
                xpath: "#info",
                regexp: "\u4f5c\u8005</span>[^<]+<a [^>]+>(?:\\[[^\\]]+\\]\\s*)?([^<]+)<"
              }],
              price: [{
                xpath: "#info",
                regexp: "\u5b9a\u4ef7:</span>\\s*([\\d\\.]+)"
              }]
            }
          }]
        },
        'www.amazon.cn' : {
          index: 4,
          patterns: [{
            url: /(\/(?:dp|dp\/product|-|o\/asin|ASIN|gp\/product)\/+([0-9A-Za-z]{10})(\/|\?|$|%3F|#)|asin=([0-9A-Za-z]{10}))/,
            meta: {
              isbn: [{
                xpath: "table .content li",
                regexp: "ISBN:</b>\\s+(\\w+)"
              }],
              author: [{
                xpath: "#handleBuy .buying",
                regexp: "<a[^>]+>([^<]+)<\/a> \\(\u4f5c\u8005\\)"
              }],
              price: [{
                xpath: ".priceLarge",
                regexp: "([\\d\\.]+)"
              }]
            }
          }]
        },
        'item.taobao.com': {
          index: 5,
          patterns: [{
            url: '.',
            meta: {
              isbn: [{
                xpath: "#attributes .attributes-list",
                regexp: "ISBN[^><]*?:&nbsp;(\\w+)"
              }],
              author: [{
                xpath: "#attributes .attributes-list",
                regexp: "\u4f5c\u8005:&nbsp;([^<]+?)(?:\\s*\u8457)?<"
              }],
              price: [{
                xpath: "#J_StrPriceModBox",
                regexp: "([\\d.]+)"
              }]
            }
          }]
        },
        'item.tmall.com': {
          index: 5,
          patterns: [{
            url: '.',
            meta: {
              isbn: [{
                xpath: "#attributes .attributes-list",
                regexp: "ISBN[^><]*?:&nbsp;(\\w+)"
              }],
              author: [{
                xpath: "#attributes .attributes-list",
                regexp: "\u4f5c\u8005:&nbsp;([^<]+?)(?:\\s*\u8457)?<"
              }],
              price: [{
                xpath: "#J_StrPriceModBox",
                regexp: "([\\d.]+)"
              }]
            }
          }]
        }
      },
      product: {
        "360buy.com" : 1,
        "99read.com" : 1,
        "amazon.cn" : 1,
        "beifabook.com" : 1,
        "bookschina.com" : 1,
        "bookuu.com" : 1,
        "china-pub.com" : 1,
        "coo8.com" : 1,
        "dangdang.com" : 1,
        "newegg.com.cn" : 1,
        "tao3c.com" : 1,
        "icson.com": 1,
        "51buy.com": 1,
        "suning.com": 1,
        "taobao.com" : [
          "http://item\.taobao\.com/auction/item_detail",
          "http://item\.taobao\.com/item\.htm"
        ],
        "tmall.com" : [
          "http://item\.tmall\.com/item\.htm",
          "http://list\.3c\.tmall\.com/spu-",
          "http://spu\.tmall\.com/spu-",
          "http://detail.tmall.com"
        ]
      },
      search: {
        "zh": {
          "taobao.com": {
            "ruyi": [
              {
                "d": "&",
                "k": "testkeyword",
                "s": ""
              }
            ]
          },
          "360buy.com": {
            "search": [
              {
                "k" : "keyword",
                "d": "&",
                "s": ""
              }
            ]
          },
          "dangdang.com": {
            "search": [
              {
                "k": "key",
                "d": "&",
                "s": ""
              },
              {
                "k": "q",
                "d": "&",
                "s": ""
              }
            ]
          },
		  "taobao.com" : {
		    "list" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "list.mall" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "list.3c" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "s" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "s8" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "search" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "try" : [
			  {
			    "k" : "",
			    "d" : "",
			    "s" : "J_TrialKeyword",
			    "sk" : "\u8bf7\u8f93\u5165\u641c\u7d22\u6761\u4ef6"
			  }
		    ]
		  },
		  "tmall.com" : {
		    "list" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "list.3c" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ],
		    "list.xie" : [
			  {
			    "k" : "q",
			    "d" : "&",
			    "s" : ""
			  }
		    ]
		  }
        },
        "en": {
          "taoassistant.com": {
            "DUMMY": [
              {
                "d": "&",
                "k": "testkeyword",
                "s": ""
              }
            ]
          },
          "ebay.com":{
            "search.half":[
              {
                "k":"",
                "d":"",
                "s":"query"
              }
            ],
            "shop":[
              {
                "k":"_nkw",
                "d":"&",
                "s":""
              }
            ]
          },
          "google.com":{
            "www":[
              {
                "k":"q",
                "d":"&",
                "s":""
              },
              {
                "k":"q",
                "d":"&",
                "s":""
              },
              {
                "k":"query",
                "d":"&",
                "s":""
              }
            ],
            "books":[
              {
                "k":"q",
                "d":"&",
                "s":""
              }
            ],
            "encrypted":[
              {
                "k":"q",
                "d":"&",
                "s":""
              },
              {
                "k":"query",
                "d":"&",
                "s":""
              }
            ]
          },
          "bing.com":{
            "www":[
              {
                "k":"q",
                "d":"&",
                "s":""
              }
            ],
            "DUMMY":[
              {
                "k":"q",
                "d":"&",
                "s":""
              }
            ]
          },
          "barnesandnoble.com":{
            "productsearch":[
              {
                "k":"WRD",
                "d":"&",
                "s":""
              }
            ]
          },
          "fatwallet.com":{
            "www":[
              {
                "k":"query",
                "d":"&",
                "s":""
              },
              {
                "k":"search",
                "d":"&",
                "s":""
              }
            ]
          },
          "slickdeals.net":{
            "DUMMY":[
              {
                "k":"search",
                "d":"&",
                "s":""
              },
              {
                "k":"q",
                "d":"&",
                "s":""
              }
            ]
          },
          "bestbuy.com":{
            "www":[
              {
                "k":"st",
                "d":"&",
                "s":""
              },
              {
                "k":"searchterm",
                "d":"&",
                "s":""
              }
            ]
          },
          "walmart.com":{
            "www":[
              {
                "k":"search_query",
                "d":"&",
                "s":""
              },
              {
                "k":"redirect_query",
                "d":"&",
                "s":""
              }
            ]
          }
        }
      },
      movie: {
        "movie.douban.com" : [
          {
            patterns : [{
              list : "#subject_list",
              img : ".item a.nbg>img",
              a : ".item a.nbg"
            }],
            url : "movie\.douban\.com/.+$"
          },
          {
            patterns : [{
              list : "body",
              img : ".item a>img",
              a : ".item a"
            }],
            url : "movie\.douban\.com/$"
          }
        ]
      },
      detail_info: {}
    }
  };
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
