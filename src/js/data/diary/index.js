"use strict";

import _ from 'lodash';
import Logger from '../../utils/logger';
import Q from 'bluebird';
import moment from 'moment';
import React from 'react';

import Detect from '../../utils/detect';
import { instance as Crypto } from '../crypto/index';
import { instance as Search } from '../search/index';
import { instance as Storage } from '../storage/index';
import { instance as Dispatcher } from '../dispatcher';
import Auth from '../auth/index';
import ExportedEntries from '../../ui/components/ExportedEntries';
import * as DateUtils from '../../utils/date';




/**
 * Represents a diary.
 */
export default class Diary {

  constructor(data = {}) {
    this._name = data.name;
    this._entries = null;
    this._encryptedEntries = data.entries || {};
    this._auth = new Auth(data.meta);

    this._backupFilePath = _.get(data, 'backup.file', null);
    this._lastBackupTime = _.get(data, 'backup.ts', null);

    this.logger = Logger.create(`diary[${name}]`);
  }


  /**
   * Open this diary using given password.
   * 
   * @return {Promise}
   */
  open (password) {
    Dispatcher.openDiary('start', {
      name: this._name,
      password: password,
    });

    return this._auth.enterPassword(password)
      .then(() => {
        Dispatcher.openDiary('result', this);
      })
      .catch((err) => {
        Dispatcher.openDiary('error', err);

        throw err;
      });
  }



  loadEntries() {
    Dispatcher.loadEntries('start');

    return Q.try(() => {
      if (_.isEmpty(this._encryptedEntries)) {
        this.logger.info('no existing entries found');

        this._entries = {};

        Dispatcher.loadEntries('result');

        return this._rebuildSearchIndex();
      } else {
        this.logger.info('existing entries found');

        if (!this._auth.originalMeta.version) {
          return this._decryptOldFormat();
        } else {
          return this._decryptNewFormat();
        }
      }
    })
      .catch((err) => {
        Dispatcher.loadEntries('error', new Error('There was an error loading your diary entries.'));

        throw err;
      });
  }



  /**
   * @return {Promise}
   */
  updateEntry (id, ts, content) {
    Dispatcher.updateEntry('start');

    let entry = this.getEntryById(id) || this.getEntryByDate(ts);

    return Q.try(() => {
      if (!entry) {
        ts = DateUtils.getNormalizedTimestamp(ts || Date.now());

        this.logger.debug('create entry', ts);

        return Crypto.hash(ts, Math.random() * 100000)
          .then((newId) => {
            return {
              id: newId,
              ts: ts,
            };
          });
      } else {
        return entry;
      }
    })
      .then((entry) => {
        this.logger.debug('update entry');

        entry.body = content;
        entry.up = moment().valueOf();
        this._entries[entry.id] = entry;

        return this._saveEntry(entry);
      })
      .then((entry) => {
        Dispatcher.updateEntry('result');

        return this._addToSearchIndex(entry);
      })
      .catch((err) => {
        this.logger.error(err);

        Dispatcher.updateEntry('error', err);

        throw err;
      });
  }



  /**
   * @return {Promise}
   */
  deleteEntry (id) {
    if (!this._entries[id]) {
      return Q.reject(new Error('Entry not found: ' + id));
    }

    Dispatcher.deleteEntry('start');

    delete this._entries[id];
    delete this._encryptedEntries[id];

    return this._saveDiary()
      .then(() => {
        Dispatcher.deleteEntry('result');
      })
      .then(() => {
        return this._removeFromSearchIndex(id);
      })
      .catch((err) => {
        this.logger.error(err);

        Dispatcher.deleteEntry('error', err);

        throw err;
      });
  }


  /**
   * @return {Promise}
   */
  changePassword (oldPassword, newPassword) {
    return this._auth.changePassword(oldPassword, newPassword)
      .then(() => {
        return this._saveDiary();
      });
  }


  /**
   * @return {Promise}
   */
  exportToFile () {
    Dispatcher.exportToFile('start');

    let content = React.renderToString(
      <ExportedEntries entries={this.entries} />
    );

    return Storage.exportToFile(content)
      .then(function didUserCancel(filePath) {
        // user cancelled?
        if (!filePath) {
          return Dispatcher.exportToFile('reset');
        }

        Dispatcher.exportToFile('result', {
          filePath: filePath
        });
      })
      .catch(function(err) {
        this.logger.error(err);

        Dispatcher.exportToFile('error', err);

        throw err;
      });
  }



  get name () {
    return this._name;
  }


  get entries () {
    return this._entries;
  }


  get backupFilePath () {
    return this._backupFilePath;
  }


  get lastBackupTime () {
    return this._lastBackupTime;
  }


  getEntryById (id) {
    this.logger.debug('get entry by id', id);

    return (this._entries || {})[id];
  }


