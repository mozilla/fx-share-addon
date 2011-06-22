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

        // 1. remove the tab
        // 2. set a error for the url of the closed tab
        // 3. make sure that a background tab was opened, and the error
        //    notification has been set
        next(gBrowser.tabContainer, "TabClose", function (event) {
          // we have to wait for the tab to be properly removed from gBrowser
          // so that updateStatus fails to get the tab for the PAGE_URL
          setTimeout(function() {
            // calling updateStatus should now cause a new tab to open
            next(gBrowser.tabContainer, "TabOpen", function(event) {
              // again, we need to delay until the updateStatus call is actually
              // finished
              setTimeout(function() {
                var browser = gBrowser.getBrowserForTab(event.target);
                let nBox = gBrowser.getNotificationBox(browser);
                let notification = nBox.getNotificationWithValue("mozilla-f1-share-error");
                isnot(notification, undefined, "notification-box-showing")
                nBox.removeNotification(notification);
          
                gBrowser.removeTab(event.target);
                cleanup(finish);
              }, 0);
            });
            ffshare.sharePanel.updateStatus([SHARE_ERROR,,,PAGE_URL]);
          }, 0);
        });
        gBrowser.removeCurrentTab();
      });
    });
    ffshare.togglePanel();
  });

}

