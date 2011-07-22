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
dump("heya! from f1\n");
define([ "require", "jquery", "blade/object", "blade/fn",
        "blade/jig", "blade/url", "dispatch",
         "storage",  "widgets/ServicePanel", "widgets/TabButton",
         "widgets/AddAccount", "less", "osTheme", "mediator",
         "jquery-ui-1.8.7.min", "jquery.textOverflow", "jschannel"
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
      owaservices = [], // A list of {app, iframe, channel, characteristics}
      owaservicesbyid = {}; // A map version of the above


  //Start processing of less files right away.
  require(['text!style/' + osTheme + '.css', 'text!style.css'],
    function (osText, styleText) {
    (new less.Parser()).parse(osText + styleText, function (err, css) {
      if (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(err);
        }
      } else {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = css.toCSS();
        document.head.appendChild(style);
        document.body.style.visibility = 'visible';
      }
    });
  });

  //For debug tab purpose, make it global.
  window.closeShare = mediator.close;

  function updateChromeStatus(status, statusId, message) {
    var app = sendData.appid;
    var result = {status:status, statusId:statusId, message:message, url:options.url};
    mediator.updateChromeStatus(app, result);
  }

  function _showStatus(statusId, shouldCloseOrMessage) {
    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        mediator.success({
          username: sendData.username,
          userid: sendData.userid,
          url: options.url,
          service: owaservicesbyid[sendData.appid].app.manifest.name
        });
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
      updateChromeStatus(SHARE_ERROR, statusId, shouldCloseOrMessage);
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
    var channel = svcRec.channel;
    channel.call({
      method: "link.send",
      params: sendData,
      success: function() {
        var prop;
        // {'message': u'Status is a duplicate.', 'provider': u'twitter.com'}
        store.set('lastSelection', sendData.appid);
        showStatusShared();
        // notify on successful send for components that want to do
        // work, like save any new contacts.
        updateChromeStatus(SHARE_DONE);
        mediator.sendComplete(sendData);
        // Let the 'shared' status stay up for a second.
        setTimeout(function() {
            // do *not* send the sendData in the result as that might leak
            // private information to content.
            mediator.result(sendData.appid);
          }, 1000);
      },
      error: function(error, message) {
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
          } else if (status === 503) {
            showStatus('statusServerBusy');
          } else if (status === 0) {
            showStatus('statusServerError');
          } else {
            showStatus('statusError', message); // XXX - need better default msg??
          }
        } else {
          showStatus('statusError', message);
        }
        updateChromeStatus(SHARE_ERROR);
        if (fatal) {
          // Let the 'error' status stay up for a second then notify OWA of
          // the error.
          setTimeout(function() {
              mediator.error(sendData.appid);
            }, 1000);
        }
      }
    });
  }

  function sendMessage(data) {
    showStatus('statusSharing');

    sendData = data;
    var svcRec = owaservicesbyid[data.appid];

    // get any shortener prefs before trying to send.
    store.get('shortenPrefs', function (shortenPrefs) {
          var svcConfig = svcRec.characteristics,
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
        fragment = document.createDocumentFragment();

    $('#shareui').removeClass('hidden');

    store.get('lastSelection', function (lastSelection) {
      store.get('accountAdded', function (accountAdded) {

        var asyncCount = 0,
            asyncConstructionDone = false,
            accountPanel;

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
          if (lastSelectionMatch < 0 && !accountAdded && lastSelection) {
            store.remove('lastSelection');
            lastSelectionMatch = 0;
          }

          // which domain was last active?
          // TODO in new tabs world.
          //$("#accounts").accordion({ active: lastSelectionMatch });
          tabButtonsDom.eq(lastSelectionMatch).click();

          //Reset the just added state now that accounts have been configured one time.
          if (accountAdded) {
            store.remove('accountAdded');
          }

          //Inform extension the content size has changed, but use a delay,
          //to allow any reflow/adjustments.
          setTimeout(function () {
            mediator.sizeToContent();
          }, 100);
        }

        //Figure out what accounts we do have
        owaservices.forEach(function (thisSvc, index) {
          var appid = thisSvc.app.app,
              tabId = "ServicePanel" + index,
              PanelCtor;

          //Make sure to see if there is a match for last selection
          if (appid === lastSelection) {
            lastSelectionMatch = index;
          }

          if (accountPanels[appid]) {
            dump("EEEK - no concept of multiple accts per service!\n");
            // accountPanels[appid].addService(thisSvc);
          } else {
            /// XXX - need the OWA icon helper!!
            var icon;
            for (var z in thisSvc.app.manifest.icons) {
              icon = thisSvc.app.app + thisSvc.app.manifest.icons[z];
              break;
            }
            // Add a tab button for the service.
dump("adding tab for "+thisSvc.app.manifest.name+"\n");
            tabsDom.append(new TabButton({
              target: tabId,
              type: appid,
              title: thisSvc.app.manifest.name,
              serviceIcon: icon
            }, tabFragment));

            // Get the contructor function for the panel.
            accountPanel = new ServicePanel({
              options: options,
              owaservice: thisSvc,
              savedState: accountPanelsRestoreState[appid]
            }, fragment);

            accountPanel.node.setAttribute("id", tabId);
            accountPanels[appid] = accountPanel;
          }
        });
        finishCreate();
        accountPanelsRestoreState = {};
      });
    });
  }
  
  //function doAuthorization(data) {
  //  dump("attempt oauthAuthorization\n");
  //  var svcRec = owaservicesbyid[data.appid];
  //  var channel = svcRec.channel;
  //  channel.call({
  //    method: "oauthAuthorization",
  //    params: data,
  //    success: function() {
  //      dump("got success callback from oauthAuthorization\n");
  //    },
  //    error: function(error, message) {
  //    }
  //  });
  //  
  //}

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
        svcRec.channel.call({
          method: "link.send.logout",
          success: function(result) {
            dump("logout worked\n");
            //mediator.reconfigure();
            dispatch.pub('serviceChanged', svcRec.app.app);
          },
          error: function(err, message) {
            dump("failed to logout: " + err + ": " + message + "\n");
            // may as well update the accounts anyway incase it really did work!
            //mediator.reconfigure();
            dispatch.pub('serviceChanged', svcRec.app.app);
          }
        });
      });

      $('body')
        .delegate('.widgets-TabButton', 'click', function (evt) {
          evt.preventDefault();

          //Switch Tabs
          // Ack - the click event seems to come from the img rather than the anchor?
          var node = evt.target.nodeName==='A' ? evt.target : evt.target.parentNode,
              target = node.href.split('#')[1];

          tabButtonsDom.removeClass('selected');
          $(node).addClass('selected');

          servicePanelsDom.addClass('hidden');
          $('#' + target).removeClass('hidden');

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
        .delegate('.close', 'click', function (evt) {
          evt.preventDefault();
          mediator.close();
        });

      $('#authOkButton').click(function (evt) {
        // just incase the service doesn't detect the logout automatically
        // (ie, incase it returns the stale user info), force a logout.
        
        // XXX FIXME.  need to test this use case somehow.  We really should
        // not reproduce the opening of an auth dialog here, we do that in
        // servicepanel.js.  We probably should do something like:
        //var accountPanel = accountPanels[sendData.appid];
        //accountPanel.onLogin();
        var svcRec = owaservicesbyid[sendData.appid];
        // apparently must create the window here, before we do the channel
        // stuff to avoid it being blocked.
        var win = window.open("",
          "ffshareOAuth",
          "dialog=yes, modal=yes, width=900, height=500, scrollbars=yes");
        svcRec.channel.call({
          method: 'link.send.logout',
          success: function() {
            _fetchLoginInfo(svcRec, function() {
              if (!svcRec.login || !svcRec.login.login || !svcRec.login.login.dialog) {
                dump("Eeek - didn't get a login URL back from the service\n");
                showStatus('statusOAuthFailed');
                win.close();
                return;
              }
              var url = svcRec.app.app + svcRec.login.login.dialog;
              win.location = url;
              win.focus();
            });
          },
          error: function(err, message) {
            dump("Service logout failed: " + err + "/" + message + "\n");
            showStatus('statusOAuthFailed');
            win.close();
          }
        });
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
    // first the channels
    while (owaservices.length) {
      var svcRec = owaservices.pop();
      svcRec.channel.destroy();
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

  function _createChannels(requestMethod, requestArguments) {
    options = requestArguments;
    onFirstShareState();

    owaservices.forEach(function(svcRec, i) {
      try {
        // if we're loading an app from an addon, use a global origin.  also use
        // the apps url for scope, since each app needs a unique origin+scope
        var origin = svcRec.app.url.indexOf("resource://") == 0 ? "*" : svcRec.app.url;
        var chan = Channel.build({
            window: svcRec.iframe.contentWindow,
            origin: origin,
            scope: svcRec.app.url
        });
        svcRec.channel = chan;
        // and listen for "Account changed" events coming back from it.
        // (We do this once per app as each one may have a different origin)
        svcRec.subAcctsChanged = dispatch.sub('accountsChanged',
                                              mediator.reconfigure,
                                              window,
                                              svcRec.app.app);

      } catch (e) {
        dump("Warning: unable to create channel to " + svcRec.app.url + ": " + e + "\n");
      }
    });
  };
  
  
  function owa_setup(data) {
    data.serviceList.forEach(function(svc, index) {
      var svcRec = {app: svc,
                    iframe: document.getElementById("svc-frame-" + index)
      }
      owaservices.push(svcRec);
      owaservicesbyid[svc.app] = svcRec;
    });
    displayAccounts();
    var requestMethod = data.method;
    var requestArgs = data.args;

    _createChannels(requestMethod, requestArgs);
    // use the newly created channels to get the characteristics for
    // each owa service.
    owaservices.forEach(function(thisSvc) {
      var ch = thisSvc.channel;
      ch.call({
        method: "link.send.getCharacteristics",
        success: function(result) {
          thisSvc.characteristics = result;
          dispatch.pub('serviceChanged', thisSvc.app.app);
        },
        error: function(err) {
          dump("failed to get owa characteristics: " + err + "\n");
          dispatch.pub('serviceChanged', thisSvc.app.app);
        }
      });
    });
  }
  /* initialize and setup commands sent from owa */
  dispatch.sub("init", _deleteOldServices);
  dispatch.sub("setup", owa_setup);
  
dump("F1 panel is ready!\n");
  mediator.reconfigure();
});
