if ( !com ) var com = {};
if ( !com.ookong ) com.ookong = {};
if ( !com.ookong.shoppingassist ) com.ookong.shoppingassist = {};

(function(win, app, undefined) {
    var S = { extension: app };
    
    /**
     * Installs the toolbar button with the given ID into the given
     * toolbar, if it is not already present in the document.
     *
     * @param {string} toolbarId The ID of the toolbar to install to.
     * @param {string} id The ID of the button to install.
     * @param {string} afterId The ID of the element to insert after. @optional
     */
    function installButton(toolbarId, id, afterId) {
        if (!document.getElementById(id)) {
            var toolbar = document.getElementById(toolbarId);
     
            // If no afterId is given, then append the item to the toolbar
            var before = null;
            if (afterId) {
                var elem = document.getElementById(afterId);
                if (elem && elem.parentNode == toolbar)
                    before = elem.nextElementSibling;
            }
     
            toolbar.insertItem(id, before);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            document.persist(toolbar.id, "currentset");
     
            if (toolbarId == "addon-bar")
                toolbar.collapsed = false;
        }
    };
    
    app.init = function () {
        var appcontent = document.getElementById("appcontent");   // browser  
        if(appcontent) {
            appcontent.addEventListener("DOMContentLoaded", function(event) {
                app.onPageLoad(event);
            }, true);
        }

        Components.utils.import("resource://ruyitao/tab-manager.js", S);
        S.TabManager = S.exports.TabManager;
        var gBrowser = app.getTabBrowser();
        var tabContainer = gBrowser.tabContainer;
        var tabs = tabContainer.childNodes;
        var tab;
        for (var i = 0, l = tabs.length; i < l; i++) {
          tab = tabs[i];
          if (!S.TabManager.getIdByTab(tab)) {
            var id = S.TabManager.add(tab);
          }
        }

        tabContainer.addEventListener('TabOpen', function(event) {
          var openedTab = event.target;
          var tabId = S.TabManager.add(openedTab);
          S.console.debug('Tab opened, id: ' + tabId);
        }, false);

        tabContainer.addEventListener('TabClose', function(event) {
          var closedTab = event.target;
          var tabId = S.TabManager.removeByTab(closedTab);
          S.console.debug('Tab closed, id: ' + tabId);
        }, false);


        Components.utils.import("resource://ruyitao/background.js", S);
        S.background = S.exports.background;
        var background = S.background.get();
        if ( background ) {
            background.extend(S, background, false);
            return;
        }
        Components.utils.import("resource://ruyitao/util.js", S);
        S.exports.extend(S, S.exports);
        Components.utils.import("resource://ruyitao/console.js", S);
        S.console = S.exports.console;
        S.console.setLevel("ERROR");
        Components.utils.import("resource://ruyitao/constants.js", S);
        S.constants = S.exports.constants;
        S.extend(S.constants, {
      pid: "rf002",
      version: "3.5.5",
      open_after_install_page: "upgrading",
            application: "ruyifirefox",
            extension_id: "shoppingassist@ookong.com"
        });
        Components.utils.import("resource://ruyitao/browser.js", S);
        S.browser = S.exports.browser;
        S.browser.extension.baseURI = 'chrome://ruyitao/content/';
        S.browser.tabs.getSelected = function(tabid, callback) {
          callback(S.browser.tabs._currentTab);
        };
        Components.utils.import("resource://ruyitao/sqlite-storage.js", S);
        S.SqliteStorage = S.exports.SqliteStorage;
        S.SqliteStorage.init({file: "shoppingassist.sqlite"});
        app.addUninstallListener();
        Components.utils.import("resource://ruyitao/factory.js", S);
        S.factory = S.exports.factory;
        S.factory.init({storage: S.SqliteStorage});
        Components.utils.import("resource://ruyitao/options.js", S);
        S.options = S.exports.options;
        Components.utils.import("resource://ruyitao/site.js", S);
        S.site = S.exports.site;
        Components.utils.import("resource://ruyitao/notification.js", S);
        S.notification = S.exports.notification;
        Components.utils.import("resource://ruyitao/upgrader.js", S);
        S.upgrader = S.exports.upgrader;
        Components.utils.import("resource://ruyitao/search-engine.js", S);
        S.SearchEngine = S.exports.SearchEngine;
        Components.utils.import("resource://ruyitao/service.js", S);
        S.service = S.exports.service;
        Components.utils.import("resource://ruyitao/share/share.js", S);
        S.Share = S.exports.Share;
var get_default_locale = function() {
    if ( S.constants.application == "ruyisogou" ) {
        return 'zh';
    }
    var locale = 'us';
    var language = window.navigator.language|| window.navigator.userLanguage;
    language = language.toLowerCase();
    if ( language.match(/^zh/) ) {
        locale = 'zh';
    } else if ( language.match(/^en-gb/i) ) {
        locale = 'uk';
    } else if ( language.match(/^de/) ) {
        locale = 'de';
    } else if (language.match(/^it/)) {
      locale = 'it';
    } else if (language.match(/^fr/)) {
      locale = 'fr'
    }
    return locale;
};
if ( S.browser.name == 'safari' ) {
    (function() {
        var settings = safari.extension.settings;
        var storage = {
            get: function(key) {
                return settings[key];
            },
            set: function(key, value) {
                settings[key] = value;
            },
            get_object: function(key) {
                try {
                    return JSON.parse(settings[key]);
                } catch (e) {
                    return null;
                }
            },
            set_object: function(key, value) {
                settings[key] = JSON.stringify(value);
            }
        };
        S.options.init({ storage: storage, locale: get_default_locale() });
    })();
} else {
    S.options.init({ storage: S.factory.getStorage("options"), locale: get_default_locale() });
}
S.site.init({
    storage: S.factory.getStorage('persist'),
    cache: S.factory.getCache(),
    search_status: S.options.get_search_result_setting(),
    price_compare_status: S.options.get_price_compare_result_setting(),
    price_curve_status: S.options.get_price_curve_result_setting()
});
S.notification.init({
  storage: S.factory.getStorage('persist'),
  cache: S.factory.getCache()
});
var storage = S.factory.getStorage("extension");
if ( !storage.get('uid') ) {
    storage.set('uid', S.get_random_string());
}
S.constants.uid = storage.get('uid');
S.constants.cnaCookie = storage.get("cna");
S.upgrader.run(storage.get("version"), S.constants.version, {
  after: function(old_version, new_version) {
    var application = S.constants.application;
    storage.set("version", S.constants.version);
    var cond = S.constants.open_after_install_page;
    if ( cond == 'never' ) {
      return;
    }
    old_version.revision = 0;
    new_version.revision = 0;
    var is_installing = (S.upgrader.version_compare(old_version, 0) == 0);
    var is_upgrading = !is_installing && (S.upgrader.version_compare(new_version, old_version) > 0);
    var url;
    if ( S.options.get_locale() != "zh" ) {
      // 对于 locale 不为中国不打开页面
    } else {
      if ( is_installing && (cond == 'installing' || cond == "always") ) {
        url = S.options.get_api_url('zh') + "/tutorial?utm_medium=ext&utm_source=install";
      } else if ( is_upgrading && (cond == 'upgrading' || cond == 'always') ) {
        url = S.options.get_api_url('zh') + "/tutorial?utm_medium=ext&utm_source=update";
      }
    }
    if ( url ) {
      setTimeout(function() {
        S.browser.tabs.create({ url: url, selected: true });
      }, 700);
    }
  },
  install: function() {
    S.service.send_log({ action: 'install' });
    S.options.set_price_compare_result_setting(true);
    S.site.price_compare_default_status = true;
    S.options.set_search_result_setting(true);
    S.site.search_default_status = true;
    S.site.clearStatus('search');
    S.site.clearStatus('price_compare');
  },
  upgrade: {
    '3.0.6': function() {
      if ( S.options.get_locale() == 'zh' ) {
        var conf = S.options.get_search_engine();
        conf['etao'] = true;
        S.options.set_search_engine(conf);
      }
    },
    '3.0.7': function() {
      S.factory.getCache().clear();
    },
    '3.0.8': function() {
      S.options.set_search_engine({});
      S.site.clearStatus();
      S.service.set_first_shown({
        type: false
      });
    },
    '3.1.5': function() {
      S.options.set_price_compare_result_setting(true);
      S.site.price_compare_default_status = true;
    },
    '3.2.9': function() {
      S.factory.getCache().clear();
    },
    '3.3.2': function() {
      var locale = S.options.get_locale();
      if ( locale == 'it' ) {
        S.service.options_set({locale: 'uk'}, null , function(){});
      } else if ( locale == 'ca' ) {
        S.service.options_set({locale: 'us'}, null , function(){});
      }
    },
    '3.4.1': function() {
      // 清除价格字符模型缓存，重新获取，包括苏宁的
      S.factory.getCache().clear();
    },
    '3.5.1': function() {
      // 使新接口和新的 site config 生效
      S.factory.getCache().clear();
      // 默认展示搜索页面
      S.options.set_price_compare_result_setting(true);
      S.options.set_search_result_setting(true);
      S.site.price_compare_default_status = true;
      S.site.search_default_status = true;
      S.site.clearStatus('search');
      S.site.clearStatus('price_compare');
    }
  }
});
S.SearchEngine.init();
S.Share.init(S.factory.getStorage('persist'));
S.factory.getRuyitaoOauth().getUserInfo();
// 延迟站点配置的加载
setTimeout(function() {
  S.service.send_log({ action: 'up' });
  S.site.getConfig("");
  var updateNotification = function() {
    S.notification.pullNotifications(function() {
      setTimeout(updateNotification, 3600*1000);
    });
  };
  updateNotification();
}, 10*1000);
        S.browser.extension.onRequest.addListener(S.service.helper.requestHandler);
        // disable GA
        S.service.ga_push = function(){};
        S.background.set(S);
        
        var storage = S.factory.getStorage('persist');
        if ( !storage.get('toolbar') ) {
          storage.set('toolbar', true);
          installButton('nav-bar', 'ruyitao-toolbar-button');
        }
    };

    app.onPageLoad = function(event) {
        var doc = event.originalTarget;
        if ( doc.location && doc.location.href.indexOf('http://') == 0
             && !S.browser.tabs.isIframe(doc) && doc.contentType == 'text/html' ) {
            var gBrowser = app.getTabBrowser();
            var currentBrowser = gBrowser.getBrowserForDocument(doc);
            var currentTab = S.TabManager.getTabByBrowser(currentBrowser);
            S.browser.tabs.executeScript(S.browser.tabs.getTab(doc, currentTab), {
                file: [
                    S.browser.extension.getURL("assets/js/jquery-1.7.1.min.js"),
                    S.browser.extension.getURL("assets/js/jquery.flot.min.js"),
                    S.browser.extension.getURL("views/shoppingassist.js")
                ],
                filename: S.browser.extension.getURL("views/shoppingassist.js"),
            });
            if ( doc.location.href.indexOf('http://ruyi.taobao.com/') == 0 ) {
                S.browser.tabs.executeScript(S.browser.tabs.getTab(doc, currentTab), {
                    file: [
                        S.browser.extension.getURL('views/ruyitao-site.js')
                    ]
                });
            }
        }
    };

  app.addUninstallListener = function() {
    // add uninstall handler
    var beingUninstalled;
    try {
      Components.utils.import("resource://gre/modules/AddonManager.jsm");
      var listener = {
        onUninstalling: function(addon) {
          if (addon.id == S.constants.extension_id) {
            if ( S.options.get_locale() == 'zh' ) {
              S.browser.tabs.create({
                url: "http://ruyi.taobao.com/feedback/uninstall?uid=" + encodeURIComponent(S.constants.uid)
              });
            }
            beingUninstalled = true;
          }
        },
        onOperationCancelled: function(addon) {
          if (addon.id == S.constants.extension_id) {
            beingUninstalled = (addon.pendingOperations & AddonManager.PENDING_UNINSTALL) != 0;
          }
        }
      };
      AddonManager.addAddonListener(listener);
      var os = Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService);
      os.addObserver(function (aSubject, aTopic, aData) {
        if ( aTopic == "quit-application" ) {
          if ( beingUninstalled ) {
            var sql = 'DELETE FROM storage WHERE key <> "extension/uid"';
            S.SqliteStorage.getConnection().executeSimpleSQL(sql);
          }
        }
      }, "quit-application", false);
    } catch (ex) {}
  };

  app.getTabBrowser = function() {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
              .getService(Components.interfaces.nsIWindowMediator);
    return wm.getMostRecentWindow("navigator:browser").gBrowser;
  };
  
  app.openPopup = function(event) {
    var url = S.browser.extension.getURL('views/popup.html');
    var currentUrl = gBrowser.contentDocument.location.href;
    S.console.log("current url: " + currentUrl);
    S.browser.tabs._currentTab = {
      title: gBrowser.contentDocument.title,
      url: currentUrl
    };
    var get_base_url = function(url) {
      var info = S.parse_url(url);
      return info.scheme + '://' + info.host + info.path;
    }
    var base_url = get_base_url(url);
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
    var browserEnumerator = wm.getEnumerator("navigator:browser");

    // Check each browser instance for our URL
    var found = false;
    while (!found && browserEnumerator.hasMoreElements()) {
      var browserWin = browserEnumerator.getNext();
      var tabbrowser = browserWin.gBrowser;
      // Check each tab of this browser instance
      var numTabs = tabbrowser.browsers.length;
      for (var index = 0; index < numTabs; index++) {
        var currentBrowser = tabbrowser.getBrowserAtIndex(index);
        if (base_url == get_base_url(currentBrowser.currentURI.spec)) {
          // The URL is already opened. Select this tab.
          tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
          // Focus *this* browser-window
          browserWin.focus();
          tabbrowser.loadURI(url);
          found = true;
          break;
        }
      }
    }

    // Our URL isn't open. Open it now.
    if (!found) {
      var recentWindow = wm.getMostRecentWindow("navigator:browser");
      if (recentWindow) {
        // Use an existing browser window
        recentWindow.delayedOpenTab(url, null, null, null, null);
      }
      else {
        // No browser windows are open, so open a new one.
        window.open(url);
      }
    }
  };
  
  window.addEventListener("load", app.init, false);
})(window, com.ookong.shoppingassist);

