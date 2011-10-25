const unload = require("unload");
const { Hotkey } = require("hotkeys");
const { Cc, Ci } = require('chrome');

const serviceName = "activityStream.fetch";

exports.main = function(options, callbacks) {
  console.log("streams/main loading");
  // setup a hotkey to invoke this mediator.
  var showHotKey = Hotkey({
    combo: "ctrl-alt-a",
    onPress: function() {
      let wm = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator);
      let window = wm.getMostRecentWindow('navigator:browser');
      let services = window.apps._services;
      services.registerMediator(serviceName, {
        url: require("self").data.url("ui/streams/index.html"),
        notificationErrorText: "There was a problem fetching this stream."
      });
      let activity =     {
        action: serviceName,
        type: "get",
        data: {}
      };
      let contentWindow = window.gBrowser.contentWindow;
      let svc = services.get(contentWindow, activity, function() {
        console.log("stream get was success");
      }, function(err) {
        console.error("Failed to invoke activity-stream service", err);
      });
      svc.show();
    }
  });
};

unload.when(function(why) {
  ;
});
