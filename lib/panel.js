/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Raindrop.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Anant Narayanan <anant@kix.in>
 *   Shane Caraveo <shanec@mozillamessaging.com>
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
let {Services, PlacesUtils, XPCOMUtils} = tmp;

const PANEL_MESSAGE_TOPICS = ["panelReady",
                              "sizeToContent",
                              "hide",
                              "close",
                              "updateStatus",
                              "success",
                              "getShareState",
                              "generateBase64Preview",
                              "installApp",
                              "result",
                              "storeGet",
                              "storeSet",
                              "storeRemove",
                              "storeRemoveAll"];

const PREFS_MESSAGE_TOPICS = ["storeGet",
                              "storeSet",
                              "storeRemove",
                              "storeRemoveAll"];

const SHARE_STATUS = ["", "start", "", "finished"];
const SHARE_DONE = 0;
const SHARE_START = 1;
const SHARE_ERROR = 2;
const SHARE_FINISHED = 3;
const IDLE_TIMEOUT = 1; // seconds

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const PANEL_NETWORK_DOWN_PAGE = "resource://ffshare-at-mozilla-dot-org-ffshare-data/content/shareNetworkDown.xhtml";
const PREFS_NETWORK_DOWN_PAGE = "resource://ffshare-at-mozilla-dot-org-ffshare-data/content/shareNetworkDown.xhtml";

const STORE_KEY_CHANGED_TOPIC = "services:share:store:key-changed";
const STORE_CLEARED_TOPIC     = "services:share:store:cleared";
const PREFPANE_LOADED_TOPIC   = "services:share:prefpane:loaded";
const WINDOWS_RESTORED_TOPIC  = "sessionstore-windows-restored";
const IDLE_TOPIC              = "idle";

function mixin(target, source, override) {
  //TODO: consider ES5 getters and setters in here.
  for (let prop in source) {
    if (!(prop in {}) && (!(prop in target) || override)) {
      target[prop] = source[prop];
    }
  }
}

XPCOMUtils.defineLazyServiceGetter(this, "unescapeService",
                                   "@mozilla.org/feed-unescapehtml;1",
                                   "nsIScriptableUnescapeHTML");

XPCOMUtils.defineLazyServiceGetter(this, "bookmarksService",
                                   "@mozilla.org/browser/nav-bookmarks-service;1",
                                   "nsINavBookmarksService");

XPCOMUtils.defineLazyServiceGetter(this, "idleService",
                                   "@mozilla.org/widget/idleservice;1",
                                   "nsIIdleService");

function validateURL(url) {
  if (!/^\w+?:\/\/\w+(\.\w+)*(:\d+)?(\/.*)?$/.test(url))
    return null;
  return url;  
}

/**
 * Dispatches postMessages from a XUL browser as an RPC call JavaScript object.
 * 
 * Mesages have the following properties:
 * - topic: the string topic of the messsage, corresponds to a function name.
 * - data: associated data (e.g. arguments) for the message.
 *
 * Objects inheriting from this should define the following properties/methods:
 * - 'browserID'
 * - 'allowedMessageTopics'
 * - 'getAllowedMessageOrigin()'
 *
 */
