
const {createSharePanel, getTestUrl, getShareButton, createTab, removeCurrentTab} = require("./test_utils");
const events = require("dom/events");
const { activeBrowserWindow: { document } } = require("window-utils");
const window = document.window;

function mouseEvent(element) {
  events.emit(element, "click", {
    category: "MouseEvents",
    settings: [
      true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null
    ]
  });
}

exports.testButton = function(test) {
  test.waitUntilDone();
  let pageUrl = getTestUrl("page.html");

  createTab(pageUrl, function(tab) {
    let panel = createSharePanel(tab.contentWindow);
    test.waitUntil(function() {return panel.panel.isShowing;}
    ).then(function() {
      mouseEvent(panel.anchor);
      test.waitUntil(function() {return !panel.panel.isShowing;}
      ).then(function () {
        mouseEvent(panel.anchor);
        test.waitUntil(function() {return panel.panel.isShowing;}
        ).then(function() {
          panel.panel.hide();
          removeCurrentTab(function() {
            test.done();
          });
        });
      });
    });
  });
}
