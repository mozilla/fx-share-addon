const unload = require("unload");
const { Hotkey } = require("hotkeys");
const { Cc, Ci } = require('chrome');
const {serviceInvocationHandler, MediatorPanel} = require("openwebapps/services");

const serviceName = "activityStream.fetch";

function StreamsAgent(window, contentWindowRef, methodName, args, successCB, errorCB) {
  MediatorPanel.call(this, window, contentWindowRef, methodName, args, successCB, errorCB);
}

StreamsAgent.prototype = {
  __proto__: MediatorPanel.prototype,

  attachHandlers: function() {
    MediatorPanel.prototype.attachHandlers.apply(this);
    this.panel.port.on("fxas.consume", this.onConsume.bind(this));
  },
  onConsume: function(items) {
    // The ActivityStream items find there way to here, where we are able
    // to use mozStorage or other suitable trusted-only storage.
    console.log("trusted agent got:\n", JSON.stringify(items, undefined, 2));
  }
};


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
      // and we also act as a trusted "agent" for the service.
      services.registerAgent(serviceName, StreamsAgent);

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
