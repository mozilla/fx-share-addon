const {Cc, Ci} = require("chrome");

// implicitly run our main() entry-point
require("ffshare/main").main();

// Return the URL of content in our 'test' directory.
exports.getTestUrl = function(testPage) {
  let lastSlash = this.module.id.lastIndexOf("/");
  let resourceUrl = this.module.id.substr(0, lastSlash+1) + testPage;
  // return the file:// as F1 disables itself for resource:// urls.
  return require("url").toFilename(resourceUrl);
}


exports.createSharePanel = function(contentWindow) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");

  let {SharePanel} = require("ffshare/panel");
  let sharePanel = new SharePanel(topWindow, contentWindow,
                                  "link.send", {},
                                  function () {;});
  return sharePanel;
};

exports.getShareButton = function(topWindow) {
  if (!topWindow) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Ci.nsIWindowMediator);

    topWindow = wm.getMostRecentWindow("navigator:browser");
  }
  return topWindow.document.getElementById("share-button");
}
