if ( !exports ) var exports = {};

(function(S, undefined) {
  Components.utils.import("resource://ruyitao/util.js", S);
  S.exports.extend(S, S.exports);
  Components.utils.import("resource://ruyitao/constants.js", S);
  S.constants = S.exports.constants;
  Components.utils.import("resource://ruyitao/console.js", S);
  S.console = S.exports.console;
  Components.utils.import("resource://ruyitao/options.js", S);
  S.options = S.exports.options;
S.notification = {
  STORE_KEY: "notification",

  init: function(options) {
    options = options || {};
    this.notifications = undefined;
    this.storage = options.storage;
    this.cache = options.cache;
    this.config = undefined;
  },

  formatDate: function(date) {
    var pad = function(n) {
      return (n < 10 ? '0' : '') +String(n);
    }
    return date.getFullYear() + '-' + pad(1+date.getMonth()) + '-' + pad(date.getDate());
  },

  getConfig: function() {
    if ( typeof this.config == "undefined" ) {
      var date = new Date;
      var current_date = this.formatDate(date);
      var compare_date = this.formatDate(new Date( date.getTime() - 86400*1000*3)); // 过期后还保留3天配置，防止客户端时间与服务器差异
      this.config = { date: current_date };
      var conf = this.storage.get_object(this.STORE_KEY);
      if ( conf && typeof conf == "object" ) {
        var isToday = typeof conf.date != "undefined" && conf.date == current_date;
        for ( var msgid in conf ) {
          if ( conf.hasOwnProperty(msgid) && msgid.match(/^\d+$/) ) {
            if ( conf[msgid].expires && conf[msgid].expires >= compare_date ) {
              if ( !isToday ) {
                conf[msgid].times = 0;
                if ( conf[msgid].status == 'hide' ) {
                  conf[msgid].status = '';
                }
              }
              this.config[msgid] = conf[msgid];
            }
          }
        }
        this.saveConfig();
      }
    }
    return this.config;
  },

  saveConfig: function() {
    this.storage.set_object(this.STORE_KEY, this.config);
  },

  /**
   * 获得页面的展示消息
   */
  getNotification: function(url) {
    if ( typeof this.notifications == "undefined" ) {
      this.pullNotifications();
    }
    if ( !this.notifications ) {
      return;
    }
    for ( var i=0,len=this.notifications.length; i<len; i++ ) {
      var msg = this.notifications[i];
      var re = new RegExp(msg.match);
      S.console.debug("check msg " + msg.id + ": url " + re.test(url));
      if ( re.test(url) ) {
        var status = this.getStatus(msg.id);
        if ( typeof status == "undefined" ) {
          status = { status: '', expires: msg.expires, times: 0 };
        }
        var quota = parseInt(msg.quota);
        if ( isNaN(quota) ) {
          quota = 0;
        }
        if ( status.status == '' && status.times < quota ) {
          status.times++;
          this.config[msg.id] = status;
          this.saveConfig();
          return msg;
        }
      }
    }
  },

  /**
   * 设置消息状态
   * @param string id 消息 id
   * @param string status 消息状态，可选值 hide 或 close
   */
  setStatus: function(id, status) {
    var conf = this.getConfig();
    if ( conf.hasOwnProperty(id) ) {
      if ( status == 'hide' && conf[id].status != '' ) {
        return;
      }
      conf[id].status = status;
      this.saveConfig();
    }
  },

  /**
   * 获得消息状态
   */
  getStatus: function(id) {
    var conf = this.getConfig();
    if ( conf.hasOwnProperty(id) ) {
      return conf[id];
    }
    return undefined;
  },

  setNotifications: function(notifications) {
    this.notifications = [];
    if ( !notifications || typeof notifications.length == "undefined" ) {
      return;
    }
    for ( var i=0,len=notifications.length; i<len; i++ ) {
      var msg = notifications[i];
      if ( msg.id && msg.id.match(/^\d+$/)
           && msg.campaign && msg.campaign.match(/^[a-zA-Z0-9]+$/)
           && msg.title
           && msg.match
           && msg.content
           && msg.expires && msg.expires.match(/^\d+-\d+-\d+/) ) {
        var parts = msg.expires.split(/[-\s]/);
        var date = new Date;
        date.setYear(parts[0]);
        date.setMonth(parts[1]-1);
        date.setDate(parts[2]);
        msg.expires = this.formatDate(date);
        this.notifications.push(msg);
      }
    }
  },

  pullNotifications: function(callback) {
    if ( this.cache.has(this.STORE_KEY) ) {
      this.setNotifications(this.cache.get(this.STORE_KEY));
    } else {
      var self = this;
      S.ajax({
        url: S.options.get_api_url('zh') + "/ext/notification",
        data: {
          uid: S.constants.uid,
          pid: S.constants.pid,
          version: S.constants.version
        },
        success: function(data) {
          if ( data && typeof data.length != "undefined" ) {
            self.setNotifications(data);
            self.cache.set(self.STORE_KEY, data);
            if ( callback ) {
              callback();
            }
          }
        }
      });
    }
  }
};
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
