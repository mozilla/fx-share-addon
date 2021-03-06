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
 *   Mark Hammond <mhammond@skippinet.com.au>
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

let {OAuthConsumer} = require("oauthorizer/oauthconsumer");
let {MediatorPanel} = require("activities/services");

const SHARE_STATUS = ["", "start", "", "finished"];
const SHARE_DONE = 0;
const SHARE_START = 1;
const SHARE_ERROR = 2;
const SHARE_FINISHED = 3;

// This is very liberal but that's probably OK - it would be very bad if we
// rejected a valid address, while we can assume the server itself will still
// reject any invalid ones that slip through.
const reValidEmail = /^\S+@\S+$/;

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

function validateURL(url) {
  if (!/^(https?|ftps?):\/\/\w+(\.\w+)*(:\d+)?(\/.*)?$/.test(url)) return null;
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

function SharePanel(window, activity) {
  MediatorPanel.call(this, window, activity);
  
  this.contentScriptFile.push(require("self").data.url("servicesapi.js"));
  let url = require("self").data.url("");
}
SharePanel.prototype = {
  __proto__: MediatorPanel.prototype,

  registerAPIs: function(worker, frame) {
    let mediator = this;
    // setup the owa.service api handlers for various email helpers:
    worker.port.on("owa.service.oauth.call", function(args) {
      OAuthConsumer.call(args.svc, args.data, function(req) {
        //dump("oauth call response "+req.status+" "+req.statusText+" "+req.responseText+"\n");
        let response = JSON.parse(req.responseText);
        worker.port.emit(args.result, response);
      });
    });

    // sendEmail:
    worker.port.on("owa.service.sendEmail.call", function(args) {
  
      const {SslSmtpClient} = require("email/smtp");
      const {MimeMultipart, MimeText, MimeBinary} = require("email/mime");

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
            let mail = new MimeMultipart('alternative');
            mail.addHeader('Subject', message.subject);
            mail.addHeader("To", message.to);
            let textpart = new MimeText(message.text, 'plain');
            let htmlpart;
            if (message.thumbnail) {
              // we need a more complex structure
              htmlpart = new MimeMultipart('related');
              let htmltextpart = new MimeText(message.html, 'html');
              let imagepart = new MimeBinary("image", "png", message.thumbnail, "base64")
              imagepart.addHeader('Content-Id', '<thumbnail>');
              imagepart.addHeader('Content-Disposition', 'inline; filename=thumbnail.png');
              htmlpart.attach(htmltextpart);
              htmlpart.attach(imagepart);
            } else {
              htmlpart = new MimeText(message.html, 'html')
            }
            mail.attach(textpart);
            mail.attach(htmlpart);
            // now we can send the message.
            client.sendMessage(message.to, mail,
                               function (msg) {
                                finished = true;
                                client.disconnect();
                                worker.port.emit(args.result, {message: msg});
                               },
                               function (errmsg) {
                                finished = true;
                                client.disconnect();
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

    // resolveEmailAddresses:
    worker.port.on("owa.service.resolveEmailAddresses.call", function(args) {
      // This function just parses then reformats the passed in email
      // address/name strings, just to check they are syntactically) valid.
      const {parseaddrlist, formataddr} = require("email/addressutils");
      let addrlist = parseaddrlist(args.data);
      let results = [];
      for each (let [name, address] in addrlist) {
        if (address) {
          // some invalid addresses will slip by - check the address portion
          // matches a very liberal regex.
          if (!reValidEmail.test(address)) {
            results.push({error: "invalid email address", value: address});
          } else {
            results.push({result: formataddr([name, address])});
          }
        } else {
          // hrm - how to determine what string failed?
          results.push({error: "invalid email address"});
        }
      }
      worker.port.emit(args.result, {result: results});
    });

    worker.port.on("owa.service.formatEmailAddresses.call", function(args) {
      // This function just parses then reformats the passed in email
      // address/name strings, just to check they are syntactically) valid.
      const {formataddr} = require("email/addressutils");
      let results = [];
      for each (let [name, address] in args.data) {
        results.push(formataddr([name, address]));
      }
      worker.port.emit(args.result, {result: results});
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

  onPanelShown: function() {
    this.anchor.setAttribute("checked", true);
    MediatorPanel.prototype.onPanelShown.apply(this);
  },

  onPanelHidden: function() {
    this.anchor.removeAttribute("checked");
    MediatorPanel.prototype.onPanelHidden.apply(this);
  },

  attachHandlers: function() {
    MediatorPanel.prototype.attachHandlers.apply(this);
    this.panel.port.on("fxshare.updateStatus", this.onUpdateStatus.bind(this));
    this.panel.port.on("fxshare.generateBase64Preview", this.onGenerateBase64Preview.bind(this));
  },
  /* END OWA INTERFACE */

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

  onOWALogin: function(params) {
    let wasShowing = this.panel.isShowing;
    let {app, auth} = params;
    if (auth.type == 'oauth') {
      try {
        let self = this;
        this.oauthAuthorize(auth, function(result) {
          let params = {app: app, credentials: result};
          self.panel.port.emit("owa.mediation.onLogin", params);
          // auth probably caused the panel to close - reopen it.
          if (wasShowing && !self.panel.isShowing) {
            self.show();
          }
        });
      } catch(e) {
        dump("onLogin fail "+e+"\n");
      }
    } else {
      MediatorPanel.prototype.onOWALogin.apply(this, arguments);
    }
  },

  _makeOauthProvider: function(config) {
    try {
      // this is very much a copy of OAuthConsumer.authorize, but we have to
      // create a provider service object ourselves.  this should move into
      // oauthorizer.
      var svc = OAuthConsumer.makeProvider("f1-" + config.name, config.displayName, config.key, config.secret, config.completionURI, config.calls, true);
      svc.version = config.version;
      svc.tokenRx = new RegExp(config.tokenRx, "gi");
      if (config.deniedRx) {
        svc.deniedRx = new RegExp(config.deniedRx, "gi");
      }
      if (config.params) svc.requestParams = config.params;
      return svc;
    } catch (e) {
      dump("_makeOauthProvider: "+e + "\n");
    }
    return null;
  },

  oauthAuthorize: function(config, callback) {
    try {
      var svc = this._makeOauthProvider(config);
      var self = this;
      var handler = OAuthConsumer.getAuthorizer(svc, callback);

      this.window.setTimeout(function() {
        handler.startAuthentication();
      }, 1);
    } catch (e) {
      dump("oauthAuthorize: "+e + "\n");
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
      let canvas = self.window.gBrowser.contentDocument.createElement("canvas"),
          w = img.width, h = img.height, dataUrl, canvasW, canvasH, ctx, scale;

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

      self.panel.port.emit("base64Preview", {'url': imgUrl, 'data': dataUrl});
    };
    img.src = imgUrl;
  }
};

function PageOptionsBuilder(browser) {
  this.gBrowser = browser;
};

PageOptionsBuilder.prototype = {
  getOptions: function(options) {
    options = options || {};
    mixin(options, {
      //      version: this.fxshare.version,
      title: this.getPageTitle(),
      subject: this.getPageTitle(),
      description: this.getPageDescription(),
      medium: this.getPageMedium(),
      source: this.getSourceURL(),
      url: this.getCanonicalURL() || this._validURL(this.gBrowser.currentURI.spec),
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
    let canonical = this.getCanonicalURL(), host = this.currentHost, params, embeds, i, src, flashvars, value, url;

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
    let host = this.currentHost;
    if (host && /^maps\.google\.[a-zA-Z]{2,5}/.test(host)) {
       return this._validURL(this.gBrowser.contentDocument.getElementById("link").getAttribute("href"));
    }

    return '';
  },

  get currentHost() {
    try {
      return this.gBrowser.currentURI.host;
    } catch (ex) {
      // probably about:blank or similar
      return '';
    }
  },

  _validURL: function(url) {
    // hacky validation of a url to make sure it at least appears valid
    return validateURL(this.gBrowser.currentURI.resolve(url));
  },

  previews: function() {
    // Look for FB og:image and then rel="image_src" to use if available
    // for og:image see: http://developers.facebook.com/docs/share
    // for image_src see: http://about.digg.com/thumbnails
    let metas = this.gBrowser.contentDocument.querySelectorAll("meta[property='og:image']"),
        links = this.gBrowser.contentDocument.querySelectorAll("link[rel='image_src']"),
        imgs = this.gBrowser.contentDocument.querySelectorAll("img"),
        previews = [], i, content;

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
