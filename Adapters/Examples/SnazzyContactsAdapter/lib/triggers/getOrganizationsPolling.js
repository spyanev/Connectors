/**
 * Copyright 2018 Wice GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";
const Q = require('q');
const request = require('request-promise');
const messages = require('elasticio-node').messages;
const snazzy = require('../actions/snazzy');

exports.process = processTrigger;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processTrigger(msg, cfg) {

  snazzy.createSession(cfg, () => {
    const self = this;
    let organizations = [];

    function getOrganizations() {
      return new Promise((resolve, reject) => {
        const requestOptions = {
          uri: `https://snazzycontacts.com/mp_contact/json_respond/address_company/json_mainview?mp_cookie=${cfg.mp_cookie}`,
          json: true,
          headers: {
            'X-API-KEY': cfg.apikey
          }
        };

        request.get(requestOptions)
          .then((res) => {
            let customOrganizaiontFormat;
            const totalEntries = res.content[0].total_entries_readable_with_current_permissions;

            if (totalEntries == 0) {
              reject('No organizations found ...');
            }

            // TODO: Create a custom object which does not contain all fields
            organizations = res.content;
            resolve(organizations);
          }).catch((e) => {
            reject(e);
          });
      });
    }

    function emitData() {
      const data = messages.newMessageWithBody({
        "organizations": organizations
      });
      self.emit('data', data);
    }

    function emitError(e) {
      console.log(`ERROR: ${e}`);
      self.emit('error', e);
    }

    function emitEnd() {
      console.log('Finished execution');
      self.emit('end');
    }

    Q()
      .then(getOrganizations)
      .then(emitData)
      .fail(emitError)
      .done(emitEnd);
  });
}
