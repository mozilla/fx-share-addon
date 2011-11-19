/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");
let {getMediator, getTestUrl, createTab, removeCurrentTab, finalize} = require("./test_utils");

// test showing the notification box, this could move to owa
exports.testErrorNotification = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  finalize(test, function(finish) {
    removeCurrentTab(function() {
      finish();
    });
  });

  createTab(pageUrl, function(tab) {
    let sharePanel = getMediator();
    sharePanel.showErrorNotification({msg: "This is a test error"});

    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
    let win = wm.getMostRecentWindow("navigator:browser");
    var gBrowser = win.gBrowser;
    
    let nBox = gBrowser.getNotificationBox();
    let nId = "openwebapp-error-" + sharePanel.methodName;
    let notification = nBox.getNotificationWithValue(nId);
    test.assertNotEqual(notification, undefined, "notification-box-showing")
    nBox.removeNotification(notification);

    test.done();
  });

}

