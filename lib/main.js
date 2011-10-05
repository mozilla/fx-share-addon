/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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

const { Cc, Ci, Cm, Cu, components } = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
let { Services, XPCOMUtils } = tmp;

let { installOverlay } = require("overlay");
let { getString } = require("addonutils");
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
  dump(msg + "\n");
  Cu.reportError('.' + msg); // avoid clearing on empty log
}

/**
 * FFShare
 *
 * a top level singlton controller for each top level navigator:browser window
 */

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

  get services() {
    return this.window.apps._services;
  },

  _togglePanel: function(event) {
    if (event) {
      event.stopPropagation();
      if ((event.type == "click" && event.button != 0) || (event.type == "keypress" && event.keyCode != KeyEvent.DOM_VK_F1)) return; // Left click or F1 only
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
    let activity =     {
      action: "link.send",
      type: "link.send",
      data: {}
    };
    let svc = this.services.get(activity, function() {
      console.log("send was success");
    }, function(err) {
      console.error("Failed to invoke share service", err);
    });
    if (svc.panel.isShowing) svc.panel.hide()
    else
    svc.show()
  },

  canShareURI: function(aURI) {
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

  isValidURI: function(aURI) {
    // Only open the share frame for http/https/ftp urls, file urls for testing.
    return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') || aURI.schemeIs('file') || aURI.schemeIs('ftp')));
  },

  init: function() {
    this.window.gBrowser.addProgressListener(this);

    // Initialize share button for current tab (it might not be shareable).
    this.canShareURI(this.window.gBrowser.currentURI);

    this.window.document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this._onContextMenuItemShowing.bind(this), false);

    // tell OWA that we want to handle the link.send service
    // (this need be done only once, but multiple times doesn't hurt - yet!)
    // XXX - this mediator registration is misplaced - the mediator is quite
    // distinct from the addon and can stand alone - but there isn't yet a
    // more reasonable place to do this.
    let data = require("self").data;
    this.services.registerMediator("link.send", {
      url: data.url("ui/share/index.html"),
      notificationErrorText: "There was a problem sharing this page."
    });
    // and we also act as a trusted "agent" for the service.
    let {
      SharePanel
    } = require("panel");
    this.services.registerAgent("link.send", SharePanel);
  },

  _onContextMenuItemShowing: function(e) {
    try {
      let contextMenu = this.window.gContextMenu;
      let document = this.window.document;
      let hide = (contextMenu.onTextInput || contextMenu.onLink || contextMenu.onImage || contextMenu.isContentSelected || contextMenu.onCanvas || contextMenu.onVideo || contextMenu.onAudio);
      let hideSelected = (contextMenu.onTextInput || contextMenu.onLink || !contextMenu.isContentSelected || contextMenu.onImage || contextMenu.onCanvas || contextMenu.onVideo || contextMenu.onAudio);

      document.getElementById("context-ffshare").hidden = hide;
      document.getElementById("context-ffshare-separator").hidden = hide;

      document.getElementById("context-selected-ffshare").hidden = hideSelected;
      document.getElementById("context-selected-ffshare-separator").hidden = hideSelected;
    } catch (e) {}
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),

  onLocationChange: function(aWebProgress, aRequest, aLocation) {
    this.canShareURI(aLocation);
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {},
  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onSecurityChange: function(aWebProgress, aRequest, aState) {},
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {}
};

function loadIntoWindow(win) {
  try {
    console.log("load f1 into window\n");
    unloaders = installOverlay(win);
    unloaders.push.apply(unloaders, installFFShareIntoWindow(win));
  } catch (e) {
    console.log("f1 load error " + e + "\n" + e.stack + "\n");
  }
}


/**
 * BuiltInApp
 *
 * helper for registering our default builtin apps
 */

function BuiltInApp(name, resLoc, url, origin) {
  this.name = name;
  this.url = url ? url : require("self").data.url("apps/" + resLoc + "/" + resLoc + ".webapp");
  this.origin = origin ? origin : require("self").data.url("apps/" + resLoc) + "/";

  this.onerror = this._onerror.bind(this);
  this.onsuccess = this._onsuccess.bind(this);
}
BuiltInApp.prototype = {
  url: null,
  origin: null,
  skipPostInstallDashboard: true,
  // don't want the app panel to appear.
  _onerror: function(errob) {
    // TODO: should probably consider notifying the content of the error
    // so it can do something useful.
    console.log("Failed to install " + this.url + ": " + errob.code + ": " + errob.message);
  },
  _onsuccess: function() {
    // Note the app being installed will have triggered the
    // 'openwebapp-installed' observer, which will in-turn cause a
    // 'reconfigure' event to be handled by OWA.
    console.log("successful install of", this.url);
  },
  install: function() {
    let {
      FFRepoImplService
    } = require("api");
    FFRepoImplService.install('http://localhost:8420', this, undefined); // the window is only used if a prompt is shown.
  }
};


function installBuiltins() {
  this.builtins = [
    new BuiltInApp('Twitter', 'twitter').install(),
    new BuiltInApp('Facebook', 'facebook').install(),
    new BuiltInApp('GMail', 'google').install()
    ]
}



function f1Loader() {
  Services.obs.addObserver(this, "openwebapps-mediator-load", true);
  Services.obs.addObserver(this, "openwebapps-mediator-init", true);
}
f1Loader.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    switch (topic) {
    case "openwebapps-mediator-load":
      let doc = subject.document.documentElement;
      if (doc.getAttribute("windowtype") == "navigator:browser") {
        loadIntoWindow(subject);
      }
      break;
    case "openwebapps-mediator-init":
      getString.init();
      installBuiltins();
    }
  }
}
var loader = new f1Loader();

exports.main = function(options, callbacks) {
  unload.when(shutdown);
  getString.init();
  let owa = require("openwebapps/main");
  return;
};

function shutdown(reason) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) unload && unload());
}