  getEntryByDate (date) {
    var ts = DateUtils.getNormalizedTimestamp(date);

    this.logger.debug('get entry by date', date, ts);

    var entry = _.find(this._entries || {}, function(e) {
      return DateUtils.getNormalizedTimestamp(e.ts) === ts;
    });

    if (entry) {
      this.logger.debug('got by date', ts, entry.id);
    }

    return entry;
  }


  getEntryForNow () {
    this.logger.debug('get today\'s entry');
    
    return this.getEntryByDate(new Date());
  }



  /**
   * @return {Promise}
   */
  _saveEntry (entry) {
    this.logger.debug('save entry', entry.id);

    return Crypto.encrypt(this._auth.encryptionKey, entry)
      .then((encryptedEntry) => {
        this._encryptedEntries[entry.id] = encryptedEntry;

        return this._saveDiary();
      })
      .then(() => {
        return entry;
      });
  }



  /**
   * @return {Promise}
   */
  _saveDiary () {
    Dispatcher.saveDiary('start');

    this.logger.debug('save to storage');

    return Storage.saveDiary(this._name, {
      meta: this._auth.meta,
      entries: this._encryptedEntries,
    })
      .then(() => {
        Dispatcher.saveDiary('result');
      })
      .catch((err) => {
        Dispatcher.saveDiary('error', err);

        throw err;
      });
  }



  _decryptOldFormat () {
    this.logger.debug("decrypt OLD format");

    this._entries = {};

    Dispatcher.loadEntries('progress', `Decrypting entries`);

    return Crypto.decrypt(
      this._auth.encryptionKey, this._encryptedEntries
    )
      .then((entries) => {
        this._entries = entries;
        this._encryptedEntries = {};  // clear original so that we can save to new version

        let done = 0,
          total = _.keys(entries).length;

        // now let's re-save each entry, individually encrypted
        return Q.props(_.mapValues(entries, (entry) => {
          return Crypto.encrypt(this._auth.encryptionKey, {
            body: entry.body,
            ts: entry.ts,
            up: entry.up,
          })
            .then((encryptedEntry) => {
              Dispatcher.loadEntries('progress', `Upgrading diary...(${++done}/${total})`);

              return encryptedEntry;
            });
        }));
      })
      .then((encryptedEntries) => {
        Dispatcher.loadEntries('progress', 'Saving new format');

        this._encryptedEntries = encryptedEntries;

        return Storage.saveDiary(this._name, {
          meta: this._auth.meta,
          entries: this._encryptedEntries,
        });
      })
      .then(() => {
        Dispatcher.loadEntries('result');

        return this._rebuildSearchIndex();
      });
  }


  _decryptNewFormat () {
    this.logger.debug("decrypt NEW format");

    this._entries = {};

    let encryptedEntries = this._encryptedEntries || {};

    let total = _.keys(encryptedEntries).length;
    let done = 0;

    // decrypt one at a time!
    let decryptionPromise = _.reduce(encryptedEntries, (prevPromise, entryEnc, id) => {
      return prevPromise.then(() => {
        return Crypto.decrypt(this._auth.encryptionKey, entryEnc)
          .then((entry) => {
            entry.id = id;

            this._entries[id] = entry;

            Dispatcher.loadEntries('progress', `Decrypting...(${++done}/${total})`);
          })
          .catch((err) => {
            this.logger.error(err);

            Dispatcher.loadEntry('error', `Error decrypting entry ${id}`);

            throw err;
          });
      });
    }, Q.resolve());

    return decryptionPromise
      .then(() => {
        Dispatcher.loadEntries('result');

        return this._rebuildSearchIndex();
      });
  }


  _rebuildSearchIndex() {
    let entries = this.entries;

    this.logger.debug('rebuild search index', _.keys(entries).length);

    Dispatcher.buildSearchIndex('start');

    return Search.reset()
      .then(() => {
        return Search.addMany(entries);
      })
      .then(() => {
        Dispatcher.buildSearchIndex('result');
      })
      .catch((err) => {
        Dispatcher.buildSearchIndex('error', err);
      });
  }


  _addToSearchIndex(entry) {
    this.logger.debug('add to search index', entry.id);

    return Search.add({
      id: entry.id,
      ts: entry.ts,
      body: entry.body,
    });
  }

  _removeFromSearchIndex(id) {
    this.logger.debug('remove from search index', id);

    return Search.remove({
      id: id,
    });
  }

}


Diary.createNew = (name, password) => {
  let auth = new Auth();

  return auth.createPassword(password)
    .then(() => {
      return Storage.local.createNewDiary(name, {
        meta: auth.meta
      });
    })
    .then((data) => {
      return new Diary(name, data);
    });
};


Diary.open = (id, password) => {
  let auth = new Auth();

  auth.

  return Storage.local.openDiary(id)
    .then((data) => {
      let diaryMgr = new Diary(data);

      return diaryMgr.open(password)
        .then(() => {
          return diaryMgr;
        });
    });
};




