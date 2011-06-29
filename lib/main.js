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

const self = require("self");
const unload = require("unload");

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
let {Services, XPCOMUtils} = tmp;

let {installOverlay} = require("overlay");
let {getString} = require("addonutils");
let jetpackOptions;

let unloaders = [];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SHARE_PANEL_ID = "cmd_toggleSharePanel";
const SHARE_BUTTON_ID = "share-button";

function installFFShareIntoWindow(win) {
    win.ffshare = new FFShare(win);
    let unloaders = [];
    /* By the time the unloader is called, win.ffshare is already undefined
    unloaders.push(function () {
        win.ffshare.unload();
        win.ffshare = null;
    });
    */
    return unloaders;
}

function error(msg) {
  console.error(msg);
  dump(msg+"\n");
  Cu.reportError('.' + msg); // avoid clearing on empty log
}

function createMediator() {
  let win = Services.wm.getMostRecentWindow("navigator:browser");
  let ffshare = new FFShare(win);
  let {SharePanel, PageOptionsBuilder} = require("panel");
  // create our 'helper' object - we will pass it the iframe once we
  // get the onshow callback.
  let panelHelper = new SharePanel(win, ffshare);
  return {
    url: Services.prefs.getCharPref("services.share.shareURL"),
    anchor: win.document.getElementById('share-button'),
    notificationErrorText: "There was a problem sharing this page.",
    updateargs: function(contentargs) {
      let optBuilder = new PageOptionsBuilder(win.gBrowser);
      return optBuilder.getOptions(contentargs);
    },
    onshow: function(iframe) {
      panelHelper.browser = iframe;
      panelHelper.panelShown();
    },
    onhide: function(iframe) {
      panelHelper.panelHidden();
      panelHelper.browser = null;
    },
    // a generic callback used whenever the content (ie, share panel) makes
    // any kind of notification back to OWA.
    onresult: function(req) {
      return panelHelper.onMediatorCallback(req);
    }
  };
}


function FFShare(win) {
  this.window = win;

  // Hang on, the window may not be fully loaded yet
  let self = this;
  function checkWindow() {
    if (win.document.readyState !== "complete") {
      win.setTimeout(checkWindow, 1000);
    } else {
      self.init();
    }
  }
  checkWindow();
}

