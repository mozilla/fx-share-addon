const {getSharePanelWithApp, testAppSequence} = require("./app_helpers");

testAccountFocusLoadHelper = function(test, preferences, expected_focus_name, cbdone) {
  test.waitUntilDone();

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget, panelContentWindow} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    let seq = [
      {method: 'getPreferences', successArgs: preferences},
      {method: 'getLogin', successArgs: {user: {displayName: 'test user'}},
       callback: function(cbresume) {
        // We returned a user, so the account panel should become visible.
        // Our preferences prevent 'to' etc fields, so the message field
        // should be Focused.
        test.waitUntil(function() {
          return accountPanelDiv.is(":visible") &&
                 panelContentWindow.document.activeElement.getAttribute("name") === expected_focus_name;
        }).then(function() {
          if (cbdone) {
            cbdone(appInfo, cbresume);
          } else {
            cbresume();
          }
        })
       }
      }
    ];
    testAppSequence(test, appInfo, seq);
  });
}

exports.testToFocused = function(test) {
  // these preferences mean "to" is shown so should get focus
  let prefs = {
    features: {direct: true},
    shareTypes: [{type: 'somewhere', name: 'somewhere'}]
  };
  testAccountFocusLoadHelper(test, prefs, "to");
};

exports.testToFocused2 = function(test) {
  // these preferences mean "to" and "subject" are shown - but "to"
  // should still win.
  let prefs = {
    features: {direct: true, subject: true},
    shareTypes: [{type: 'somewhere', name: 'somewhere'}]
  };
  testAccountFocusLoadHelper(test, prefs, "to");
};

exports.testSubjectFocused = function(test) {
  // these preferences mean "subject" is shown, so it should get focus
  let prefs = {
    features: {subject: true},
    shareTypes: [{type: 'somewhere', name: 'somewhere'}]
  };
  testAccountFocusLoadHelper(test, prefs, "subject");
};

exports.testMessageFocused = function(test) {
  // these preferences mean "to" and "subject" are both hidden, so
  // "message" should get the focus
  let prefs = {shareTypes: [{type: 'somewhere', name: 'somewhere'}]};
  testAccountFocusLoadHelper(test, prefs, "message");
};

// Test that after hiding and reshowing the panel that focus is still where
// we expect.
exports.testFocusAfterHide = function(test) {
  // these preferences mean "to" and "subject" are both hidden, so
  // "message" should get the focus
  let prefs = {shareTypes: [{type: 'somewhere', name: 'somewhere'}]};
  testAccountFocusLoadHelper(test, prefs, "message", function(appInfo, cbresume) {
    let {panel, panelContentWindow, jqAppWidget} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    panel.panel.hide();
    test.waitUntil(function() !panel.panel.isShowing
    ).then(function() {
      panel.show();
      test.waitUntil(function() panel.panel.isShowing
      ).then(function() {
        // The div should already be visible.
        test.assert(accountPanelDiv.is(":visible"));
        // "message" should still have focus.
        test.waitUntil(function() {
          return panelContentWindow.document.activeElement.getAttribute("name") === "message";
        }).then(function() {
          cbresume();
        })
      })
    })
  });
};

// Test that when the account is not logged in the "login" button has focus.
exports.testLoginFocus = function(test) {
  test.waitUntilDone();
  let prefs = {shareTypes: [{type: 'somewhere', name: 'somewhere'}]};

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget, panelContentWindow} = appInfo;
    let loginPanelDiv = jqAppWidget.find(".accountLogin");
    let seq = [
      {method: 'getPreferences', successArgs: prefs},
      {method: 'getLogin', successArgs: {auth: {something: 'something'}},
       callback: function(cbresume) {
        // Not logged in so the login panel should become visible.
        test.waitUntil(function() {
          return loginPanelDiv.is(":visible") &&
                 panelContentWindow.document.activeElement.getAttribute("class") === "login";
        }).then(function() {
          cbresume();
        })
       }
      }
    ];
    testAppSequence(test, appInfo, seq);
  });
}
