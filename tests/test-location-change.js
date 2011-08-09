/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * test progress listener catching a location change and updating the share
 * button state
 */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let {getTestUrl, getShareButton} = require("./test_utils");


exports.testChangeInSameTab = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  const tabs = require("tabs"); // From addon-kit
  tabs.open({
    url: pageUrl,
    onReady: function(tab) {
      let shareButton = getShareButton();
      // The button is visible now, but the panel is closed at first.
      if (tab.url === "about:blank") {
        // must be second time around - should be hidden.
        test.assert(shareButton.hidden);
        tab.close(function() {
          test.done();
        });
      } else {
        // first time around - on our test page, so should be visible.
        test.assert(!shareButton.hidden);
        // now change the URL to about:blank - this will cause our onReady
        // to be called again.
        tab.url = "about:blank";
      }
  }});
}

const { activateTab } = require("tabs/utils");

exports.testChangeInDifferentTab = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  const tabs = require("tabs"); // From addon-kit
  tabs.open({
    url: pageUrl,
    onReady: function(tabWithPage) {
      let shareButton = getShareButton();
      test.assert(!shareButton.hidden);
      // now create a second tab with about:blank.
      tabs.open({
        url: "about:blank",
        onReady: function(tabWithBlank) {
          test.assert(shareButton.hidden);
          // re-activate the first tab - should not be hidden.
          tabWithPage.activate();
          test.waitUntil(function() {return !shareButton.hidden}
          ).then(function () {
            // re-activate about:blank - should go back to hidden.
            tabWithBlank.activate();
            test.waitUntil(function() {return shareButton.hidden}
            ).then(function () {
              tabWithBlank.close(function() {
                tabWithPage.close(function () {
                  test.done();
                })
              });
            })
          });
        }});
    }
  });
}