FFShare.prototype = {
  togglePanel: function(event) {
    try {
      this._togglePanel(event);
    } catch (ex) {
      console.error("failed to invoke service", ex, ex.stack);
    }
  },

  _togglePanel: function(event) {
    // now a misnomer - just opens the panel.
    if (event) {
      event.stopPropagation();
      if ((event.type == "click" && event.button != 0) ||
          (event.type == "keypress" && event.keyCode != KeyEvent.DOM_VK_F1))
        return; // Left click or F1 only
    }
/*
    XXX - markh tried rolling this into the OWA services code just before the
    call to panel.openPopup, but it doesn't seem to have any effect (ie,
    clicking on the F1 button when the panel is visible causes it to vanish
    and immediately re-open).

    let popup = this.sharePanel.panel;
    // Tell the popup to consume dismiss clicks, to avoid bug 395314
    popup.popupBoxObject
         .setConsumeRollupEvent(Ci.nsIPopupBoxObject.ROLLUP_CONSUME);
*/
  // invoke the service.
  let options = {};
  let contentWindow = this.window.gBrowser.contentWindow;
  this.services.invoke(contentWindow, "link.send", options,
          function() {
            console.log("send was success");
          },
          function(err) {
            console.error("Failed to invoke share service", err);
          });
  },

  canShareURI: function (aURI) {
    var command = this.window.document.getElementById(SHARE_PANEL_ID);
    let button = this.window.document.getElementById(SHARE_BUTTON_ID);
    if (this.isValidURI(aURI)) {
      command.removeAttribute("disabled");
      button.hidden = false;
    } else {
      command.setAttribute("disabled", "true");
      button.hidden = true;
    }
  },

  isValidURI: function (aURI) {
    // Only open the share frame for http/https/ftp urls, file urls for testing.
    return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') ||
            aURI.schemeIs('file') || aURI.schemeIs('ftp')));
  },

  init: function() {
    this.window.gBrowser.addProgressListener(this);

    // Initialize share button for current tab (it might not be shareable).
    this.canShareURI(this.window.gBrowser.currentURI);

    let self = this;
    this.onContextMenuItemShowing = function(e) {
      self._onContextMenuItemShowing(e);
    };
    this.window.document.getElementById("contentAreaContextMenu")
        .addEventListener("popupshowing", this.onContextMenuItemShowing, false);

    // tell OWA that we want to handle the link.send service
    // (this need be done only once, but multiple times doesn't hurt - yet!)
    let {serviceInvocationHandler} = require("services");
    this.services = new serviceInvocationHandler(this.window);
    this.services.registerMediator("link.send", function() {
        return createMediator();
    });
  },

  _onContextMenuItemShowing: function (e) {
    try {
      let contextMenu = this.window.gContextMenu;
      let document = this.window.document;
      let hide = (contextMenu.onTextInput || contextMenu.onLink ||
                  contextMenu.onImage || contextMenu.isContentSelected ||
                  contextMenu.onCanvas || contextMenu.onVideo ||
                  contextMenu.onAudio);
      let hideSelected = (contextMenu.onTextInput || contextMenu.onLink ||
                          !contextMenu.isContentSelected ||
                          contextMenu.onImage || contextMenu.onCanvas ||
                          contextMenu.onVideo || contextMenu.onAudio);

      document.getElementById("context-ffshare").hidden = hide;
      document.getElementById("context-ffshare-separator").hidden = hide;

      document.getElementById("context-selected-ffshare").hidden = hideSelected;
      document.getElementById("context-selected-ffshare-separator").hidden = hideSelected;
    } catch (e) {}
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference]),

  onLocationChange: function (aWebProgress, aRequest, aLocation) {
    this.canShareURI(aLocation);
  },

  onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
  onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onSecurityChange: function (aWebProgress, aRequest, aState) {},
  onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
};

function loadIntoWindow(win) {
  try {
    console.log("install addon\n");
    unloaders = installOverlay(win);
    unloaders.push.apply(unloaders, installFFShareIntoWindow(win));
  } catch(e) {
    console.log("load error "+e+"\n"+e.stack+"\n");
  }
}

function overlayPrefs(win) {
  try {
    console.log("overlayPrefs\n");
    unloaders = installPrefsOverlay(win);
    //unloaders.push.apply(unloaders, installFFShareIntoWindow(win));
  } catch(e) {
    console.log("load error "+e+"\n"+e.stack+"\n");
  }
}

function eachWindow(callback) {
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    if (win.document.readyState === "complete") {
      callback(win);
    } else {
      runOnEvent("load", win, callback);
    }
  }
}

function runOnEvent(evt, window, callback) {
  window.addEventListener(evt, function onLoad() {
    window.removeEventListener(evt, onLoad, false);
    callback(window);
  }, false);
}

function windowWatcher(subject, topic) {
  if (topic !== "domwindowopened") {
    return;
  }
  let win = subject.QueryInterface(Ci.nsIDOMWindow);
  // We don't know the type of the window at this point yet, only when
  // the load event has been fired.
  runOnEvent("load", win, function (win) {
    let doc = win.document.documentElement;
    if (doc.getAttribute("windowtype") == "navigator:browser") {
      loadIntoWindow(win);
    }
    if (doc.getAttribute("windowtype") == "Browser:Preferences") {
      overlayPrefs(win);
    }
  });
}

exports.main = function(options, callbacks) {
  unload.when(shutdown);
  jetpackOptions = options;
  // just the 'require' of this module boostraps the world.
  let owa = require("openwebapps/main");

  /* Setup l10n, getString is loaded from addonutils */
  getString.init();

  eachWindow(loadIntoWindow);

  Services.ww.registerNotification(windowWatcher);
  unloaders.push(function() Services.ww.unregisterNotification(windowWatcher));
};

function shutdown(reason) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) unload && unload());
}
