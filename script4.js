function randDeterministic(/** @type {number} */ seed) {
  let randState = seed;
  function rand() {
    // based on minstd_rand0
    // https://en.cppreference.com/w/cpp/numeric/random/linear_congruential_engine
    randState = (randState * 16807 % 0x7fffffff);
    return randState;
  }
  return rand;
}

function randRange(/** @type {() => number} */ rand, /** @type {number} */ minInclusive, /** @type {number} */ maxExclusive) {
  return minInclusive + rand() % (maxExclusive - minInclusive);
}

function randRangeRound(/** @type {() => number} */ rand, /** @type {number} */ minInclusive, /** @type {number} */ maxExclusive) {
  let commonZeros = 0;
  let lo = minInclusive;
  let hi = maxExclusive;
  while (lo >= 100) {
    const loDiv = Math.ceil(lo / 10);
    const hiDiv = Math.ceil(hi / 10);
    if (loDiv >= hiDiv) break;
    lo = loDiv;
    hi = hiDiv;
    commonZeros++;
  }
  if (lo >= 100) {
    const r = randRange(rand, lo, hi);
    let exp = 1;
    for (let i = 0; i < commonZeros; i++) {
      exp *= 10;
    }
    return r * exp;
  }
  let hiZeros = 0;
  while (hi > 100) {
    hi = Math.ceil(hi / 10);
    hiZeros++;
  }
  hi += 90 * hiZeros;
  let r = randRange(rand, lo, hi);
  let exp = 1;
  while (r >= 100) {
    r -= 90;
    exp *= 10;
  }
  for (let i = 0; i < commonZeros; i++) {
    exp *= 10;
  }
  return r * exp;
}

function randCSU16() {
  const bits = new Uint16Array(1);
  crypto.getRandomValues(bits);
  return bits[0];
}

function sortNumeric(/** @type {number[]} */ a) {
  return a.sort((x, y) => x - y);
}

/** @template T */
function shuffle(/** @type {() => number} */ rand, /** @type {T[]} */ a) {
  for (let i = 0; i < a.length - 1; i++) {
    const j = randRange(rand, i, a.length);
    const v = a[j];
    a[j] = a[i];
    a[i] = v;
  }
}

const startScore = 2;

function optAlt(/** @type {number[]} */ a, /** @type {number[]} */ m) {
  function sim(/** @type {number} */ score, /** @type {number} */ f) {
    let s = score * f;
    for (const v of a) {
      if (v < score) continue;
      if (v >= s) break;
      s += v;
    }
    return s;
  }
  const subs = new Array(1 << m.length);
  function subOptMem(/** @type {number} */ x) {
    const sub = subs[x];
    if (sub) return sub;
    return subs[x] = subOpt(x);
  }
  function subOpt(/** @type {number} */ x) {
    if (x === 0) return {s: sim(startScore, 1), prev: -1};
    const best = {s: 0, prev: -1};
    for (let i = m.length; i--; ) {
      const b = 1 << i;
      if (!(x & b)) continue;
      const y = x & ~b;
      const sub = subOptMem(y);
      const s = sim(sub.s, m[i]);
      if (s > best.s) {
        best.s = s;
        best.prev = i;
      }
    }
    return best;
  }
  const subsAlt = new Array(1 << m.length);
  function subOptAltMem(/** @type {number} */ x) {
    const subAlt = subsAlt[x];
    if (subAlt) return subAlt;
    return subsAlt[x] = subOptAlt(x);
  }
  function subOptAlt(/** @type {number} */ x) {
    if (x === 0) return {s: 0, prev: -1, alt: false};
    const best = {s: 0, prev: -1, alt: false};
    const subX = subOptMem(x);
    for (let i = m.length; i--; ) {
      const b = 1 << i;
      if (!(x & b)) continue;
      const y = x & ~b;
      const sub = subOptMem(y);
      const s = sim(sub.s, m[i]);
      if (s < subX.s) {
        if (s > best.s) {
          best.s = s;
          best.prev = i;
          best.alt = false;
        }
      } else {
        const subAlt = subOptAltMem(y);
        const sAlt = sim(subAlt.s, m[i]);
        if (sAlt > best.s) {
          best.s = sAlt;
          best.prev = i;
          best.alt = true;
        }
      }
    }
    return best;
  }
  const r = {
    s: 0,
    p: new Array(m.length),
    sa: 0,
    pa: new Array(m.length),
  };
  {
    let x = (1 << m.length) - 1;
    for (let d = m.length; d--; ) {
      const sub = subOptMem(x);
      if (d === m.length - 1) {
        r.s = sub.s;
      }
      const i = sub.prev;
      r.p[d] = m[i];
      const b = 1 << i;
      x = x & ~b;
    }
  }
  {
    let x = (1 << m.length) - 1;
    let alt = true;
    for (let d = m.length; d--; ) {
      let i;
      if (alt) {
        const subAlt = subOptAltMem(x);
        if (d === m.length - 1) {
          r.sa = subAlt.s;
        }
        i = subAlt.prev;
        r.pa[d] = m[subAlt.prev];
        alt = subAlt.alt;
      } else {
        const sub = subOptMem(x);
        i = sub.prev;
        r.pa[d] = m[sub.prev];
      }
      const b = 1 << i;
      x = x & ~b;
    }
  }
  return r;
}

/** @typedef {{type: 'add', v: number, boss?: true}} AddItem */
/** @typedef {{type: 'mul', f: number}} MulItem */
/** @typedef {AddItem | MulItem} Item */

function generate(/** @type {() => number} */ rand, /** @type {number} */ maxMInclusive, /** @type {number} */ numA) {
  const numARand = numA - 1;
  const aRand = new Array(numARand);
  let aBoss = 0;
  const m = [];
  for (let f = 2; f <= maxMInclusive; f++) {
    m.push(f);
  }
  console.log('m', m);
  let rerollA = 0;
  let ceil = startScore;
  for (const f of m) {
    ceil *= f;
  }
  for (let i = 0; i < numARand; i++) {
    ceil *= 2;
  }
  console.log('ceil', ceil);
  let stabilization = 0;
  while (rerollA < numARand) {
    if (++stabilization > 10) throw new Error('Exceedingly bad luck');
    console.log('stabilization pass', stabilization); // %%%
    for (let i = rerollA; i < numARand; i++) {
      aRand[i] = randRangeRound(rand, 1, ceil);
    }
    sortNumeric(aRand);
    const r = optAlt(aRand, m);
    for (; rerollA < numARand; rerollA++) {
      if (aRand[rerollA] >= r.s) break;
    }
    if (rerollA >= numARand) {
      const floor = Math.max(aRand[numARand - 1] + 1, r.sa);
      aBoss = randRangeRound(rand, floor, r.s);
    }
  }
  // see Rule S

  let /** @type {Item[]} */ items = [];
  for (const f of m) {
    items.push({type: 'mul', f});
  }
  for (const v of aRand) {
    items.push({type: 'add', v});
  }
  shuffle(rand, items);
  items.push({type: 'add', v: aBoss, boss: true});
  return items;
}

