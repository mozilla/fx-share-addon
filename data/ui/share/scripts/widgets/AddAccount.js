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

/*jslint indent: 2, plusplus: false, nomen: false */
/*global define: false, document: false, alert: false */
"use strict";

define([ 'blade/object', 'blade/fn', 'blade/Widget', 'jquery',
         'storage', 'module', 'dispatch', 'Select',
         'text!./AddAccount.html'],
function (object,         fn,         Widget,         $,
          storage,   module,   dispatch,   Select,
          template) {

  var className = module.id.replace(/\//g, '-'),
      store = storage();

  //Define the widget.
  return object(Widget, null, function (parent) {
    return {
      template: template,
      className: className,

      onRender: function () {
        //Use a Select widget because web content in a panel on Linux
        //has a problem with native selects.

        // This needs to come from the F1 server.  Further, we eventually need
        // integration with OWA service discovery so the user can find additional
        // apps to install for this service.  When that happens:
        // * We probably want to magically exclude our (eg) "Facebook" app if
        //   we discover one hosted by facebook (ditto twitter etc)
        // * Need to rethink the UI in the face of this discovery being async
        //   and possibly slow to respond.  Ideally we could leverage the UI
        //   from OWA itself (once that is built ;)
        var apps = [{name: "Facebook", url: "http://linkdrop.caraveo.com:5000/1/apps/facebook.webapp"},
                    {name: "Twitter", url: "http://localhost:5000/1/apps/twitter.webapp"}];

        var options = [{name: 'Select type', value: ''}];
        apps.forEach(function(apprec, i) {
          options.push({
            name: apprec.name,
            value: i.toString()
          });
        });

        this.select = new Select({
          name: 'accountType',
          options: options
        }, $('.add', this.node)[0]);

        //Listen for changes
        this.select.dom.bind('change', fn.bind(this, function (evt) {
          var index = this.select.val();
          if (typeof(index) !== 'undefined' && index !== '') {
            var apprec = apps[index];
            // we ask the chrome to perform the installation as we don't
            // have permission.
            var messageData = {cmd:"installApp", app: apprec.url};
            sendOWAMessage(messageData);
          }
        }));
      }
    };
  });
});
