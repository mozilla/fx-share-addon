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

define([ 'blade/object', 'blade/Widget', 'jquery', 'text!./AccountPanel.html',
         'TextCounter', 'module', 'dispatch', 'mediator',
         'AutoComplete', 'blade/fn', './jigFuncs', 'Select',
         'jquery.textOverflow'],
function (object,         Widget,         $,        template,
          TextCounter,   module,   dispatch,   mediator,
          AutoComplete,   fn,         jigFuncs,     Select) {

  var className = module.id.replace(/\//g, '-');

  //Set up event handlers.
  $(function () {
    $('body')
      .delegate('.' + className + ' form.messageForm', 'submit', function (evt) {
        Widget.closest(module.id, evt, 'onSubmit');
      })
      .delegate('.remove', 'click', function (evt) {
        Widget.closest(module.id, evt, 'onRemove');
      })
      .delegate('.' + className + ' [name="to"]', 'blur', function (evt) {
        Widget.closest(module.id, evt, 'validateTo');
      });
  });

  /**
   * Define the widget.
   * This widget assumes its member variables include the following objects:
   *
   * options: the options for the URL/page being shared.
   * owaservice: the owa service record (ie, with 'channel', 'parameters',
   *             'login' etc elements).
   * svc: The share service parameters (from owaservice)
   */
  return object(Widget, null, function (parent) {
    return {
      moduleId: module.id,
      className: className,

      // text counter support
      counter: null,

      template: template,

      onCreate: function (onAsynCreateDone) {
        var profile = this.owaservice.user;

        this.hadFocusRequest = false;
        this.profile = profile;
        this.parameters = this.owaservice.parameters;
        this.svc = this.parameters; // just for the jig template...

        //Set up the photo property
        this.photo = profile.photos && profile.photos[0] && profile.photos[0].value;

        //Set up nicer display name
        // XXX for email services, we should show the email account, but we
        // cannot rely on userid being a 'pretty' name we can display
        this.displayName = profile.displayName || profile.username;

        //Listen for updates to base64Preview
        this.base64PreviewSub = fn.bind(this, function (dataUrl) {
          $('[name="picture_base64"]', this.node).val(jigFuncs.rawBase64(dataUrl));
        });
        mediator.on('base64Preview', this.base64PreviewSub);
      },

      destroy: function () {
        mediator.removeListener('base64Preview', this.base64PreviewSub);
        dispatch.unsub(this.sendCompleteSub);
        this.select.dom.unbind('change', this.selectChangeFunc);
        delete this.selectChangeFunc;
        this.select.destroy();
        this.select = null;
        parent(this, 'destroy');
      },

      focusAChild: function () {
        if (!this.hadFocusRequest) {
          // this is the first time we've seen a focus request, so now is
          // a good time to select all the default "message" text (ie, without
          // the URL etc if it exists) - we don't want to auto-select it each
          // time the panel get focus, just the first time - but sadly we
          // can't create it in _onRender as setSelectionRange fails unless
          // the field itself is visible (ie, it fails even if the fields
          // parent isn't visible.) See bug 650670 for why we bother at all...
          // It's quite possible that in the future more fields will need
          // this.
          var msgElt = $(this.node).find('[name="message"]');
          msgElt.get(0).setSelectionRange(0, (this.options.message || '').length);
          this.hadFocusRequest = true;
        }
        var candidateNames = ["to", "subject", "message"];
        for (var i=0; i < candidateNames.length; i++) {
          var name = candidateNames[i];
          var node = $('[name="' + name + '"]', this.node);
          if (node.length && node.is(":visible")) {
            node.focus();
            break;
          }
        }
      },

      onRender: function () {
        // Note an exception in _onRender will cause the widget creation
        // process to hang and never return - so catch and log exceptions.
        try {
          this._onRender()
        } catch (ex) {
          dump("AccountPanel onRender failed: " + ex + "\n");
          dump(ex.stack);
        }
      },

      _onRender: function () {
        var root = $(this.node),
            opts = this.options,
            formLink = jigFuncs.link(opts);

        // Hold onto nodes that are used frequently
        this.toDom = $('[name="to"]', this.node);
        this.shareButtonNode = $('button.share', this.node)[0];

        //Mix in any saved data for the new URL if it was in storage.
        if (this.savedState) {
          //Create a temp object so we do not mess with pristine options.
          opts = object.create(opts, [{
            to: this.savedState.to,
            subject: this.savedState.subject,
            message: this.savedState.message,
            shareType: this.savedState.shareType
          }]);
        }

        //Update the DOM.
        root.find('[name="picture"]').val(jigFuncs.preview(opts));
        root.find('[name="picture_base64"]').val(jigFuncs.preview_base64(opts));
        root.find('[name="link"]').val(formLink);
        // If the service has a specific field for the title, use that.
        // otherwise if it has a field for the subject and no 'subject' is
        // specified, stick the title in the subject.
        if (this.parameters.features.title) {
          root.find('[name="title"]').val(opts.title);
        } else if (this.parameters.features.subjectLabel) {
          if (opts.subject) {
            root.find('[name="subject"]').val(opts.subject);
          } else if (opts.title) {
            root.find('[name="subject"]').val(opts.title);
          }
        }
        root.find('[name="caption"]').val(opts.caption);
        root.find('[name="description"]').val(opts.description);
        root.find('[name="medium"]').val(opts.medium);
        root.find('[name="source"]').val(opts.source);
        this.toDom.val(opts.to);
        var message = opts.message || '';
        var constraints = this.parameters.constraints || {};
        if (constraints.editableURLInMessage) {
          // so we need some URL in the message itself - if the service doesn't
          // do its own shortening we prefer a short url if we already have one.
          var url;
          if (constraints.shortURLLength) {
            url = formLink; // prefers canonicalUrl over url.
          } else {
            url = opts.shortUrl || formLink;
          }
          if (url) {
            // just use a single space to separate them - that is what
            // twitter's intents does and it sounds reasonable...
            message += " " + url;
          }
        }
        root.find('[name="message"]').val(message);

        var shareTypes = this.parameters.shareTypes;
        var initialShareType = opts.shareType || this.options.shareType ||
                               shareTypes[0].type;
        if (shareTypes && shareTypes.length > 1) {
          //Insert a Select widget if it is desired.
          this.select = new Select({
            name: 'shareType',
            value: initialShareType,
            options: shareTypes.map(function (item) {
                      return {
                        name: item.name,
                        value: item.type
                      };
                    })
          }, $('.shareTypeSelectSection', this.node)[0]);

          // Update anything which depends on the share state and do the same
          // as it changes.
          // Listen to changes in the Select
          this.selectChangeFunc = fn.bind(this, function (evt) {
            this.onShareTypeChange(evt);
          });
          this.select.dom.bind('change', this.selectChangeFunc);
        }
        this.changeShareType(this.getShareType(initialShareType));

        if (this.parameters.constraints && this.parameters.constraints.textLimit) {
          this.startCounter();
        }

        //Create ellipsis for anything wanting ... overflow
        $(".overflow", this.node).textOverflow();

        // we're resizing the page description via css, but we also need to
        // notify the panel to resize, otherwise part of our panel will get
        // hidden.
        $('textarea.pageDescription', this.node).bind('focus', function (e) {
          mediator.sizeToContent();
        });
        $('textarea.pageDescription', this.node).bind('blur', function (e) {
          mediator.sizeToContent();
        });

      },

      validate: function (sendData) {
        return !this.counter || !this.counter.isOver();
      },

      /**
       * Validates that any direct/to sending has a recipient. If not,
       * then show an error, and disable the sharing button.
       */
      validateTo: function () {
        var value = this.toDom.val().trim();

        // Hide any existing error.
        this.resetError();

        if (!value) {
          // Disable share, show error.
          this.shareButtonNode.setAttribute('disabled', 'disabled');
          this.toDom.addClass('inputError');
          this.toDom.attr("aria-invalid", "true");

          this.showStatus('needRecipient');
        } else {
          // Make sure all recipients are good.
          this.resolveRecipients(
            value,
            function(good, bad) {
              if (bad.length === 0) {
                // all good - may we well update the to field with the
                // resolved names.
                if (good.length) {
                  this.toDom.val(good.join(", ") + ", ");
                }
              } else {
                // at least one error
                this.shareButtonNode.setAttribute('disabled', 'disabled');
                this.toDom.addClass('inputError');
                this.toDom.attr("aria-invalid", "true");
                this.showStatus('invalidRecipient');
              }
            }.bind(this)
          );
        }
      },

      // Given a string direct from the UI, convert it to a list of PoCo
      // records suitable to pass back to the service.
      resolveRecipients: function(toText, cb) {
        var names = [],
            split = toText.split(',');
        split.forEach(function (to) {
          to = to.trim();
          if (to) {
            names.push(to)
          }
        });
        var shareType = this.parameters.shareTypes[0].type;
        if (this.select)
          shareType = this.getShareType(this.select.val()).type;
        this.owaservice.call('resolveRecipients',
          {shareType: shareType, names: names},
          function(results) {
            var good = [], bad = [];
            results.forEach(function (result) {
              if (result.result) {
                good.push(result.result);
              } else {
                bad.push(result.error);
              }
            });
            cb(good, bad);
          },
          function(err, msg) {
            dump("error resolving recipients: " + err + "/" + msg + "\n");
            // and callback as if all are bad.
            cb([], names);
          }
        );
      },

      /**
       * Clears the form of any error message, enables share button.
       */
      resetError: function () {
        this.shareButtonNode.removeAttribute('disabled');
        this.toDom.removeClass('inputError');
        this.doDom.removeAttr("aria-invalid");
        this.hideStatus();
      },

      startCounter: function () {
        //Set up text counter
        if (!this.counter) {
          this.counter = new TextCounter($('textarea.message', this.node),
                                         $('.counter', this.node),
                                         this.parameters);
        }
      },

      /**
       * Shows a status message near the share button.
       * @param {String} className the class name of the status message element
       * to show.
       */
      showStatus: function (className) {
        $('.status.' + className, this.node)[0].style.display = 'inline';
      },

      /**
       * Hides all status messages that show up near the share button.
       */
      hideStatus: function () {
        $('.status', this.node).hide();
      },

      getRestoreState: function () {
        return this.getFormData();
      },

      getFormData: function () {
        var dom = $('form', this.node),
            data = {};
        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        $.each(dom[0].elements, function (i, node) {
          var trimmed = node.value.trim();

          node.value = trimmed;

          if (node.value) {
            data[node.name] = node.value;
          }
        });

        return data;
      },

      getShareType: function (shareTypeValue) {
        for (var i = 0, item; (item = this.parameters.shareTypes[i]); i++) {
          if (item.type === shareTypeValue) {
            return item;
          }
        }
        return null;
      },

      changeShareType: function (shareType) {
        var toSectionDom = $('.toSection', this.node),
            shareTypeDom = $('.shareTypeSection', this.node),
            actionsDom = $('.accountActions', this.node),
            shareTypeSelectDom = $('.shareTypeSelectSection', this.node),
            toInputDom = $('.toSection input', this.node);

        //If there is a special to value (like linkedin my connections), drop it in
        toInputDom.val(shareType.specialTo ? shareType.specialTo : '');

        if (shareType.toLabel) {
          toSectionDom.removeClass('hiddenImportant');
          shareTypeDom.addClass('wide');
          actionsDom.addClass('wide');
          shareTypeSelectDom.addClass('fixedSize');
          toInputDom.focus();
        } else {
          toSectionDom.addClass('hiddenImportant');
          actionsDom.removeClass('wide');
          shareTypeDom.removeClass('wide');
          shareTypeSelectDom.removeClass('fixedSize');
        }
        // Set up autocomplete and contacts used for autocomplete.
        var acNode = this.toDom[0];
        if (acNode) {
          if (!this.autoComplete) {
            this.autoComplete = new AutoComplete(acNode, this.owaservice);
            // Listen for autocomplete selections, so that the error
            // state is not set on a node after using the mouse to select
            // an autocomplete option.
            this.toDom.bind('autocompleteselect', fn.bind(this, function () {
              this.resetError();
            }));
          }
          this.autoComplete.shareTypeChanged(shareType.type);
        }
      },

      onShareTypeChange: function (evt) {
        var shareType = this.getShareType(this.select.val());
        this.changeShareType(shareType);

        //Clear up any error status, make sure share button
        //is enabled.
        this.resetError();

        mediator.sizeToContent();
      },

      onSubmit: function (evt) {
        //Do not submit the form as-is.
        evt.preventDefault();

        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        var sendData = this.getFormData();
        // put the appid in the data so the caller can find us.
        sendData.appid = this.owaservice.app.origin;
        // and any other import things from the initial params which don't
        // currently appear on the form.
        sendData.title = this.options.title;

        if (!this.validate(sendData)) {
          return;
        }

        if (this.options.shortUrl) {
          sendData.shorturl = this.options.shortUrl;
        } else if (this.parameters.shorten) {
          // XXX - this is currently unused...
          sendData.shorten = true;
        }

        // fixup 'to' addressing do the send.
        this.resolveRecipients(
          sendData.to || '',
          function(good, bad) {
            // in theory we have already called validateTo, so errors here
            // shouldn't happen.
            if (bad.length) {
              dump("unexpected errors resolving recipients: " + bad + "\n");
            }
            sendData.to = good;
            //Notify the page of a send.
            dispatch.pub('sendMessage', sendData);
          }
        );
      },

      onRemove: function (evt) {
        // request a logout.
        dispatch.pub('logout', this.owaservice.app.origin);
      }
    };
  });
});
