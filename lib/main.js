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

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://ffshare/modules/panel.js");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SHARE_PANEL_ID = "cmd_toggleSharePanel";
const SHARE_BUTTON_ID = "share-button";

const EXPORTED_SYMBOLS = ["FFShare", "installFFShareIntoWindow"];

function installFFShareIntoWindow(win) {
    win.ffshare = new FFShare(win);
    let unloaders = [];
    unloaders.push(function () {
        win.ffshare.unload();
        win.ffshare = null;
    });
    return unloaders;
}

function error(msg) {
  dump(msg+"\n");
  Cu.reportError('.' + msg); // avoid clearing on empty log
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
    if (event) {
      event.stopPropagation();
      if ((event.type == "click" && event.button != 0) ||
          (event.type == "keypress" && event.keyCode != KeyEvent.DOM_VK_F1))
        return; // Left click or F1 only
    }

    let popup = this.sharePanel.panel;

    // Tell the popup to consume dismiss clicks, to avoid bug 395314
    popup.popupBoxObject
         .setConsumeRollupEvent(Ci.nsIPopupBoxObject.ROLLUP_CONSUME);

    if (popup.state == 'open') {
      this.sharePanel.close();
    } else {
      this.sharePanel.show();
    }
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
    this.sharePanel = new SharePanel(this.window, this);
    this.window.gBrowser.addProgressListener(this);

    // Initialize share button for current tab (it might not be shareable).
    this.canShareURI(this.window.gBrowser.currentURI);

    let self = this;
    this.onContextMenuItemShowing = function(e) {
      self._onContextMenuItemShowing(e);
    };
    this.window.document.getElementById("contentAreaContextMenu")
        .addEventListener("popupshowing", this.onContextMenuItemShowing, false);

    // Events triggered by TabView (panorama)
    this.tabViewShowListener = function() { self.onTabViewShow(); };
    this.window.addEventListener('tabviewshow', this.tabViewShowListener, false);
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

  onTabViewShow: function (event) {
    // Triggered by TabView (panorama). Always hide it if being shown.
    if (this.sharePanel.panel.state === 'open') {
      this.sharePanel.hide();
    }
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
