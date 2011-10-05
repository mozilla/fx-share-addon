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
 Refactor cleanup:

 * lastSelectionMatch
 * oauth failure in addAccount.js

*/

define([ "require", "jquery", "blade/object", "blade/fn",
        "blade/jig", "blade/url", "dispatch",
         "storage",  "widgets/ServicePanel", "widgets/TabButton",
         "widgets/AddAccount", "less", "osTheme", "mediator",
         "jquery-ui-1.8.7.min", "jquery.textOverflow"
         ],
function (require,   $,        object,         fn,
          jig,         url,        dispatch,
          storage,   ServicePanel,           TabButton,
          AddAccount,           less,   osTheme,   mediator) {

  var accountPanels = {},
      accountPanelsRestoreState = {},
      store = storage(),
      SHARE_DONE = 0,
      SHARE_START = 1,
      SHARE_ERROR = 2,
      okStatusIds = {
        statusSettings: true,
        statusSharing: true,
        statusShared: true
      },
      options, sendData, tabButtonsDom,
      servicePanelsDom,
      owaservices = [], // A list of OWA service objects
      owaservicesbyid = {}; // A map version of the above

  //Start processing of less files right away.
  require(['text!style/' + osTheme + '.css', 'text!style.css'],
    function (osText, styleText) {
    (new less.Parser()).parse(osText + styleText, function (err, css) {
      if (err) {
        dump("Failed to setup style-sheet: " + err.name + "/" + err.message+"\n");
        if (typeof console !== 'undefined' && console.error) {
          console.error(err);
        }
      } else {
        var style = document.createElement('style');
        style.type = 'text/css';
        try{
          style.textContent = css.toCSS();
        } catch(e) {
          dump("less error: "+JSON.stringify(e)+"\n");
        }
        document.head.appendChild(style);
        document.body.style.display = 'block';
        mediator.sizeToContent();
      }
    });
  });

  function updateChromeStatus(statusCode) {
    mediator.updateChromeStatus({statusCode: statusCode});
  }

  function _showStatus(statusId, shouldCloseOrMessage) {
    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        $('div.status').addClass('hidden');
      }, 2000);
    } else if (shouldCloseOrMessage) {
      $('#' + statusId + 'Message').text(shouldCloseOrMessage);
    }

    //Tell the extension that the size of the content may have changed.
    mediator.sizeToContent();
  }

  function showStatus(statusId, shouldCloseOrMessage) {
    $('div.status').addClass('hidden');
    $('#clickBlock').removeClass('hidden');
    $('#' + statusId).removeClass('hidden');

    if (!okStatusIds[statusId]) {
      updateChromeStatus(SHARE_ERROR);
    }
    _showStatus(statusId, shouldCloseOrMessage);
  }
  //Make it globally visible for debug purposes
  window.showStatus = showStatus;

  function resetStatusDisplay() {
    $('#clickBlock').addClass('hidden');
    $('div.status').addClass('hidden');
  }

  function cancelStatus() {
    // clear any existing status
    updateChromeStatus(SHARE_DONE);
    resetStatusDisplay();
  }

  function showStatusShared() {
    var svcRec = owaservicesbyid[sendData.appid],
        siteName = options.siteName,
        url = options.url || "",
        doubleSlashIndex = url.indexOf("//") + 2;
    $('#statusShared').empty().append(jig('#sharedTemplate', {
      domain: siteName || url.slice(doubleSlashIndex, url.indexOf("/", doubleSlashIndex)),
      service: svcRec.app.manifest.name,
      href: svcRec.app.url
    })).find('.shareTitle').textOverflow(null, true);
    showStatus('statusShared', true);
  }
  //Make it globally visible for debug purposes
  window.showStatusShared = showStatusShared;

  function handleCaptcha(detail, error) {
    $('#captchaImage').attr('src', detail.imageurl);
    if (error) {
      $('#captchaMsg').text(error.message);
    }
    $('#captchaSound').attr('src', detail.audiourl);
    showStatus('statusCaptcha', false);
  }
  window.handleCaptcha = handleCaptcha;

  function reAuth() {
    showStatus('statusAuth');
  }

  // This method assumes the sendData object has already been set up.
  // You probably want sendMessage, not this call.
  function callSendApi() {
    var data = object.create(sendData);
    updateChromeStatus(SHARE_START);
    //For now strip out the bitly placeholder since the backend does
    //not support it. This is being tracked in:
    //https://bugzilla.mozilla.org/show_bug.cgi?id=653277
    if (data.message) {
      data.message = data.message.replace(/http\:\/\/bit\.ly\/XXXXXX/, '');
    }
    // XXX - this needs lots of work - the values we work with are specific
    // to the F1 backend implementation and not really suitable as a general
    // api.
    var svcRec = owaservicesbyid[sendData.appid];
    svcRec.call("confirm", sendData,
      function(result) {
        var prop;
        // {'message': u'Status is a duplicate.', 'provider': u'twitter.com'}
        localStorage["last-app-selected"] = sendData.appid;
        showStatusShared();
        // notify on successful send for components that want to do
        // work, like save any new contacts.
        dispatch.pub('sendComplete', sendData);

        // Let the 'shared' status stay up for a second.
        setTimeout(function() {
            // do *not* send the sendData in the result as that might leak
            // private information to content.  We do however need to include
            // info like the URL and title so our 'agent' can bookmark it etc.
            // XXX - needs more thought about who exactly is responsible for
            // not leaking sensitive stuff back to content as even this
            // limited data is somewhat sensitive...
            mediator.result({link: sendData.link, title: sendData.title,
                             appName: svcRec.app.manifest.name});
          }, 1000);
      },
      function(errob) {
        var error = errob.code, message = errob.message;
        var fatal = true; // false if we can automatically take corrective action.
        dump("SEND FAILURE: " + error + "/" + message + "\n");
        if (error === 'authentication') {
          reAuth();
          fatal = false;
        } else if (error === 'captcha') {
          handleCaptcha(message[0], message[1]);
          fatal = false;
        } else if (error === 'http_error') {
          var status = message;
          if (status === 403) {
            //header error will be "CSRF" if missing CSRF token. This usually
            //means we lost all our cookies, or the server lost our session.
            //We could get more granular, to try to distinguish CSRF missing
            //token from just missing other cookine info, but in practice,
            //it is hard to see how that might happen -- either all the cookies
            //are gone or they are all there.
            //var headerError = xhr.getResponseHeader('X-Error');
            reAuth();
          } else {
            showStatus('statusError', message); // XXX - need better default msg??
          }
        } else {
          showStatus('statusError', message);
        }
        updateChromeStatus(SHARE_ERROR);
        if (fatal) {
          // The text here is what will be displayed in the OWA error notification
          mediator.error("There was a problem sharing this page: " + message);
        }
      }
    );
  }

  function sendMessage(data) {
    showStatus('statusSharing');

    sendData = data;
    var svcRec = owaservicesbyid[data.appid];

    // get any shortener prefs before trying to send.
    store.get('shortenPrefs', function (shortenPrefs) {
          var svcConfig = svcRec.parameters,
              shortenData;

          // hide the panel now, but only if the extension can show status
          // itself (0.7.7 or greater)
          updateChromeStatus(SHARE_START);
          mediator.hide();

          //First see if a bitly URL is needed.
          if (svcConfig.shorten && shortenPrefs) {
            shortenData = {
              format: 'json',
              longUrl: sendData.link
            };

            // Unpack the user prefs
            shortenPrefs = JSON.parse(shortenPrefs);

            if (shortenPrefs) {
              object.mixin(shortenData, shortenPrefs, true);
            }

            // Make sure the server does not try to shorten.
            delete sendData.shorten;

            $.ajax({
              url: 'http://api.bitly.com/v3/shorten',
              type: 'GET',
              data: shortenData,
              dataType: 'json',
              success: function (json) {
                sendData.shorturl = json.data.url;
                callSendApi();
              },
              error: function (xhr, textStatus, errorThrown) {
                showStatus('statusShortenerError', errorThrown);
              }
            });
          } else {
            callSendApi();
          }
    });
  }

  /**
   * Shows the accounts after any AccountPanel overlays have been loaded.
   */
  function displayAccounts(panelOverlayMap) {
    var lastSelectionMatch = 0,
        tabsDom = $('#tabs'),
        tabContentDom = $('#tabContent'),
        tabFragment = document.createDocumentFragment(),
        fragment = document.createDocumentFragment(),
        asyncCount = 0,
        asyncConstructionDone = false,
        accountPanel,
        lastSelection = localStorage['last-app-selected'];

    $('#shareui').removeClass('hidden');

    // Finishes account creation. Actually runs *after* the work done
    // below this function.
    function finishCreate() {
      var addButton, addAccountWidget;

      // Add tab button for add account
      addButton = new TabButton({
        target: 'addAccount',
        title: 'Add Account',
        name: '+'
      }, tabFragment);
      addButton.node.setAttribute("role", "tab");

      // Add the AddAccount UI to the DOM/tab list.
      addAccountWidget = new AddAccount({
        id: 'addAccount', owaservices: owaservices
      }, fragment);

      // add the tabs and tab contents now
      tabsDom.append(tabFragment);
      tabContentDom.append(fragment);

      // Get a handle on the DOM elements used for tab selection.
      tabButtonsDom = $('.widgets-TabButton');
      servicePanelsDom = $('.servicePanel');

      mediator.checkBase64Preview(options);

      //If no matching accounts match the last selection clear it.
      if (lastSelectionMatch < 0 && lastSelection) {
        delete localStorage["last-app-selected"];
        lastSelectionMatch = 0;
      }

      // which domain was last active?
      // TODO in new tabs world.
      //$("#accounts").accordion({ active: lastSelectionMatch });
      tabButtonsDom.eq(lastSelectionMatch).click();

      //Inform extension the content size has changed, but use a delay,
      //to allow any reflow/adjustments.
      setTimeout(function () {
        mediator.sizeToContent();
      }, 100);
    }

    //Figure out what accounts we do have
    owaservices.forEach(function (thisSvc, index) {
      var appid = thisSvc.app.origin,
          tabId = "ServicePanel" + index,
          PanelCtor;

      //Make sure to see if there is a match for last selection
      if (appid === lastSelection) {
        lastSelectionMatch = index;
      }

      if (accountPanels[appid]) {
        // accountPanels[appid].addService(thisSvc);
      } else {
        /// XXX - need the OWA icon helper!!
        var icon = thisSvc.getIconForSize(48); // XXX - what size should really be used???
        // Add a tab button for the service.
        var tabButton = new TabButton({
          target: tabId,
          type: appid,
          title: thisSvc.app.manifest.name,
          serviceIcon: icon
        }, tabFragment);
        tabButton.node.setAttribute("role", "tab");
        tabsDom.append(tabButton);

        // Get the contructor function for the panel.
        accountPanel = new ServicePanel({
          options: options,
          owaservice: thisSvc,
          savedState: accountPanelsRestoreState[appid]
        }, fragment);

        accountPanel.node.setAttribute("id", tabId);
        accountPanel.node.setAttribute("appid", appid);
        accountPanels[appid] = accountPanel;
      }
    });
    finishCreate();
    accountPanelsRestoreState = {};
  }

  // Set up initialization work for the first share state passing.
  function onFirstShareState() {
    // Wait until DOM ready to start the DOM work.
    $(function () {
      //Listen to sendMessage events from the AccountPanels
      dispatch.sub('sendMessage', function (data) {
        sendMessage(data);
      });

      dispatch.sub('logout', function (appid) {
        // XXX calling reconfigure is very heavy handed, we can simply logout
        // and update the panel
        var svcRec = owaservicesbyid[appid];
        svcRec.call("logout", {},
          function(result) {
            dump("logout worked\n");
            //mediator.reconfigure();
            dispatch.pub('serviceChanged', svcRec.app.origin);
          },
          function(errob) {
            dump("failed to logout: " + errob.code + ": " + errob.message + "\n");
            // may as well update the accounts anyway incase it really did work!
            //mediator.reconfigure();
            dispatch.pub('serviceChanged', svcRec.app.origin);
          }
        );
      });

      // Listen for notifications about the service panel changing state - if
      // the account is in the active tab, we ask it to focus.
      dispatch.sub('servicePanelChanged', function(appid) {
        var thePanel = accountPanels[appid];
        if (thePanel && thePanel.node && $(thePanel.node).is(":visible")) {
          thePanel.focusAChild();
        }
      });

      $('body')
        .delegate('.widgets-TabButton', 'click', function (evt) {
          evt.preventDefault();

          //Switch Tabs
          // Ack - the click event seems to come from the img rather than the anchor?
          var node = evt.target.nodeName==='A' ? evt.target : evt.target.parentNode,
              target = node.href.split('#')[1];

          tabButtonsDom.attr('aria-selected', 'false');
          $(node).attr('aria-selected', 'true');

          servicePanelsDom.addClass('hidden');
          var targetElement = $('#' + target);
          targetElement.removeClass('hidden');

          // Arrange for an appropriate widget in the panel to get focus.
          var appid = targetElement.attr("appid");
          var thePanel = accountPanels[appid];
          if (thePanel && thePanel.node) {
            thePanel.focusAChild();
          }

          setTimeout(function () {
            mediator.sizeToContent();
          }, 15);
        })
        .delegate('#statusAuthButton, .statusErrorButton', 'click', function (evt) {
          cancelStatus();
        })
        .delegate('.statusErrorCloseButton', 'click', function (evt) {
          cancelStatus();
        })
        .delegate('.statusResetErrorButton', 'click', function (evt) {
          location.reload();
        })
        .delegate('.settingsLink', 'click', function (evt) {
          evt.preventDefault();
          mediator.openPrefs();
        })

      $('#authOkButton').click(function (evt) {
        // just incase the service doesn't detect the logout automatically
        // (ie, incase it returns the stale user info), force a logout.

        // XXX FIXME.  need to test this use case somehow.  We really should
        // not reproduce the opening of an auth dialog here, we do that in
        // servicepanel.js.  We probably should do something like:
        //var accountPanel = accountPanels[sendData.appid];
        //accountPanel.onLogin();
        var svcRec = owaservicesbyid[sendData.appid];
        // apparently must create the window here, before we call the service
        // to avoid it being blocked.
        var win = window.open("",
          "ffshareOAuth",
          "dialog=yes, modal=yes, width=900, height=500, scrollbars=yes");
        svcRec.call('logout', {},
          function() {
            _fetchLoginInfo(svcRec, function() {
              if (!svcRec.login || !svcRec.login.login || !svcRec.login.login.dialog) {
                dump("Eeek - didn't get a login URL back from the service\n");
                showStatus('statusOAuthFailed');
                win.close();
                return;
              }
              var url = svcRec.app.origin + svcRec.login.login.dialog;
              win.location = url;
              win.focus();
            });
          },
          function(err, message) {
            dump("Service logout failed: " + err + "/" + message + "\n");
            showStatus('statusOAuthFailed');
            win.close();
          }
        );
        return false;
      });

      $('#captchaButton').click(function (evt) {
        cancelStatus();
        $('#clickBlock').removeClass('hidden');
        sendData.HumanVerification = $('#captcha').attr('value');
        sendData.HumanVerificationImage = $('#captchaImage').attr('src');
        sendMessage(sendData);
      });

      //Only bother with localStorage enabled storage.
      if (storage.type === 'memory') {
        showStatus('statusEnableLocalStorage');
        return;
      }

    });
  };

  function _deleteOldServices() {
    while (owaservices.length) {
      var svcRec = owaservices.pop();
      if (svcRec.subAcctsChanged) {
        dispatch.unsub(svcRec.subAcctsChanged);
      }
    }
    owaservicesbyid = {};
    $("#frame-garage").empty();// this will remove iframes from DOM
    $("#tabs").empty();
    $("#tabContent").empty();
    for (var appid in accountPanels) {
      accountPanelsRestoreState[appid] = accountPanels[appid].getRestoreState();
    }
    accountPanels = {};
  };


  // listen for changes in the base64Preview, and update options accordingly,
  // since the this call could happen before AccountPanels are ready, which
  // also listen for base64Preview.
  function onBase64Preview(url) {
    if (options) {
      var preview = options.previews && options.previews[0];
      if (preview) {
        preview.base64 = url;
      }
    }
  }
  mediator.on('base64Preview', onBase64Preview);

  // tell OWA we are ready...
  window.navigator.mozApps.mediation.ready(
    function(activity, services) {
      _deleteOldServices();
      options = activity.data;
      owaservices = services;
      onFirstShareState();
      displayAccounts();
      for (var i = 0; i < services.length; i++) {
        var svc = services[i];
        $("#frame-garage").append(svc.iframe);
        owaservicesbyid[svc.app.origin] = svc;
        svc.on("ready", function() {
          var readyService = this;
          readyService.call("getParameters", {}, function(prefs) {
            readyService.parameters = prefs;
            dispatch.pub('serviceChanged', readyService.app.origin);
          });
        }.bind(svc));
        // listen for any serviceChanged notification specific to this service, happens during login flow
        svc.on("serviceChanged", function() {
          dispatch.pub('serviceChanged', this.app.origin);
        }.bind(svc));
      }
    }
  );
});
