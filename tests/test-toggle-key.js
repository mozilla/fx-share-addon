/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Open and close the Share panel by hitting the F1 key.
 */

const {createSharePanel, getTestUrl, getShareButton, createTab, removeCurrentTab} = require("./test_utils");
const { keyPress } = require("api-utils/dom/events/keys");

exports.testKey = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let panel = createSharePanel(tab.contentWindow);
    test.waitUntil(function() {return panel.panel.isShowing;}
    ).then(function() {
      panel.panel.hide();
      test.waitUntil(function() {return !panel.panel.isShowing;}
      ).then(function () {
        keyPress(panel.window.document.documentElement, "F1");
        test.waitUntil(function() {return panel.panel.isShowing;}
        ).then(function() {
          panel.panel.hide();
          removeCurrentTab(function() {
            test.done();
          });
        });
      });
    });
  });
}
