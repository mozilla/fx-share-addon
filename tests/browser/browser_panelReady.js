/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  waitForExplicitFinish();

  openTab(PAGE_URL, function() {
    // First we expect to see a message with the "panelReady" topic
    // which we send ourselves below.
    relayMessage({topic: "panelReady"}, function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "panelReady");

      // Panel sends a "shareState" message in response to "panelReady"
      next(gShareWindow, "message", function(event) {
        let message = JSON.parse(event.data);
        is(message.topic, "shareState");

        gBrowser.removeCurrentTab();
        cleanup(finish);
      });
    });
  });
}
