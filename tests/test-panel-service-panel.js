// Test the F1 "ServicePanel"
const {getSharePanelWithApp, testAppSequence} = require("./app_helpers");

exports.testAccountLoads = function(test) {
  test.waitUntilDone();

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget} = appInfo;
    let accountLoadingDiv = jqAppWidget.find(".accountLoading");
    let accountLoginDiv = jqAppWidget.find(".accountLogin");
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    // app is "blocked" in getPreferences, so only the "loading" div should be visible.
    test.assert(accountLoadingDiv.is(":visible"));
    test.assert(!accountLoginDiv.is(":visible"));
    test.assert(!accountPanelDiv.is(":visible"));

    // now kick off the sequence of "unblocking" calls and testing each state.
    let seq = [
      {method: 'getPreferences', successArgs: {},
       callback: function(cbresume, results) {
        // only 'loading' should still be visible as getLogin is "blocked"
        test.assert(accountLoadingDiv.is(":visible"));
        test.assert(!accountLoginDiv.is(":visible"));
        test.assert(!accountPanelDiv.is(":visible"));
        cbresume();
       }
      },
      {method: 'getLogin', successArgs: {user: {displayName: 'test user'}},
       callback: function(cbresume) {
        // We returned a user, so the account panel should become visible.
        test.waitUntil(function() {return accountPanelDiv.is(":visible");}
        ).then(function() {
          test.assert(!accountLoadingDiv.is(":visible"));
          test.assert(!accountLoginDiv.is(":visible"));
          cbresume();
        })
       }
      }
    ];
    testAppSequence(test, appInfo, seq);
  });
};

// There is/was a problem when the sharepanel was opened in one tab, then
// opened again in another - the mediator wouldn't get past the "loading"
// panel for any of the apps in that second panel.
// (Turns out the problem was in OWA causing the app.services.ready() call to
// be delivered to the wrong panel - but let's keep this test anyway...)
exports.testAccountLoadsTwice = function(test) {
  test.waitUntilDone();

  getSharePanelWithApp(test, {}, function(appInfo1) {
    let panel1 = appInfo1.panel;
    // We've tested this first state above.
    // so kick off the sequence of "unblocking" calls and testing each state.
    let seq = [
      {method: 'getPreferences', successArgs: {}
      },
      {method: 'getLogin', successArgs: {user: {displayName: 'test user'}}
      }
    ];
    testAppSequence(test, appInfo1, seq, function () {
      panel1.panel.hide();
      // and do it again in a new tab.
      getSharePanelWithApp(test, {}, function(appInfo2) {
        let {jqAppWidget} = appInfo2;
        let accountLoadingDiv = jqAppWidget.find(".accountLoading");
        let accountLoginDiv = jqAppWidget.find(".accountLogin");
        let accountPanelDiv = jqAppWidget.find(".accountPanel");
        // app is "blocked" in getPreferences, so only the "loading" div should be visible.
        test.assert(accountLoadingDiv.is(":visible"));
        test.assert(!accountLoginDiv.is(":visible"));
        test.assert(!accountPanelDiv.is(":visible"));

        // now kick off the sequence of "unblocking" calls and testing each state.
        let seq2 = [
          {method: 'getPreferences', successArgs: {},
           callback: function(cbresume, results) {
            // only 'loading' should still be visible as getLogin is "blocked"
            test.assert(accountLoadingDiv.is(":visible"));
            test.assert(!accountLoginDiv.is(":visible"));
            test.assert(!accountPanelDiv.is(":visible"));
            cbresume();
           }
          },
          {method: 'getLogin', successArgs: {user: {displayName: 'test user'}},
           callback: function(cbresume) {
            // We returned a user, so the account panel should become visible.
            test.waitUntil(function() {return accountPanelDiv.is(":visible");}
            ).then(function() {
              test.assert(!accountLoadingDiv.is(":visible"));
              test.assert(!accountLoginDiv.is(":visible"));
              cbresume();
            })
           }
          }
        ];
        testAppSequence(test, appInfo2, seq2);
      });
    });
  });
};

exports.testLoginPanelShows = function(test) {
  test.waitUntilDone();

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget} = appInfo;
    let accountLoadingDiv = jqAppWidget.find(".accountLoading");
    let accountLoginDiv = jqAppWidget.find(".accountLogin");
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    // app is "blocked" in getPreferences - and we've tested this state
    // above - so just kick off the sequence of unblocks and tests.
    let seq = [
      // no callback for getPreferences - we've tested this above.
      {method: 'getPreferences', successArgs: {}
      },
      {method: 'getLogin', successArgs: {auth: "something"},
       callback: function(cbresume) {
        // We returned no user but auth info - the login panel should become visible.
        test.waitUntil(function() {return accountLoginDiv.is(":visible");}
        ).then(function() {
          test.assert(!accountLoadingDiv.is(":visible"));
          test.assert(!accountPanelDiv.is(":visible"));
          cbresume();
        })
       }
      }
    ];
    testAppSequence(test, appInfo, seq);
  });
};
