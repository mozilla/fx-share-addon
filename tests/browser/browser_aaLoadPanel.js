/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// sigh.
function test() {
  // test that the idle service did in fact set src attr on the share browser
  // to cause early loading of the web content.

  waitForExplicitFinish();
  gShareBrowser.addEventListener("load", function onLoad() {
    gShareBrowser.removeEventListener("load", onLoad, true);
    window.setTimeout(function () {
      cleanup(finish);
    }, 0);
  }, true);

  // idle service would normally call this
  ffshare.sharePanel.preloadPanel(); 
}
