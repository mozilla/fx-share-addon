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
         'mediator',     'module', 'dispatch', 'widgets/AccountPanel',
         'require', 'blade/fn', './jigFuncs'],
function (object,         Widget,         $,        template,
          mediator,       module,   dispatch,   AccountPanel,
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
   * owaservice: the owa service record (ie, with 'channel', 'parameters',
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
          if (which === this.owaservice.app.origin) {
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
        this.updateServicePanel();
      },

      //The service state has changed, update the relevant HTML bits.
      serviceChanged: function () {
        var self = this;
        this.owaservice.call("getLogin", {},
          function(result) {
            self.owaservice.user = result.user;
            self.updateServicePanel();
          },
          function(errob) {
            dump("failed to get owa login info: " + errob.code + ": " + errob.message + "\n");
            self.updateServicePanel();
          }
        );
      },

      updateServicePanel: function () {
        if (this.owaservice.parameters) {
          var root = $(this.node);
          root.find('[name="name"]').text(this.owaservice.parameters.name);
          root.find('[name="domain"]').text(this.owaservice.parameters.domain);
          root.find('[name="displayName"]').text(this.owaservice.parameters.displayName);

        }
        // If either 'parameters' or 'login' are null, we are waiting
        // for those methods to return.
        var showPanel = false;
        if (this.owaservice.error) {
          $(".accountLoading", this.node).hide();
          $(".accountLogin", this.node).hide();
          $(".accountError", this.node).show();
          $(this.node).find('[name="error"]').text(this.owaservice.error);
        } else if (!this.owaservice.parameters) {
          // waiting for the app to load and respond.
          $(".accountLoading", this.node).show();
          $(".accountLogin", this.node).hide();
          $(".accountError", this.node).hide();
        } else if (!this.owaservice.user) {
          // getLogin call has returned but no user logged in.
          $(".accountLoading", this.node).hide();
          $(".accountLogin", this.node).show();
          $(".accountError", this.node).hide();
        } else {
          // logged in so can show the account panel.
          $(".accountLoading", this.node).hide();
          $(".accountLogin", this.node).hide();
          $(".accountError", this.node).hide();
          showPanel = true;
        }
        var thisPanelDiv = $(".accountPanel", this.node);
        if (showPanel) {
          if (!this.accountPanel) {
            // Get the contructor function for the panel.
            // XXX - overlay??
            var PanelCtor = require('widgets/AccountPanel');
            this.accountPanel = new PanelCtor({
                activity: this.activity,
                owaservice: this.owaservice
                }, thisPanelDiv[0]);
          }
          thisPanelDiv.show();
        } else {
          thisPanelDiv.hide();
        }
        mediator.sizeToContent();
        dispatch.pub("servicePanelChanged", this.owaservice.app.origin);
      },

      /** The main UI wants us to focus a relevant child...
       *
       */
      focusAChild: function () {
        if ($(".accountPanel", this.node).is(":visible")) {
          // account panel is showing, so ask it to select a good field.
          this.accountPanel.focusAChild();
        } else if ($(".accountLogin", this.node).is(":visible")) {
          // find and focus the login button...
          $(".login", ".accountLogin", this.node).focus();
        } // else the "loading" panel is showing - nothing to focus there...
      },

      onRemove: function (evt) {
      },
      onLogin: function (evt) {
        // hrmph - tried to dispatch.pub back to the main panel but then
        // the popup was blocked.
        try {
          var app = this.owaservice.app;
          navigator.mozActivities.mediation.startLogin(app.origin);
        } catch (e) {
          dump("ex "+e.toString()+"\n");
        }
        localStorage["last-app-selected"] = app.origin;
      },

      getRestoreState: function () {
        return this.accountPanel ? this.accountPanel.getRestoreState() : null;
      }

    };
  });
});
