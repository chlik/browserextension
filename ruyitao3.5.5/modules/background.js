if ( !exports ) var exports = {};

(function(S, undefined) {
    var page;
    S.background = {};
    S.background.set = function(instance){
        page = instance;
    }
    S.background.get = function(){
        return page;
    };
})(exports);

var EXPORTED_SYMBOLS = ["exports"];
