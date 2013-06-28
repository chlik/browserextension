/**
 * browser.js - emulate chrome.extension.* and chrome.tabs.* for firefox
 * Copyright (c) 2010 Ookong Ltd. Co. (ookong.com).
 *
 * interface browser = {
 *     name: String,
 *     tabs: {
 *         function executeScript(tab, details[, callback]);
 *         function create(options[, callback]);
 *         function getCurrent(callback)
 *         function sendRequest(tab, request, responseCallback);
 *     },
 *     extension: {
 *         baseURI: String,
 *         function getURL(path);
 *         onRequest: {
 *             function addListener(function listener(request, sender, sendResponse) {}),
 *             function removeListener(listener);
 *         }
 *     }
 * }
 */
if ( !exports ) var exports = {};
(function(S, undefined) {
    Components.utils.import("resource://ruyitao/util.js", S);
    S.exports.extend(S, S.exports);
    Components.utils.import("resource://ruyitao/console.js", S);
    S.console = S.exports.console;
    Components.utils.import("resource://ruyitao/tab-manager.js", S);
    S.TabManager = S.exports.TabManager;
    
    var exposedProperties = ["browser", "console", "PageCache", "filterChain", "i18n", "extend",
      "debounce", "str_repeat", "sprintf", "format_price", "get_cookie", "transform_selector",
      "isNumeric", "site", "SearchBox", "ControlBar", "shareWeibo", "PriceComparationsUI",
      "ItemBar", "sameBookAssist", "productSearch", "etaoLike", "SrpCompare", "CnaCookie",
      "EventProxy", "PriceCurve", "Share", "Notification", "Movie","currentViewType", "SyncOrder",
      "IvyWantBuy", "oauth", "SerpList", "SerpDetail", 'Listview']

    var getFileContent = function( file ) {
        var ioService=Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);
        var scriptableStream=Components
            .classes["@mozilla.org/scriptableinputstream;1"]
            .getService(Components.interfaces.nsIScriptableInputStream);
        var unicodeConverter=Components
            .classes["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        unicodeConverter.charset="UTF-8";

        var channel=ioService.newChannel( file, "UTF-8", null);
        var input=channel.open();
        scriptableStream.init(input);
        var str=scriptableStream.read(input.available());
        scriptableStream.close();
        input.close();

        try {
            return unicodeConverter.ConvertToUnicode(str);
        } catch (e) {
            return str;
        } 
    };

    var getResponseCallback = function(callback) {
        return function(data) {
            if ( typeof callback != "function" ) {
                return;
            }
            // For Obejct and Array, not null
            if ( data && typeof data == "object" ) {
              callback({
                "response": JSON.stringify(data),
                __exposedProps__: {
                  "response": "r"
                }
              });
            } else {
                callback(data);
            }
        };
    };

    var getTabBrowser = function() {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
            .getService(Components.interfaces.nsIWindowMediator);  
        return wm.getMostRecentWindow("navigator:browser").gBrowser;
    };

    var firefox = { name: "firefox" };
    firefox.tabs = {};

    /**
     * get tab object
     * @param Document doc
     */
    firefox.tabs.getTab = function(doc, tab) {
        return {
            document: doc,
            url: (typeof doc.location != "undefined" ? doc.location.href : undefined),
            //tab: tab,
            id: S.TabManager.getIdByTab(tab)
        }
    };

    /**
     * FIXME: the tab can't use with firefox.tabs.sendRequest if not selected. 
     * maybe this solve the problem
     * // BETTER WAY  
     * var newTabBrowser = gBrowser.getBrowserForTab(gBrowser.addTab("http://www.google.com/"));  
     * newTabBrowser.addEventListener("load", function () {  
     *   newTabBrowser.contentDocument.body.innerHTML = "<div>hello world</div>";  
     * }, true);  
     */
    firefox.tabs.create = function(options, callback) {
        var gBrowser = getTabBrowser();
        var tab = gBrowser.addTab(options.url);
        var thetab = {"tab": tab};
        if (options.selected) {
            gBrowser.selectedTab = tab;
        }
        var newTabBrowser = gBrowser.getBrowserForTab(tab);
        if ( callback ) {
            var listener = function() {
                newTabBrowser.removeEventListener("load", listener, true);
                callback(firefox.tabs.getTab(newTabBrowser.contentDocument, tab));
            }
            newTabBrowser.addEventListener("load", listener, true);
        }
    };

    firefox.tabs.isIframe = function(doc) {
        var win = doc.defaultView;
        return win.top !== win;
    };

    /**
     * execute content script on select tab
     * @param object tab
     * @param object details
     *      - code: string
     *      - file: string for file name or array of file name
     *      - js_version: js version, see https://developer.mozilla.org/en/Components.utils.evalInSandbox#Optional_Arguments
     *      - filename: filename for display error
     *      - line: line
     *      - all_frames: whether the content script runs in all frames
     */
    firefox.tabs.executeScript = function(tab, details, callback) {
        details = S.extend({ js_version: 1.8, line: 1, all_frames: false }, details);
        if ( !details.all_frames && firefox.tabs.isIframe(tab.document) ) {
            return;
        }
        var unsafeWin = tab.document.defaultView;
        var safeWin = new XPCNativeWrapper(unsafeWin);
        var sandbox = new Components.utils.Sandbox(safeWin);
        
        sandbox.window = safeWin;
        sandbox.document = sandbox.window.document;
        sandbox.unsafeWindow = unsafeWin;
        sandbox.__proto__ = sandbox.window;
        sandbox.exports = {
            browser: {
                extension: new firefox.tabs.extension(tab.document, tab.id),
                __exposedProps__: {
                    extension: 'wr'
                }
            },
          console: {
            debug: function(msg) {
              S.console.debug(msg);
            },
            __exposedProps__: {
              "debug": "r"
            }
          },
          __exposedProps__: {}
        };

        for (var i = 0; i < exposedProperties.length; i++) {
            sandbox.exports.__exposedProps__[exposedProperties[i]] = 'wr'
        }

        var code = '';
        if ( typeof details.code != "undefined" ) {
            code = details.code;
        } else if ( typeof details.file != "undefined" ) {
            if ( S.is_array(details.file) ) {
                for ( var i=0; i<details.file.length; i++ ) {
                    code += getFileContent(details.file[i]) + "\n";
                }
            } else {
                code = getFileContent(details.file);
            }
        }
        if ( code ) {
            S.console.debug('execute: ' + JSON.stringify(details));
            Components.utils.evalInSandbox(code, sandbox, details.js_version, details.filename, details.line);
        }
        if ( callback ) callback(tab);
    };

    firefox.tabs.event_id = S.get_random_string()+".tabs.request";
    firefox.tabs.request = {};

    firefox.tabs.getCurrent = function(callback) { 
        var gBrowser = getTabBrowser();
        callback(firefox.tabs.getTab(gBrowser.contentDocument, gBrowser.selectedTab));
    };

    firefox.tabs.sendRequest = function(tabId, request, requestCallback) {
        var tab = S.TabManager.getTabById(tabId);
        var gBrowser = getTabBrowser();
        var browser;
        var doc;
        if (tab) {
            browser = gBrowser.getBrowserForTab(tab);
            doc = browser.contentDocument;
            var evt = doc.createEvent("Events");
            evt.initEvent(firefox.tabs.event_id, true, false);
            firefox.tabs.request = {
                data: request,
                callback: requestCallback
            };
            doc.dispatchEvent(evt);
            S.console.debug('Send single message to tab of id: ' + tabId);
        } else {
            S.console.error("cannot not send request without document");
        }
    };

    firefox.tabs.extension = function(doc, tabId) {
        this.document = doc;
        this.event_id = firefox.tabs.event_id;
        this.tabId = tabId;

        // listeners for request send by firefox.tabs.sendRequest
        var listeners = [];
        var handler = function(evt) {
            var request = firefox.tabs.request;
            var callback = getResponseCallback(request.callback);
            for ( var i=0; i<listeners.length; i++ ) {
                if (request.data && typeof request.data == 'object') {
                    data = {
                        response: JSON.stringify(request.data),
                        __exposedProps__: {
                            response: 'r'
                        }
                    }
                } else {
                    data = request.data
                }
                listeners[i](data, callback);
            }
        };

        this.onRequest = {
            addListenerInternal: function(listener) {
                listeners.push(listener);
            },
            
            removeListener: function(listener) {
                for ( var i=0; i<listeners.length; i++ ) {
                    if ( listener == listeners[i] ) {
                        listeners.splice(i, 1);
                        i--;
                    }
                }
            },
            __exposedProps__: {
                addListenerInternal: 'wr',
                addListener: 'wr',
                removeListener: 'wr'
            }
        };
        doc.addEventListener(firefox.tabs.event_id, handler, false, true );
    };

    // listeners for request send by content script using firefox.extension.sendRequest
    firefox.tabs.listeners = [];
    firefox.tabs.extension.prototype.__exposedProps__ = {
        sendRequestInternal: 'wr',
        sendRequest: 'wr',
        getURL: 'wr',
        onRequest: 'wr'
    }

    firefox.tabs.extension.prototype.sendRequestInternal = function(request, responseCallback) {
        var listeners = firefox.tabs.listeners;
        var callback = getResponseCallback(responseCallback);
        var tab = S.TabManager.getTabById(this.tabId);
        for ( var i=0; i<listeners.length; i++ ) {
            listeners[i](request, { tab: firefox.tabs.getTab(this.document, tab) }, callback);
        }
    };
    firefox.tabs.extension.prototype.getURL = function(path) {
        return firefox.extension.getURL(path);
    };

    firefox.extension = {};
    firefox.extension.onRequest = {
        addListener: function(listener) {
            firefox.tabs.listeners.push(listener);
        },
        removeListener: function(listener) {
            var listeners = firefox.tabs.listeners;
            for ( var i=0; i<listeners.length; i++ ) {
                if ( listener == listeners[i] ) {
                    listeners.splice(i, 1);
                    i--;
                }
            }
        }
    };
    firefox.extension.getURL = function(path) {
        return firefox.extension.baseURI + path;
    };

    firefox.tabs.remove = function(tabId, callback) {
        var gBrowser = getTabBrowser();
        var tab = S.TabManager.getTabById(tabId);
        var result = false;
        if (tab) {
            gBrowser.removeTab(tab);
            result = true;
        }

        if (callback) {
            var browser = gBrowser.getBrowserForTab(tab);
            var unloadHandler = function() {
                browser.removeEventListener('unload', unloadHandler, false);
                callback(result);
            };
            browser.addEventListener('unload', unloadHandler, false);
        }
    };

    firefox.tabs.update = function(tabId, updateProperties, callback) {
        var gBrowser = getTabBrowser();
        var tab = S.TabManager.getTabById(tabId);
        if (tab) {
            if (updateProperties.selected || updateProperties.active) {
                gBrowser.selectedTab = tab; // sync or async?
            }

            if (callback) {
                var browser = gBrowser.getBrowserForTab(tab);
                var doc = browser.contentDocument;
                callback(firefox.tabs.getTab(doc, tab));
            }
        }
    };

    firefox.tabs.captureVisibleTab = function(options, callback) {
        var gBrowser = getTabBrowser();
        var contentWindow = gBrowser.contentWindow;
        var doc = contentWindow.document;
        var html = doc.documentElement;
        var x = html.scrollLeft + options.left
        var y = html.scrollTop + options.top;
        var w = options.width;
        var h = options.height;
        var canvas = doc.createElement('canvas');
        canvas.width = w; 
        canvas.height = h; // need refinement
        canvas.style.display = 'none';
        doc.body.appendChild(canvas);
        
        var ctx = canvas.getContext("2d");
        ctx.drawWindow(contentWindow, x, y, w, h, 'rgb(255, 255, 255)');
        if (callback) {
            callback(canvas.toDataURL());
        }
    };

    S.browser = firefox;
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