function PostMessageRPCDispatcher(window) {
  this.window = window;
  this.document = window.document;
  this.browser = this.document.getElementById(this.browserID);

  // Attach with 'useCapture = true' here since the load event doesn't
  // seem to bubble up to chrome.
  this.browser.addEventListener("load", this.attachMessageListener.bind(this),
                                true);

  this.browser.webProgress.addProgressListener(
    this, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
}
PostMessageRPCDispatcher.prototype = {

  /**
   * XML id of the browser element that contains the web content.
   * Define this in sub implementations.
   */
  browserID: null,

  /**
   * An array of allowed message topics.
   */
  allowedMessageTopics: null,

  /**
   * Return the URL of the page that we accept messages from.
   */
  getAllowedMessageOrigin: function getAllowedMessageOrigin(){
    return null;
  },

  /**
   * (Chrome) URL of the network down page to display
   */
  networkDownPage: null,

  /**
   * Indicates whether a non-cache refresh should be forced the next time.
   */
  forceReload: false,  

  /**
   * Attach the message event listener to the web content browser.
   */
  attachMessageListener: function attachMessageListener() {
    let allowedOrigin = this.getAllowedMessageOrigin();
    function messageListener(event) {
      // Make sure we only act on messages from the page we expect.
      if (allowedOrigin.indexOf(event.origin) !== 0) {
        return;
      }

      let message;
      try {
        // Only some messages are valid JSON, only care about the ones
        // that are.
        message = JSON.parse(event.data);
      } catch (e) {
        // Bail if we can't parse the event data as JSON.
        return;
      }

      // Bail if this isn't a valid message topic.
      if (!message.topic ||
          this.allowedMessageTopics.indexOf(message.topic) == -1) {
        return;
      }
      this[message.topic](message.data);
    }

    let win = this.browser.contentWindow;
    win.addEventListener("message", messageListener.bind(this), false);
  },

  /**
   * Send a message into the web content.
   */
  sendMessage: function sendMessage(topic, data) {
    let win = this.browser.contentWindow;
    win.postMessage(JSON.stringify({
      topic: topic,
      data: data
    }), win.location.protocol + "//" + win.location.host);
  },

  /**
   * nsIWebProgressListener
   */

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference]),

  onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
    if (!('nsIHttpChannel' in aRequest)) {
      return;
    }
    if (!(aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW &&
          aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)) {
      return;
    }

    let status;
    try {
      status = aRequest.nsIHttpChannel.responseStatus;
    } catch (e) {
      // Could be just an invalid URL or not an http thing. Need to be
      // sure to not endlessly load error page if it is already loaded.
      // Also ignore this state for about:blank which is used as a
      // placeholder while first creating the browser element. Check
      // against channel.name, that is what we were *trying* to load.
      let href = aRequest.nsIHttpChannel.name;
      if (href !== this.networkDownPage && href !== 'about:blank') {
        status = 1000;
      } else {
        status = 200;
      }
    }

    if (status < 200 || status > 399) {
      this.browser.contentWindow.location = this.networkDownPage;
      this.forceReload = true;
    }
  },

  onLocationChange: function (aWebProgress, aRequest, aLocation) {},
  onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onSecurityChange: function (aWebProgress, aRequest, aState) {},
  onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
};


function KeyValueStoreDispatcher(window) {
  PostMessageRPCDispatcher.call(this, window);

  Services.obs.addObserver(this, STORE_KEY_CHANGED_TOPIC, true);
  Services.obs.addObserver(this, STORE_CLEARED_TOPIC, true);

  function unregister() {
    window.removeEventListener("unload", unregister, false);
    Services.obs.removeObserver(this, STORE_KEY_CHANGED_TOPIC);
    Services.obs.removeObserver(this, STORE_CLEARED_TOPIC);
  }
  unregister = unregister.bind(this);
  window.addEventListener("unload", unregister, false);
}
KeyValueStoreDispatcher.prototype = {
  __proto__: PostMessageRPCDispatcher.prototype,

  /**
   * nsIObserver
   */

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference]),

  observe: function (subject, topic, data) {
    switch (topic) {
      case STORE_KEY_CHANGED_TOPIC:
        let info = subject.wrappedJSObject;
        this.sendMessage("storeNotifyChange", {key: info.key, value: info.value});
        break;
      case STORE_CLEARED_TOPIC:
        this.sendMessage("storeNotifyRemoveAll");
        break;
    }
  },

  /**
   * PostMessage handlers
   */

  storeGet: function storeGet(key) {
    SecureKeyValueStore.get(key, (function(value) {
      this.sendMessage("storeGetReturn", {key: key, value: value});
    }).bind(this));
  },

  storeSet: function storeSet(data) {
    SecureKeyValueStore.set(data.key, data.value);
  },

  storeRemove: function storeRemove(key) {
    SecureKeyValueStore.remove(key);
  },

  storeRemoveAll: function storeRemoveAll() {
    SecureKeyValueStore.removeAll();
  }
};


