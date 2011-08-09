/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
let {Services, PlacesUtils} = tmp;

let {createSharePanel, getTestUrl, createTab, removeCurrentTab} = require("./test_utils");

getTestId = function(testPage) {
  let lastSlash = this.module.id.lastIndexOf("/");
  let resourceUrl = this.module.id.substr(0, lastSlash+1) + testPage;
  return require("url").toFilename(resourceUrl);
}
exports.testButtonState = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let sharePanel = createSharePanel(tab.contentWindow);
    //sharePanel.show();
    // the panel callback doesn't seem to happen immediately...
    test.waitUntil(function() {return sharePanel.anchor.getAttribute("checked");}
    ).then(function() {
      sharePanel.panel.hide(); // XX - not currently exposed on sharePanel
      test.waitUntil(function() {return !sharePanel.anchor.getAttribute("checked")}
      ).then(function() {
        removeCurrentTab(function() {
          test.done();
        });
      });
    });
  });
}
