/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
let {Services, PlacesUtils} = tmp;

getTestId = function(testPage) {
  let lastSlash = this.module.id.lastIndexOf("/");
  return this.module.id.substr(0, lastSlash+1) + testPage;
}
exports.testBookmarkPage = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestId("page.html");

  const tabs = require("tabs"); // From addon-kit
  tabs.open({
    url: pageUrl,
    onReady: function(tab) {
      let bms = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                .getService(Ci.nsINavBookmarksService);
      let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Ci.nsIWindowMediator);

      let nsiuri = Services.io.newURI(pageUrl, null, null);

      let shareMessage = {
        data: {
          link: pageUrl,
          service: "mochitest",
          title: 'A test page'
        }
      };
      let topWindow = wm.getMostRecentWindow("navigator:browser");
      // test interaction with the injector code is suspect, but as we don't
      // actually rely on it, we can stub it so the panel constructs correctly
      if (!topWindow.appinjector) {
        topWindow.appinjector = {
          register: function() {;}
        }
      }
      let {SharePanel} = require("ffshare/panel");
      let sharePanel = new SharePanel(topWindow, tab.contentWindow, "link.send", {});
      sharePanel.result(shareMessage);
      test.assert(bms.isBookmarked(nsiuri));
      // Tagging is currently disabled.
      //let tags = PlacesUtils.tagging.getTagsForURI(nsiuri, {});
      //test.assertStrictEqual(tags.length, 1);
      //test.assertStrictEqual(tags[0], shareMessage.data.service);

//      gBrowser.removeCurrentTab();
      tab.close(function() {
        test.done();
      });
    }
  });
}
