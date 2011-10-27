const unload = require("unload");
const { Hotkey } = require("hotkeys");
const { Cc, Ci } = require('chrome');
const {serviceInvocationHandler, MediatorPanel} = require("openwebapps/services");

const serviceName = "activityStream.fetch";

// A little "demo" of using the stream.  Whenever a new window opens, we add
// a notification bar if anyone has commented on it.
require("tabs").on("ready", function(tab) {
  require("./store").getMentionsOfUrl(tab.url, function(result) {
    let mentions = result.results;
    console.log("have", mentions.length, "mentions");
    if (mentions && mentions.length) {
      let wm = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator);
      let nId = "social-browsing";
      let window = wm.getMostRecentWindow('navigator:browser');
      let nBox = window.gBrowser.getNotificationBox();
      let notification = nBox.getNotificationWithValue(nId);
      if (!notification) {
        let message;
        if (mentions.length === 1) {
          message = "There is 1 comment";
        } else {
          message = "There are " + mentions.length + " comments";
        }
        message += " on this site from your social network";
        buttons = [{
          label: "view",
          accessKey: null,
          callback: function () {
            console.log("todo");
          }
        }];
        nBox.appendNotification(message, nId, null,
                    nBox.PRIORITY_WARNING_MEDIUM, buttons);
      }
    }
  });
});

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
    require("./store").store(items, function(result) {
      if ('error' in result) {
        console.log("failed to store the items:", result.error);
      } else {
        console.log("apparently the items were stored!");
      }
    })
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