const minWidth = 360 - 2 * 4;
const widthRatio = 2812 / 2048; // from Segoe UI Emoji
const scaleVLow = 1;
const scaleVHigh = 7431782400; // 10! * 2 * 2^10
const scaleSizeLow = 16;
const scaleSizeHigh = (minWidth - 2 * 6) / widthRatio;
const scaleExp = Math.log(scaleSizeHigh / scaleSizeLow) / Math.log(scaleVHigh / scaleVLow);
console.log('scale', 'inv exp', 1 / scaleExp); // %%%

function scaleSize(/** @type {number} */ v) {
  return Math.pow(v, scaleExp) * scaleSizeLow;
}

/**
  @typedef {{
    item: Item,
    itemEmoji: string,
    itemSize: number,
    chunkWidth: number,
    sceneryEmojiLeft: string[],
    sceneryEmojiRight: string[],
  }} DecorItem
*/

function decorate(/** @type {() => number} */ rand, /** @type {Item[]} */ items) {
  const unusedAddEmoji = ['🐒', '🐕', '🐩', '🐈', '🐅', '🐆', '🐎', '🐂', '🐃', '🐄', '🐖', '🐏', '🐑', '🐐', '🐪', '🐫', '🐘', '🐁', '🐀', '🐇', '🐓', '🐥', '🐊', '🐢', '🐍', '🐉', '🐋', '🐬', '🐟', '🐠', '🐡', '🐙', '🐌', '🐛', '🐜', '🐝', '🐞'];
  const unusedMulEmoji = ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🍠', '🍡', '🍦', '🍧', '🍨', '🍩', '🍪', '🍰', '🍫', '🍬', '🍭', '🍮'];
  const commonSceneryEmoji = ['🌲', '🌳', '🏠'];
  const unusedRareSceneryEmoji = ['🌹', '🌻', '🌼', '🌷', '🌱', '🌴', '🌵', '🌾', '🍄', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🎡', '🎪'];

  function useOne(/** @type {string[]} */ unused) {
    const i = randRange(rand, 0, unused.length);
    const used = unused[i];
    unused[i] = unused[unused.length - 1];
    unused.pop();
    return used;
  }

  function selectSceneryEmoji() {
    if (unusedRareSceneryEmoji.length && randRange(rand, 0, 5) === 0) {
      return useOne(unusedRareSceneryEmoji);
    }
    return commonSceneryEmoji[randRange(rand, 0, commonSceneryEmoji.length)];
  }

  const /** @type {DecorItem[]} */ decorItems = [];
  for (const item of items) {
    let itemSize;
    let itemEmoji;
    switch (item.type) {
      case 'add':
        itemSize = scaleSize(item.v);
        itemEmoji = useOne(unusedAddEmoji);
        break;
      case 'mul':
        itemSize = scaleSizeLow;
        itemEmoji = useOne(unusedMulEmoji);
        break;
    }
    const chunkWidth = itemSize * widthRatio + 2 * 6;
    decorItems.push({
      item,
      itemEmoji,
      itemSize,
      chunkWidth,
      sceneryEmojiLeft: [],
      sceneryEmojiRight: [],
    });
  }
  const numScenery = items.length * 2;
  for (let j = 0; j < numScenery; j++) {
    const i = randRange(rand, 0, items.length);
    const widthWithScenery = decorItems[i].chunkWidth + 4 + scaleSizeLow * widthRatio;
    if (widthWithScenery > minWidth) continue;
    decorItems[i].chunkWidth = widthWithScenery;
    if (randRange(rand, 0, 2) === 0) {
      decorItems[i].sceneryEmojiLeft.push(selectSceneryEmoji());
    } else {
      decorItems[i].sceneryEmojiRight.push(selectSceneryEmoji());
    }
  }
  return decorItems;
}

/**
  @typedef {{
    recordAttempt: () => void,
    recordSolve: () => void,
    title: string,
    getStats: () => Promise<string>,
    shareNeedsInitials: boolean,
    shareOfferInitials: (initials: string) => Promise<void>,
    share: (shareExtra: string) => Promise<void>,
    dailyGameAvailable: boolean,
    dailyGameGo: () => void,
    skipDailyGameAvailable: boolean,
    skipDailyGameGo: () => void,
    personalBonusGameGetAvailable: () => Promise<boolean>,
    personalBonusGameGo: () => void,
  }} Extra
*/

function render(/** @type {Node} */ dst, /** @type {DecorItem[]} */ decorItems, /** @type {Extra} */ extra) {
  const playerEmoji = '🚚';
  const shareEmoji = ['✅', '☑️', '✔️', '🆗', '❤️', '💕', '❓', '❗', '‼️', '😟', '😟', '😟', '😘', '😟'];
  const attentionDotSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><circle cx="3" cy="3" r="3" fill="%23e00000" /></svg>';
  const attentionTriSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><path d="m 3 6 l 2.5 -4.5 h -5 z" fill="%23e00000" /></svg>';

  const /** @type {(() => void)[]} */ stepsGameEnd = [];
  const /** @type {(() => void)[]} */ stepsGameReset = [];

  let numAdd = 0;
  for (const decorItem of decorItems) {
    if (decorItem.item.type === 'add') {
      numAdd++;
    }
  }

  let score = startScore;
  let numRemaining = numAdd;
  let shareExtra = '';
  let attempted = false;

  stepsGameReset.push(() => {
    score = startScore;
    numRemaining = numAdd;
    shareExtra = '';
    attempted = false;
  });

  function gameEndCommon() {
    for (const step of stepsGameEnd) {
      step();
    }
  }

  function gameEndLose() {
    gameEndCommon();
    playerGameEndLose();
  }

  function gameEndWin() {
    gameEndCommon();
    playerGameEndWin();
    extra.recordSolve();
    statsUpdate();
    personalBonusGameUpdate();
  }

  function gameReset() {
    for (const step of stepsGameReset) {
      step();
    }
  }

  function renderItemAdd(/** @type {Node} */ dst, /** @type {AddItem} */ item, /** @type {string} */ emoji, /** @type {number} */ size) {
    const itemButton = document.createElement('button');
    itemButton.className = 'item item-add';
    if (item.boss) {
      itemButton.classList.add('boss');
    }
    const ensureLastBaselineDiv = document.createElement('div');
    ensureLastBaselineDiv.className = 'ensure-last-baseline';
    const itemIcon = document.createElement('span');
    itemIcon.className = 'icon icon-add-enabled';
    itemIcon.textContent = emoji;
    itemIcon.style.fontSize = `${size}px`;
    ensureLastBaselineDiv.appendChild(itemIcon);
    ensureLastBaselineDiv.appendChild(document.createElement('br'));
    ensureLastBaselineDiv.appendChild(document.createTextNode(item.v.toLocaleString()));
    if (item.boss) {
      ensureLastBaselineDiv.appendChild(document.createTextNode(' '));
      const bossSpan = document.createElement('span');
      bossSpan.className = 'label label-boss';
      bossSpan.textContent = 'BOSS';
      ensureLastBaselineDiv.appendChild(bossSpan);
    }
    itemButton.appendChild(ensureLastBaselineDiv);
    itemButton.onclick = (e) => {
      if (!attempted) {
        attempted = true;
        extra.recordAttempt();
        statsUpdate();
      }
      if (item.v >= score) {
        if (shareExtra) {
          shareExtra += ' ';
        }
        shareExtra += `${score.toLocaleString()} <= ${emoji}`;
        gameEndLose();
        itemIcon.className = 'icon icon-add-win';
      } else {
        itemButton.disabled = true;
        itemIcon.className = 'icon icon-add-disabled';
        if (item.boss) {
          // clear out previous to avoid spoilers
          shareExtra = `${score.toLocaleString()} > ${emoji}`;
        } else {
          shareExtra += emoji;
        }
        score += item.v;
        playerUpdateScoreGrow();
        if (!--numRemaining) {
          gameEndWin();
        }
      }
    };
    dst.appendChild(itemButton);
    stepsGameEnd.push(() => {
      itemButton.disabled = true;
    });
    stepsGameReset.push(() => {
      itemIcon.className = 'icon icon-add-enabled';
      itemButton.disabled = false;
    });
  }

  function renderItemMul(/** @type {Node} */ dst, /** @type {MulItem} */ item, /** @type {string} */ emoji) {
    const itemButton = document.createElement('button');
    itemButton.className = 'item item-mul';
    const ensureLastBaselineDiv = document.createElement('div');
    ensureLastBaselineDiv.className = 'ensure-last-baseline';
    const itemIcon = document.createElement('span');
    itemIcon.className = 'icon icon-mul-enabled';
    itemIcon.textContent = emoji;
    ensureLastBaselineDiv.appendChild(itemIcon);
    ensureLastBaselineDiv.appendChild(document.createElement('br'));
    ensureLastBaselineDiv.appendChild(document.createTextNode(`×${item.f.toLocaleString()}`));
    itemButton.appendChild(ensureLastBaselineDiv);
    itemButton.onclick = (e) => {
      if (!attempted) {
        attempted = true;
        extra.recordAttempt();
        statsUpdate();
      }
      itemButton.disabled = true;
      itemIcon.className = 'icon icon-mul-disabled';
      shareExtra += emoji;
      score *= item.f;
      playerUpdateScoreGrow();
    };
    dst.appendChild(itemButton);
    stepsGameEnd.push(() => {
      itemButton.disabled = true;
    });
    stepsGameReset.push(() => {
      itemIcon.className = 'icon icon-mul-enabled';
      itemButton.disabled = false;
    });
  }

  function renderScenery(/** @type {Node} */ dst, /** @type {string} */ emoji) {
    const sceneryDiv = document.createElement('div');
    sceneryDiv.className = 'scenery';
    const sceneryIcon = document.createElement('span');
    sceneryIcon.className = 'icon icon-scenery';
    sceneryIcon.textContent = emoji;
    sceneryDiv.appendChild(sceneryIcon);
    sceneryDiv.appendChild(document.createElement('br'));
    const strutSpan = document.createElement('span');
    strutSpan.className = 'strut';
    strutSpan.textContent = '\ufeff';
    sceneryDiv.appendChild(strutSpan);
    dst.appendChild(sceneryDiv);
  }

  const stickyTrackDiv = document.createElement('div');
  stickyTrackDiv.className = 'sticky-track';

  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'items';
  for (const decorItem of decorItems) {
    const chunkSpan = document.createElement('span');
    chunkSpan.className = 'chunk';
    for (const sceneryEmoji of decorItem.sceneryEmojiLeft) {
      renderScenery(chunkSpan, sceneryEmoji);
      chunkSpan.appendChild(document.createTextNode(' '));
    }
    switch (decorItem.item.type) {
      case 'add':
        renderItemAdd(chunkSpan, decorItem.item, decorItem.itemEmoji, decorItem.itemSize);
        break;
      case 'mul':
        renderItemMul(chunkSpan, decorItem.item, decorItem.itemEmoji);
        break;
    }
    for (const sceneryEmoji of decorItem.sceneryEmojiRight) {
      chunkSpan.appendChild(document.createTextNode(' '));
      renderScenery(chunkSpan, sceneryEmoji);
    }
    itemsDiv.appendChild(chunkSpan);
    itemsDiv.appendChild(document.createTextNode(' '));
  }
  stickyTrackDiv.appendChild(itemsDiv);

  const stickySpaceDiv = document.createElement('div');
  stickySpaceDiv.className = 'sticky-space';
  stickyTrackDiv.appendChild(stickySpaceDiv);
  const stickyDiv = document.createElement('div');
  stickyDiv.className = 'sticky';
  const playerSpaceDiv = document.createElement('div');
  playerSpaceDiv.className = 'player-space';

  const playerDiv = document.createElement('div');
  playerDiv.className = 'player';
  const playerScaling = document.createElement('span');
  playerScaling.className = 'player-scaling';
  const playerIcon = document.createElement('span');
  playerIcon.className = 'icon icon-player-playing';
  playerIcon.textContent = playerEmoji;
  playerIcon.style.fontSize = `${scaleSizeHigh}px`;
  playerScaling.appendChild(playerIcon);
  playerDiv.appendChild(playerScaling);
  playerDiv.appendChild(document.createElement('br'));
  const playerScoreSpan = document.createElement('span');
  playerScoreSpan.className = 'player-score';
  playerDiv.appendChild(playerScoreSpan);

  function playerUpdateScore() {
    const size = scaleSize(score);
    const scale = size / scaleSizeHigh;
    playerScaling.style.transform = `scale(${scale})`;
    playerScoreSpan.textContent = score.toLocaleString();
  }

  function playerUpdateScoreGrow() {
    playerScaling.className = 'player-scaling player-scaling-grow';
    playerUpdateScore();
  }

  stepsGameReset.push(() => {
    playerIcon.className = 'icon icon-player-playing';
    playerScaling.className = 'player-scaling';
    playerUpdateScore();
  });

  function playerGameEndLose() {
    playerIcon.className = 'icon icon-player-lose';
  }

  function playerGameEndWin() {
    playerIcon.className = 'icon icon-player-win';
  }

  playerUpdateScore();

  playerSpaceDiv.appendChild(playerDiv);
  stickyDiv.appendChild(playerSpaceDiv);
  stickyTrackDiv.appendChild(stickyDiv);
  dst.appendChild(stickyTrackDiv);

  const titleH1 = document.createElement('h1');
  titleH1.className = 'title';
  titleH1.textContent = extra.title;
  dst.appendChild(titleH1);

  const statsP = document.createElement('p');
  statsP.className = 'stats';

  function statsUpdate() {
    (async () => {
      try {
        const stats = await extra.getStats();
        statsP.textContent = stats;
      } catch (e) {
        reportError(e);
      }
    })();
  }

  statsUpdate();
  dst.appendChild(statsP);

  const controlsSpan = document.createElement('span');
  controlsSpan.className = 'controls';

  const resetButton = document.createElement('button');
  resetButton.className = 'control';
  resetButton.textContent = 'Restart';
  resetButton.onclick = (e) => {
    gameReset();
  };
  controlsSpan.appendChild(resetButton);

  let shareEmojiIndex = 0;

  function shareEmojiPick() {
    const used = shareEmoji[shareEmojiIndex];
    if (shareEmojiIndex < shareEmoji.length - 1) {
      shareEmojiIndex++;
    }
    return used;
  }

  stepsGameReset.push(() => {
    shareEmojiIndex = 0;
  });

  controlsSpan.appendChild(document.createTextNode(' '));
  if (extra.shareNeedsInitials) {
    let initialsOffered = false;
    const shareSpan = document.createElement('span');
    shareSpan.hidden = true;
    const shareForm = document.createElement('form');
    shareForm.className = 'control-inline-form';
    shareForm.onsubmit = (e) => {
      e.preventDefault();
      const initialsRaw = shareInitialsInput.value;
      (async () => {
        if (!initialsOffered) {
          try {
            const initials = (initialsRaw.toUpperCase().replace(/[^A-Z ]/g, '') + '  ').slice(0, 3);
            await extra.shareOfferInitials(initials);
          } catch (e) {
            reportError(e);
            shareResultSpan.textContent = 'Problem saving initials';
            return;
          }
          shareInitialsInput.disabled = true;
          initialsOffered = true;
        }
        try {
          await extra.share(shareExtra);
        } catch (e) {
          reportError(e);
          shareResultSpan.textContent = 'Problem copying';
          return;
        }
        shareResultSpan.textContent = `Copied outcome ${shareEmojiPick()}`;
      })();
    };
    const shareInitialsInput = document.createElement('input');
    shareInitialsInput.className = 'control-input-text';
    shareInitialsInput.minLength = 1;
    shareInitialsInput.maxLength = 3;
    shareInitialsInput.size = 5;
    shareInitialsInput.required = true;
    shareInitialsInput.placeholder = 'Initials';
    shareInitialsInput.onfocus = (e) => {
      shareAttentionDotImg.hidden = true;
      shareAttentionTriImg.hidden = true;
    };
    shareInitialsInput.oninput = (e) => {
      const cleanValue = shareInitialsInput.value.toUpperCase().replace(/[^A-Z ]/g, '');
      shareInitialsInput.value = cleanValue;
      if (cleanValue && !/^[A-Z]/.test(shareInitialsInput.value)) {
        shareInitialsInput.setCustomValidity('This has to start with a letter.');
      } else {
        shareInitialsInput.setCustomValidity('');
      }
    };
    shareForm.appendChild(shareInitialsInput);
    const shareAttentionDotImg = document.createElement('img');
    shareAttentionDotImg.className = 'attention-dot';
    shareAttentionDotImg.src = attentionDotSrc;
    shareForm.appendChild(shareAttentionDotImg);
    const shareAttentionTriImg = document.createElement('img');
    shareAttentionTriImg.className = 'attention-tri';
    shareAttentionTriImg.src = attentionTriSrc;
    shareForm.appendChild(shareAttentionTriImg);
    shareForm.appendChild(document.createTextNode(' '));
    const shareButton = document.createElement('button');
    shareButton.className = 'control';
    shareButton.type = 'submit';
    shareButton.textContent = 'Share';
    shareForm.appendChild(shareButton);
    shareSpan.appendChild(shareForm);
    shareSpan.appendChild(document.createTextNode(' '));
    const shareResultSpan = document.createElement('span');
    shareSpan.appendChild(shareResultSpan);
    controlsSpan.appendChild(shareSpan);
    stepsGameEnd.push(() => {
      shareSpan.hidden = false;
    });
    stepsGameReset.push(() => {
      shareSpan.hidden = true;
      shareResultSpan.innerHTML = '';
    });
  } else {
    const shareSpan = document.createElement('span');
    shareSpan.hidden = true;
    const shareButton = document.createElement('button');
    shareButton.className = 'control';
    shareButton.textContent = 'Share';
    shareButton.onfocus = (e) => {
      shareAttentionDotImg.hidden = true;
      shareAttentionTriImg.hidden = true;
    };
    shareButton.onclick = (e) => {
      (async () => {
        try {
          await extra.share(shareExtra);
        } catch (e) {
          reportError(e);
          shareResultSpan.textContent = 'Problem copying';
        }
        shareResultSpan.textContent = `Copied outcome ${shareEmojiPick()}`;
      })();
    };
    shareSpan.appendChild(shareButton);
    const shareAttentionDotImg = document.createElement('img');
    shareAttentionDotImg.className = 'attention-dot';
    shareAttentionDotImg.src = attentionDotSrc;
    shareSpan.appendChild(shareAttentionDotImg);
    const shareAttentionTriImg = document.createElement('img');
    shareAttentionTriImg.className = 'attention-tri';
    shareAttentionTriImg.src = attentionTriSrc;
    shareSpan.appendChild(shareAttentionTriImg);
    shareSpan.appendChild(document.createTextNode(' '));
    const shareResultSpan = document.createElement('span');
    shareSpan.appendChild(shareResultSpan);
    controlsSpan.appendChild(shareSpan);
    stepsGameEnd.push(() => {
      shareSpan.hidden = false;
    });
    stepsGameReset.push(() => {
      shareSpan.hidden = true;
      shareResultSpan.innerHTML = '';
    });
  }

  if (extra.dailyGameAvailable) {
    controlsSpan.appendChild(document.createTextNode(' '));
    const dailyGameButton = document.createElement('button');
    dailyGameButton.className = 'control';
    dailyGameButton.textContent = 'Daily game';
    dailyGameButton.onclick = (e) => {
      extra.dailyGameGo();
    };
    controlsSpan.appendChild(dailyGameButton);
  }

  if (extra.skipDailyGameAvailable) {
    controlsSpan.appendChild(document.createTextNode(' '));
    const skipDailyGameButton = document.createElement('button');
    skipDailyGameButton.className = 'control';
    skipDailyGameButton.textContent = 'Skip to today\'s game...';
    skipDailyGameButton.onclick = (e) => {
      skipDailyGameConfirmSpan.hidden = false;
    };
    controlsSpan.appendChild(skipDailyGameButton);
    controlsSpan.appendChild(document.createTextNode(' '));
    const skipDailyGameConfirmSpan = document.createElement('span');
    skipDailyGameConfirmSpan.hidden = true;
    skipDailyGameConfirmSpan.textContent = 'You won\'t be able to return to this game. ';
    const skipDailyGameSkipButton = document.createElement('button');
    skipDailyGameSkipButton.className = 'control';
    skipDailyGameSkipButton.textContent = 'Skip';
    skipDailyGameSkipButton.onclick = (e) => {
      extra.skipDailyGameGo();
    };
    skipDailyGameConfirmSpan.appendChild(skipDailyGameSkipButton);
    skipDailyGameConfirmSpan.appendChild(document.createTextNode(' '));
    const skipDailyGameCancelButton = document.createElement('button');
    skipDailyGameCancelButton.className = 'control';
    skipDailyGameCancelButton.textContent = 'Cancel';
    skipDailyGameCancelButton.onclick = (e) => {
      skipDailyGameConfirmSpan.hidden = true;
    };
    skipDailyGameConfirmSpan.appendChild(skipDailyGameCancelButton);
    controlsSpan.appendChild(skipDailyGameConfirmSpan);
  }

  controlsSpan.appendChild(document.createTextNode(' '));
  const personalBonusGameButton = document.createElement('button');
  personalBonusGameButton.className = 'control';
  personalBonusGameButton.hidden = true;
  personalBonusGameButton.textContent = 'Personal bonus game';
  personalBonusGameButton.onclick = (e) => {
    extra.personalBonusGameGo();
  };

  function personalBonusGameUpdate() {
    (async () => {
      const available = await extra.personalBonusGameGetAvailable();
      if (available) {
        personalBonusGameButton.hidden = false;
      } else {
        personalBonusGameButton.hidden = true;
      }
    })();
  }

  personalBonusGameUpdate();
  controlsSpan.appendChild(personalBonusGameButton);

  dst.appendChild(controlsSpan);
}

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

async function dbDailyGameOffer(/** @type {number} */ index, /** @type {boolean} */ advanceUnsolved) {
  const db = await dbOpen();
  const tx = db.transaction(['misc'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  let /** @type {DailyGameInfo | null} */ lastDailyGame = await dbReqSuccess(osMisc.get('last_daily_game'));
  const /** @type {TotalsInfo} */ dailyTotals = await dbReqSuccess(osMisc.get('daily_totals'));
  if (lastDailyGame && lastDailyGame.index >= index) return;
  if (lastDailyGame && !lastDailyGame.solved && !advanceUnsolved) return;
  lastDailyGame = {index, attempts: 0, solved: false};
  dailyTotals.opened++;
  osMisc.put(lastDailyGame, 'last_daily_game');
  osMisc.put(dailyTotals, 'daily_totals');
  await txComplete;
}

async function dbDailyGameLastIndex() {
  const db = await dbOpen();
  const tx = db.transaction(['misc']);
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {DailyGameInfo | null} */ lastDailyGame = await dbReqSuccess(osMisc.get('last_daily_game'));
  await txComplete;
  if (!lastDailyGame) return null;
  return lastDailyGame.index;
}

async function dbDailyGameRecordAttempt(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {DailyGameInfo | null} */ lastDailyGame = await dbReqSuccess(osMisc.get('last_daily_game'));
  const /** @type {TotalsInfo} */ dailyTotals = await dbReqSuccess(osMisc.get('daily_totals'));
  if (!lastDailyGame || lastDailyGame.index !== index || lastDailyGame.solved) return;
  lastDailyGame.attempts++;
  dailyTotals.attempts++;
  osMisc.put(lastDailyGame, 'last_daily_game');
  osMisc.put(dailyTotals, 'daily_totals');
  await txComplete;
}

async function dbDailyGameRecordSolve(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {DailyGameInfo | null} */ lastDailyGame = await dbReqSuccess(osMisc.get('last_daily_game'));
  const /** @type {TotalsInfo} */ dailyTotals = await dbReqSuccess(osMisc.get('daily_totals'));
  if (!lastDailyGame || lastDailyGame.index !== index || lastDailyGame.solved) return;
  lastDailyGame.solved = true;
  dailyTotals.solved++;
  osMisc.put(lastDailyGame, 'last_daily_game');
  osMisc.put(dailyTotals, 'daily_totals');
  await txComplete;
}

async function dbDailyGameGetStats(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc']);
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {DailyGameInfo | null} */ lastDailyGame = await dbReqSuccess(osMisc.get('last_daily_game'));
  const /** @type {TotalsInfo} */ dailyTotals = await dbReqSuccess(osMisc.get('daily_totals'));
  await txComplete;
  let dailyGame = null;
  if (lastDailyGame && lastDailyGame.index === index) {
    dailyGame = lastDailyGame;
  }
  return {dailyGame, dailyTotals};
}

async function dbPersonalBonusGameGetInfo() {
  const db = await dbOpen();
  const tx = db.transaction(['misc']);
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {PersonalBonusGameInfo | null} */ personalBonusGame = await dbReqSuccess(osMisc.get('personal_bonus_game'));
  await txComplete;
  return personalBonusGame;
}

async function dbPersonalBonusGameOffer(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  let /** @type {PersonalBonusGameInfo | null} */ personalBonusGame = await dbReqSuccess(osMisc.get('personal_bonus_game'));
  if (personalBonusGame !== null) return;
  personalBonusGame = {index, initials: null};
  osMisc.put(personalBonusGame, 'personal_bonus_game');
  await txComplete;
}

async function dbPersonalBonusGameOfferInitials(/** @type {string} */ initials) {
  const db = await dbOpen();
  const tx = db.transaction(['misc'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const /** @type {PersonalBonusGameInfo | null} */ personalBonusGame = await dbReqSuccess(osMisc.get('personal_bonus_game'));
  if (!personalBonusGame || personalBonusGame.initials !== null) return;
  personalBonusGame.initials = initials;
  osMisc.put(personalBonusGame, 'personal_bonus_game');
  await txComplete;
}

async function dbBonusGameOffer(/** @type {number} */ index, /** @type {string} */ sharerInitials, /** @type {number} */ now) {
  const db = await dbOpen();
  const tx = db.transaction(['misc', 'bonus_games'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const osBonusGames = tx.objectStore('bonus_games');
  let /** @type {BonusGameInfo | undefined} */ bonusGame = await dbReqSuccess(osBonusGames.get(index));
  const /** @type {TotalsInfo} */ bonusTotals = await dbReqSuccess(osMisc.get('bonus_totals'));
  if (bonusGame) return;
  bonusGame = {index, firstSharerInitials: sharerInitials, firstReceivedDate: now, attempts: 0, solved: false};
  bonusTotals.opened++;
  osBonusGames.put(bonusGame);
  osMisc.put(bonusTotals, 'bonus_totals');
  await txComplete;
}

async function dbBonusGameRecordAttempt(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc', 'bonus_games'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const osBonusGames = tx.objectStore('bonus_games');
  const /** @type {BonusGameInfo | undefined} */ bonusGame = await dbReqSuccess(osBonusGames.get(index));
  const /** @type {TotalsInfo} */ bonusTotals = await dbReqSuccess(osMisc.get('bonus_totals'));
  if (!bonusGame || bonusGame.solved) return;
  bonusGame.attempts++;
  bonusTotals.attempts++;
  osBonusGames.put(bonusGame);
  osMisc.put(bonusTotals, 'bonus_totals');
  await txComplete;
}

async function dbBonusGameRecordSolve(/** @type {number} */ index, /** @type {(e: Error) => void} */ errCb) {
  const db = await dbOpen();
  const tx = db.transaction(['misc', 'bonus_games'], 'readwrite');
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const osBonusGames = tx.objectStore('bonus_games');
  const /** @type {BonusGameInfo | undefined} */ bonusGame = await dbReqSuccess(osBonusGames.get(index));
  const /** @type {TotalsInfo} */ bonusTotals = await dbReqSuccess(osMisc.get('bonus_totals'));
  if (!bonusGame || bonusGame.solved) return;
  bonusGame.solved = true;
  bonusTotals.solved++;
  osBonusGames.put(bonusGame);
  osMisc.put(bonusTotals, 'bonus_totals');
  await txComplete;
}

async function dbBonusGameGetStats(/** @type {number} */ index) {
  const db = await dbOpen();
  const tx = db.transaction(['misc', 'bonus_games']);
  const txComplete = dbTxComplete(tx);
  db.close();
  const osMisc = tx.objectStore('misc');
  const osBonusGames = tx.objectStore('bonus_games');
  const /** @type {BonusGameInfo | undefined} */ bonusGame = await dbReqSuccess(osBonusGames.get(index));
  const /** @type {TotalsInfo} */ bonusTotals = await dbReqSuccess(osMisc.get('bonus_totals'));
  await txComplete;
  return {bonusGame, bonusTotals};
}

function dateString(/** @type {Date} */ d) {
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 101).toString().slice(1);
  const dd = (d.getDate() + 100).toString().slice(1);
  return `${yyyy}/${mm}/${dd}`;
}

function dailyCurrentIndex(/** @type {number} */ now) {
  const startDate = new Date(2025, 1, 28);
  const today = new Date(now);
  today.setHours(12);
  const diffMs = today.getTime() - startDate.getTime();
  const diffDays = diffMs / 86400000;
  const index = Math.floor(diffDays);
  const clampedIndex = Math.max(0, Math.min(9999, index));
  return clampedIndex;
}

function dailyDateFromIndex(/** @type {number} */ index) {
  const startDate = new Date(2025, 1, 28, 12);
  const diffMs = index * 86400000;
  const indexDate = new Date(startDate.getTime() + diffMs);
  return dateString(indexDate);
}

function personalBonusDrawIndex() {
  const d = new Date();
  d.setMonth(6);
  const z = d.getTimezoneOffset();
  const base = Math.floor((z / 1440 + 1) * 10000);
  const r = randCSU16() % 834;
  const e = 5657;
  const i = (base + r) * e % 10000;
  return i;
}

// retroactively found from https://oeis.org/A101592
const codeP = 9999999967;
// this ain't any high brow cryptography, just mix around the fields somewhat
// e1, e2, d1, d2 are chosen partially at random so that
// e1 * e2 * d1 * d2 = 1 mod p,
// p times each one is below 2^53, and
// e1 * e2 / p has several low numbers at the beginning of its continued fraction
const codeE1 = 34562;
const codeE2 = 185987;
const codeD1 = 184186;
const codeD2 = 31379;

function codeScramble(/** @type {number} */ vd) {
  // see Rule S
  return vd * codeE1 % codeP * codeE2 % codeP;
}

function codeUnscramble(/** @type {number} */ ve) {
  // see Rule S
  return ve * codeD1 % codeP * codeD2 % codeP;
}

function codeCharFromNumber(/** @type {number} */ n) {
  return n ? String.fromCharCode(64 + n) : ' ';
}

function codeNumberFromChar(/** @type {string} */ c) {
  return c === ' ' ? 0 : c.charCodeAt(0) - 64;
}

/** @typedef {{index: number, initials: string}} CodeInfo */

function codePack(/** @type {CodeInfo} */ info) {
  const n0 = codeNumberFromChar(info.initials[0]);
  const n1 = codeNumberFromChar(info.initials[1]);
  const n2 = codeNumberFromChar(info.initials[2]);
  const vd = info.index + 10000 * n0 + 270000 * n1 + 7290000 * n2;
  const ve = codeScramble(vd);
  return (10000000000 + ve).toString().slice(1);
}

function codeUnpack(/** @type {string} */ ves) {
  const ve = parseInt(ves, 10);
  if (ves !== '' + ve) throw new Error('Invalid code');
  const vd = codeUnscramble(ve);
  if (vd >= 196830000) throw new Error('Invalid code');
  const index = vd % 10000;
  const n0 = Math.floor(vd / 10000) % 27;
  const n1 = Math.floor(vd / 270000) % 27;
  const n2 = Math.floor(vd / 7290000);
  if (!n0) throw new Error('Invalid code');
  const initials = codeCharFromNumber(n0) + codeCharFromNumber(n1) + codeCharFromNumber(n2);
  return /** @type {CodeInfo} */ ({index, initials});
}

const out = /** @type {HTMLDivElement} */ (document.getElementById('out'));

function buildGame(/** @type {number} */ seed, /** @type {Extra} */ extra) {
  out.innerHTML = '';
  const rand = randDeterministic(seed);
  const items = generate(rand, 10, 10);
  const decorItems = decorate(rand, items);
  render(out, decorItems, extra);
}

const dailySeedBase = 1;
const bonusSeedBase = 10001;

function buildDailyGame(/** @type {number} */ index, /** @type {boolean} */ skipDailyGameAvailable) {
  const dailySeed = dailySeedBase + index;
  const dailyDate = dailyDateFromIndex(index);
  let /** @type {Promise<{dailyGame: DailyGameInfo | null, dailyTotals: TotalsInfo}>} */ statsPromised;
  const extra = {
    recordAttempt() {
      (async () => {
        try {
          await dbDailyGameRecordAttempt(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    recordSolve() {
      (async () => {
        try {
          await dbDailyGameRecordSolve(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    title: `Daily game\xa0#${index}`,
    async getStats() {
      statsPromised = dbDailyGameGetStats(index);
      const {dailyGame, dailyTotals} = await statsPromised;
      const stats = [];
      stats.push(`From ${dailyDate}.`);
      if (dailyGame) {
        if (dailyGame.solved) {
          stats.push('Fully subdued.');
        }
        stats.push(`${dailyGame.attempts}\xa0${dailyGame.attempts === 1 ? 'attempt' : 'attempts'}.`);
      }
      stats.push(`${dailyTotals.opened}\xa0daily ${dailyTotals.opened === 1 ? 'game' : 'games'} opened.`);
      stats.push(`${dailyTotals.solved}\xa0fully subdued.`);
      stats.push(`${dailyTotals.attempts}\xa0total ${dailyTotals.attempts === 1 ? 'attempt' : 'attempts'}.`);
      return stats.join(' ');
    },
    shareNeedsInitials: false,
    shareOfferInitials: /** @type {never} */ (null),
    async share(/** @type {string} */ shareExtra) {
      const shareLines = [];
      shareLines.push(`Subdue them #${index}`);
      if (shareExtra) {
        shareLines.push(shareExtra);
      }
      await navigator.clipboard.writeText(shareLines.join('\n'));
    },
    dailyGameAvailable: false,
    dailyGameGo: /** @type {never} */ (null),
    skipDailyGameAvailable,
    skipDailyGameGo() {
      const now = Date.now();
      (async () => {
        const currentIndex = dailyCurrentIndex(now);
        await dbDailyGameOffer(currentIndex, true);
        const index = /** @type {number} */ (await dbDailyGameLastIndex());
        buildDailyGame(index, false);
      })();
    },
    personalBonusGameGetAvailable: async () => {
      const {dailyTotals} = await statsPromised;
      return dailyTotals.solved > 0;
    },
    personalBonusGameGo() {
      const now = Date.now();
      (async () => {
        let personalBonusGame = await dbPersonalBonusGameGetInfo();
        if (!personalBonusGame) {
          const proposedIndex = personalBonusDrawIndex();
          await dbPersonalBonusGameOffer(proposedIndex);
          personalBonusGame = /** @type {PersonalBonusGameInfo} */ (await dbPersonalBonusGameGetInfo());
        }
        await dbBonusGameOffer(personalBonusGame.index, '(personal)', now);
        buildPersonalBonusGame(personalBonusGame.index, personalBonusGame.initials);
      })();
    },
  };
  buildGame(dailySeed, extra);
}

function buildPersonalBonusGame(/** @type {number} */ index, /** @type {string | null} */ initials) {
  const bonusSeed = bonusSeedBase + index;
  const extra = {
    recordAttempt() {
      (async () => {
        try {
          await dbBonusGameRecordAttempt(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    recordSolve() {
      (async () => {
        try {
          await dbBonusGameRecordSolve(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    title: `Bonus game\xa0#${index}`,
    async getStats() {
      const {bonusGame, bonusTotals} = await dbBonusGameGetStats(index);
      const stats = [];
      if (bonusGame) {
        if (bonusGame.firstSharerInitials === '(personal)') {
          stats.push(`First awarded as personal bonus game on ${dateString(new Date(bonusGame.firstReceivedDate))}.`);
        } else {
          stats.push(`First recieved from ${bonusGame.firstSharerInitials} on ${dateString(new Date(bonusGame.firstReceivedDate))}.`);
        }
        if (bonusGame.solved) {
          stats.push('Fully subdued.');
        }
        stats.push(`${bonusGame.attempts}\xa0${bonusGame.attempts === 1 ? 'attempt' : 'attempts'}.`);
      }
      stats.push(`${bonusTotals.opened}\xa0bonus ${bonusTotals.opened === 1 ? 'game' : 'games'} opened.`);
      stats.push(`${bonusTotals.solved}\xa0fully subdued.`);
      stats.push(`${bonusTotals.attempts}\xa0total ${bonusTotals.attempts === 1 ? 'attempt' : 'attempts'}.`);
      return stats.join(' ');
    },
    shareNeedsInitials: initials === null,
    async shareOfferInitials(/** @type {string} */ proposedInitials) {
      await dbPersonalBonusGameOfferInitials(/** @type {string} */ (proposedInitials));
      const personalBonusGame = /** @type {PersonalBonusGameInfo} */ (await dbPersonalBonusGameGetInfo());
      initials = personalBonusGame.initials;
    },
    async share(/** @type {string} */ shareExtra) {
      const shareLines = [];
      shareLines.push(`Subdue them bonus game #${index}`);
      if (initials === null) {
        throw new Error('initials null');
      }
      const bonusCode = codePack({index, initials});
      const shareUrl = new URL(`#bonus=${encodeURIComponent(bonusCode)}`, location.href).href;
      shareLines.push(shareUrl);
      if (shareExtra) {
        shareLines.push(shareExtra);
      }
      await navigator.clipboard.writeText(shareLines.join('\n'));
    },
    dailyGameAvailable: true,
    dailyGameGo() {
      const now = Date.now();
      (async () => {
        const currentIndex = dailyCurrentIndex(now);
        await dbDailyGameOffer(currentIndex, false);
        const index = /** @type {number} */ (await dbDailyGameLastIndex());
        buildDailyGame(index, currentIndex > index);
      })();
    },
    skipDailyGameAvailable: false,
    skipDailyGameGo: /** @type {never} */ (null),
    async personalBonusGameGetAvailable() {
      return false;
    },
    personalBonusGameGo: /** @type {never} */ (null),
  };
  buildGame(bonusSeed, extra);
}

function buildSharedBonusGame(/** @type {number} */ index, /** @type {string} */ sharerInitials, /** @type {string} */ bonusCode) {
  const bonusSeed = bonusSeedBase + index;
  const shareUrl = new URL(`#bonus=${encodeURIComponent(bonusCode)}`, location.href).href;
  const extra = {
    recordAttempt() {
      (async () => {
        try {
          await dbBonusGameRecordAttempt(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    recordSolve() {
      (async () => {
        try {
          await dbBonusGameRecordSolve(index);
        } catch (e) {
          reportError(e);
        }
      })();
    },
    title: `Bonus game\xa0#${index}, shared by ${sharerInitials}`,
    async getStats() {
      const {bonusGame, bonusTotals} = await dbBonusGameGetStats(index);
      const stats = [];
      if (bonusGame) {
        if (bonusGame.firstSharerInitials === '(personal)') {
          stats.push(`First awarded as personal bonus game on ${dateString(new Date(bonusGame.firstReceivedDate))}.`);
        } else {
          stats.push(`First recieved from ${bonusGame.firstSharerInitials} on ${dateString(new Date(bonusGame.firstReceivedDate))}.`);
        }
        if (bonusGame.solved) {
          stats.push('Fully subdued.');
        }
        stats.push(`${bonusGame.attempts}\xa0${bonusGame.attempts === 1 ? 'attempt' : 'attempts'}.`);
      }
      stats.push(`${bonusTotals.opened}\xa0bonus ${bonusTotals.opened === 1 ? 'game' : 'games'} opened.`);
      stats.push(`${bonusTotals.solved}\xa0fully subdued.`);
      stats.push(`${bonusTotals.attempts}\xa0total ${bonusTotals.attempts === 1 ? 'attempt' : 'attempts'}.`);
      return stats.join(' ');
    },
    shareNeedsInitials: false,
    shareOfferInitials: /** @type {never} */ (null),
    async share(/** @type {string} */ shareExtra) {
      const shareLines = [];
      shareLines.push(`Subdue them bonus game #${index}`);
      shareLines.push(shareUrl);
      if (shareExtra) {
        shareLines.push(shareExtra);
      }
      await navigator.clipboard.writeText(shareLines.join('\n'));
    },
    dailyGameAvailable: true,
    dailyGameGo() {
      const now = Date.now();
      (async () => {
        const currentIndex = dailyCurrentIndex(now);
        await dbDailyGameOffer(currentIndex, false);
        const index = /** @type {number} */ (await dbDailyGameLastIndex());
        buildDailyGame(index, currentIndex > index);
      })();
    },
    skipDailyGameAvailable: false,
    skipDailyGameGo: /** @type {never} */ (null),
    async personalBonusGameGetAvailable() {
      return false;
    },
    personalBonusGameGo: /** @type {never} */ (null),
  };
  buildGame(bonusSeed, extra);
}

function buildGameFromOptions(/** @type {URLSearchParams} */ options) {
  const now = Date.now();
  if (options.has('test')) {
    buildGame(20001, {
      recordAttempt() {
        console.log('record attempt');
      },
      recordSolve() {
        console.log('record solve');
      },
      title: 'Test game',
      async getStats() {
        return 'Dummy stats';
      },
      shareNeedsInitials: true,
      async shareOfferInitials(/** @type {string} */ initials) {
        console.log('share offer initials', initials);
      },
      async share(/** @type {string} */ shareExtra) {
        console.log('share', shareExtra);
      },
      dailyGameAvailable: true,
      dailyGameGo() {
        console.log('daily game go');
      },
      skipDailyGameAvailable: true,
      skipDailyGameGo() {
        console.log('skip daily game go');
      },
      async personalBonusGameGetAvailable() {
        return true;
      },
      personalBonusGameGo() {
        console.log('personal bonus game go');
      },
    });
  } else if (options.has('bonus')) {
    const bonusCode = /** @type {string} */ (options.get('bonus'));
    let bonusCodeInfo = null;
    try {
      bonusCodeInfo = codeUnpack(bonusCode);
    } catch (e) {
      reportError(e);
      out.innerHTML = '';
      const errorP = document.createElement('p');
      errorP.textContent = `⛔ ${e}`;
      out.appendChild(errorP);
      return;
    }
    (async () => {
      try {
        await dbBonusGameOffer(bonusCodeInfo.index, bonusCodeInfo.initials, now);
      } catch (e) {
        reportError(e);
      }
    })();
    buildSharedBonusGame(bonusCodeInfo.index, bonusCodeInfo.initials, bonusCode);
  } else {
    const currentIndex = dailyCurrentIndex(now);
    (async () => {
      let lastIndex;
      try {
        await dbDailyGameOffer(currentIndex, false);
        lastIndex = /** @type {number} */ (await dbDailyGameLastIndex());
      } catch (e) {
        reportError(e);
        lastIndex = currentIndex;
      }
      buildDailyGame(lastIndex, currentIndex > lastIndex);
    })();
  }
}

const hashOptions = new URLSearchParams(location.hash.replace(/^#/, ''));

buildGameFromOptions(hashOptions);