/**
 * Singleton controller for the share panel
 *
 * A state object is attached to each browser tab when the share panel
 * is opened for that tab.  The state object is removed from the current
 * tab when the panel is closed.
 */
function SharePanel(window, ffshare) {
//  KeyValueStoreDispatcher.call(this, window);
  this.window = window;

  this.gBrowser = window.gBrowser;
  this.ffshare = ffshare;

  this.button = window.document.getElementById('share-button');
  
  this.init();
}
SharePanel.prototype = {
/***  
  __proto__: KeyValueStoreDispatcher.prototype,

  // Define bits for PostMessageRPCDispatcher
  browserID: "share-browser",
  allowedMessageTopics: PANEL_MESSAGE_TOPICS,
  getAllowedMessageOrigin: function getAllowedMessageOrigin() {
    return Services.prefs.getCharPref("services.share.shareURL");
  },
  networkDownPage: PANEL_NETWORK_DOWN_PAGE,
***/

  /**
   * shareState cache
   *
   * contains the options for a share that are gathered from the page being
   * shared, as well as the current status of the share (see getOptions). The
   * key in this object is the url of the page being shared. When a share is
   * completed the entry is removed.  In case of an error, the entry may contain
   * the error message, and will be reused to retry the share.  An entry
   * could outlive the tab containing the page that was shared, but under
   * normal circumstances it will be deleted within a second or two.
   */
  shareState: {},
  
  init: function () {
/***    
    this.browser.addEventListener("load",
                                  this.browserLoadListener.bind(this), true);
***/
    // Set the browser src to load at first idle moment, if the user has
    // previously configured sharing accounts.
    idleService.addIdleObserver(this, IDLE_TIMEOUT);
    // Ensure we don't leak anything if the window is closed before
    // we had a chance to run the observer.
    this.removeIdleObserver = this.removeIdleObserver.bind(this);
    this.window.addEventListener("unload", this.removeIdleObserver, false);
  },

  removeIdleObserver: function removeIdleObserver() {
    this.window.removeEventListener("unload", this.removeIdleObserver, false);
    idleService.removeIdleObserver(this, IDLE_TIMEOUT);
  },

  observe: function (subject, topic, data) {
/*** preload still relevant??    
    let self = this;
    switch (topic) {
      case IDLE_TOPIC:
        this.removeIdleObserver();
        SecureKeyValueStore.getAll(function (storeData) {
          if (storeData && Object.keys(storeData).length) {
            self.preloadPanel();
          }
        });
        return;
    }
***/
    KeyValueStoreDispatcher.prototype.observe.apply(this, arguments);
  },

/***
  preloadPanel: function() {
    let url = Services.prefs.getCharPref("services.share.shareURL");
    if (this.browser.getAttribute("src") == url) {
      return;
    }
    this.browser.setAttribute('src', url);
  },
***/

  browserLoadListener: function(event) {
    let self = this;
    this.window.setTimeout(function () {
      self.sizeToContent();
    }, 0);
  },

  panelShown: function () {
    this.button.setAttribute("checked", true);
  },

  panelHidden: function () {
    this.button.removeAttribute("checked");
  },

  /**
   * APIs called (indirectly) by the share panel.
   */
  onMediatorCallback: function(message) {
    // Bail if this isn't a valid message topic.
    if (!message.cmd||
        PANEL_MESSAGE_TOPICS.indexOf(message.cmd) == -1) {
      console.log("ignoring mediator message", message.cmd);
      return message;
    }
    try {
      return this[message.cmd](message);
    } catch (ex) {
      console.error("Handler of OWA command", message.cmd, "failed:", ex, ex.stack);
      return message;
    }
  },

  /**
   * Sent when the share succeeds.
   * 
   * Properties on the data object:
   * @param domain
   *        The share service domain.
   * @param username:
   *        The username of the user on the service domain.
   * @param userid
   *        Some services have an ID that id different from the username.
   * @param url
   *        The URL of the page that was shared. Used for bookmarking.
   * @param service
   *         The "name" of the service. Used for bookmarking.
   * 
   * The domain, username and userid taken together form a unique identifier
   * for which account on which service was used to do the share.
   */
  result: function (message) {
    let data = message.data;
    let url = data.link;
    let title = data.title;
    this.updateStatus([SHARE_DONE,,,url], true);

    // XXX we should work out a better bookmarking system
    // https:// github.com/mozilla/f1/issues/66
    if (Services.prefs.getBoolPref("services.share.bookmarking")) {
      let nsiuri = Services.io.newURI(url, null, null);
      if (!bookmarksService.isBookmarked(nsiuri)) {
          bookmarksService.insertBookmark(
              bookmarksService.unfiledBookmarksFolder, nsiuri,
              bookmarksService.DEFAULT_INDEX, title.trim()
          );
      }
      // Ack - we don't have the concept of a 'service' in an OWA...
      // PlacesUtils.tagging.tagURI(nsiuri, [data.service]);
    }
    // and we want this message to also be processed by OWA itself, which will
    // close the panel.
    return message;
  },

  /**
   * Send current shareState for the page.
   *
   * This is useful for when the web app needs to restore correctly from an
   * error. The panel is usually hidden when the share error occurs, and the
   * user may have changed tabs. So the chrome remembers any error state and
   * other info about the page in a shareState variable that is stored
   * per-browser tab. This data is only stored in memory, it is removed on
   * browser window close, or if there is a successful share.
   *
   * Also see the show() method.
   */
  getShareState: function() {
    let contentBrowser = this.gBrowser.getBrowserForTab(this.gBrowser.selectedTab),
        tabURI = contentBrowser.currentURI,
        tabUrl = tabURI.spec,
        shareState = this.shareState[tabUrl];
    this.sendMessage("shareState", shareState);
  },

  /**
   * Called from web content via post message whenever it is loaded.
   */
  panelReady: function() {
    // When the panel is opened for the very first time, we have to hook up a
    // listener for popupshown so we can set the share state in the future, and
    // we need to set the initial share state now.  We replace the panelReady
    // function with a simpler version after the first call.

    this.getShareState();

    // we replace panelReady to only do a getShareState call, and never add
    // another event listener again.  Content MAY call panelReady again without
    // a negative side effect.
    this.panelReady = this.getShareState;
  },

  sizeToContent: function () {
    if (!this.browser) {
      // if the panel is not open and visible we will not get the correct
      // size for the panel content.  This happens when the idle observer
      // first sets src on the browser.
      return;
    }
    let doc = this.browser.contentDocument;
    // XXX - use of wrapper seems problematic here, especially with the
    // dynamic DOM work done in the panel - just size to the body for now
    // (which is still problematic, but works slightly better until we sort
    // this out)
//    let wrapper = doc && doc.getElementById('wrapper');
    let wrapper = doc.body;
    if (!wrapper) {
      return;
    }
    this.browser.style.width = wrapper.scrollWidth + "px";
    this.browser.style.height = wrapper.scrollHeight + "px";
  },

  /**
   * Called when we want to hide the panel and possibly destroy the shareState
   * information.  This can only happen with the current selected tab, so we
   * rely on the uri from the tab to delete status if necessary.
   */
/***
  close: function () {
    let contentBrowser = this.gBrowser.getBrowserForTab(this.gBrowser.selectedTab),
        tabURI = contentBrowser.currentURI,
        tabUrl = tabURI.spec,
        shareState = this.shareState[tabUrl];

    this.panel.hidePopup();

    if (shareState && shareState.status === 0) {
      delete this.shareState[tabUrl];
    }
  },
***/
  /**
   * Called when we only want to hide the panel and preserve the shareState
   * information.
   */
/***
  hide: function () {
    this.panel.hidePopup();
  },
***/
  /**
   * Updates the state of the toolbar button during a share activity or
   * afterward when a share error is received.
   * 
   * The status
   * @param {Integer} an index value that has meaning in the SHARE_STATUS array
   * @param {Boolean} only passed by the final success call
   */
  updateStatus: function (message) {
    let statusCode = message.result.status,
        success = (statusCode===SHARE_DONE),
        shareUrl = message.result.url,
        statusData = [statusCode,,,shareUrl],
        contentTab = this.getBrowserTabForUrl(shareUrl),
        button = this.button,
        shareState = this.shareState[shareUrl];

    // is there an existing tab for this share? if not, and this is an error
    // we need to background open a new browser tab
    if (!contentTab && status === SHARE_ERROR) {
      contentTab = this.gBrowser.addTab(shareUrl);
    }

    if (contentTab) {
      if (shareState) {
        shareState.status = statusData;
      }
  
      if (button && this.gBrowser.selectedTab == contentTab) {
        // Only a final successful share should be passing this value
        if (success) {
          button.setAttribute("status", SHARE_STATUS[SHARE_FINISHED]);
          this.window.setTimeout(function () {
            button.setAttribute("status", SHARE_STATUS[statusCode]);
          }, 2900);
        } else {
          button.setAttribute("status", SHARE_STATUS[statusCode]);
        }
      }
    }
    
    if (success) {
      delete this.shareState[shareUrl];
    }
  },

  /**
   * Fetch a preview image and convert it to base64 data.
   * 
   * @param imgUrl
   *        The image URL to use in generating the preview.
   */
  generateBase64Preview: function (imgUrl) {
    let self = this;
    let img = new this.window.Image();
    img.onload = function () {

      let canvas = self.document.createElementNS(NS_XUL, "canvas"),
          w = img.width,
          h = img.height,
          dataUrl, canvasW, canvasH, ctx, scale;

      // Put upper constraints on the image size.
      if (w > 10000) {
        w = 10000;
      }
      if (h > 10000) {
        h = 10000;
      }

      canvas.setAttribute('width', '90');
      canvas.setAttribute('height', '70');

      canvasW = canvas.width;
      canvasH = canvas.height;
      ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.save();

      scale = canvasH / h;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
      dataUrl = canvas.toDataURL("image/png", "");

      self.sendMessage("base64Preview", dataUrl);
    };
    img.src = imgUrl;
  },

  /**
   * End of postMessage handlers. Helpers below.
   */


  escapeHtml: function (text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  getBrowserTabForUrl: function(url) {
    if (!url)
      return null;
    if (this.gBrowser.getBrowserForTab(this.gBrowser.selectedTab).currentURI.spec == url)
      return this.gBrowser.selectedTab;
    var numTabs = this.gBrowser.browsers.length;
    for (var index = 0; index < numTabs; index++) {
      var currentBrowser = this.gBrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec) {
        return this.gBrowser.tabs[index];
      }
    }
    return null;
  },

  installApp: function(message) {
    let manifestUrl = message.app;
    let self = this;
    let {FFRepoImplService} = require("api");
    var args = {
      url: manifestUrl,
      hidePostInstallPrompt: true, // don't want the app panel to appear.
      onerror: function(errob) {
        // TODO: should probably consider notifying the content of the error
        // so it can do something useful.
        console.log("Failed to install " + manifestUrl + ": " + errob.code + ": " + errob.message);
      },
      onsuccess: function() {
        // Note the app being installed will have triggered the
        // 'openwebapp-installed' observer, which will in-turn cause a
        // 'reconfigure' event to be handled by OWA.
        console.log("successful install of", manifestUrl);
      }
    };
    // Hrmph - need to use an installOrigin of the hard-coded OWA app store
    console.log("requesting install of", manifestUrl);
    FFRepoImplService.install('http://localhost:8420',
                              args,
                              undefined); // the window is only used if a prompt is shown.
  }

/****
  show: function (options) {
    let contentBrowser = this.gBrowser.getBrowserForTab(this.gBrowser.selectedTab),
        tabURI = contentBrowser.currentURI,
        tabUrl = tabURI.spec,
        nBox = this.gBrowser.getNotificationBox(contentBrowser),
        notification = nBox.getNotificationWithValue("mozilla-f1-share-error");

    if (!this.ffshare.isValidURI(tabURI)) {
      return;
    }

    if (notification) {
      nBox.removeNotification(notification);
    }
    let currentState = this.shareState[tabUrl];
    options = this.getOptions(options);

    this.shareState[tabUrl] = {
      options: options,
      status: currentState ? currentState.status : 0
    };

    let url = Services.prefs.getCharPref("services.share.shareURL");
    if (this.forceReload) {
      // first time load, just set the src, otherwise force a real reload
      if (this.browser.getAttribute('src') !== url) {
        this.browser.setAttribute('src', url);
      } else {
        this.browser.loadURI(url);
      }
      this.forceReload = false;
    } else {
      this.browser.setAttribute('src', url);
    }

    if (this.panel.state === 'open') {
      this.getShareState();
    } else {
      let position = 'bottomcenter topleft';
      if (this.window.getComputedStyle(this.window.gNavToolbox,
                                       "").direction === "rtl") {
        position = 'bottomcenter topright';
      }
      this.panel.openPopup(this.button, position, 0, 0, false, false);
    }
  }
****/  
};


