/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Open and close the Share panel by hitting the F1 key.
 */

const {getSharePanel, getTestUrl, getShareButton, createTab, removeCurrentTab, finalize} = require("./test_utils");
const { keyPress } = require("api-utils/dom/events/keys");
const { activeBrowserWindow: { document } } = require("window-utils");

exports.testKey = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  finalize(test, function(finish) {
    removeCurrentTab(function() {
      finish();
    });
  });

  createTab(pageUrl, function(tab) {
    let share = getSharePanel();
    share.panel.once("show", function() {
      keyPress(document.documentElement, "ESCAPE");
    });
    share.panel.once("hide", function() {
      test.assert(true, "keypress open/close panels")
      test.done();
    });

    keyPress(document.documentElement, "F1");
  });

}
