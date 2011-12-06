const {Cc, Ci} = require("chrome");
const URL = require("url");
const tabs = require("tabs");
// implicitly run our main() entry-point
require("fx-share-addon/main").main();

exports.finalize = function(test, fn) {
  let onDone = test.onDone;
  test.onDone = function(test) {
    fn(function() {
      onDone(test);
    });
  }
}

exports.getContentWindow = function() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
  return wm.getMostRecentWindow("navigator:browser").document.commandDispatcher.focusedWindow;
}

// Return the URL of content in our 'test' directory.
exports.getTestUrl = function(testPage) {
  let lastSlash = this.module.uri.lastIndexOf("/");
  let resourceUrl = this.module.uri.substr(0, lastSlash+1) + testPage;
  // return the file:// as F1 disables itself for resource:// urls.
  return URL.fromFilename(URL.toFilename(resourceUrl));
}

exports.createTab = function(url, callback) {
  tabs.open({
    url: url,
    onOpen: function onOpen(tab) {
      tab.on('ready', function(tab){
        callback(tab);
      });
    }
  });
}

exports.removeCurrentTab = function(callback) {
  let tab = tabs.activeTab;
  tab.on('close', callback);
  tab.close();
}

function getMediator(args, readyCallback) {
  require("activities/main"); // for the side effect of injecting window.apps.
  require("openwebapps/main"); // for the side effect of injecting window.apps.
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");
  let tab = topWindow.gBrowser.selectedTab;
  let browser = topWindow.gBrowser.getBrowserForTab(tab);
  // instead of constructing the object explicitly, we go via the services API
  // so it knows the created panel is associated with the contentWindow/service.
  let services = topWindow.serviceInvocationHandler;
  let activity = {
    action: "link.send",
    type: "link.send", // fixme
    data: args || {}
  }
  // This is a bit yucky - if the mediator already exists, we will never
  // get the "ready" notification from it, so dig inside the impl to work
  // out if the mediator is new or will be reused.
  let reused = false;
  for each (let panel in services._popups) {
    if (panel.panelWindow && activity.action == panel.methodName) {
      reused = true;
      break;
    }
  }
  mediator = services.get(activity, function () {;});
  if (readyCallback) {
    if (reused) {
      mediator.panel.once("show", function() {
        readyCallback(mediator);
      });
    } else {
      mediator.panel.port.once("owa.mediation.ready", function() {
        readyCallback(mediator)
      });
    }
  }
  return mediator;
}
exports.getMediator = getMediator;

exports.createSharePanel = function(contentWindow) {
  let panel = getMediator();
  panel.show();
  return panel;
};

exports.getShareButton = function(topWindow) {
  if (!topWindow) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Ci.nsIWindowMediator);

    topWindow = wm.getMostRecentWindow("navigator:browser");
  }
  return topWindow.document.getElementById("share-button");
}
