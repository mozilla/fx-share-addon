/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let {getMediator, getTestUrl, createTab, removeCurrentTab} = require("./test_utils");
const {getMediatorWithApp, testAppSequence} = require("./app_helpers");
const tabs = require("tabs");

/**
 * test share state information
 */
const SHARE_STATUS = ["", "start", "", "finished"];
const SHARE_DONE = 0;
const SHARE_START = 1;
const SHARE_ERROR = 2;
const SHARE_FINISHED = 3;

// test the state of the f1 urlbar button
exports.testShareState = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let sharePanel = getMediator();

    // test 'sharing' state
    sharePanel.onUpdateStatus({statusCode: SHARE_START});
    test.assertEqual(sharePanel.anchor.getAttribute("status"),
       SHARE_STATUS[SHARE_START], "share-state-start");

    // mark a success share, which should result temporarily in a
    // SHARE_FINISHED status on the button
    sharePanel.onUpdateStatus({statusCode: SHARE_DONE});
    test.assertEqual(sharePanel.anchor.getAttribute("status"),
       SHARE_STATUS[SHARE_FINISHED], "share-state-finished");

    removeCurrentTab(function() {
      test.done();
    });

  });
}

// test the state of the panel when re-opened.
exports.testShareStateOnReopen = function(test) {
  test.waitUntilDone();
  let features = {subjectLabel: true, title: true};
  getMediatorWithApp(test, {}, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow, mediator} = appInfo;
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
        // change the text in the fields.
        let title = accountPanelDiv.find('[name="title"]');
        title.val('a new title');
        let subject = accountPanelDiv.find('[name="subject"]');
        subject.val('a new subject');
        let message = accountPanelDiv.find('[name="message"]');
        message.val('a new message');
        // Now close and re-open the panel.
        mediator.panel.hide();
        mediator.panel.show();
        // and check the fields again.
        test.assertEqual(title.val(), 'a new title');
        test.assertEqual(subject.val(), 'a new subject');
        test.assertEqual(message.val(), 'a new message');
        test.done();
      });
    });
  });
}

// test the state of the panel when multiple tabs are opened.
exports.testShareStateMultiTabs = function(test) {
  test.waitUntilDone();
  let features = {subjectLabel: true, title: true};
  getMediatorWithApp(test, {tabTitle: "tab 1"}, function(appInfo) {
    let {jqAppWidget, jqPanelContentWindow, mediator, tab: tab1} = appInfo;
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
        // change the text in the fields.
        let title1 = accountPanelDiv.find('[name="title"]');
        title1.val('title in tab 1');
        let subject1 = accountPanelDiv.find('[name="subject"]');
        subject1.val('subject in tab 1');
        let message1 = accountPanelDiv.find('[name="message"]');
        message1.val('message in tab 1');
        // Now create a new tab and invoke the mediator there.
        mediator.panel.hide();
        let shareArgs = {title: 'title in tab 2', subject: 'subject in tab 2', message: 'message in tab 2'};
        getMediatorWithApp(test, {skipAppInstall: true, tabTitle: "tab 2", shareArgs: shareArgs}, function(appInfo2) {
          let {tab: tab2} = appInfo2;
          // activate the first tab.
          tab1.activate();
          test.waitUntil(function() {
            return tabs.activeTab === tab1;
          }).then(function() {
            mediator.show();
            test.waitUntil(function() {
              return title1.val() === 'title in tab 1';
            }).then(function() {
              test.assertEqual(subject1.val(), 'subject in tab 1');
              test.assertEqual(message1.val(), 'message in tab 1');
              // activate the second
              tab2.activate();
              test.waitUntil(function() {
                return tabs.activeTab === tab2;
              }).then(function() {
                mediator.show();
                test.waitUntil(function() {
                  return title1.val() == 'title in tab 2'}
                ).then(function() {
                  test.assertEqual(subject1.val(), 'subject in tab 2');
                  test.assertEqual(message1.val(), 'message in tab 2');
                  test.done();
                })
              });
            });
          })
        });
      });
    });
  });
}
