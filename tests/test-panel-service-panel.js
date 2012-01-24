// Test the F1 "ServicePanel"
const {getMediatorWithApp, testAppSequence} = require("./app_helpers");

exports.testAccountLoads = function(test) {
  test.waitUntilDone();

  getMediatorWithApp(test, {}, function(appInfo) {
    let {jqAppWidget} = appInfo;
    let accountLoadingDiv = jqAppWidget.find(".accountLoading");
    let accountLoginDiv = jqAppWidget.find(".accountLogin");
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    // app is "blocked" in getParameters, so only the "loading" div should be visible.
    test.assert(accountLoadingDiv.is(":visible"));
    test.assert(!accountLoginDiv.is(":visible"));
    test.assert(!accountPanelDiv.is(":visible"));

    // now kick off the sequence of "unblocking" calls and testing each state.
    let seq = [
      {method: 'getParameters',
       successArgs: {shareTypes: [{type: "test", name: "test"}]},
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

exports.testLoginPanelShows = function(test) {
  test.waitUntilDone();

  getMediatorWithApp(test, {}, function(appInfo) {
    let {jqAppWidget} = appInfo;
    let accountLoadingDiv = jqAppWidget.find(".accountLoading");
    let accountLoginDiv = jqAppWidget.find(".accountLogin");
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    // app is "blocked" in getParameters - and we've tested this state
    // above - so just kick off the sequence of unblocks and tests.
    let seq = [
      // no callback for getParameters - we've tested this above.
      {method: 'getParameters',
       successArgs: {shareTypes: [{type: "test", name: "test"}]}
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
