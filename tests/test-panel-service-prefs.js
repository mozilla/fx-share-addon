// Test the F1 "ServicePanel" WRT how the service 'preferences' change its behaviour.
const {getSharePanelWithApp, testAppSequence} = require("./app_helpers");
const keys = require("dom/events/keys");

function testTextCounterHelper(test, constraints, testVal, expectedCounter)
{
  test.waitUntilDone();
  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    let seq = [
      {method: 'getPreferences', successArgs:
          {constraints: constraints,
           shareTypes: [{type: 'type', name: 'name'}]
          }
      },
      {method: 'getLogin', successArgs: {user: {displayName: 'test user'}}
      }
    ];
    testAppSequence(test, appInfo, seq, function () {
      test.waitUntil(function() {
        return accountPanelDiv.is(":visible");
      }).then(function () {
        // put some text in the field.
        let message = accountPanelDiv.find('[name="message"]');
        let counterNode = accountPanelDiv.find('.counter');
        message.val(testVal);
        keys.keyUp(message[0], {key: 'A'}); // any key will do...
        test.assertEqual(counterNode.text(), expectedCounter);
        test.done();
      });
    });
  });
}

exports.testTextCounterSimple = function(test) {
  let testVal = "This is a message";
  let expectedCounter = 140 - testVal.length;
  testTextCounterHelper(test, {textLimit: 140}, testVal, expectedCounter);
};

exports.testTextCounterSimpleWithUrl = function(test) {
  let testVal = "This is a message - http://foo.com/bar";
  // We haven't specified a shortURLLength, so nothing magic should happen.
  let expectedCounter = 140 - testVal.length;
  testTextCounterHelper(test, {textLimit: 140}, testVal, expectedCounter);
};

exports.testTextCounterSingleShortUrl = function(test) {
  let constraints = {textLimit: 140, shortURLLength: 10};
  let prefix = "This is a message - "
  let testVal = prefix + "http://foo.com:1234/bar?arg=something#etc";
  let expectedCounter = 140 - prefix.length - 10; // the url should be counted as 10 chars.
  testTextCounterHelper(test, constraints, testVal, expectedCounter);
};

exports.testTextCounterMultipleShortUrl = function(test) {
  let constraints = {textLimit: 140, shortURLLength: 10};
  let prefix = "This is a message - "
  let testVal = prefix + "http://foo.com/bar" + " - " + "http://somewhere.com/etc";
  // the urls should be counted as 10 chars and the 3 is for the " - ".
  let expectedCounter = 140 - prefix.length - 20 - 3;
  testTextCounterHelper(test, constraints, testVal, expectedCounter);
};
