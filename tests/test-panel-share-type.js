const {getSharePanelWithApp, testAppSequence} = require("./app_helpers");

// validate the UI is as expected for the specified single shareType.
validateUIAgainstShareType = function(test, appInfo, shareType) {
  let {panelContentWindow, appWidget} = appInfo;
  let $ = panelContentWindow.$; // The jquery object *inside* the share content.
  let accountPanelDiv = $(appWidget).find(".accountPanel");
  function checkElement(selector, enabled) {
    enabled = !!enabled;
    let elt = $(selector, accountPanelDiv);
    let msg = 'selector "' + selector + '" has ' + elt.length + ' items, expected 1';
    test.assert(elt.length === 1, msg);
    let isVisible;
    if (elt.attr("type") === "hidden") {
      // hidden fields can't just check :visible, so check a magic attribute.
      isVisible = elt.attr("f1-disabled") === "false";
    } else {
      // a normal element
      isVisible = elt.is(":visible");
    }
    msg = 'selector "' + selector + '" has visibility=' + isVisible + ', expected=' + enabled;
    test.assert(isVisible === enabled, msg);
  }
  // See if the 'subject' field should be visible.
  checkElement('[name="subject"]', shareType.subjectLabel);
  // The 'to' label.
  checkElement('[name="to"]', shareType.toLabel);
  // The counter.
  checkElement('.counter', shareType.textLimit);
  // picture stuff...
  checkElement('[name="picture"]', shareType.picture);
  checkElement(".thumbContainer", shareType.picture);
  checkElement('[name="picture_base64"]', shareType.image);

  checkElement('[name="caption"]', shareType.caption);
  // medium and source both rely on shareType.medium
  checkElement('[name="medium"]', shareType.medium);
  checkElement('[name="source"]', shareType.medium);

  checkElement('.pageTitle', shareType.title);
  checkElement('.pageDescription', shareType.description);
}


testShareTypeHelper = function(test, characteristics, cbtest) {
  test.waitUntilDone();

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {panelContentWindow, appWidget} = appInfo;
    let $ = panelContentWindow.$; // The jquery object *inside* the share content.
    let accountPanelDiv = $(appWidget).find(".accountPanel");
    let seq = [
      {method: 'getCharacteristics', successArgs: characteristics},
      {method: 'getLogin', successArgs: {user: {displayName: 'test user'}},
       callback: function(cbresume) {
        // We returned a user, so the account panel should become visible.
        test.waitUntil(function() {return accountPanelDiv.is(":visible");
        }).then(function() {
          cbtest(appInfo, cbresume);
        })
       }
      }
    ];
    testAppSequence(test, appInfo, seq);
  });
}

// The tests...
let simpleShareType = {
  type: 'somewhere',
  name: 'somewhere'
};

let complexShareType = {
  type: 'somewhere else',
  name: 'somewhere else',
  subjectLabel: "subject",
  toLabel: "to who?",
  textLimit: 100,
  title: true,
  caption: true,
  description: true,
  medium: true,
  picture: true,
  image: true
};

exports.testSimpleSingleShareType = function(test) {
  // these characteristics mean "subject" is shown, so it should get focus
  let chars = {shareTypes: [simpleShareType]};
  testShareTypeHelper(test, chars, function(appInfo, cbresume) {
    let {panelContentWindow, appWidget} = appInfo;
    let $ = panelContentWindow.$; // The jquery object *inside* the share content.
    let accountPanelDiv = $(appWidget).find(".accountPanel");
    // only 1 share type, so should be no widget
    test.assertEqual($('.Select', accountPanelDiv).length, 0);
    validateUIAgainstShareType(test, appInfo, chars.shareTypes[0]);
    cbresume();
  });
};

exports.testComplexSingleShareType = function(test) {
  // these characteristics mean "subject" is shown, so it should get focus
  let chars = {shareTypes: [complexShareType]};
  testShareTypeHelper(test, chars, function(appInfo, cbresume) {
    let {panelContentWindow, appWidget} = appInfo;
    let $ = panelContentWindow.$; // The jquery object *inside* the share content.
    let accountPanelDiv = $(appWidget).find(".accountPanel");
    // only 1 share type, so should be no widget
    test.assertEqual($('.Select', accountPanelDiv).length, 0);
    validateUIAgainstShareType(test, appInfo, chars.shareTypes[0]);
    cbresume();
  });
};

exports.testMultipleShareTypes = function(test) {
  // these characteristics mean "subject" is shown, so it should get focus
  let chars = {
    shareTypes: [simpleShareType, complexShareType]
  };
  testShareTypeHelper(test, chars, function(appInfo, cbresume) {
    let {panelContentWindow, appWidget} = appInfo;
    let $ = panelContentWindow.$; // The jquery object *inside* the share content.
    let accountPanelDiv = $(appWidget).find(".accountPanel");
    // 2 share types, so should be a widget
    test.assertEqual($('.Select', accountPanelDiv).length, 1);
    validateUIAgainstShareType(test, appInfo, chars.shareTypes[0]);
    // now hit the select widget and select the second.
    let selectOption = $('.Select li', accountPanelDiv).eq(1);
    // need to click twice - once to open the dropdown, once to select it.
    selectOption.click();
    selectOption.click();
    validateUIAgainstShareType(test, appInfo, chars.shareTypes[1]);
    // and re-select the first item to ensure everything drops back to how it was.
    selectOption = $('.Select li', accountPanelDiv).eq(0);
    selectOption.click();
    selectOption.click();
    validateUIAgainstShareType(test, appInfo, chars.shareTypes[0]);
    cbresume();
  });
};
