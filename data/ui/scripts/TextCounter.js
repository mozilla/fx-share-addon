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

/*jslint plusplus: false */
/*global require: false, define: false */
"use strict";

define([ 'jquery', 'blade/object', 'blade/fn'],
function ($,        object,         fn) {
    // Note this is very similar to the regex in panel.js but with a few
    // tweaks to better handle '?', '#' etc chars, allow a URL to finish on
    // whitespace and the global flag.
    var urlRegex = /\w+?:\/\/\w+(\.\w+)*(:\d+)?[^\d]+?(\s|$)/g;

    return object(null, null, {
        init: function (node, countNode, preferences) {
            this.dom = $(node);
            this.countDom = $(countNode);
            this.preferences = preferences;
            this.dom.bind('keyup', fn.bind(this, 'checkCount'));
            this.checkCount();
        },

        checkCount: function () {
            var value = this.dom[0].value,
                limit = this.preferences.constraints.textLimit,
                effectiveLen = value.length,
                remaining;

            if (this.preferences.constraints.shortURLLength && value) {
                // we must find all URLs in the message and assume they will only
                // actually take up shortURLLength chars.
                var urlsInMsg = value.match(urlRegex);
                for (var i=0; i<urlsInMsg.length; i++) {
                    // trim whitespace.
                    var thisMatch = urlsInMsg[i].replace(/^\s+|\s+$/g, '');
                    effectiveLen += this.preferences.constraints.shortURLLength - thisMatch.length;
                }
            }
            remaining = this.preferences.constraints.textLimit - effectiveLen;
            if (remaining < 0) {
                this.countDom.addClass("TextCountOver");
            } else {
                this.countDom.removeClass("TextCountOver");
            }
            this.countDom.text(remaining);
        },

        updateLimit: function (limit) {
            this.limit = limit;
            this.checkCount();
        },

        isOver: function () {
            return this.dom[0].value.length > this.limit;
        }
    });
});
