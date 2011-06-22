/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/Services.jsm");

const PANEL_NETWORK_DOWN_PAGE = "chrome://browser/content/shareNetworkDown.xhtml";
const PREFS_NETWORK_DOWN_PAGE = "chrome://browser/content/shareNetworkDown.xhtml";

const BROKEN_URL = "http://localhost:12345/non-existent";
const PAGE_404_URL = "http://mochi.test:8888/non-existent";

const PREFPANE_LOADED_TOPIC = "services:share:prefpane:loaded";

function onSharePaneLoaded(callback) {
  Services.obs.addObserver(function observer(subject, topic, data) {
    Services.obs.removeObserver(observer, PREFPANE_LOADED_TOPIC);
    callback(subject); // subject is the pref window object
  }, PREFPANE_LOADED_TOPIC, false);
  window.openPreferences("paneShare");
}

function test() {
  waitForExplicitFinish();
  run_next_test();
}

gTests.push(function test_panel_broken() {
  Services.prefs.setCharPref("services.share.shareURL", BROKEN_URL);
  openTab(PAGE_URL, function() {
    window.ffshare.togglePanel();
    nextCaptured(gShareBrowser, "load", function onLoad() {
      is(gShareWindow.location, PANEL_NETWORK_DOWN_PAGE);

      window.ffshare.togglePanel();
      gBrowser.removeCurrentTab();
      run_next_test();
    });
  });
});

gTests.push(function test_panel_404() {
  Services.prefs.setCharPref("services.share.shareURL", PAGE_404_URL);
  openTab(PAGE_URL, function() {
    window.ffshare.togglePanel();
    nextCaptured(gShareBrowser, "load", function onLoad() {
      // First we load the 404 page, but then we should get redirected to the
      // network down page.
      is(gShareWindow.location, PAGE_404_URL);
      nextCaptured(gShareBrowser, "load", function onLoad() {
        is(gShareWindow.location, PANEL_NETWORK_DOWN_PAGE);

        window.ffshare.togglePanel();
        gBrowser.removeCurrentTab();
        run_next_test();
      });
    });
  });
});

gTests.push(function test_prefs_broken() {
  Services.prefs.setCharPref("services.share.settingsURL", BROKEN_URL);
  onSharePaneLoaded(function(win) {
    gShareBrowser = win.document.getElementById("share-prefs-browser");
    nextCaptured(gShareBrowser, "load", function onLoad() {
      is(gShareWindow.location, PREFS_NETWORK_DOWN_PAGE);

      gShareBrowser = null;
      win.close();
      next(win, "unload", function () {
        run_next_test();
      });
    });
  });
});

gTests.push(function test_prefs_404() {
  Services.prefs.setCharPref("services.share.settingsURL", PAGE_404_URL);
  onSharePaneLoaded(function(win) {
    gShareBrowser = win.document.getElementById("share-prefs-browser");
    nextCaptured(gShareBrowser, "load", function onLoad() {
      // First we load the 404 page, but then we should get redirected to the
      // network down page.
      is(gShareWindow.location, PAGE_404_URL);
      nextCaptured(gShareBrowser, "load", function onLoad() {
        is(gShareWindow.location, PREFS_NETWORK_DOWN_PAGE);

        gShareBrowser = null;
        win.close();
        next(win, "unload", function () {
          run_next_test();
        });
      });
    });
  });
});

gTests.push(function tearDown() {
  gShareBrowser = document.getElementById("share-browser");
  openTab(PAGE_URL, function() {
    Services.prefs.setCharPref("services.share.shareURL", SHARE_URL);
    window.ffshare.togglePanel();
    nextCaptured(gShareBrowser, "load", function onLoad() {
      gBrowser.removeCurrentTab();
      cleanup(finish);
    });
  });
});
