function randRange(/** @type {number} */ minInclusive, /** @type {number} */ maxInclusive) {
  return minInclusive + Math.floor(Math.random() * (maxInclusive - minInclusive + 1));
}

function randRangeRound(/** @type {number} */ minInclusive, /** @type {number} */ maxInclusive, /** @type {number} */ fidelityLimit) {
  let low = minInclusive;
  let high = maxInclusive;
  let power = 1;
  while (high > fidelityLimit) {
    const l = Math.ceil(low / 10);
    const h = Math.floor(high / 10)
    if (l > h) break;
    low = l;
    high = h;
    power *= 10;
  }
  const v = randRange(low, high) * power;
  console.log('rand range round', 'sample', v, 'bounds', minInclusive, '<', maxInclusive, 'approx', low * power, '<', high * power); // %%%
  return v;
}

function sortNumeric(/** @type {number[]} */ a) {
  return a.sort((x, y) => x - y);
}

/** @template T */
function shuffle(/** @type {T[]} */ a) {
  for (let i = 0; i < a.length; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    const v = a[j];
    a[j] = a[i];
    a[i] = v;
  }
}

function expandProducts(/** @type {number[]} */ factors) {
  const /** @type {{[v: number]: true}} */ seen = {1: true};
  for (const f of factors) {
    const prev = [];
    for (const vStr in seen) {
      prev.push(+vStr);
    }
    for (const v of prev) {
      seen[v * f] = true;
    }
  }
  const products = [];
  for (const vStr in seen) {
    products.push(+vStr);
  }
  sortNumeric(products);
  return products;
}

const startScore = 2;

/** @typedef {{type: 'add', v: number, boss?: true}} AddItem */
/** @typedef {{type: 'mul', f: number}} MulItem */
/** @typedef {AddItem | MulItem} Item */

function generate() {
  const factors = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const addTotalCount = 9;

  const products = expandProducts(factors);

  function randMulBins(/** @type {number[]} */ factors) {
    const bins = [];
    for (const f of factors) {
      const i = randRange(0, bins.length);
      if (i >= bins.length) {
        bins.push(f);
      } else {
        bins[i] *= f;
      }
    }
    sortNumeric(bins);
    return bins;
  }

  const mulBins = randMulBins(factors);

  function randAddBins(/** @type {number} */ numBins, /** @type {number} */ totalCount) {
    const bins = [];
    for (let i = 0; i < numBins; i++) {
      bins.push(1);
    }
    for (let count = numBins; count < totalCount; count++) {
      const i = randRange(0, numBins - 1);
      bins[i]++;
    }
    return bins;
  }

  const addBins = randAddBins(mulBins.length, addTotalCount);

  let floor = 1;
  let ceil = startScore;
  let /** @type Item[] */ items = [];
  for (const f of factors) {
    items.push({type: 'mul', f});
  }
  for (let i = 0; i < mulBins.length; i++) {
    for (let j = 0; j < addBins[i]; j++) {
      const v = randRangeRound(floor, ceil - 1, 99);
      ceil += v;
      items.push({type: 'add', v});
    }
    const product = mulBins[i];
    const productIndex = products.indexOf(product);
    const smallerProduct = products[productIndex - 1];
    console.log('mul', 'product', product, '>', smallerProduct, 'margin', ((product - smallerProduct) / product * 100).toFixed(2) + '%'); // %%%
    floor = ceil * smallerProduct;
    ceil *= product;
  }
  shuffle(items);
  const v = randRangeRound(floor, ceil - 1, 99);
  ceil += v;
  items.push({type: 'add', v, boss: true});
  return items;
}

