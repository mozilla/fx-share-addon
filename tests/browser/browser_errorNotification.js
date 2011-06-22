/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * test share state information
 */
const SHARE_STATUS = ["", "start", "", "finished"];
const SHARE_DONE = 0;
const SHARE_START = 1;
const SHARE_ERROR = 2;
const SHARE_FINISHED = 3;


function test() {
  waitForExplicitFinish();

  openTab(PAGE_URL, function() {
    // Panel sends a "shareState" message in response to "getShareState"
    relayMessage({topic: "getShareState"}, function(event) {
      next(gShareWindow, "message", function(event) {
        let message = JSON.parse(event.data);
        is(message.topic, "shareState");
        isnot(message.data, undefined);
  
        // test 'sharing' state
        ffshare.sharePanel.updateStatus([SHARE_START,,,PAGE_URL]);
        is(ffshare.sharePanel.button.getAttribute("status"),
           SHARE_STATUS[SHARE_START], "share-state-start");
  
        // mark a success share, which should result temporarily in a
        // SHARE_FINISHED status on the button
        ffshare.sharePanel.updateStatus([SHARE_DONE,,,PAGE_URL], true);
        is(ffshare.sharePanel.button.getAttribute("status"),
           SHARE_STATUS[SHARE_FINISHED], "share-state-finished");
  
        // push an error and check if the notification box has the error
        ffshare.sharePanel.updateStatus([SHARE_ERROR,,,PAGE_URL]);
  
        let nBox = gBrowser.getNotificationBox();
        let notification = nBox.getNotificationWithValue("mozilla-f1-share-error");
        isnot(notification, undefined, "notification-box-showing")
        nBox.removeNotification(notification);
  
        gBrowser.removeCurrentTab();
        cleanup(finish);
      });
    });
    ffshare.togglePanel();
  });

}

