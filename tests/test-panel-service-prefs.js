// Test the F1 "ServicePanel" WRT how the service 'parameters' change its behaviour.
const {getTestUrl} = require("./test_utils");
const {getSharePanelWithApp, testAppSequence} = require("./app_helpers");
const keys = require("dom/events/keys");

function testTextCounterHelper(test, constraints, testVal, expectedCounter)
{
  test.waitUntilDone();
  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    let seq = [
      {method: 'getParameters', successArgs:
          {constraints: constraints,
           features: {},
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
  let testVal = prefix + "http://foo.com:1234/bar-123%20.?arg=something#etc";
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

function testEditableUrlInMessageHelper(test, appArgs, constraints, expectedMessage)
{
  test.waitUntilDone();
  getSharePanelWithApp(test, appArgs, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    let seq = [
      {method: 'getParameters', successArgs:
          {constraints: constraints,
           features: {},
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
        // check the text in the field.
        let message = accountPanelDiv.find('[name="message"]');
        test.assertEqual(message.val(), expectedMessage);
        test.done();
      });
    });
  });
}

exports.testEditableUrlInMessageNoDefault = function(test) {
  let pageUrl = getTestUrl("page.html");
  let appArgs = {pageUrl: pageUrl};
  let constraints = {editableURLInMessage: true};
  let expected = " " + pageUrl;
  testEditableUrlInMessageHelper(test, appArgs, constraints, expected);
}

exports.testEditableUrlInMessageNullDefault = function(test) {
  let pageUrl = getTestUrl("page.html");
  let appArgs = {shareArgs: {message: null},
                 pageUrl: pageUrl};
  let constraints = {editableURLInMessage: true};
  let expected = " " + pageUrl;
  testEditableUrlInMessageHelper(test, appArgs, constraints, expected);
}

exports.testEditableUrlInMessageDefault = function(test) {
  let pageUrl = getTestUrl("page.html");
  let appArgs = {shareArgs: {message: "the message"},
                 pageUrl: pageUrl};
  let constraints = {editableURLInMessage: true};
  let expected = "the message " + pageUrl;
  testEditableUrlInMessageHelper(test, appArgs, constraints, expected);
}

function testTitleAndSubjectHelper(test, shareArgs, features, expectedTitle, expectedSubject)
{
  test.waitUntilDone();
  getSharePanelWithApp(test, shareArgs, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow} = appInfo;
    let accountPanelDiv = jqAppWidget.find(".accountPanel");
    let seq = [
      {method: 'getParameters', successArgs:
          {constraints: {},
           features: features,
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
        // check the text in the fields.
        let title = accountPanelDiv.find('[name="title"]');
        test.assertEqual(title.val() || '', expectedTitle);
        let subject = accountPanelDiv.find('[name="subject"]');
        test.assertEqual(subject.val() || '', expectedSubject);
        test.done();
      });
    });
  });
}

exports['subject field, no title field, default share options'] = function(test) {
  let features = {subjectLabel: "Subject"};
  testTitleAndSubjectHelper(test, {}, features, '', "Just another web page");
}

exports['subject field, no title field, subject in share options'] = function(test) {
  let features = {subjectLabel: "Subject"};
  let appArgs = {shareArgs: {subject: "The subject"}};
  testTitleAndSubjectHelper(test, appArgs, features, '', "The subject");
}

exports['subject field, title field, default share options'] = function(test) {
  let features = {subjectLabel: "Subject", title: true};
  testTitleAndSubjectHelper(test, {}, features, "Just another web page", '');
}

exports['subject field, title field, subject in share options'] = function(test) {
  let features = {subjectLabel: "Subject", title: true};
  let appArgs = {shareArgs: {subject: "The subject"}};
  testTitleAndSubjectHelper(test, appArgs, features, "Just another web page", "The subject");
}
