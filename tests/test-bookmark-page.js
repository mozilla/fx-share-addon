/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
let {Services, PlacesUtils} = tmp;

let {createSharePanel, getTestUrl, createTab, removeCurrentTab} = require("./test_utils");

exports.testBookmarkPage = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let bms = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
              .getService(Ci.nsINavBookmarksService);

    let nsiuri = Services.io.newURI(pageUrl, null, null);

    let shareMessage = {
      link: pageUrl,
      appName: "F1 test suite",
      title: 'A test page'
    };
    let sharePanel = createSharePanel(tab.contentWindow);
    let oldPrefVal;
    try {
      oldPrefVal = Services.prefs.getBoolPref("services.share.bookmarking");
    } catch (ex) {
      // oldPrefVal stays undefined.
    }
    Services.prefs.setBoolPref("services.share.bookmarking", true);
    try {
      sharePanel.onResult(shareMessage);
    } finally {
      if (typeof oldPrefVal !== 'undefined') {
        Services.prefs.setBoolPref("services.share.bookmarking", oldPrefVal);
      }
    }
    sharePanel.panel.hide();
    test.assert(bms.isBookmarked(nsiuri));
    let tags = PlacesUtils.tagging.getTagsForURI(nsiuri, {});
    test.assertStrictEqual(tags.length, 1);
    test.assertStrictEqual(tags[0], shareMessage.appName);

    removeCurrentTab(function() {
      test.done();
    });
  });
}
