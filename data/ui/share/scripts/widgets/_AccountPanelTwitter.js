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

/*jslint indent: 2 */
/*global define: false */
"use strict";

define([ 'blade/object', './AccountPanel', 'jquery'],
function (object,         AccountPanel,     $) {

  var shortLinkPlaceholder = 'http://bit.ly/XXXXXX';

  /**
   * Just overrides a text string.
   */
  return object(AccountPanel, null, function (parent) {
    return {

      onRender: function () {
        parent(this, 'onRender', arguments);
        this.setDefaultTwitterMessage(this.options);
      },

      optionsChanged: function (options) {
        // Get the options out of the super's optionsChanged, since that
        // method may have restored some saved state.
        var opts = parent(this, 'optionsChanged', arguments);

        this.setDefaultTwitterMessage(opts);
      },

      setDefaultTwitterMessage: function (options) {
        var message;

        // Only set the default message if there is not already a message.
        // There could be a restored-data message.
        if (!options.message) {
          message = options.title + ' - ' + shortLinkPlaceholder + ' ';
          $(this.node).find('[name="message"]').val(message);
        }

      }
    };
  });
});
