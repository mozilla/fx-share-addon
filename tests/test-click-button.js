const {Cc, Ci, Cm, Cu, components} = require("chrome");
const {getSharePanel, getTestUrl, getShareButton, createTab, removeCurrentTab, finalize} = require("./test_utils");
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
    let share = getSharePanel();
    share.panel.on("show", function() {
      test.assert(true, "mouse clicks opens panels");
      // close the panel by clicking someplace outside the panel
      // XXX this test worked pre-jetpack, some jetpackism is getting in the way
      mouseEvent(share.anchor);
    });
    share.panel.on("hide", function() {
      test.assert(true, "mouse clicks closes panels");
      test.done();
    });
    
    // open the panel by clicking on the urlbar icon
    mouseEvent(share.anchor);
  });
}
