/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

/*jslint plusplus: false, indent: 2, nomen: false */
/*global require: false, define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false, parent: false,
  console: false */
"use strict";

/*
 * mediator
 *
 * implements all api's that need to call INTO chrome from the panel content
 * via postmessage or port calls
 */

define(function () {
  var emit = window.navigator.mozApps.mediation.emit;
  var m = {
    /**
     * checkBase64Preview
     * the current result will be sent via a post message to base64Preview
     */
    checkBase64Preview: function(options) {
    //Ask extension to generate base64 data if none available.
    //Useful for sending previews in email.
    var preview = options.previews && options.previews[0];
    if (preview && preview.http_url && !preview.base64) {
      emit('fxshare.generateBase64Preview', preview.http_url);
    }
    },

    /**
     * hide
     *
     * hide the mediator panel
     */
    hide: function() {
      emit('hide');
    },

    /**
     * XXX prefs panel has been removed
     */
    openPrefs: function() {
      emit('openPrefs');
    },

    sizeToContent: function() {
      // use our wrapper to get the right size, using the body element
      // for sizing is not working since body.style.overflow=hidden.
      var wrapper = document.getElementById("wrapper");
      var args = {
        width: wrapper.scrollWidth +4,
        height: wrapper.scrollHeight +4
      };
      emit('owa.mediation.sizeToContent', args);
    },

    updateChromeStatus: function(status) {
      emit('fxshare.updateStatus', status);
    },

    // This is the 'success' notification defined by OWA.
    result: function(resultInfo) {
      emit('owa.success', resultInfo);
    },

    error: function(appid) {
      emit('owa.failure', {app:appid, result: "error"});
    }
  }
  return m;

});
