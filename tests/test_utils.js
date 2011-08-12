const {Cc, Ci} = require("chrome");
const URL = require("url");
// implicitly run our main() entry-point
require("ffshare/main").main();

exports.finalize = function(test, fn) {
  let onDone = test.onDone;
  test.onDone = function(test) {
    fn(function() {
      onDone(test);
    });
  }
}

// Return the URL of content in our 'test' directory.
exports.getTestUrl = function(testPage) {
  let lastSlash = this.module.id.lastIndexOf("/");
  let resourceUrl = this.module.id.substr(0, lastSlash+1) + testPage;
  // return the file:// as F1 disables itself for resource:// urls.
  return URL.fromFilename(URL.toFilename(resourceUrl));
}

exports.createTab = function(url, callback) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");
  let gBrowser = topWindow.gBrowser;
  let tab = gBrowser.selectedTab = gBrowser.addTab(url);
  let newTabBrowser = gBrowser.getBrowserForTab(tab);
  newTabBrowser.addEventListener("DOMContentLoaded",
    function() {
      callback(newTabBrowser);
    },
    false
  );
}

exports.removeCurrentTab = function(callback) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);
  let topWindow = wm.getMostRecentWindow("navigator:browser");
  var container = topWindow.gBrowser.tabContainer;
  let removedCallback = function() {
    container.removeEventListener("TabClose", removedCallback, false);
    callback();
  }
  container.addEventListener("TabClose", removedCallback, false);
  topWindow.gBrowser.removeCurrentTab();
}

exports.createSharePanel = function(contentWindow) {
  if (!contentWindow) throw "contentWindow is null";
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");
  // instead of constructing the object explicitly, we go via the services API
  // so it knows the created panel is associated with the contentWindow/service.
  let services = topWindow.apps._services;
  let serviceName = "link.send";
  // first pretend to invoke a service so our panel is created.
  services.invoke(contentWindow, serviceName, {}, function () {;});
  return services.get(contentWindow, "link.send");
};

exports.getShareButton = function(topWindow) {
  if (!topWindow) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Ci.nsIWindowMediator);

    topWindow = wm.getMostRecentWindow("navigator:browser");
  }
  return topWindow.document.getElementById("share-button");
}
