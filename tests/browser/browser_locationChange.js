/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * test progress listener catching a location change and updating the share
 * button state
 */
function test() {
  waitForExplicitFinish();

  let share_button = document.getElementById("share-button");
  let share_popup = document.getElementById("share-popup");

  openTab(PAGE_URL, function() {
    // The button is visible now, but the panel is closed at first.
    is(share_button.hidden, false, "button-shown");

    is(content.location, PAGE_URL, "page-loaded");

    next(gBrowser.selectedBrowser, "DOMContentLoaded", function() {
      is(share_button.hidden, true, "button-hidden");
      gBrowser.removeCurrentTab();
      cleanup(finish);
    });
    gBrowser.selectedBrowser.loadURI("about:blank");
  });
}
