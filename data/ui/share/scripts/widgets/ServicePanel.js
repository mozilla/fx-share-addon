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
/*global define: false, document: false */
"use strict";

define([ 'blade/object', 'blade/Widget', 'jquery', 'text!./ServicePanel.html',
         'storage', 'module', 'dispatch', 'widgets/AccountPanel',
         'require', 'blade/fn', './jigFuncs'],
function (object,         Widget,         $,        template,
          storage, module,   dispatch, AccountPanel,
          require,   fn,         jigFuncs) {

  var className = module.id.replace(/\//g, '-');

  //Set up event handlers.
  $(function () {
    // a "remove" button on this panel would need to mean "uninstall app".
    $('body')
      .delegate('.remove', 'click', function (evt) {
        Widget.closest(module.id, evt, 'onRemove');
      })
      .delegate('.login', 'click', function (evt) {
        Widget.closest(module.id, evt, 'onLogin');
      });
  });

  /**
   * Define the widget.
   * This widget assumes its member variables include the following objects:
   *
   * owaservice: the owa service record (ie, with 'channel', 'characteristics',
   *             'login' etc elements).
   */
  return object(Widget, null, function (parent) {
    return {
      moduleId: module.id,
      className: className,

      template: template,

      onCreate: function () {
        //Listen for changes to the service state and update the UI.
        this.serviceChangedSub = dispatch.sub('serviceChanged', fn.bind(this, function (which) {
          if (which === this.owaservice.app.app) {
            this.serviceChanged();
          }
        }));
      },

      destroy: function () {
        dispatch.unsub(this.serviceChangedSub);
        if (this.accountPanel) {
          this.accountPanel.destroy();
        }
        parent(this, 'destroy');
      },

      onRender: function () {
        this.serviceChanged();
      },

      //The service state has changed, update the relevant HTML bits.
      serviceChanged: function () {
        // If either 'characteristics' or 'login' are null, we are waiting
        // for those methods to return.
        var showPanel = false;
        if (!this.owaservice.characteristics || !this.owaservice.login) {
          // waiting for the app to load and respond.
          $(".accountLoading", this.node).show();
          $(".accountLogin", this.node).hide();
        } else if (!this.owaservice.login.user) {
          // getLogin call has returned but no user logged in.
          $(".accountLoading", this.node).hide();
          $(".accountLogin", this.node).show();
        } else {
          // logged in so can show the account panel.
          $(".accountLoading", this.node).hide();
          $(".accountLogin", this.node).hide();
          showPanel = true;
        }
        var thisPanelDiv = $(".accountPanel", this.node);
        if (showPanel) {
          // XXX - surely this can be simplified...
          if (!this.accountPanel) {
            // Get the contructor function for the panel.
            // XXX - overlay??
            var PanelCtor = require('widgets/AccountPanel');
            this.accountPanel = new PanelCtor({
                options: this.options,
                owaservice: this.owaservice,
                savedState: this.savedState
                }, thisPanelDiv[0]);
            if (this.accountPanel.asyncCreate) {
              this.accountPanel.asyncCreate.then(function(){
                thisPanelDiv.show();
              });
            } else {
              thisPanelDiv.show();
            }
          } else {
            thisPanelDiv.show();
          }
        } else {
          thisPanelDiv.hide();
        }
      },

      onRemove: function (evt) {
        dump("TODO: This needs to remove the entire account, not just logout");
      },
      onLogin: function (evt) {
        // hrmph - tried to dispatch.pub back to the main panel but then
        // the popup was blocked.
        var store = storage(),
            url = this.owaservice.app.app + this.owaservice.login.login.dialog,
            win = window.open(url,
                  "ffshareOAuth",
                  "dialog=yes, modal=yes, width=900, height=500, scrollbars=yes");
        store.set('lastSelection', this.owaservice.app.app);
        win.focus();
      },

      getRestoreState: function () {
        return this.accountPanel ? this.accountPanel.getRestoreState() : null;
      }

    };
  });
});
