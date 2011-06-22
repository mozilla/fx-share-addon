Components.utils.import("resource://services-share/store.js");

const CHROME_PREFIX = "chrome://mochitests/content/browser/services/share/tests/browser/";
const PREFIX = "http://mochi.test:8888/browser/services/share/tests/browser/";
const SHARE_URL = PREFIX + "share.html";
const PAGE_URL = PREFIX + "page.html";

Services.prefs.setCharPref("services.share.shareURL", SHARE_URL);
Services.prefs.setCharPref("services.share.settingsURL", SHARE_URL);

// gShareWindow is gShareBrowser's window object. It's dynamic because
// it can change.
let gShareBrowser = document.getElementById("share-browser");
this.__defineGetter__("gShareWindow", function() {
  return gShareBrowser.contentWindow.wrappedJSObject;
});

/**
 * Register a one-time event handler.
 */
function next(element, event, callback) {
  element.addEventListener(event, function handler() {
    element.removeEventListener(event, handler, false);
    callback.apply(this, arguments);
  }, false);
}

/**
 * Register a one-time event handler with 'useCapture = true'.
 */
function nextCaptured(element, event, callback) {
  element.addEventListener(event, function handler() {
    element.removeEventListener(event, handler, true);
    callback.apply(this, arguments);
  }, true);
}

/**
 * Relay a message to the share window.
 */
function relayMessage(message, callback) {
  next(gShareWindow, "message", callback);
  gShareWindow.relayMessage(message);
}

/**
 * Open a new tab.
 */
function openTab(url, callback) {
  gBrowser.selectedTab = gBrowser.addTab();
  next(gBrowser.selectedBrowser, "DOMContentLoaded", callback);
  content.location = url;
}

/**
 * Clean up test fixtures.
 */
function cleanup(callback) {
  ffshare.sharePanel.close();
  try {
    Services.prefs.clearUserPref("services.share.shareURL");
    Services.prefs.clearUserPref("services.share.settingsURL");
  } catch (ex if ex.result == Cr.NS_ERROR_UNEXPECTED) {
    // The pref wasn't touched.
  }
  SecureFileStore.clear();
  callback();
}

/**
 * Chain asynchronous tests.
 */
let gTimer = Components.classes["@mozilla.org/timer;1"]
                       .createInstance(Components.interfaces.nsITimer);
let gTestIndex = 0;
let gTests = [];

function run_next_test() {
  let test = gTests[gTestIndex++];
  gTimer.initWithCallback({notify: test}, 0,
                          Components.interfaces.nsITimer.TYPE_ONE_SHOT);
}
