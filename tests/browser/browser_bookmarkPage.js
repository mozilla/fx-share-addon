/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/Services.jsm");

function test() {
  waitForExplicitFinish();

  openTab(PAGE_URL, function() {
    let bms = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                .getService(Components.interfaces.nsINavBookmarksService);
    let nsiuri = Services.io.newURI(PAGE_URL, null, null);

    let shareData = {
      url: PAGE_URL,
      service: "mochitest"
    };

    ffshare.sharePanel.success(shareData);
    ok(bms.isBookmarked(nsiuri));
    let tags = PlacesUtils.tagging.getTagsForURI(nsiuri, {});
    is(tags.length, 1);
    is(tags[0], shareData.service);

    gBrowser.removeCurrentTab();
    cleanup(finish);
  });
}
