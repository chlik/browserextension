if ( !exports ) var exports = {};

(function(S) {
S.TabManager = {
  tabs: {},

  generateId: function() {
    return Math.floor(Math.random() * 2147483648).toString(36) +
      (Math.floor(Math.random() * 2147483648) ^ (new Date).getTime()).toString(36);
  },

  add: function(tab) {
    var id = this.generateId();
    this.tabs[id] = tab;
    return id;
  },

  getTabById: function(id) {
    return this.tabs[id];
  },

  getIdByTab: function(tab) {
    var tabs = this.tabs;
    for (var id in tabs) {
      if (tabs[id] === tab) {
        return id;
      }
    }
  },

  getIdByBrowser: function(browser) {
    var tabs = this.tabs;
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
      .getService(Components.interfaces.nsIWindowMediator);  
    var gBrowser = wm.getMostRecentWindow("navigator:browser").gBrowser;

    for (var id in tabs) {
      if (gBrowser.getBrowserForTab(tabs[id]) === browser) {
        return id;
      }
    }

    return null
  },

  getTabByBrowser: function(browser) {
    var id = this.getIdByBrowser(browser);
    return this.getTabById(id);
  },

  removeById: function(id) {
    delete this.tabs[id];
  },

  removeByTab: function(tab) {
    var id = this.getIdByTab(tab);
    this.removeById(id);
    return id;
  }
}
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
