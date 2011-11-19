/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let {getMediator, getTestUrl, createTab, removeCurrentTab} = require("./test_utils");

/**
 * test share state information
 */
const SHARE_STATUS = ["", "start", "", "finished"];
const SHARE_DONE = 0;
const SHARE_START = 1;
const SHARE_ERROR = 2;
const SHARE_FINISHED = 3;

// test the state of the f1 urlbar button
exports.testShareState = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let sharePanel = getMediator();

    // test 'sharing' state
    sharePanel.onUpdateStatus({statusCode: SHARE_START});
    test.assertEqual(sharePanel.anchor.getAttribute("status"),
       SHARE_STATUS[SHARE_START], "share-state-start");

    // mark a success share, which should result temporarily in a
    // SHARE_FINISHED status on the button
    sharePanel.onUpdateStatus({statusCode: SHARE_DONE});
    test.assertEqual(sharePanel.anchor.getAttribute("status"),
       SHARE_STATUS[SHARE_FINISHED], "share-state-finished");

    removeCurrentTab(function() {
      test.done();
    });

  });

}

