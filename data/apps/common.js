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

/*jslint plusplus: false, indent: 2 */
/*global define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";

define([ "require"],
function (require) {

  var common = function() {
    
  };
  common.prototype = {

    getLogin: function(domain, activity, credentials) {
      var key = "ff-share-" + domain;
      var strval = window.localStorage.getItem(key);
      var result = {};
      try {
        if (strval) {
          var raw = JSON.parse(strval);
          // Turn the nested object into a flat one with profile and info all in one,
          // as required by the OWA APIs.
          var acct = raw.profile.accounts[0];
          var retUser = {};
          for (var attr in raw.profile) {
            if (raw.profile.hasOwnProperty(attr)) retUser[attr] = raw.profile[attr];
          }
          for (var attr in acct) {
            if (acct.hasOwnProperty(attr)) retUser[attr] = acct[attr];
          }
          result.user = retUser;
        }
      } catch(e) {
        dump("common.getLogin error "+e+"\n");
        // some error, logout
        activity.postException({code: "get.login", message: e.toString(), data: { key: key, value: strval}});
        window.localStorage.removeItem(key);
        return;
      }
      activity.postResult(result);
    },

    logout: function(domain, activity, credentials) {
      var key = "ff-share-" + domain;
      window.localStorage.removeItem(key);
      activity.postResult({status: "ok"});
    }
  }

  return new common();
});