function render(/** @type {Node} */ dst, /** @type Item[] */ items) {
  const playerEmoji = '🚚';
  const unusedAddEmoji = ['🐒', '🐕', '🐩', '🐈', '🐅', '🐆', '🐎', '🐂', '🐃', '🐄', '🐖', '🐏', '🐑', '🐐', '🐪', '🐫', '🐘', '🐁', '🐀', '🐇', '🐓', '🐤', '🐦', '🐧', '🐊', '🐢', '🐍', '🐉', '🐋', '🐬', '🐟', '🐠', '🐡', '🐙', '🐌', '🐛', '🐜', '🐝', '🐞'];
  const unusedMulEmoji = ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🍦', '🍧', '🍨', '🍩', '🍪', '🍰', '🍫', '🍬', '🍭', '🍮'];
  const commonSceneryEmoji = ['🌲', '🌳', '🏠'];
  const unusedRareSceneryEmoji = ['🌹', '🌻', '🌼', '🌷', '🌱', '🌴', '🌵', '🌾', '🍄', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🎡', '🎪'];

  function useOne(/** @type string[] */ unused) {
    const i = randRange(0, unused.length - 1);
    const used = unused[i];
    unused[i] = unused[unused.length - 1];
    unused.pop();
    return used;
  }

  const scaleVLow = 1;
  const scaleVHigh = 3723148799;
  const scaleSizeLow = 16;
  const scaleSizeHigh = (360 - 2 * 4 - 2 * 6) / 1.3;
  const scaleScale = (scaleSizeHigh - scaleSizeLow) / Math.log(scaleVHigh / scaleVLow);
  const scaleOffset = scaleSizeLow - Math.log(scaleVLow) * scaleScale;
  console.log('scale', 'scale', scaleScale, 'offset', scaleOffset); // %%%

  function scaleSize(/** @type number */ v) {
    return Math.log(v) * scaleScale + scaleOffset;
  }

  function scaleIcon(/** @type HTMLElement */ icon, /** @type number */ v) {
    const size = scaleSize(v);
    icon.style.fontSize = `${size}px`;
  }

  const playerDiv = document.createElement('div');
  playerDiv.className = 'player';
  const playerScaling = document.createElement('span');
  playerScaling.className = 'player-scaling';
  const playerIcon = document.createElement('span');
  playerIcon.className = 'icon icon-player-playing';
  playerIcon.textContent = playerEmoji;
  scaleIcon(playerIcon, scaleVHigh);
  playerScaling.appendChild(playerIcon);
  playerDiv.appendChild(playerScaling);
  playerDiv.appendChild(document.createElement('br'));
  const playerScoreSpan = document.createElement('span');
  playerScoreSpan.className = 'player-score';
  playerDiv.appendChild(playerScoreSpan);
  dst.appendChild(playerDiv);
  dst.appendChild(document.createElement('br'));

  let score = startScore;
  let numRemaining = 0;

  const /** @type {{disabled: any}[]} */ allControls = [];
  function disableAllControls() {
    for (const c of allControls) {
      c.disabled = true;
    }
  }

  function endGameCommon() {
    disableAllControls();
    playerIcon.classList.remove('icon-player-playing');
  }

  function endGameLose() {
    endGameCommon();
    playerIcon.classList.add('icon-player-lose');
  }

  function endGameWin() {
    endGameCommon();
    playerIcon.classList.add('icon-player-win');
  }
  
  function updatePlayerScore() {
    const size = scaleSize(score);
    const scale = size / scaleSizeHigh;
    playerScaling.style.transform = `scale(${scale})`;
    playerScoreSpan.textContent = score.toLocaleString();
  }

  updatePlayerScore();

  function renderItemAdd(/** @type Node */ dst, /** @type AddItem */ item) {
    numRemaining++;
    const itemButton = document.createElement('button');
    itemButton.className = 'item item-add';
    if (item.boss) {
      itemButton.classList.add('boss');
    }
    const itemIcon = document.createElement('span');
    itemIcon.className = 'icon icon-add-enabled';
    itemIcon.textContent = useOne(unusedAddEmoji);
    scaleIcon(itemIcon, item.v);
    itemButton.appendChild(itemIcon);
    itemButton.appendChild(document.createElement('br'));
    itemButton.appendChild(document.createTextNode(item.v.toLocaleString()));
    if (item.boss) {
      itemButton.appendChild(document.createTextNode(' '));
      const bossSpan = document.createElement('span');
      bossSpan.className = 'label label-boss';
      bossSpan.textContent = 'BOSS';
      itemButton.appendChild(bossSpan);
    }
    itemButton.onclick = (e) => {
      if (item.v >= score) {
        endGameLose();
        itemIcon.classList.remove('icon-add-enabled');
        itemIcon.classList.add('icon-add-win');
      } else {
        itemButton.disabled = true;
        itemIcon.classList.remove('icon-add-enabled');
        itemIcon.classList.add('icon-add-disabled');
        score += item.v;
        updatePlayerScore();
        if (!--numRemaining) {
          endGameWin();
        }
      }
    };
    allControls.push(itemButton);
    dst.appendChild(itemButton);
  }

  function renderItemMul(/** @type {Node} */ dst, /** @type MulItem */ item) {
    const itemButton = document.createElement('button');
    itemButton.className = 'item item-mul';
    const itemIcon = document.createElement('span');
    itemIcon.className = 'icon icon-mul-enabled';
    itemIcon.textContent = useOne(unusedMulEmoji);
    itemButton.appendChild(itemIcon);
    itemButton.appendChild(document.createElement('br'));
    itemButton.appendChild(document.createTextNode(`×${item.f.toLocaleString()}`));
    itemButton.onclick = (e) => {
      itemButton.disabled = true;
      itemIcon.classList.remove('icon-mul-enabled');
      itemIcon.classList.add('icon-mul-disabled');
      score *= item.f;
      updatePlayerScore();
    };
    allControls.push(itemButton);
    dst.appendChild(itemButton);
  }

  function selectSceneryEmoji() {
    if (unusedRareSceneryEmoji.length && Math.random() < 0.2) {
      return useOne(unusedRareSceneryEmoji);
    }
    return commonSceneryEmoji[randRange(0, commonSceneryEmoji.length - 1)];
  }

  function renderScenery(/** @type {Node} */ dst) {
    const sceneryDiv = document.createElement('div');
    sceneryDiv.className = 'scenery';
    const sceneryIcon = document.createElement('span');
    sceneryIcon.className = 'icon icon-scenery';
    sceneryIcon.textContent = selectSceneryEmoji();
    sceneryDiv.appendChild(sceneryIcon);
    sceneryDiv.appendChild(document.createElement('br'));
    sceneryDiv.appendChild(document.createTextNode('\xa0'));
    dst.appendChild(sceneryDiv);
  }

  function renderScenerySome(/** @type {Node} */ dst) {
    const count = randRange(1, 3);
    for (let i = 0; i < count; i++) {
      renderScenery(dst);
      dst.appendChild(document.createTextNode(' '));
    }
  }

  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'items';
  renderScenerySome(itemsDiv);
  for (const item of items) {
    switch (item.type) {
      case 'add':
        renderItemAdd(itemsDiv, item);
        break;
      case 'mul':
        renderItemMul(itemsDiv, item);
        break;
    }
    itemsDiv.appendChild(document.createTextNode(' '));
    renderScenerySome(itemsDiv);
  }
  dst.appendChild(itemsDiv);
}

const out = /** @type {HTMLPreElement} */ (document.getElementById('out'));
render(out, generate());
