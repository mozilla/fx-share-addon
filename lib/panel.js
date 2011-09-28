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

const {Cc, Ci, Cm, Cu, components} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
let {Services, PlacesUtils, XPCOMUtils} = tmp;

let {serviceInvocationHandler, MediatorPanel} = require("openwebapps/services");
let {URLParse} = require("openwebapps/urlmatch");

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
const STORE_CLEARED_TOPIC = "services:share:store:cleared";
const PREFPANE_LOADED_TOPIC = "services:share:prefpane:loaded";
const WINDOWS_RESTORED_TOPIC = "sessionstore-windows-restored";
const IDLE_TOPIC = "idle";

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
  if (!/^\w+?:\/\/\w+(\.\w+)*(:\d+)?(\/.*)?$/.test(url)) return null;
  return url;
}

/**
 * Helper for the share panel
 *
 * A state object is attached to each browser tab when the share panel
 * is opened for that tab.  The state object is removed from the current
 * tab when the panel is closed.
 * XXX - this state stuff needs re-thinking in an OWA world.
 */

function SharePanel(window, contentWindowRef, methodName, args, successCB, errorCB) {
  MediatorPanel.call(this, window, contentWindowRef, methodName, args, successCB, errorCB);
  
  this.contentScriptFile.push(require("self").data.url("servicesapi.js"));
  let url = require("self").data.url("");
  this.panelOrigin = URLParse(url).normalize().originOnly().toString();
}
SharePanel.prototype = {
  __proto__: MediatorPanel.prototype,

  registerAPIs: function(worker, frame) {
    let mediator = this;
    // setup the owa.service api handlers for sendEmail
    worker.port.on("owa.service.sendEmail.call", function(args) {
  
      const {SslSmtpClient} = require("email/smtp");

      let svc = args.svc;
      let message = args.data;

      //dump("got sendEmail svc "+JSON.stringify(svc)+"\n");
      //dump("got sendEmail message "+JSON.stringify(message)+"\n");
      let finished = false;
      let on_disconnect = function() {
        if (!finished) {
          worker.port.emit(args.result, {"error": "premature disconnection"});
        }
      }

      var client = new SslSmtpClient(on_disconnect);
      let on_connected = function() {
        client.authenticate(svc,
          function() {
            // now we can send the message.
            client.sendMessage(message.to,
                               message.subject,
                               message.html, // html
                               message.text, // txt
                               function (msg) {
                                finished = true;
                                worker.port.emit(args.result, {message: msg});
                               },
                               function (errmsg) {
                                worker.port.emit(args.result, {error: errmsg});
                               }
                               );
          },
          function (errmsg) {
            worker.port.emit(args.result, {error: errmsg});
          }
        );
      }
      client.connect(svc, on_connected, function(errmsg) {
        // assuming only error messages ere
        worker.port.emit(args.result, {error: errmsg});
      }, true);
    
    });

    MediatorPanel.prototype.registerAPIs.apply(this, arguments);
  },
  
  get width() 434,
  get height() 120,

  /* MediatorPanel interface to our panel object */
  get anchor() {
    return this.window.document.getElementById('share-button')
  },

  updateargs: function(contentargs) {
    let optBuilder = new PageOptionsBuilder(this.window.gBrowser);
    return optBuilder.getOptions(contentargs);
  },

  _panelShown: function() {
    this.anchor.setAttribute("checked", true);
  },

  _panelHidden: function() {
    this.anchor.removeAttribute("checked");
  },

  attachHandlers: function() {
    MediatorPanel.prototype.attachHandlers.apply(this);
    this.panel.port.on("fxshare.updateStatus", this.onUpdateStatus.bind(this));
    this.panel.port.on("fxshare.generateBase64Preview", this.onGenerateBase64Preview.bind(this));
  },
  /* END OWA INTERFACE */

  /**
   * PostMessage handlers
   */


  /**
   * Sent when the share succeeds.
   *
   * Properties on the data object:
   * @param title
   *        The title of the page that was shared.  Used for bookmarking.
   * @param link
   *        The URL of the page that was shared. Used for bookmarking.
   * @param appName
   *         The "name" of the service. Used for bookmarking.
   *
   * The domain, username and userid taken together form a unique identifier
   * for which account on which service was used to do the share.
   */
  onOWASuccess: function(data) {
    let url = data.link;
    let title = data.title;
    this.onUpdateStatus({
      statusCode: SHARE_DONE
    });

    // XXX we should work out a better bookmarking system
    // https:// github.com/mozilla/f1/issues/66
    if (Services.prefs.getBoolPref("services.share.bookmarking")) {
      let nsiuri = Services.io.newURI(url, null, null);
      if (!bookmarksService.isBookmarked(nsiuri)) {
        bookmarksService.insertBookmark(
        bookmarksService.unfiledBookmarksFolder, nsiuri, bookmarksService.DEFAULT_INDEX, title.trim());
      }
      // We tag the URL with the name of the service used to share it.
      if (data.appName) {
        PlacesUtils.tagging.tagURI(nsiuri, [data.appName]);
      }
    }
    // and we want this message to also be processed by OWA itself, which will
    // close the panel.
    MediatorPanel.prototype.onOWASuccess.apply(this, arguments);
  },

  /**
   * Updates the state of the toolbar button during a share activity or
   * afterward when a share error is received.
   *
   * @param {Integer} statusRecord - an object with a statusCode attribute
   * that has meaning in the SHARE_STATUS array
   */
  onUpdateStatus: function(statusRecord) {
    let statusCode = statusRecord.statusCode, success = (statusCode === SHARE_DONE), button = this.anchor;

    if (button) {
      if (success) {
        button.setAttribute("status", SHARE_STATUS[SHARE_FINISHED]);
        this.window.setTimeout(function() {
          button.setAttribute("status", SHARE_STATUS[statusCode]);
        }, 2900);
      } else {
        button.setAttribute("status", SHARE_STATUS[statusCode]);
      }
    }
  },

  /**
   * Fetch a preview image and convert it to base64 data.
   *
   * @param imgUrl
   *        The image URL to use in generating the preview.
   */
  onGenerateBase64Preview: function(imgUrl) {
    let self = this;
    let img = new this.window.Image();
    img.onload = function() {

      let canvas = self.window.document.createElementNS(NS_XUL, "canvas"), w = img.width, h = img.height, dataUrl, canvasW, canvasH, ctx, scale;

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
   * End of OWA handlers. Helpers below.
   */


  escapeHtml: function(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  getBrowserTabForUrl: function(url) {
    if (!url) return null;
    let gBrowser = this.window.gBrowser;
    if (gBrowser.getBrowserForTab(gBrowser.selectedTab).currentURI.spec == url) return gBrowser.selectedTab;
    var numTabs = gBrowser.browsers.length;
    for (var index = 0; index < numTabs; index++) {
      var currentBrowser = gBrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec) {
        return gBrowser.tabs[index];
      }
    }
    return null;
  }
};

function PageOptionsBuilder(browser) {
  this.gBrowser = browser;
};

PageOptionsBuilder.prototype = {
  getOptions: function(options) {
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
      siteName: this.getSiteName(),
      message: this.getSelection()
    });
    return options;
  },

  getSelection: function() {
    let selection = require("selection");
    let result;
    if (!selection.isContiguous) {
      let bits = [sub.text for (sub in selection)];
      result = bits.join(" ");
    } else {
      result = selection.text;
    }
    if (result) {
      // replace all multiple whitespace chars with a single space and trim
      result = result.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, '');
    }
    return result;
  },

  getPageTitle: function() {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:title']"), i, title, content;
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

  getPageDescription: function() {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:description']"), i, content;
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

  getSiteName: function() {
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
  getPageMedium: function() {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:type']"), i, content;
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

  getSourceURL: function() {
    // Ideally each page would report the medium correctly, but some
    // do not, like vimeo, so always just look for a video source.
    let source = this.getVideoSourceURL();
    return source || "";
  },

  getVideoSourceURL: function() {
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:video']");
    for (let i = 0; i < metas.length; i++) {
      let content = metas[i].getAttribute("content");
      if (content && (content = this._validURL(unescapeService.unescape(content)))) {
        return content;
      }
    }
    return this.getVideoSourceURLHacks();
  },

  getVideoSourceURLHacks: function() {
    let canonical = this.getCanonicalURL(), host = this.gBrowser.currentURI.host, params, embeds, i, src, flashvars, value, url;

    // YouTube hack to get the right source without too many parameters
    if (host.indexOf("youtube.com") >= 0 && canonical.match(/v=([A-Za-z0-9._%\-]*)[&\w;=\+_\-]*/)) {
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

  getShortURL: function() {
    let selectors = ["link[id='shorturl']", "link[rel='shorturl']", "link[rel='shortlink']"];
    let url;
    for each(let query in selectors) {
      if ((url = this._getShortURLFrom(query))) return url;
    }
    return "";
  },

  getCanonicalURL: function() {
    let links = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:url']"), i, content;

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
  getCanonicalURLHacks: function() {
    // Google Maps Hack :( obviously this regex isn't robust
    if (/^maps\.google\.[a-zA-Z]{2,5}/.test(this.gBrowser.currentURI.host)) {
      return this._validURL(this.gBrowser.contentDocument.getElementById("link").getAttribute("href"));
    }

    return '';
  },

  _validURL: function(url) {
    // hacky validation of a url to make sure it at least appears valid
    return validateURL(this.gBrowser.currentURI.resolve(url));
  },

  previews: function() {
    // Look for FB og:image and then rel="image_src" to use if available
    // for og:image see: http://developers.facebook.com/docs/share
    // for image_src see: http://about.digg.com/thumbnails
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:image']"), links = this.gBrowser.contentDocument.querySelectorAll("link[rel='image_src']"), imgs = this.gBrowser.contentDocument.querySelectorAll("img"), previews = [], i, content;

    for (i = 0; i < metas.length; i++) {
      content = this._validURL(metas[i].getAttribute("content"));
      if (content) {
        previews.push({
          http_url: content,
          base64: ""
        });
      }
    }

    for (i = 0; i < links.length; i++) {
      content = this._validURL(links[i].getAttribute("href"));
      if (content) {
        previews.push({
          http_url: content,
          base64: ""
        });
      }
    }

    // get img src urls
    for (i = 0; i < imgs.length; i++) {
      content = this._validURL(imgs[i].getAttribute("src"));
      if (content) {
        previews.push({
          http_url: content,
          base64: ""
        });
      }
    }
    return previews;
  }
};

exports.SharePanel = SharePanel;
exports.validateURL = validateURL;
exports.PageOptionsBuilder = PageOptionsBuilder;
