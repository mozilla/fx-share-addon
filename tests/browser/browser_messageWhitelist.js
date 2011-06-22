/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  waitForExplicitFinish();

  // Add a new method to the panel that should NOT be called.
  ffshare.sharePanel.forbiddenMethod = function() {
    // We should not get here!
    ok(false);
  };

  openTab(PAGE_URL, function() {
    relayMessage({topic: "forbiddenMethod"}, function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "forbiddenMethod");

      gBrowser.removeCurrentTab();
      delete ffshare.sharePanel.forbiddenMethod;
      cleanup(finish);
    });
  }, true);

  ffshare.togglePanel();
}
