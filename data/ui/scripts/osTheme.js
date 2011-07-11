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
/*global document: false, navigator: false, define: false */
'use strict';

/**
 * Sets up a class on the documentElement that is based on the OS theme.
 * this right away, not part of a module, to a flash of unstyled content.
 *
 * Also returns the name of the OS theme as the module value.
 */

(function () {
  var platform = navigator.platform,
    map = {
      'Win': 'win',
      'Mac': 'mac',
      'Linux': 'linux'
    },
    theme, prop;

  for (prop in map) {
    if (map.hasOwnProperty(prop) && platform.indexOf(prop) !== -1) {
      theme = map[prop];
      document.documentElement.className += ' ' + theme;
      break;
    }
  }

  define(function () {
    return theme;
  });
}());