function SharePrefsPane(window) {
  KeyValueStoreDispatcher.call(this, window);

  let url = Services.prefs.getCharPref("services.share.settingsURL");
  this.browser.setAttribute("src", url);

  Services.obs.notifyObservers(window, PREFPANE_LOADED_TOPIC, null);
}
SharePrefsPane.prototype = {
  __proto__: KeyValueStoreDispatcher.prototype,

  // Define bits for PostMessageRPCDispatcher
  browserID: "share-prefs-browser",
  allowedMessageTopics: PREFS_MESSAGE_TOPICS,
  getAllowedMessageOrigin: function getAllowedMessageOrigin() {
    return Services.prefs.getCharPref("services.share.settingsURL");
  },
  networkDownPage: PREFS_NETWORK_DOWN_PAGE

};

function PageOptionsBuilder(browser)
{
  this.gBrowser = browser;
};

PageOptionsBuilder.prototype = {
  getOptions: function (options) {
    options = options || {};
    mixin(options, {
//      version: this.ffshare.version,
      title: this.getPageTitle(),
      description: this.getPageDescription(),
      medium: this.getPageMedium(),
      source: this.getSourceURL(),
      url: this.gBrowser.currentURI.spec,
      canonicalUrl: this.getCanonicalURL(),
      shortUrl: this.getShortURL(),
      previews: this.previews(),
      siteName: this.getSiteName()
    });
    return options;
  },

  getPageTitle: function () {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:title']"),
        i, title, content;
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        //Title could have some XML escapes in it since it could be an
        //og:title type of tag, so be sure unescape
        return unescapeService.unescape(content.trim());
      }
    }

    metas = this.gBrowser.contentDocument.querySelectorAll("meta[name='title']");
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        // Title could have some XML escapes in it so be sure unescape
        return unescapeService.unescape(content.trim());
      }
    }

    title = this.gBrowser.contentDocument.getElementsByTagName("title")[0];
    if (title && title.firstChild) {
      // Use node Value because we have nothing else
      return title.firstChild.nodeValue.trim();
    }
    return "";
  },

  getPageDescription: function () {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:description']"),
        i, content;
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        return unescapeService.unescape(content);
      }
    }

    metas = this.gBrowser.contentDocument.querySelectorAll("meta[name='description']");
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        return unescapeService.unescape(content);
      }
    }
    return "";
  },

  getSiteName: function () {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:site_name']");
    for (let i = 0; i < metas.length; i++) {
      let content = metas[i].getAttribute("content");
      if (content) {
        return unescapeService.unescape(content);
      }
    }
    return "";
  },

  // According to Facebook - (only the first 3 are interesting)
  // Valid values for medium_type are audio, image, video, news, blog, and mult.
  getPageMedium: function () {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:type']"),
        i, content;
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        return unescapeService.unescape(content);
      }
    }

    metas = this.gBrowser.contentDocument.querySelectorAll("meta[name='medium']");
    for (i = 0; i < metas.length; i++) {
      content = metas[i].getAttribute("content");
      if (content) {
        return unescapeService.unescape(content);
      }
    }
    return "";
  },

  getSourceURL: function () {
    // Ideally each page would report the medium correctly, but some
    // do not, like vimeo, so always just look for a video source.
    let source = this.getVideoSourceURL();
    return source || "";
  },

  getVideoSourceURL: function () {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:video']");
    for (let i = 0; i < metas.length; i++) {
      let content = metas[i].getAttribute("content");
      if (content && (content = this._validURL(unescapeService.unescape(content)))) {
        return content;
      }
    }
    return this.getVideoSourceURLHacks();
  },

  getVideoSourceURLHacks: function () {
    let canonical = this.getCanonicalURL(),
        host = this.gBrowser.currentURI.host,
        params, embeds, i, src, flashvars, value, url;

    // YouTube hack to get the right source without too many parameters
    if (host.indexOf("youtube.com") >= 0 &&
        canonical.match(/v=([A-Za-z0-9._%\-]*)[&\w;=\+_\-]*/)) {
      let id = canonical.match(/v=([A-Za-z0-9._%\-]*)[&\w;=\+_\-]*/)[1];
      return "http:// www.youtube.com/v/" + id;
    }

    // Vimeo hack to find the <object data="src"><param name="flashvars"/></object> pieces we need
    embeds = this.gBrowser.contentDocument.querySelectorAll("object[type='application/x-shockwave-flash'][data]");
    params = this.gBrowser.contentDocument.querySelectorAll("param[name='flashvars']");
    if (params && params.length) {
      for (i = 0; i < embeds.length; i++) {
        src = embeds[i].getAttribute("data");
        flashvars = params[0].getAttribute("value");
        if (flashvars) {
          src += (src.indexOf("?") < 0 ? "?" : "&amp;") + decodeURIComponent(flashvars);
        }
        if ((url = this._validURL(unescapeService.unescape(src)))) {
          return url;
        }
      }
    }

    // A generic hack that looks for the <param name="movie"> which is often available
    // for backwards compat and IE
    params = this.gBrowser.contentDocument.querySelectorAll("param[name='movie']");
    for (i = 0; i < params.length; i++) {
      value = params[i].getAttribute("value");
      if (value) {
        if ((url = this._validURL(unescapeService.unescape(value)))) {
          return url;
        }
      }
    }

    // This one is fairly bad because the flashvars can exceed a reasonable
    // url length limit and since it is only sent to flash it is often large
    embeds = this.gBrowser.contentDocument.querySelectorAll("embed[src]");
    for (i = 0; i < embeds.length; i++) {
      src = embeds[i].getAttribute("src");
      flashvars = embeds[i].getAttribute("flashvars");
      if (flashvars) {
        src += (src.indexOf("?") < 0 ? "?" : "&amp;") + decodeURIComponent(flashvars);
      }
      if ((url = this._validURL(unescapeService.unescape(src)))) {
        return url;
      }
    }
    return "";
  },

  _getShortURLFrom: function(query) {
    let shorturl = this.gBrowser.contentDocument.querySelectorAll(query);
    for (let i = 0; i < shorturl.length; i++) {
      let content = this._validURL(shorturl[i].getAttribute("href"));
      if (content) {
        return content;
      }
    }
    return "";
  },
  
  getShortURL: function () {
    let selectors = ["link[id='shorturl']", "link[rel='shorturl']",
                     "link[rel='shortlink']"];
    let url;
    for each(let query in selectors) {
      if ((url = this._getShortURLFrom(query)))
        return url;
    }
    return "";
  },

  getCanonicalURL: function () {
    let links = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:url']"),
        i, content;

    for (i = 0; i < links.length; i++) {
      if ((content = this._validURL(links[i].getAttribute("content")))) {
        return content;
      }
    }

    links = this.gBrowser.contentDocument.querySelectorAll("link[rel='canonical']");

    for (i = 0; i < links.length; i++) {
      if ((content = this._validURL(links[i].getAttribute("href")))) {
        return content;
      }
    }

    // Finally try some hacks for certain sites
    return this.getCanonicalURLHacks();
  },

  // This will likely be a collection of hacks for certain sites we want to
  // work but currently don't provide the right kind of meta data
  getCanonicalURLHacks: function () {
    // Google Maps Hack :( obviously this regex isn't robust
    if (/^maps\.google\.[a-zA-Z]{2,5}/.test(this.gBrowser.currentURI.host)) {
      return this._validURL(this.gBrowser.contentDocument.getElementById("link").getAttribute("href"));
    }

    return '';
  },

  getThumbnailData: function () {
    let canvas = this.gBrowser.contentDocument.createElement("canvas"); // where?
    canvas.setAttribute('width', '90');
    canvas.setAttribute('height', '70');
    let tab = this.gBrowser.selectedTab;
    let win = this.gBrowser.getBrowserForTab(tab).contentWindow;
    let aspectRatio = canvas.width / canvas.height;
    let w = win.innerWidth + win.scrollMaxX;
    let h = Math.max(win.innerHeight, w / aspectRatio);

    if (w > 10000) {
      w = 10000;
    }
    if (h > 10000) {
      h = 10000;
    }

    let canvasW = canvas.width;
    let canvasH = canvas.height;
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();

    let scale = canvasH / h;
    ctx.scale(scale, scale);
    ctx.drawWindow(win, 0, 0, w, h, "rgb(255,255,255)");
    ctx.restore();
    let img = canvas.toDataURL("image/png", "");
    return img;
  },

  _validURL: function(url) {
    // hacky validation of a url to make sure it at least appears valid
    return validateURL(this.gBrowser.currentURI.resolve(url));
  },
  
  previews: function () {
    // Look for FB og:image and then rel="image_src" to use if available
    // for og:image see: http://developers.facebook.com/docs/share
    // for image_src see: http://about.digg.com/thumbnails
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:image']"),
        links = this.gBrowser.contentDocument.querySelectorAll("link[rel='image_src']"),
        previews = [], i, content;

    for (i = 0; i < metas.length; i++) {
      content = this._validURL(metas[i].getAttribute("content"));
      if (content) {
        previews.push({
          http_url : content,
          base64 : ""
        });
      }
    }

    for (i = 0; i < links.length; i++) {
      content = this._validURL(links[i].getAttribute("href"));
      if (content) {
        previews.push({
          http_url : content,
          base64 : ""
        });
      }
    }

    // Push in the page thumbnail last in case there aren't others
    previews.push(
      {
        http_url : "",
        base64 : this.getThumbnailData()
      }
    );
    return previews;
  }
};

exports.SharePanel = SharePanel;
exports.SharePrefsPane = SharePrefsPane;
exports.validateURL = validateURL;
exports.PageOptionsBuilder = PageOptionsBuilder;
