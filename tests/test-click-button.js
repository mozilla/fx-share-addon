const {Cc, Ci, Cm, Cu, components} = require("chrome");
const {getMediator, getTestUrl, getShareButton, createTab, removeCurrentTab, finalize} = require("./test_utils");
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
  
  finalize(test, function(finish) {
    removeCurrentTab(function() {
      finish();
    });
  });

  createTab(pageUrl, function(tab) {
    let share = getMediator();
    share.panel.once("show", function() {
      test.assert(true, "mouse clicks opens panels");
      // close the panel by clicking someplace outside the panel
      mouseEvent(share.anchor);
    });
    share.panel.once("hide", function() {
      test.assert(true, "mouse clicks closes panels");
      test.done();
    });
    
    // open the panel by clicking on the urlbar icon
    mouseEvent(share.anchor);
  });
}
