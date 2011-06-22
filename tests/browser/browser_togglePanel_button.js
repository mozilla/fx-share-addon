/**
 * Open and close the Share panel by clicking on the URL bar button with
 * the mouse.
 */
function test() {
  waitForExplicitFinish();

  let share_button = document.getElementById("share-button");
  let share_popup = document.getElementById("share-popup");

  // Initially we're showing about:blank so the share button should
  // not be visible.
  is(share_button.hidden, true);

  openTab(PAGE_URL, function() {
    // The button is visible now, but the panel is closed at first.
    is(share_button.hidden, false);
    is(share_popup.state, "closed");

    // Now click on the button, the panel opens.
    next(share_popup, "popupshown", function() {
      // The panel is open now.
      is(share_popup.state, "open");

      // Click on the button again, the panel is closed.
      next(share_popup, "popuphidden", function() {
        // The panel is closed again now.
        is(share_popup.state, "closed");

        // Clean up.
        gBrowser.removeCurrentTab();
        cleanup(finish);
      });
      EventUtils.sendMouseEvent({type: "click"}, "share-button", window);
    });
    EventUtils.sendMouseEvent({type: "click"}, "share-button", window);
  });
}
