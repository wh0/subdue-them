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

async function dbOpen() {
  const openReq = indexedDB.open('omni', 1);
  const openReqSuccess = dbReqSuccess(openReq);
  openReq.onupgradeneeded = (e) => {
    const db = openReq.result;
    if (e.oldVersion < 1) {
      const osMisc = db.createObjectStore('misc');
      osMisc.add(null, 'last_daily_game');
      osMisc.add(/** @type {TotalsInfo} */ ({opened: 0, attempts: 0, solved: 0}), 'daily_totals');
      osMisc.add(/** @type {TotalsInfo} */ ({opened: 0, attempts: 0, solved: 0}), 'bonus_totals');
      osMisc.add(null, 'personal_bonus_game');
      db.createObjectStore('bonus_games', {keyPath: 'index'});
    }
  };
  return await openReqSuccess;
}

const out = /** @type {HTMLDivElement} */ (document.getElementById('out'));

async function dbExport() {
  const db = await dbOpen();
  const tx = db.transaction(['misc', 'bonus_games']);
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const osBonusGames = tx.objectStore('bonus_games');
  const miscEntries = await new Promise((resolve, reject) => {
    const /** @type {{key: IDBValidKey, value: any}[]} */ entries = [];
    const miscReq = osMisc.openCursor();
    miscReq.onerror = (e) => {
      reject(miscReq.error);
    };
    miscReq.onsuccess = (e) => {
      if (!miscReq.result) {
        resolve(entries);
        return;
      }
      entries.push({key: miscReq.result.primaryKey, value: miscReq.result.value});
      miscReq.result.continue();
    };
  });
  const /** @type {any[]} */ bonusGames = await new Promise((resolve, reject) => {
    const bonusGamesReq = osBonusGames.getAll();
    bonusGamesReq.onerror = (e) => {
      reject(bonusGamesReq.error);
    };
    bonusGamesReq.onsuccess = (e) => {
      resolve(bonusGamesReq.result);
    };
  });
  await txComplete;
  return {miscEntries, bonusGames};
}

const receiveOrigin = 'https://wh0.github.io';

(async () => {
  try {
    if (!opener) throw new Error('no opener');
    const payload = await dbExport();
    console.log('payload', payload); // %%%
    opener.postMessage({type: 'migrate', payload}, receiveOrigin);
    const doneP = document.createElement('p');
    doneP.textContent = 'Save data sent. You can close this window.';
    out.appendChild(doneP);
  } catch (e) {
    reportError(e);
    const errorP = document.createElement('p');
    errorP.textContent = `⛔ ${e}`;
    out.appendChild(errorP);
  }
})();
