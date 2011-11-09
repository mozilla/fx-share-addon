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

function getSharePanel(args) {
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
  // first pretend to invoke a service so our panel is created.
  return services.get(activity, function () {;});
}
exports.getSharePanel = getSharePanel;

exports.createSharePanel = function(contentWindow) {
  let panel = getSharePanel();
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
