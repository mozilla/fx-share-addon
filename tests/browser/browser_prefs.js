/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const PREFPANE_LOADED_TOPIC = "services:share:prefpane:loaded";

let gPrefWin;
function test() {
  waitForExplicitFinish();

  Services.obs.addObserver(function onSharePaneLoaded(subject, topic, data) {
    Services.obs.removeObserver(onSharePaneLoaded, PREFPANE_LOADED_TOPIC);
    gPrefWin = subject;

    // Redefine this global variable. Now all of our helpers will use
    // this instead of the share panel's browser.
    gShareBrowser = gPrefWin.document.getElementById("share-prefs-browser");
    gShareBrowser.addEventListener("load", function onLoad() {
      gShareBrowser.removeEventListener("load", onLoad, true);

      // Trivial test: make sure we got the right URL loaded
      let settingsURL = Services.prefs.getCharPref("services.share.settingsURL");
      is(gShareWindow.location, settingsURL);

      run_next_test();
    }, true);

  }, PREFPANE_LOADED_TOPIC, false);

  window.openPreferences("paneShare");
}

Services.scriptloader.loadSubScript(CHROME_PREFIX + "keyvaluestore_tests.js",
                                    this);
gTests.push(function tearDown() {
  gPrefWin.close();
  gPrefWin = null;
  gShareBrowser = null;
  cleanup(finish);
});
