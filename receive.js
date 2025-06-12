function dbTxComplete(/** @type {IDBTransaction} */ tx) {
  return /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
    tx.onabort = (e) => {
      reject(tx.error);
    };
    tx.oncomplete = (e) => {
      resolve();
    };
  }));
}

/** @template T */
function dbReqSuccess(/** @type {IDBRequest<T>} */ req) {
  return /** @type {Promise<T>} */ (new Promise((resolve, reject) => {
    req.onerror = (e) => {
      reject(req.error);
    };
    req.onsuccess = (e) => {
      resolve(req.result);
    };
  }));
}

/** @typedef {{index: number, attempts: number, solved: boolean}} DailyGameInfo */
/** @typedef {{opened: number, attempts: number, solved: number}} TotalsInfo */
/** @typedef {{index: number, initials: string | null}} PersonalBonusGameInfo */
/** @typedef {{index: number, firstSharerInitials: string, firstReceivedDate: number, attempts: number, solved: boolean}} BonusGameInfo */

async function dbImport(/** @type {any} */ payload) {
  const openReq = indexedDB.open('omni', 1);
  const openReqSuccess = dbReqSuccess(openReq);
  let upgraded = false;
  openReq.onupgradeneeded = (e) => {
    upgraded = true;
    const db = openReq.result;
    const osMisc = db.createObjectStore('misc');
    for (const {key, value} of payload.miscEntries) {
      osMisc.add(value, key);
    }
    const osBonusGames = db.createObjectStore('bonus_games', {keyPath: 'index'});
    for (const bonusGame of payload.bonusGames) {
      osBonusGames.add(bonusGame);
    }
  };
  const db = await openReqSuccess;
  db.close();
  if (!upgraded) throw new Error('already received');
}

const out = /** @type {HTMLDivElement} */ (document.getElementById('out'));

const migrateOrigin = 'https://subdue-them.glitch.me';
const migrateUrl = `${migrateOrigin}/migrate.html`;
const doneUrl = '.';

(async () => {
  try {
    const dbs = await indexedDB.databases();
    if (dbs.find((db) => db.name === 'omni')) {
      const alreadyP = document.createElement('p');
      alreadyP.appendChild(document.createTextNode('Already migrated. '));
      const alreadyLink = document.createElement('a');
      alreadyLink.href = doneUrl;
      alreadyLink.textContent = 'Play';
      alreadyP.appendChild(alreadyLink);
      out.appendChild(alreadyP);
      return;
    }

    const startP = document.createElement('p');
    const startButton = document.createElement('input');
    startButton.type = 'button';
    startButton.value = 'Move my save data';
    startButton.onclick = (e) => {
      window.open(migrateUrl);
    };
    startP.appendChild(startButton);
    out.appendChild(startP);

    window.onmessage = (/** @type {MessageEvent}*/ e) => {
      console.log('message', e.origin, e.data); // %%%
      if (e.origin !== migrateOrigin) return;
      switch (e.data.type) {
        case 'migrate':
          (async () => {
            try {
              const payload = e.data.payload;
              console.log('payload', payload); // %%%
              await dbImport(payload);
              const doneP = document.createElement('p');
              doneP.textContent = 'Done, returning.';
              out.appendChild(doneP);
              /** @type {WindowProxy} */ (e.source).close();
              const hashStr = sessionStorage.getItem('receive_hash_str') || '';
              location.replace(`${doneUrl}${hashStr}`);
            } catch (e) {
              reportError(e);
              const errorP = document.createElement('p');
              errorP.textContent = `⛔ ${e}`;
              out.appendChild(errorP);
            }
          })();
          break;
      }
    };
  } catch (e) {
    reportError(e);
    const errorP = document.createElement('p');
    errorP.textContent = `⛔ ${e}`;
    out.appendChild(errorP);
  }
})();
