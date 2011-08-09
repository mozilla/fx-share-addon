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

  // test interaction with the injector code is suspect, but as we don't
  // actually rely on it, we can stub it so the panel constructs correctly
  if (!topWindow.appinjector) {
    topWindow.appinjector = {
      register: function() {;}
    }
  }

  let {SharePanel} = require("ffshare/panel");
  let sharePanel = new SharePanel(topWindow, contentWindow,
                                  "link.send", {},
                                  function () {;});
  return sharePanel;
};
