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

const wice = require('./wice.js');

exports.process = processAction;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */

function processAction(msg, cfg) {

  let reply = [];
  const self = this;
  msg.body.number = 'auto';

  // First create a session in Wice
  wice.createSession(cfg, () => {
    if (cfg.cookie) {

      let article = JSON.stringify(msg.body);
      let existingRowid = 0;

      let options = {
        method: 'POST',
        uri: 'https://oihwice.wice-net.de/plugin/wp_elasticio_backend/json',
        headers: {
          'X-API-KEY': cfg.apikey
        }
      };

      function checkForExistingArticle() {
        options.form = {
          method: 'get_all_articles',
          cookie: cfg.cookie,
          search_filter: msg.body.description
        };

        return new Promise((resolve, reject) => {
          request.post(options)
            .then((res) => {
              const resObj = JSON.parse(res);
              if (resObj.loop_articles) {
                existingRowid = resObj.loop_articles[0].rowid;
                console.log(`Article already exists ... Rowid: ${existingRowid}`);
              }
              resolve(existingRowid);
            })
            .catch((e) => {
              reject(e);
            });
        });
      };

      function createArticle() {
        return new Promise((resolve, reject) => {

          if (existingRowid > 0) {
            msg.body.rowid = existingRowid;
            options.form = {
              method: 'update_article',
              cookie: cfg.cookie,
              data: article
            };
            console.log('Updating an article ...');

          } else {
            options.form = {
              method: 'insert_article',
              cookie: cfg.cookie,
              data: article
            };
            console.log('Creating an article ...');
          }
          request.post(options).then((res) => {
            const obj = JSON.parse(res);
            reply.push(obj);
            resolve(reply);
          }).catch((e) => {
            reject(e);
          });
        });
      }

      function emitData() {
        const data = messages.newMessageWithBody({
          "article": reply
        });
        self.emit('data', data);
      }

      function emitError(e) {
        console.log('Oops! Error occurred');
        self.emit('error', e);
      }

      function emitEnd() {
        console.log('Finished execution');
        self.emit('end');
      }

      Q()
      .then(checkForExistingArticle)
      .then(createArticle)
      .then(emitData)
      .fail(emitError)
      .done(emitEnd);
    }
  });
}
