// ==UserScript==
// @name         🐭️ MouseHunt - Ultimate Checkmark
// @version      1.3.0
// @description  Track your progress towards the "Ultimate Checkmark".
// @license      MIT
// @author       bradp
// @namespace    bradp
// @match        https://www.mousehuntgame.com/*
// @icon         https://i.mouse.rip/mouse.png
// @grant        none
// @run-at       document-end
// @require https://greasyfork.org/scripts/464008-mousehunt-utils-beta/code/%F0%9F%90%AD%EF%B8%8F%20MouseHunt%20Utils%20Beta.js?version=1230556
// ==/UserScript==

(function () {
  'use strict';

  const getItems = async (required, queryTab, queryTag, allItems = []) => {
    if (!allItems.length) {
      const inventoryData = await doRequest(
        'managers/ajax/pages/page.php',
        {
          page_class: 'Inventory',
          'page_arguments[legacyMode]': '',
          'page_arguments[tab]': queryTab,
          'page_arguments[sub_tab]': 'false',
        }
      );

      // Find the inventoryData.page.tabs array item that has type=special
      const specialTab = inventoryData.page.tabs.find((tab) => queryTab === tab.type);
      if (!specialTab || !specialTab.subtabs || !specialTab.subtabs.length || !specialTab.subtabs[0].tags) {
        return [];
      }

      const owned = specialTab.subtabs[0].tags.filter((tag) => queryTag === tag.type);
      if (!owned || !owned.length || !owned[0].items) {
        return [];
      }

      allItems = owned[0].items;
    }

    // Merge the required allItems with the owned allItems
    required.forEach((requiredItem) => {
      const ownedItem = allItems.find((i) => i.type === requiredItem.type);
      if (!ownedItem) {
        allItems.push(requiredItem);
      }
    });

    allItems = allItems.map((item) => {
      const requiredItem = required.find((i) => i.type === item.type);

      return {
        item_id: item.item_id, /* eslint-disable-line camelcase */
        type: item.type,
        name: item.name,
        thumbnail: item.thumbnail_gray || item.thumbnail, /* eslint-disable-line camelcase */
        quantity: item.quantity || 0,
        quantity_formatted: item.quantity_formatted || '0', /* eslint-disable-line camelcase */
        le: !requiredItem,
      };
    });

    // sort the items array by name
    allItems.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });

    return allItems;
  };

  const getProgress = (items, required) => {
    // Count the number of required chests that are owned
    let le = 0;
    let requiredCompleted = 0;
    items.forEach((item) => {
      if (item.quantity <= 0) {
        return;
      }

      if (!item.le) {
        requiredCompleted++;
      } else if (item.le) {
        le++;
      }
    });

    return {
      checkmark: requiredCompleted === required.total,
      completed: requiredCompleted,
      required: required.length,
      le,
    };
  };

  const makeProgressString = (progress) => {
    const { completed, required, le } = progress;

    let text = `${completed} of ${required}`;
    if (le && le > 0) {
      text += ` (+${le} LE)`;
    }

    return text;
  };

  const makeCategory = (category, name, progress) => {
    const exists = document.querySelector(`.hunterProfileItemsView-category[data-category="${category}"]`);
    if (exists) {
      return;
    }

    const sidebar = document.querySelector('.hunterProfileItemsView-directory');
    if (!sidebar) {
      return;
    }

    const catSidebarCategory = document.createElement('a');
    catSidebarCategory.classList.add('hunterProfileItemsView-category');
    if (progress.checkmark) {
      catSidebarCategory.classList.add('completed');
    }

    catSidebarCategory.title = name;
    catSidebarCategory.href = '#';
    catSidebarCategory.setAttribute('data-category', category);
    catSidebarCategory.addEventListener('click', () => {
      hg.views.HunterProfileItemsView.showCategory(category);
      return false;
    });

    const catSidebarCategoryMargin = document.createElement('div');
    catSidebarCategoryMargin.classList.add('hunterProfileItemsView-category-margin');

    const catSidebarCategoryName = document.createElement('div');
    catSidebarCategoryName.classList.add('hunterProfileItemsView-category-name');
    catSidebarCategoryName.innerText = name;

    const catSidebarCategoryProgress = document.createElement('div');
    catSidebarCategoryProgress.classList.add('hunterProfileItemsView-category-progress');
    catSidebarCategoryProgress.innerText = makeProgressString(progress);

    const catSidebarCategoryStatus = document.createElement('div');
    catSidebarCategoryStatus.classList.add('hunterProfileItemsView-category-status');

    catSidebarCategoryMargin.appendChild(catSidebarCategoryName);
    catSidebarCategoryMargin.appendChild(catSidebarCategoryProgress);
    catSidebarCategoryMargin.appendChild(catSidebarCategoryStatus);

    catSidebarCategory.appendChild(catSidebarCategoryMargin);

    sidebar.appendChild(catSidebarCategory);
  };

  const makeItem = (item) => {
    const { item_id, type, name, thumbnail, thumbnail_gray, quantity, quantity_formatted, le } = item; /* eslint-disable-line camelcase */

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('hunterProfileItemsView-categoryContent-item');
    if (quantity > 0) {
      itemDiv.classList.add('collected');
      if (le) {
        itemDiv.classList.add('limited_edition');
      }
    } else {
      itemDiv.classList.add('uncollected');
      itemDiv.classList.add('hidden');
    }

    itemDiv.setAttribute('data-id', item_id);
    itemDiv.setAttribute('data-type', type);

    const itemPadding = document.createElement('div');
    itemPadding.classList.add('hunterProfileItemsView-categoryContent-item-padding');
    itemPadding.addEventListener('click', () => {
      hg.views.ItemView.show(type);
    });

    const itemImage = document.createElement('div');
    itemImage.classList.add('itemImage');
    if (quantity > 0 && thumbnail_gray) { /* eslint-disable-line camelcase */
      itemImage.style.backgroundImage = `url(${thumbnail_gray})`; /* eslint-disable-line camelcase */
    } else {
      itemImage.style.backgroundImage = `url(${thumbnail})`;
    }

    if (quantity > 0) {
      const itemQuantity = document.createElement('div');
      itemQuantity.classList.add('quantity');
      itemQuantity.innerText = quantity_formatted; /* eslint-disable-line camelcase */
      itemImage.appendChild(itemQuantity);
    }

    const itemName = document.createElement('div');
    itemName.classList.add('hunterProfileItemsView-categoryContent-item-name');

    const itemNameSpan = document.createElement('span');
    itemNameSpan.innerText = name;

    itemName.appendChild(itemNameSpan);

    itemPadding.appendChild(itemImage);
    itemPadding.appendChild(itemName);

    itemDiv.appendChild(itemPadding);

    return itemDiv;
  };

  const makeContent = (id, name, items, completed) => {
    const content = document.querySelector('.hunterProfileItemsView-content-padding');
    if (!content) {
      return;
    }

    const categoryDiv = document.createElement('div');
    categoryDiv.classList.add('hunterProfileItemsView-categoryContent');
    if (completed) {
      categoryDiv.classList.add('collected');
    }

    categoryDiv.setAttribute('data-category', id);

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('hunterProfileItemsView-categoryContent-name');
    nameDiv.innerText = name;

    const itemsDiv = document.createElement('div');

    // sort the items by name
    items.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }

      if (a.name > b.name) {
        return 1;
      }

      return 0;
    });

    items.forEach((item) => {
      itemsDiv.appendChild(makeItem(item));
    });

    categoryDiv.appendChild(nameDiv);
    categoryDiv.appendChild(itemsDiv);

    content.appendChild(categoryDiv);
  };

  const addCategoryAndItems = async (required, type, subtype, key, name) => {
    const exists = document.querySelector(`.hunterProfileItemsView-categoryContent[data-category="${key}"]`);
    if (exists) {
      return;
    }

    const items = await getItems(required, type, subtype);
    const progress = getProgress(items, required);

    makeCategory(key, name, progress);
    makeContent(key, name, items, progress.completed);
  };

  const addTreasureChests = async () => {
    addCategoryAndItems([
      { item_id: '1802', type: 'zugzwang_treasure_chest_convertible', name: 'Zugzwang Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/4e1b506a260466747f6238dc57ac38c3.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/5b32126dbda195a644b3e2b630843870.jpg?cv=2' },
      { item_id: '3278', type: 'sky_palace_treasure_chest_convertible', name: 'Empyrean Sky Palace Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/4deb109ea8159ae1af831d1dac44e694.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/15e5ad2a708db20fd4e92510d247bb03.jpg?cv=2' },
      { item_id: '2823', type: 'queso_canyon_tour_treasure_chest_convertible', name: 'Queso Canyon Grand Tour Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d21bb8fb6540a240318cec11f7238b04.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/fdcf47fc4de9dec045fe5280b7bfcb5b.jpg?cv=2' },
      { item_id: '1798', type: 'valour_treasure_chest_convertible', name: 'Valour Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6dc1151ce637e84e975ea779a2956e5f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/fd27e6652f1a5dedc8c2d9d3253dbd0b.jpg?cv=2' },
      // { "item_id": "1976", "type": "rare_large_rainbow_treasure_chest_convertible", "name": "Rare Large Rainbow Treasure Chest", "thumbnail": "https://www.mousehuntgame.com/images/items/convertibles/dcf0c6d1cc0f84010e26188d317e12a6.gif?cv=2", "thumbnail_gray": "https://www.mousehuntgame.com/images/items/collectibles/gray/1553c56646365f9b7d176303097f9d1a.jpg?cv=2" },
      { item_id: '2819', type: 'geyser_dweller_treasure_chest_convertible', name: 'Queso Geyser Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/33128f6d1885d3f083ba1865666bfc8a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a46c362782352a4fecd7b179f56b1eb3.jpg?cv=2' },
      { item_id: '2376', type: 'chrome_hard_treasure_chest_convertible', name: 'Hard Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/24e0f3c863d32e23948bd618a06ca0c9.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/e62b78aaac7fc0e723afa5be250cdf34.jpg?cv=2' },
      { item_id: '2859', type: 'rare_c_boss_hard_treasure_chest_convertible', name: 'Rare Hard Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/bc1a3664133e69d3df57bcdc5a4a733a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/4e10f96e7dd5b8f0d67557be6de02742.jpg?cv=2' },
      { item_id: '1776', type: 'rare_icebreaker_treasure_chest_convertible', name: 'Rare Icebreaker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/df9b1518eb19569bc704c50f35978be2.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/76bf061f77ce6f10cdb627ca03d6ee0b.jpg?cv=2' },
      { item_id: '3194', type: 'rare_valour_rift_treasure_chest_convertible', name: 'Rare Valour Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/1fa9a63667395a35e7399a4579e8707c.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/667082607cf28f1313dfd5d01e6d9fc3.jpg?cv=2' },
      { item_id: '2148', type: 'boss_easy_treasure_chest_convertible', name: 'Easy Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6ee5c376bb53b3f50371c07d773be674.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/96d394df66247f51145322a5eb86fae7.jpg?cv=2' },
      { item_id: '1949', type: 'rare_toxic_elite_treasure_chest_convertible', name: 'Rare Archduke/Archduchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/cbede8a58f086591c6122869e7ff738b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/19c012edc76502d75228cb633a949d02.jpg?cv=2' },
      { item_id: '2373', type: 'chrome_easy_treasure_chest_convertible', name: 'Easy Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8745db010060d4deae9d42a640a0bd4b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/fb12dc3170960e6c374b6b7bfb4ebf75.jpg?cv=2' },
      { item_id: '3276', type: 'rare_sky_palace_treasure_chest_convertible', name: 'Rare Empyrean Sky Palace Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/4ed290f8c15f451921e8084ebaf9ff08.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/04e6d16c5257fccdb2188078115d06c1.jpg?cv=2' },
      { item_id: '2164', type: 'rare_boss_elaborate_treasure_chest_convertible', name: 'Rare Elaborate Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/e009b0db601a9e199d549f3bcc22f85a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/76866c878d18ba12d821848df2e05367.jpg?cv=2' },
      { item_id: '1787', type: 'rare_zugzwang_treasure_chest_convertible', name: 'Rare Zugzwang Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/299e49c33014eb9c42ae39bdde528802.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/01e64d5be7ecc17ffe63726dd934bb78.jpg?cv=2' },
      { item_id: '1768', type: 'rare_catacombs_treasure_chest_convertible', name: 'Rare Acolyte Realm Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/a597670e02750645cf3ebd3027b8187c.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/97bd863de77c17ef63a8af60d7be17cc.jpg?cv=2' },
      { item_id: '2113', type: 'rare_gnawnia_rift_treasure_chest_convertible', name: 'Rare Gnawnia Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/5bb5447be9208c22cc9d93a20a02c74b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/4c4e635b30c9b03f0af860af6fbe7abe.jpg?cv=2' },
      { item_id: '1953', type: 'toxic_arduous_treasure_chest_convertible', name: 'Grand Duke/Duchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d184b60491f2541983768386562c48e8.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/fe0b2e5860b2eb9acf04b95e0ae5cd4b.jpg?cv=2' },
      { item_id: '1800', type: 'whisker_woods_treasure_chest_convertible', name: 'Whisker Woods Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8a077d726e1f0c212c791f1ecbf815b7.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c1e651781cd9cc44a5123df59f51c777.jpg?cv=2' },
      { item_id: '1791', type: 'shelder_treasure_chest_convertible', name: 'Shelder Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/c7e0328ce7eedcdba4079f50d2757641.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/80860865777e437c19e510b0023a6782.jpg?cv=2' },
      { item_id: '2851', type: 'chrome_boss_elite_treasure_chest_convertible', name: 'Elite Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/2011f0ca921c9a08c08ec85f70302e7d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/5f6a43f7c61dccfa62f6dbea15692e37.jpg?cv=2' },
      { item_id: '2152', type: 'boss_medium_treasure_chest_convertible', name: 'Medium Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/19729f80ffa2ac4e028fe1d751069cbd.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/eadd614bf7533e48dc636b4189a9310b.jpg?cv=2' },
      { item_id: '2294', type: 'rare_fort_rox_treasure_chest_convertible', name: 'Rare Fort Rox Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9c89170d8c02b024d6dd30f6e357cdd1.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/e6c58b81a7d3f4eca4de122736603e52.jpg?cv=2' },
      { item_id: '2129', type: 'rare_relic_treasure_chest_convertible', name: 'Rare Golden Jade Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/a981a23aacf4b9a240594d2577085333.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c4ad1d432036e2de5dc1343a0aa88ec2.jpg?cv=2' },
      { item_id: '3329', type: 'rare_boss_elite_2021_treasure_chest_convertible', name: 'Rare Elite Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/f1c2fc451efa4d6b722c0631eb0ef22f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a4dfa0c872880dd6f578868d2a3733ad.jpg?cv=2' },
      { item_id: '2353', type: 'bristle_woods_rift_treasure_chest_convertible', name: 'Bristle Woods Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/958c089bb5d7d2cbc397696456cae621.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/2267b2011bbb4a4c509e924eebbbf882.jpg?cv=2' },
      { item_id: '2850', type: 'chrome_boss_elaborate_treasure_chest_convertible', name: 'Elaborate Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/381f3ec8ae981e36255e01a4287c4a54.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/adbe2eb86a9b5e6531987dc57f28008c.jpg?cv=2' },
      { item_id: '2112', type: 'rare_furoma_rift_treasure_chest_convertible', name: 'Rare Furoma Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/c88837d24724b719572cd3c11781c504.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7283dd87f67193f258c523260167368b.jpg?cv=2' },
      { item_id: '1786', type: 'rare_whisker_woods_treasure_chest_convertible', name: 'Rare Whisker Woods Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/fa20a6be718d88b28b47df6b6c5ae7ac.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/b4307f0b9f02aa4e8641a64475e313b7.jpg?cv=2' },
      { item_id: '1769', type: 'rare_digby_treasure_chest_convertible', name: 'Rare Digby Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/680784952415b493592238b287007028.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/73d1569a239a8afb27870f443bd5e91d.jpg?cv=2' },
      { item_id: '1749', type: 'digby_treasure_chest_convertible', name: 'Digby Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6905bfdaa16b360bf992171a7f3dd9cf.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/49d836d43555f7759c9e43582ad7e202.jpg?cv=2' },
      { item_id: '1925', type: 'rare_labyrinth_treasure_chest_convertible', name: 'Rare Labyrinth Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/282954a6ffd085428ec3acf62272b25f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ddaaba37490bba81f2d2f8637b56f9d3.jpg?cv=2' },
      { item_id: '2827', type: 'rare_geyser_dweller_treasure_chest_convertible', name: 'Rare Queso Geyser Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8bf68b531d56b5aec061ff87c3985733.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/545c7f57c37a9f50c2fe562b44336285.jpg?cv=2' },
      // { "item_id": "1972", "type": "large_rainbow_treasure_chest_convertible", "name": "Large Rainbow Treasure Chest", "thumbnail": "https://www.mousehuntgame.com/images/items/convertibles/ef598ac876bf945a8b1e59b6496a0f51.gif?cv=2", "thumbnail_gray": "https://www.mousehuntgame.com/images/items/collectibles/gray/5db48a3288624b94dfdfdf45a3fd9f72.jpg?cv=2" },
      { item_id: '1773', type: 'rare_fungal_cavern_treasure_chest_convertible', name: 'Rare Fungal Cavern Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9a4299da908db8f4651a41eea9a473dd.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/329f7d538c61ab085c8ce8b39bba054f.jpg?cv=2' },
      { item_id: '2108', type: 'furoma_rift_treasure_chest_convertible', name: 'Furoma Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/5c9f5d466ccc7486bd00d424f03d93cb.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/91dcc7e1c71f8a5c5b7cbab104011daf.jpg?cv=2' },
      { item_id: '1948', type: 'rare_toxic_elaborate_treasure_chest_convertible', name: 'Rare Duke/Duchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/a1dd8cb4b65cd66a262d51c3da9a21a7.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/e2df6d2bf6f07e4e3cf1b114a70baf52.jpg?cv=2' },
      { item_id: '2372', type: 'chrome_arduous_treasure_chest_convertible', name: 'Arduous Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/182c8a6dca3c7568d969e80e8eb82538.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/dc65a626643ac4d63b2e910128d00632.jpg?cv=2' },
      { item_id: '1765', type: 'muridae_treasure_chest_convertible', name: 'Muridae Protector\'s Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/327f73b66cd3a91af6a47dc23e499144.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/87be3fbcc3a11e942ab96f0fb65268ee.jpg?cv=2' },
      { item_id: '2149', type: 'boss_elaborate_treasure_chest_convertible', name: 'Elaborate Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/642693091427aed5e29dc63a4022fbba.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ce1cb595714964e5878e4d987ed05c31.jpg?cv=2' },
      { item_id: '1781', type: 'rare_riftwalker_treasure_chest_convertible', name: 'Rare Rift Walker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/7135f3bc2abbf882fe7468689573e73a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/689929bc0f7a5691cc9a1f18817e6134.jpg?cv=2' },
      { item_id: '2379', type: 'rare_chrome_arduous_treasure_chest_convertible', name: 'Rare Arduous Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/1b5d03ed3e506c5db96c67fa2cbb4f81.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c40c899d87d88b5e9d533ed970a04c32.jpg?cv=2' },
      { item_id: '2380', type: 'rare_chrome_easy_treasure_chest_convertible', name: 'Rare Easy Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/1fa6faae6bc6141a4a4c61144bf3fc2d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/033f0ba772a33b150c54345377ffda35.jpg?cv=2' },
      { item_id: '1955', type: 'toxic_elaborate_treasure_chest_convertible', name: 'Duke/Duchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/0a518304c12fc87d0bef55a5d7f111f7.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/9dfb8bd90ee165ec80f744010fa6c821.jpg?cv=2' },
      { item_id: '2857', type: 'rare_c_boss_elaborate_treasure_chest_convertible', name: 'Rare Elaborate Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/2d720871e7bac45e2646f268256059e0.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/34ba3dc86de10ab86e7d9e147b266426.jpg?cv=2' },
      { item_id: '1778', type: 'rare_living_garden_treasure_chest_f_convertible', name: 'Rare Living Garden Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/7e1c427975ae52f3b34a2a0ba2e8e99b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/3ce4c751391237a25d60b90a77594e4d.jpg?cv=2' },
      { item_id: '2292', type: 'fort_rox_treasure_chest_convertible', name: 'Fort Rox Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6d365b0ead9a46e2b6569c4840530c98.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7ca6ce519ef350d6ff88449e8dea8552.jpg?cv=2' },
      { item_id: '1754', type: 'fungal_cavern_treasure_chest_convertible', name: 'Fungal Cavern Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/15624b2a37a6dacf3d7248ec503d9634.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c49a0137beb33fe0ddf4b554d814a8c6.jpg?cv=2' },
      { item_id: '2355', type: 'rare_bristle_woods_rift_treasure_chest_convertible', name: 'Rare Bristle Woods Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b8cf984566b240c11dcfac21c48eecb7.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a01e3f040f7d085806bd7eafff1d16f6.jpg?cv=2' },
      { item_id: '1762', type: 'living_garden_treasure_chest_f_convertible', name: 'Living Garden Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8daa67ef7fba125eaa0b098d682bb7a8.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/f23dc73c1dd1f563c602f477c0a480ed.jpg?cv=2' },
      { item_id: '2375', type: 'chrome_elite_treasure_chest_convertible', name: 'Elite Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/043d5183550d5b643f3ebdda5ef3a7e0.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/313df1e311b4f82a4bc06e488c73a8d3.jpg?cv=2' },
      { item_id: '1774', type: 'rare_gnawnia_treasure_chest_convertible', name: 'Rare Gnawnia Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/23ba20f4e3efa129697f87b3fd776500.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/23e02c08a04bf8b1b8a724b36c1056a0.jpg?cv=2' },
      { item_id: '1975', type: 'rare_giant_rainbow_treasure_chest_convertible', 'name': 'Rare Giant Rainbow Treasure Chest', "thumbnail": "https://www.mousehuntgame.com/images/items/convertibles/bcefcda9a9ab1b732c4b56cf76ab3de3.gif?cv=2", "thumbnail_gray": "https://www.mousehuntgame.com/images/items/collectibles/gray/04a6fcdc06c6d40049395ac8d9182fe3.jpg?cv=2" },
      { item_id: '2162', type: 'rare_boss_arduous_treasure_chest_convertible', name: 'Rare Arduous Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/ca01cc66c88804ff9845e1aeef252463.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ae1ada8763456ee4ede9bc22b84ce80d.jpg?cv=2' },
      { item_id: '2477', type: 'moussu_picchu_treasure_chest_convertible', name: 'Moussu Picchu Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/088e09fad53ce7138f2b4298774ca9d4.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/3f9645e5d302f8846da008d0dee260bc.jpg?cv=2' },
      { item_id: '2358', type: 'riftstalker_treasure_chest_convertible', name: 'Rift Stalker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/97a2f51f59db3317183c7492d4789d7a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/726987d7ea120ffe4be72ade6fa09655.jpg?cv=2' },
      { item_id: '2860', type: 'rare_c_boss_medium_treasure_chest_convertible', name: 'Rare Medium Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b902e5f1c766e08b5538e8d3842ded3e.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6770592940531649d5f6e4138f9cf70b.jpg?cv=2' },
      { item_id: '3322', type: 'boss_elite_2021_treasure_chest_convertible', name: 'Elite Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/c2aaaecd4fcf5302401e91a36624403a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/181b01c3b4443ae1d2df1d9c858dd8ab.jpg?cv=2' },
      { item_id: '2163', type: 'rare_boss_easy_treasure_chest_convertible', name: 'Rare Easy Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/3522c5618238a73270dccf79bb8b1df7.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/83037b98d73b44592ba5d70997e47db2.jpg?cv=2' },
      { item_id: '1759', type: 'icebreaker_treasure_chest_convertible', name: 'Icebreaker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d87ffbef4f6b290b18ba6c16ca8d3194.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/b7ef8bdc6382be947f679184fd0df03d.jpg?cv=2' },
      { item_id: '2933', type: 'rare_gilded_coin_treasure_chest_convertible', name: 'Rare Gilded Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6f31b4f515d7bb9342c5a5f073b6754a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7e3548546b45be03b9f0340b4cf8d2bd.jpg?cv=2' },
      { item_id: '1923', type: 'labyrinth_treasure_chest_convertible', name: 'Labyrinth Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/5cc3f59a329f8bf57c01a1e3af552aff.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6cee63fe4b6d18edcaf18c22f77e1a9c.jpg?cv=2' },
      { item_id: '3174', type: 'birthday_2021_treasure_chest_convertible', name: 'Birthday Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/862be2f2a3844f0fe1b5f5447bb1f091.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/2e91c3cfe8d3a14f552b062199188f90.jpg?cv=2' },
      { item_id: '1958', type: 'toxic_medium_treasure_chest_convertible', name: 'Lord/Lady Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/3b471f8bb66ae0ef2804f2469652d192.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/0764347f9e94b89bda029fcf5d6dd73f.jpg?cv=2' },
      { item_id: '2118', type: 'whisker_woods_rift_treasure_chest_convertible', name: 'Whisker Woods Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/85ad1965de705b29d9a9e3ed14096492.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c2584592958202e3e96d01f69b3462e8.jpg?cv=2' },
      { item_id: '2374', type: 'chrome_elaborate_treasure_chest_convertible', name: 'Elaborate Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/e74dc938da94654d14ab0c88cb0f1bf8.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/5161475c9c72ef3c92e87f01490fdd27.jpg?cv=2' },
      { item_id: '2636', type: 'rare_queso_canyoneer_treasure_chest_convertible', name: 'Rare Queso Canyoneer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/f16128354a4aaed4c66f918a61ecb0dd.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/09dbb9a25b055498270f4179f34b6093.jpg?cv=2' },
      { item_id: '3046', type: 'sky_pirate_treasure_chest_convertible', name: 'Sky Pirate Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6b9e32b50d97f1ea83ab62cc59385494.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7aabd8d90647265e59d6b97f14eafb52.jpg?cv=2' },
      // { 'item_id': '1978', 'type': 'small_rainbow_treasure_chest_convertible', 'name': 'Small Rainbow Treasure Chest', 'thumbnail': 'https://www.mousehuntgame.com/images/items/convertibles/f7b0e361a29f85abd9a416cf1e60580f.gif?cv=2', 'thumbnail_gray': 'https://www.mousehuntgame.com/images/items/collectibles/gray/6c8be7aa2522e226e9f3248e8da364a0.jpg?cv=2' },
      { item_id: '3197', type: 'valour_rift_treasure_chest_convertible', name: 'Valour Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/5ed09417864c04bd7545d14d6d43d5fe.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ef95ed0d16d556a6a39c860792dc1cd6.jpg?cv=2' },
      { item_id: '1796', type: 'undead_treasure_chest_convertible', name: 'Mousoleum Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/4ed7ce8f5fe67e4da9a6900c3e31e514.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/8991784adaba59aac2fbdd7986541d5a.jpg?cv=2' },
      { item_id: '2856', type: 'rare_c_boss_easy_treasure_chest_convertible', name: 'Rare Easy Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/73a8268e9618dc163130c885cf1cac54.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/4380d9c3245297a5e3db793914aff2de.jpg?cv=2' },
      { item_id: '1954', type: 'toxic_easy_treasure_chest_convertible', name: 'Hero Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/daaa65c5afcaf64ab5b2fce4fcb8d01f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/0c4abba98aefafab7330096441f80990.jpg?cv=2' },
      { item_id: '2381', type: 'rare_chrome_elaborate_treasure_chest_convertible', name: 'Rare Elaborate Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/2ab88ba49e87c596c9f709d5cd95f1be.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/8026ef28b7b96bf4b974a07bfff3712e.jpg?cv=2' },
      { item_id: '2417', type: 'rare_warpath_treasure_chest_convertible', name: 'Rare Warpath Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b08fb5a5cf8282507702f53612618691.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/3421aa2c2043e4b8e2bf7de69f898c9d.jpg?cv=2' },
      { item_id: '2114', type: 'rare_whisker_woods_rift_treasure_chest_convertible', name: 'Rare Whisker Woods Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/3f03fb40819702bfff6b73b8f1cf583d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ca6439f88816352c9083e34c4b06b2b8.jpg?cv=2' },
      { item_id: '1780', type: 'rare_muridae_treasure_chest_convertible', name: 'Rare Muridae Protector\'s Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/bcc138eb54022f2c548862d301b73e62.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/e76916ab5798ea92775ca73445e70fb5.jpg?cv=2' },
      { item_id: '2479', type: 'rare_lightning_slayer_chest_convertible', name: 'Rare Lightning Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/fc05f87911e737e2576147b68be4e59b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6059d6d3234ef000bec1c413f67e4443.jpg?cv=2' },
      { item_id: '2480', type: 'rare_moussu_picchu_treasure_chest_convertible', name: 'Rare Moussu Picchu Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/33e20a4bb9def45cc4508519ae0c169f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/08e3dff02d620d4039826633f3758913.jpg?cv=2' },
      { item_id: '1756', type: 'gnawnia_treasure_chest_convertible', name: 'Gnawnia Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/0e7e2f3a82543bf9a38c3fc0fa1b7012.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/016a15a5e300a79e65a7f463f5a237c1.jpg?cv=2' },
      { item_id: '2855', type: 'rare_c_boss_arduous_treasure_chest_convertible', name: 'Rare Arduous Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/64c1dab2d2a07b3ef1e04758c92d45ae.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a3b923245e160fba257b79ddbb8fa063.jpg?cv=2' },
      { item_id: '2382', type: 'rare_chrome_elite_treasure_chest_convertible', name: 'Rare Elite Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/95d2bd396f02d15a7edd3c438d23d71b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/11372bb85135a2e37c5a0f5af7be55c7.jpg?cv=2' },
      { item_id: '1957', type: 'toxic_hard_treasure_chest_convertible', name: 'Count/Countess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d6c71f5c98951c2a8e6436fc85405c3f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/0a0217b4010707b6b7aaee374d3e9151.jpg?cv=2' },
      { item_id: '1783', type: 'rare_sunken_city_treasure_chest_convertible', name: 'Rare Sunken City Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/c5c6e22e9b5fa3fd351c48abd1c63b2e.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/f061b094c20ae962b096393071a9868c.jpg?cv=2' },
      { item_id: '2926', type: 'gilded_coin_treasure_chest_convertible', name: 'Gilded Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/a4b0939e2b28aec5585cb0046ffda21f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a4d4c5610d5e47029d273a1998aa6130.jpg?cv=2' },
      // { 'item_id': '1977', 'type': 'rare_small_rainbow_treasure_chest_convertible', 'name': 'Rare Small Rainbow Treasure Chest', 'thumbnail': 'https://www.mousehuntgame.com/images/items/convertibles/97226888c57c11c94ce41ec04350ff76.gif?cv=2', "thumbnail_gray": "https://www.mousehuntgame.com/images/items/collectibles/gray/d710f5692a6e18e3fde2718e13e4f514.jpg?cv=2" },
      { item_id: '2377', type: 'chrome_medium_treasure_chest_convertible', name: 'Medium Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b3433b218620f18ea8c8c787ab386095.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/d00c0cba1abc043412784ad72a8d6380.jpg?cv=2' },
      { item_id: '1760', type: 'isles_treasure_chest_convertible', name: 'Tribal Isles Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/81bbeec4071518f10825aa152bc2ab6d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/1c08475b861e27b1b3f26942ee594844.jpg?cv=2' },
      { item_id: '2635', type: 'queso_canyoneer_treasure_chest_convertible', name: 'Queso Canyoneer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/1fbe8f68e8085247e86ce50c92311e29.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/09850b379da18eefe098b42d8b3dc18c.jpg?cv=2' },
      { item_id: '2419', type: 'warpath_treasure_chest_convertible', name: 'Warpath Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8f3702e1c3e771deb13cd0ad13e903fb.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a853f2e29fb37db6b0f191e766b1bc3d.jpg?cv=2' },
      { item_id: '1777', type: 'rare_isles_treasure_chest_convertible', name: 'Rare Tribal Isles Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9e3ee93888c30530d4adb81d243ca0ea.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/d222b32f01a3619d9924897e64fe2a51.jpg?cv=2' },
      { item_id: '2858', type: 'rare_c_boss_elite_treasure_chest_convertible', name: 'Rare Elite Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d92d923e382c2f85c11a53805f839b42.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/69994204e187a4f6d6e881643dc83ec8.jpg?cv=2' },
      { item_id: '2474', type: 'lightning_slayer_chest_convertible', name: 'Lightning Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9260cc3d492d7cf2b4d830da86a1077a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7d61f3fb6f9770ce5580e89eff70cff1.jpg?cv=2' },
      { item_id: '1782', type: 'rare_shelder_treasure_chest_convertible', name: 'Rare Shelder Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/909703f7914acf4f56619f00ea8f34f6.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/94b0d33a8835b13e1015717bdd53cac4.jpg?cv=2' },
      { item_id: '2383', type: 'rare_chrome_hard_treasure_chest_convertible', name: 'Rare Hard Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/f85036b673ae33160b0a01ceaa119bba.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/71671923917fefe6289bb843ad05f627.jpg?cv=2' },
      { item_id: '1956', type: 'toxic_elite_treasure_chest_convertible', name: 'Archduke/Archduchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/48096c7093a4f162430fa19b92b9ed56.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6a4fc748d42dd5d80d5c35c7bda576ff.jpg?cv=2' },
      { item_id: '2356', type: 'rare_riftstalker_treasure_chest_convertible', name: 'Rare Rift Stalker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/ef6e0087c73c07973c6669acab55470c.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/f34429c2dcf9beedf462be2de096a0e2.jpg?cv=2' },
      { item_id: '2131', type: 'relic_treasure_chest_convertible', name: 'Golden Jade Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/6c1cc6a113fc47a18201139d464e84f1.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/a1ad68b8ad8d59dd0e232cf346723379.jpg?cv=2' },
      { item_id: '2166', type: 'rare_boss_hard_treasure_chest_convertible', name: 'Rare Hard Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/cf9d338aa3cfe8fcc1961cdbf062d823.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6d65ef05808af3bc199e64fa46fe9f42.jpg?cv=2' },
      { item_id: '2849', type: 'chrome_boss_easy_treasure_chest_convertible', name: 'Easy Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/1894cf461080f21acb640c5146a3b1ce.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/3145835514d0db0614eb94144d2df9db.jpg?cv=2' },
      { item_id: '1789', type: 'riftwalker_treasure_chest_convertible', name: 'Rift Walker Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d3622b73b90054dd5fb0d79e43bb88e1.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/4456c640bc6a4cc79b54c124f2d94cbd.jpg?cv=2' },
      { item_id: '3472', type: 'rare_farming_fishing_treasure_chest_convertible', name: 'Rare Farming and Fishing Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/111553d708150018f3ebe2a60363f6bf.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/7873d5525d8170bf804b1336b277cc66.jpg?cv=2' },
      { item_id: '3517', type: 'rare_new_years_chest_convertible', name: 'Rare New Year\'s Party Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/e50dc39ef893ab503e994e4723463e7f.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/bf309a584f3cb8681492af76c49fa2a5.jpg?cv=2' },
      { item_id: '3043', type: 'rare_sky_pirate_treasure_chest_convertible', name: 'Rare Sky Pirate Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/0cd3a219671a97faa46b926d8f089330.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/f5139940f118e037d425e635dd50d0f2.jpg?cv=2' },
      { item_id: '2828', type: 'rare_queso_canyon_tour_treasure_chest_convertible', name: 'Rare Queso Canyon Grand Tour Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/4847329e0bd4d88d10a1b08a015e7b3d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/b0c2ed598a4123b76559951000473176.jpg?cv=2' },
      { item_id: '3468', type: 'farming_fishing_treasure_chest_convertible', name: 'Farming and Fishing Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/430088aea6927ab9b335229ff4e0856c.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/d40fa4c45af0d4298d4319b0df1259ce.jpg?cv=2' },
      { item_id: '2853', type: 'chrome_boss_medium_treasure_chest_convertible', name: 'Medium Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/0592875b8fb8b7311296a6746afbb610.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/20df0e9352bdf1aa354536013dc34963.jpg?cv=2' },
      { item_id: '1793', type: 'sunken_city_treasure_chest_convertible', name: 'Sunken City Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d94d60342c05c03a047276e4fd00aa30.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6d4918bf73cc4f3561049f9c3e7c7c0c.jpg?cv=2' },
      { item_id: '1951', type: 'rare_toxic_medium_treasure_chest_convertible', name: 'Rare Lord/Lady Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/3610d5273f5428915096c7546808ccf1.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/32ffd81dff542f965fd85d22d6b14a9c.jpg?cv=2' },
      { item_id: '2384', type: 'rare_chrome_medium_treasure_chest_convertible', name: 'Rare Medium Chrome Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/24d6d439aec4a34b14dd60b27e6bf97b.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/6f81f6c744d85317769c67b60f492348.jpg?cv=2' },
      { item_id: '1947', type: 'rare_toxic_easy_treasure_chest_convertible', name: 'Rare Hero Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/ac00f2faa54365b2844765b340d22574.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/d506ac1f4a24ab4ad9e90f2462bfbe18.jpg?cv=2' },
      { item_id: '2111', type: 'rare_burroughs_rift_treasure_chest_convertible', name: 'Rare Burroughs Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/600a69dfa799e167463de668ab713f80.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/59987be8273a66108b4b5fb3eb4e9ddf.jpg?cv=2' },
      { item_id: '1785', type: 'rare_valour_treasure_chest_convertible', name: 'Rare Valour Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d8a4463e21792d21596fe37ef17bd23c.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/990ad9ab18067afb3598a6fca0b0ac53.jpg?cv=2' },
      { item_id: '2147', type: 'boss_arduous_treasure_chest_convertible', name: 'Arduous Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b1c40db4112d3478c4b8ab6be5a0f9c0.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/8445676f5354b53d555c06dc3a67c27c.jpg?cv=2' },
      { item_id: '2110', type: 'gnawnia_rift_treasure_chest_convertible', name: 'Gnawnia Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/72f1761037bfb96c23e41567c96da7bc.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/07b0392d1782e7fe235d6ef4d1019cea.jpg?cv=2' },
      { item_id: '1946', type: 'rare_toxic_arduous_treasure_chest_convertible', name: 'Rare Grand Duke/Duchess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/addea463ca49c1c8991531ee11e17224.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/3a9701ca93f3390c79bfe88c827e8350.jpg?cv=2' },
      { item_id: '2106', type: 'burroughs_rift_treasure_chest_convertible', name: 'Burroughs Rift Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/32e1b893dc71a5ac7b19c5202b9ea4f8.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/26079e8d8f05be68976f48b66f59675d.jpg?cv=2' },
      { item_id: '1950', type: 'rare_toxic_hard_treasure_chest_convertible', name: 'Rare Count/Countess Toxic Spill Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9e589f272f2a6bedf43445515b290dd0.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/e2e21e083b3e62ebc95be860dd04ba5b.jpg?cv=2' },
      { item_id: '2151', type: 'boss_hard_treasure_chest_convertible', name: 'Hard Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/998b5e419e5b167a3abaa721708157b2.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/ddb687ceec6569747d99f1b1adae4fba.jpg?cv=2' },
      { item_id: '2852', type: 'chrome_boss_hard_treasure_chest_convertible', name: 'Hard Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/b74213db1ce254a85700e00a9b1ad340.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/b16ba5255436c78859709f3e789d1e3f.jpg?cv=2' },
      { item_id: '3469', type: 'ff_prelude_treasure_chest_convertible', name: 'Folklore Forest Prelude Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/8fd531683344af8df0c807626fff0863.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/32a66ea1a7b190c7a990c0ce47ebbec3.jpg?cv=2' },
      { item_id: '1747', type: 'catacombs_treasure_chest_convertible', name: 'Acolyte Realm Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/dd23459ac9209c88b525a3694feda9ac.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c7eb8cb864c71fb8d815f66fb42e27a2.jpg?cv=2' },
      { item_id: '3473', type: 'rare_ff_prelude_treasure_chest_convertible', name: 'Rare Folklore Forest Prelude Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/984f054080de530c62f25fff4e82933a.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/4f80b51f850693185675102c87451003.jpg?cv=2' },
      { item_id: '2848', type: 'chrome_boss_arduous_treasure_chest_convertible', name: 'Arduous Chrome Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/d06b348388d1d5dbff28690b9d944ab1.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/c63bd45290e57fb85e883e7b23a941ea.jpg?cv=2' },
      { item_id: '1970', type: 'giant_rainbow_treasure_chest_convertible', name: 'Giant Rainbow Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/377eb3e27b0bfad86f883ed17060d329.gif?cv=2', "thumbnail_gray": "https://www.mousehuntgame.com/images/items/collectibles/gray/a4c42ef4d0f03c942f7eb1dfce2ad055.jpg?cv=2" },
      { item_id: '2167', type: 'rare_boss_medium_treasure_chest_convertible', name: 'Rare Medium Slayer Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/9194420f8a885441b90421b068da9e72.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/447a696fda55a61e713b77c88cc21682.jpg?cv=2' }
      { item_id: '3611', type: 'beanstalk_treasure_chest_convertible', name: 'Bountiful Beanstalk Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/3faa925e04006aa7cc7aad7f1d24008d.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/f2af11cf591b11dbf571c14cb415cc48.jpg?cv=2' },
      { item_id: '3614', type: 'rare_beanstalk_treasure_chest_convertible', name: 'Rare Bountiful Beanstalk Treasure Chest', thumbnail: 'https://www.mousehuntgame.com/images/items/convertibles/69339eb720246c6bdb52c9ed69c61153.gif?cv=2', thumbnail_gray: 'https://www.mousehuntgame.com/images/items/collectibles/gray/fcabbb74823de7e0550767d7b19aab64.jpg?cv=2' },
    ], 'special', 'treasure_chests', 'chest', 'Treasure Chests');
  };

  const addPlankrunPages = async () => {
    addCategoryAndItems([
      { item_id: '1078', type: 'rift_notes_1_torn_page', name: 'Plankrun\'s Rift Notes 1', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/21bbdce538747cef71d28e4e07510231.gif?cv=2' },
      { item_id: '161', type: 'dojo_torn_page', name: 'Plankrun\'s Dojo Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/5cb229d483050b5b1f80ec920b59adbb.gif?cv=2' },
      { item_id: '160', type: 'back_cover_torn_page', name: 'Plankrun\'s Journal Back Cover', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/f35e6a4a74552b97bc0e43319187a57d.gif?cv=2' },
      { item_id: '1076', type: 'dark_magi_torn_page', name: 'Plankrun\'s Dark Magi Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/f9f9d8271d716103c55926c06dcf01dd.gif?cv=2' },
      { item_id: '900', type: 'deep_mouse_torn_page', name: 'Plankrun\'s Iceberg Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/8c1b907bb3959747419aa45402482cc4.gif?cv=2' },
      { item_id: '1077', type: 'king_scarab_torn_page', name: 'Plankrun\'s King Scarab Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/23cd00781604e05a6805e16ee963a9af.gif?cv=2' },
      { item_id: '1082', type: 'shattered_carmine_2_torn_page', name: 'Plankrun\'s Shattered Carmine Notes 2', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/8e41de778a3c92a32e869f1e144ad00f.gif?cv=2' },
      { item_id: '1081', type: 'shattered_carmine_1_torn_page', name: 'Plankrun\'s Shattered Carmine Notes 1', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/5b80b091ed0dac56f56c472b25fb1b9c.gif?cv=2' },
      { item_id: '1079', type: 'rift_notes_2_torn_page', name: 'Plankrun\'s Rift Notes 2', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/f1db0869f17c675712df29f184583b32.gif?cv=2' },
      { item_id: '1653', type: 'whisker_woods_rift_torn_page', name: 'Plankrun\'s Whisker Woods Rift Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/76c971eb29ba746121ecaaa10c7defb6.gif?cv=2' },
      { item_id: '1080', type: 'rift_notes_3_torn_page', name: 'Plankrun\'s Rift Notes 3', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/c7d17dcb03c82e224517cc916b2c971a.gif?cv=2' },
      { item_id: '163', type: 'gnawnia_torn_page', name: 'Plankrun\'s Gnawnia Notes', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/12db753b4cb0fdcdc2cfbbb6b6f9bd06.gif?cv=2' },
      { item_id: '162', type: 'front_cover_torn_page', name: 'Plankrun\'s Journal Cover', thumbnail: 'https://www.mousehuntgame.com/images/items/torn_pages/bf51e70097f2a8a25d71bc714582a9bd.gif?cv=2' }
    ], 'plankrun', 'general', 'plankrun', 'Plankrun Pages');
  };

  const addAirships = async () => {
    addCategoryAndItems([
      { item_id: '3166', type: 'airship_balloon_lny_ox_stat_item', name: 'Year of the Ox Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/c631a6dcdfc4658481e0c771237e0cc5.gif?cv=2' },
      { item_id: '3280', type: 'airship_hull_empyrean_stat_item', name: 'Empyrean Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/0d97f641bfe5e3d6cd8673d386c186f2.gif?cv=2' },
      { item_id: '3253', type: 'airship_hull_chrome_stat_item', name: 'Chrome Cutter Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/c573c1b55d5e4f2a77c8c050ec6df78c.gif?cv=2' },
      { item_id: '3396', type: 'airship_sail_factory_stat_item', name: 'Factory Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/abc0e9b0f068ac75646ed3dff82de698.gif?cv=2' },
      { item_id: '3066', type: 'airship_sail_mineral_stat_item', name: 'Glistening Galleon Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/859f3f05821afdfcd48e7510c361e222.gif?cv=2' },
      { item_id: '3125', type: 'airship_hull_gilded_stat_item', name: 'Gilded Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/01e14f125640e9e7071e61b8b42c3f8b.gif?cv=2' },
      { item_id: '3061', type: 'airship_hull_plant_stat_item', name: 'Skyflower Felucca Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/3ba754923204e55cf9a841d782f1d542.gif?cv=2' },
      { item_id: '3124', type: 'airship_balloon_gilded_stat_item', name: 'Gilded Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/a4d1ad7b0440a43d900e885b6a530541.gif?cv=2' },
      { item_id: '3348', type: 'airship_hull_holiday_express_stat_item', name: 'Holiday Express Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/323554ef5854f708d6cdb81fefbc2d8a.gif?cv=2' },
      { item_id: '3411', type: 'airship_sail_marzipan_stat_item', name: 'Marzipan Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/57fc7c5d110d4f9ab2dd8eb6b752f6d2.gif?cv=2' },
      { item_id: '3295', type: 'airship_sail_gloomy_galleon_stat_item', name: 'Gloomy Galleon Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/f83c5e17e96171ab20b468945c9224f5.gif?cv=2' },
      { item_id: '3542', type: 'airship_hull_lny_stat_item', name: 'Lunar New Year Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/1fddb43dbd9a7af7d963530146b3c88f.gif?cv=2' },
      { item_id: '3543', type: 'airship_sail_lny_stat_item', name: 'Lunar New Year Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/77bffba0748f44880c010867f980e522.gif?cv=2' },
      { item_id: '3057', type: 'airship_hull_cloud_stat_item', name: 'Cloud Cruiser Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/ef53b3cae4e48723b3707ea4e358f267.gif?cv=2' },
      { item_id: '3056', type: 'airship_hull_astral_stat_item', name: 'Astral Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/190ea1502ce4aed0a63c20eacad8cb73.gif?cv=2' },
      { item_id: '3294', type: 'airship_hull_gloomy_galleon_stat_item', name: 'Gloomy Galleon Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/140e5be397888b8b624eb5268fa3c6e4.gif?cv=2' },
      { item_id: '3410', type: 'airship_hull_marzipan_stat_item', name: 'Marzipan Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/e3e3075e8abd726c7e125a4a3b6cb7c7.gif?cv=2' },
      { item_id: '3386', type: 'airship_sail_tiger_stat_item', name: 'Year of the Tiger Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/58d18cd3d2106e8d90de45ace9373bd6.gif?cv=2' },
      { item_id: '3200', type: 'airship_sail_vrift_stat_item', name: 'Valorous Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/5e7068ab6c24c149dda5ed1a2a3cc1ae.gif?cv=2' },
      { item_id: '3168', type: 'airship_sail_lny_ox_stat_item', name: 'Year of the Ox Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/772c8ef043b1b153c38f689f3824db22.gif?cv=2' },
      { item_id: '3236', type: 'airship_sail_spring_stat_item', name: 'Springtime Schooner Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/937534f6df9364643aafee7637f0b80b.gif?cv=2' },
      { item_id: '3349', type: 'airship_hull_new_years_stat_item', name: 'New Year\'s Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/98476dfa8674251722e50ac1988089d5.gif?cv=2' },
      { item_id: '3060', type: 'airship_hull_pirate_stat_item', name: 'Pirate Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/5b789dfb29ef7cdc8c91f648968f9bf3.gif?cv=2' },
      { item_id: '3102', type: 'airship_hull_ghost_ship_stat_item', name: 'Ghost Galleon Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/91b711c897e9279d407527b724e12ec8.gif?cv=2' },
      { item_id: '3293', type: 'airship_balloon_gloomy_galleon_stat_item', name: 'Gloomy Galleon Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/c71c21ad769cd8ff952857933f4bf1ee.gif?cv=2' },
      { item_id: '3051', type: 'airship_balloon_deluxe_stat_item', name: 'Richard\'s Sky Yacht Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/e7995da95153f271a9f805ccf091209d.gif?cv=2' },
      { item_id: '3067', type: 'airship_sail_pirate_stat_item', name: 'Pirate Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/c08491148a6248cf8eab86b86e6b59a8.gif?cv=2' },
      { item_id: '3477', type: 'airship_balloon_bookmobile_stat_item', name: 'Floating Bookmobile Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/d1815355fde25669991ea0e540556aa7.gif?cv=2' },
      { item_id: '3050', type: 'airship_balloon_cloud_stat_item', name: 'Cloud Cruiser Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/2a8ab5854a005d7a0b190a4016bea2bf.gif?cv=2' },
      { item_id: '3103', type: 'airship_sail_ghost_ship_stat_item', name: 'Ghost Galleon Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/42a5213167d9b971eeb7b683565f8804.gif?cv=2' },
      { item_id: '3139', type: 'airship_balloon_winter_stat_item', name: 'Great Winter Hunt Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/aafcb84ee6624b253852cd98c2cf8ca1.gif?cv=2' },
      { item_id: '3053', type: 'airship_balloon_pirate_stat_item', name: 'Pirate Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/171cc0836694ec8817d64670e32fb731.gif?cv=2' },
      { item_id: '3395', type: 'airship_hull_factory_stat_item', name: 'Factory Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/b0f3a7b98d66837f65c93a24a6af914b.gif?cv=2' },
      { item_id: '3141', type: 'airship_sail_winter_stat_item', name: 'Great Winter Hunt Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/cb630358ffb2127adb572b97f5611ffa.gif?cv=2' },
      { item_id: '3252', type: 'airship_balloon_chrome_stat_item', name: 'Chrome Cutter Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/5b20a2033a06303114906e1b0554aa76.gif?cv=2' },
      { item_id: '3069', type: 'airship_sail_porcelain_stat_item', name: 'Porcelain Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/b8664cb88b1b843a4f8b47ea14b09fa2.gif?cv=2' },
      { item_id: '3182', type: 'airship_balloon_birthday_stat_item', name: 'Birthday Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/3959c1ca24cf7d4e9e14600659fa9fa0.gif?cv=2' },
      { item_id: '3478', type: 'airship_hull_bookmobile_stat_item', name: 'Floating Bookmobile Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/324ca9aef77d4608bc80515269d9a757.gif?cv=2' },
      { item_id: '3049', type: 'airship_balloon_astral_stat_item', name: 'Astral Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/240d099894c054a13faf9d484400a1e2.gif?cv=2' },
      { item_id: '3198', type: 'airship_balloon_vrift_stat_item', name: 'Valorous Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/d34a86534f842e9bcfdca6d187f1acf4.gif?cv=2' },
      { item_id: '3065', type: 'airship_sail_deluxe_stat_item', name: 'Richard\'s Sky Yacht Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/fa3cfc16fa247962aefb02c2df50571b.gif?cv=2' },
      { item_id: '3064', type: 'airship_sail_cloud_stat_item', name: 'Cloud Cruiser Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/89a6bdcaddfad8275fa2dbdf9e25e3cf.gif?cv=2' },
      { item_id: '3199', type: 'airship_hull_vrift_stat_item', name: 'Valorous Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/93d043519f1f00bb9e79404f4190940b.gif?cv=2' },
      { item_id: '3479', type: 'airship_sail_bookmobile_stat_item', name: 'Floating Bookmobile Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/5f52e0cd80d56a95d40dd61761dfd8c3.gif?cv=2' },
      { item_id: '3183', type: 'airship_hull_birthday_stat_item', name: 'Birthday Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/815e445a5be74bd5918f442906d43b17.gif?cv=2' },
      { item_id: '3068', type: 'airship_sail_plant_stat_item', name: 'Skyflower Felucca Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/f601a95675e59f03e5bae97157578a2e.gif?cv=2' },
      { item_id: '3101', type: 'airship_balloon_ghost_ship_stat_item', name: 'Ghost Galleon Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/97203a9e9dfe5a5749e3ac4e3a43e391.gif?cv=2' },
      { item_id: '3140', type: 'airship_hull_winter_stat_item', name: 'Great Winter Hunt Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/5abf49c5b748faf3aaf8bd8794b485a2.gif?cv=2' },
      { item_id: '3394', type: 'airship_balloon_factory_stat_item', name: 'Factory Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/98469a65b4bfb6b841a7fc765900c76e.gif?cv=2' },
      { item_id: '3052', type: 'airship_balloon_mineral_stat_item', name: 'Glistening Galleon Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/116b83104790fcc05ae53c6d0df69dc3.gif?cv=2' },
      { item_id: '3235', type: 'airship_hull_spring_stat_item', name: 'Springtime Schooner Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/e66cadfb6a95d2d5f35f8498a219508c.gif?cv=2' },
      { item_id: '3409', type: 'airship_balloon_marzipan_stat_item', name: 'Marzipan Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/f4e1878d9a2f4b6088e1f37c4eafd392.gif?cv=2' },
      { item_id: '3059', type: 'airship_hull_mineral_stat_item', name: 'Glistening Galleon Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/431e75c6b6cc816f70802446fd487d8b.gif?cv=2' },
      { item_id: '3126', type: 'airship_sail_gilded_stat_item', name: 'Gilded Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/ba27e2efa74496338abea6a290abda8c.gif?cv=2' },
      { item_id: '3063', type: 'airship_sail_astral_stat_item', name: 'Astral Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/b08ead747835f19a092527fdedc04777.gif?cv=2' },
      { item_id: '3167', type: 'airship_hull_lny_ox_stat_item', name: 'Year of the Ox Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/01a725bf08f068133586d4521a30dfd9.gif?cv=2' },
      { item_id: '3055', type: 'airship_balloon_porcelain_stat_item', name: 'Porcelain Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/1891a607247ec408aabd4d9ce31860c5.gif?cv=2' },
      { item_id: '3281', type: 'airship_sail_empyrean_stat_item', name: 'Empyrean Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/b8b31f4c9f8a83787bb7d1b7b39c962d.gif?cv=2' },
      { item_id: '3385', type: 'airship_hull_tiger_stat_item', name: 'Year of the Tiger Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/2ce6a3c200b7fd83fba46d724448cef7.gif?cv=2' },
      { item_id: '3254', type: 'airship_sail_chrome_stat_item', name: 'Chrome Cutter Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/f45f922e97b11fe21ef74c08dd8185ce.gif?cv=2' },
      { item_id: '3346', type: 'airship_balloon_holiday_express_stat_item', name: 'Holiday Express Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/6cff3b93bf28f0e106c31158b29e8e86.gif?cv=2' },
      { item_id: '3350', type: 'airship_sail_holiday_express_stat_item', name: 'Holiday Express Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/f3b4fb5462c68292d8e4982474cbc002.gif?cv=2' },
      { item_id: '3184', type: 'airship_sail_birthday_stat_item', name: 'Birthday Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/34dfcc7a7b54618b4c53dac570ac77b0.gif?cv=2' },
      { item_id: '3351', type: 'airship_sail_new_years_stat_item', name: 'New Year\'s Airship Sail', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/d4b65ce6df9c52bbfbc60afb55faeff2.gif?cv=2' },
      { item_id: '3347', type: 'airship_balloon_new_years_stat_item', name: 'New Year\'s Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/24788599d5fbaad605b4c9aa0c5c1bcc.gif?cv=2' },
      { item_id: '3384', type: 'airship_balloon_tiger_stat_item', name: 'Year of the Tiger Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/d9446e7c07e608a74a7d1587c9cbc189.gif?cv=2' },
      { item_id: '3279', type: 'airship_balloon_empyrean_stat_item', name: 'Empyrean Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/9d5d981c7904a86e0ab86418822fe129.gif?cv=2' },
      { item_id: '3054', type: 'airship_balloon_plant_stat_item', name: 'Skyflower Felucca Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/138073c593badfb9bcae7dee6a81689a.gif?cv=2' },
      { item_id: '3541', type: 'airship_balloon_lny_stat_item', name: 'Lunar New Year Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/4c3e247cdff0e3890a160d038b7cb4f6.gif?cv=2' },
      { item_id: '3062', type: 'airship_hull_porcelain_stat_item', name: 'Porcelain Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/c4eae7d60189722e1d67bdc59f17fa38.gif?cv=2' },
      { item_id: '3058', type: 'airship_hull_deluxe_stat_item', name: 'Richard\'s Sky Yacht Airship Hull', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/4a6f8e097cd8f835d5e10910f2225783.gif?cv=2' },
      { item_id: '3234', type: 'airship_balloon_spring_stat_item', name: 'Springtime Schooner Airship Balloon', thumbnail: 'https://www.mousehuntgame.com/images/items/stats/951f009629deb210f74ab3127ddfb2ab.gif?cv=2' }
    ], 'special', 'cosmetics', 'airships', 'Airships');
  };

  const addSEH = async () => {
    addCategoryAndItems([
      {
      }
    ], 'special', 'spring_hunt', 'egg', 'Spring Egg Hunt');
  };

  const addEquipment = async () => {
    addCategoryAndItems([
      { "item_id": 2334, "type": "rift_hourglass_stat_item", "name": "Ancient Hourglass", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/86006a5a583e0b510c2d956ceb2aa9ba.png?cv=2" },
      { "item_id": 3418, "type": "chrome_codex_stat_item", "name": "Chrome Codex", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/9e93cfb618d3bfd87661d8ff8f099052.png?cv=2" },
      { "item_id": 2888, "type": "codex_of_valor_bard_page_stat_item", "name": "Codex of Valour: Bard Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/3c483f6680a30026e7107df802d1f4ce.png?cv=2" },
      { "item_id": 2889, "type": "codex_of_valor_dust_page_stat_item", "name": "Codex of Valour: Dusty Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/c983a0437e2409b0a2296cb5f9809ef3.png?cv=2" },
      { "item_id": 2890, "type": "codex_of_valor_eclipse_page_stat_item", "name": "Codex of Valour: Eclipse Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5dde79954a905480572d954a3bff3208.png?cv=2" },
      { "item_id": 2891, "type": "codex_of_valor_magic_page_stat_item", "name": "Codex of Valour: Magic Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/79f69339aa1bca5c678ea754424052fe.png?cv=2" },
      { "item_id": 2892, "type": "codex_of_valor_melee_page_stat_item", "name": "Codex of Valour: Melee Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/648da7cd68ec4cdebaa4244df0716c7f.png?cv=2" },
      { "item_id": 2893, "type": "codex_of_valor_nobility_page_stat_item", "name": "Codex of Valour: Noble Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8d0b3fe7261c8d121c302992ebe8ebae.png?cv=2" },
      { "item_id": 2894, "type": "codex_of_valor_puppetry_page_stat_item", "name": "Codex of Valour: Puppetry Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/cff33d01270826ccd4e619b6e969184e.png?cv=2" },
      { "item_id": 2895, "type": "codex_of_valor_thievery_page_stat_item", "name": "Codex of Valour: Thievery Page", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5acc2cc5a1594204bf91fda1b2e416cb.png?cv=2" },
      { "item_id": 2426, "type": "moussu_picchu_fealty_stat_item", "name": "Climbing Boots of Fealty", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/95fb3ea7e1ed68bea4393b968279ea4b.png?cv=2" },
      { "item_id": 2428, "type": "moussu_picchu_tech_stat_item", "name": "Climbing Grapnel of Tech", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/01db012fdbc68b151f913c29133d77ca.png?cv=2" },
      { "item_id": 2427, "type": "moussu_picchu_scholar_stat_item", "name": "Climbing Vine of Scholars", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/a708b8b126f67a55f509dba142aef998.png?cv=2" },
      { "item_id": 889, "type": "iceberg_drill_level_four_stat_item", "name": "Diamond Ice Drill", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/7ae345b6f2bde9a47e662b6a750d627c.gif?cv=2" },
      { "item_id": 3271, "type": "empyrean_codex_stat_item", "name": "Empyrean Codex", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5392f862aaed731800d8bee0c8094395.png?cv=2" },
      { "item_id": 3255, "type": "high_altitude_license_stat_item", "name": "High Altitude Flight License", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/a672ac78ebc5db9c51a0aa356fc6b3c0.png?cv=2" },
      { "item_id": 890, "type": "iceberg_drill_level_one_stat_item", "name": "Ice Drill Mk. I", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/61e2718c5a6f5e092c89bb9620d1c6e9.gif?cv=2" },
      { "item_id": 892, "type": "iceberg_drill_level_two_stat_item", "name": "Ice Drill Mk. II", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/e703b61f46f71e7823c11d883aa2b887.gif?cv=2" },
      { "item_id": 891, "type": "iceberg_drill_level_three_stat_item", "name": "Ice Drill Mk. III", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/01ef6c31b2cd160f1bf49868cae51d02.gif?cv=2" },
      { "item_id": 1912, "type": "labyrinth_lantern", "name": "Labyrinth Lantern", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/d1c4774c7afebe379bef83d30b81f069.png?cv=2" },
      { "item_id": 1334, "type": "large_waste_barrel_stat_item", "name": "Large Refining Barrel", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/fc76ba2c71538601379542e747e2e581.png?cv=2" },
      { "item_id": 1546, "type": "null_gauntlet_stat_item", "name": "Null Gauntlet", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/31165dbf6b6db915f6973f44b251f866.png?cv=2" },
      { "item_id": 1525, "type": "marketplace_sell_regal_display_case_collectible", "name": "Regal Marketplace Display Case", "thumbnail": "https://www.mousehuntgame.com/images/items/collectibles/762c3b06c27fc0469728e200a66a4ecf.jpg?cv=2" },
      { "item_id": 1524, "type": "marketplace_buy_regal_stool_collectible", "name": "Regal Marketplace Stool", "thumbnail": "https://www.mousehuntgame.com/images/items/collectibles/c85a2f3dee19e25eb27e1cbba052e256.jpg?cv=2" },
      { "item_id": 2880, "type": "rift_chronometer_stat_item", "name": "Rift Chronometer", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/210796b9e766d0c2e3f5133446b3f874.png?cv=2" },
      { "item_id": 2335, "type": "rift_luck_codex_stat_item", "name": "Riftstalker Codex", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5aac08c099e23916f710c99f7817c89a.png?cv=2" },
      { "item_id": 528, "type": "desert_warpath_victory_stat_item", "name": "Warpath Victory", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/85fdfa73d10ab54dd0ff5262502a0ebc.gif?cv=2" },
    ], 'special', 'equipment', 'equipment', 'Equipment');
  };

  const addCurrency = () => {
    addCategoryAndItems([
      { "item_id": 2837, "type": "amber_queso_stat_item", "name": "Solidified Amber Queso", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/2c9ee9d04b52417619c801bbd739d8bd.png?cv=2" },
      { "item_id": 2217, "type": "blood_stone_stat_item", "name": "Bloodstone", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/0d56bbd0ac94ef0889eacd7c527981cd.png?cv=2" },
      { "item_id": 3071, "type": "cloudstone_bangle_stat_item", "name": "Cloudstone Bangle", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8d1699fd300627b4915408b8c8fae60f.png?cv=2" },
      { "item_id": 3448, "type": "crop_coin_stat_item", "name": "Crop Coin", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/d684728c0097e077c32ea0ecb211a542.png?cv=2" },
      { "item_id": 2459, "type": "cursed_gold_stat_item", "name": "Cursed Gold", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5954fd7a6c2d880ba4e533c35223b2cf.png?cv=2" },
      { "item_id": 2218, "type": "dawn_dust_stat_item", "name": "Dawn Dust", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/2f8b7e0490ccb116b0a12598314705c0.png?cv=2" },
      { "item_id": 887, "type": "diamond_ice_drill_tip_stat_item", "name": "Diamond Drill Bits", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/2aa7b95c589e5c0deacc3d225a592d61.gif?cv=2" },
      { "item_id": 2219, "type": "droid_bird_stat_item", "name": "Animatronic Bird", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/a6daf326f639ef94cbde88c13fda5945.png?cv=2" },
      { "item_id": 3272, "type": "empyrean_seal_stat_item", "name": "Empyrean Seal", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/a53a5b3c32ff2c56ad8b5b0dba86a48e.png?cv=2" },
      { "item_id": 3072, "type": "enchanted_wing_stat_item", "name": "Enchanted Wing", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/1de12fa4180e565837d6195988c79dfc.png?cv=2" },
      { "item_id": 3075, "type": "floating_trap_upgrade_stat_item", "name": "Adorned Empyrean Jewel", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/2f116b49f7aebb66942a4785c86ec984.png?cv=2" },
      { "item_id": 1528, "type": "flour_stat_item", "name": "Packet of Flour", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/4df00c7d4fb8f7e8dab472b7d58e412a.png?cv=2" },
      { "item_id": 1175, "type": "fools_gold_stat_item", "name": "Fool's Gold", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/f5d48b654963d5ec7e843343f6ea3848.png?cv=2" },
      { "item_id": 2897, "type": "gauntlet_elixir_stat_item", "name": "Gauntlet Elixir", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/cea165ab2742a404d120ea18da067d90.png?cv=2" },
      { "item_id": 2936, "type": "gilded_coin_stat_item", "name": "Gilded Coin", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/227dd930ce5f7e2f0990bfc1c37564af.png?cv=2" },
      { "item_id": 3449, "type": "gnawbel_prize_stat_item", "name": "Gnawbel Prize for Literature", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8767d5e6f8ed5f4d2a66ae605b545a3f.png?cv=2" },
      { "item_id": 2221, "type": "howlite_stat_item", "name": "Howlite", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/c80c6c321bf149e24dfd21a95524270a.png?cv=2" },
      { "item_id": 2838, "type": "hydro_geyser_trap_stat_item", "name": "Queso Thermal Spring", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/209ca347c42ff56071ddd50f087a5bb8.png?cv=2" },
      { "item_id": 2839, "type": "magic_cork_dust_stat_item", "name": "Magic Nest Dust", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/064127d4a56d4bc22901fed58ea9e58f.png?cv=2" },
      { "item_id": 2618, "type": "nachore_stat_item", "name": "Nachore", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/2df50ade4901b247c3a7dc53decc6c02.png?cv=2" },
      { "item_id": 2840, "type": "physical_geyser_trap_stat_item", "name": "Geyser Smolder Stone", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/d9e49c728a60992e07a576fb228153d4.png?cv=2" },
      { "item_id": 3453, "type": "pond_penny_stat_item", "name": "Pond Penny", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/0d9c27478f6e2a38f683da6ff0d274bd.png?cv=2" },
      { "item_id": 420, "type": "prize_credit_stat_item", "name": "King's Credit", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/3409eacfb04b14c822cc263137fe1a6b.png?cv=2" },
      { "item_id": 3273, "type": "raw_ancient_jade_stat_item", "name": "Raw Ancient Jade", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/9ada7e603f735bfe5aa0831d98a05828.png?cv=2" },
      { "item_id": 1421, "type": "raw_rift_crystal_stat_item", "name": "Raw Rift Crystal", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/e0119c38af3e1fb9b11f7bf2c9fe5e9b.png?cv=2" },
      { "item_id": 1547, "type": "rift_circuitry_stat_item", "name": "Rift Circuitry", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/c4a04d04f282d818a9d63c4c9b7e3c02.png?cv=2" },
      { "item_id": 2332, "type": "rift_clockwork_cog_stat_item", "name": "Clockwork Cog", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/21f96481feb237aca6c2b326b0b935f3.png?cv=2" },
      { "item_id": 2898, "type": "rift_gaunt_upgrade_a_stat_item", "name": "Tower Sigil", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/162bc786237b82ee70fb42c254a8ce33.png?cv=2" },
      { "item_id": 2899, "type": "rift_gaunt_upgrade_b_stat_item", "name": "Tower Secrets", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/b177168eeec7d2c8c510b56f969cd8a4.png?cv=2" },
      { "item_id": 2339, "type": "rift_sprocket_stat_item", "name": "Tiny Sprocket", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/ca9ef31f3109d810916b5fbf0f70271a.png?cv=2" },
      { "item_id": 1511, "type": "sand_dollar_stat_item", "name": "Sand Dollar", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8bac8cfe92d6d835428639e1720b40dd.png?cv=2" },
      { "item_id": 2901, "type": "shade_eclipse_resource_stat_item", "name": "Fragment of the Eclipse", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8337f28a7c4a1e6d6dc5d43c55b4075f.png?cv=2" },
      { "item_id": 2222, "type": "silver_bolt_stat_item", "name": "Silver Bolt", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/b9be730eb5bc9e9dd3e6d9c2143511f2.png?cv=2" },
      { "item_id": 3076, "type": "sky_pirate_seal_stat_item", "name": "Sky Pirate Seal", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/e6734b18dcb823ab8799d7a794094048.png?cv=2" },
      { "item_id": 3078, "type": "sky_sprocket_stat_item", "name": "Sky Sprocket", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/8f8b74266abe018c969275d019d87603.png?cv=2" },
      { "item_id": 3079, "type": "skysoft_silk_stat_item", "name": "Skysoft Silk", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/f00a417b8dc3330a07d43a420b7e8cbc.png?cv=2" },
      { "item_id": 2841, "type": "tactical_geyser_trap_stat_item", "name": "Thermal Chisel", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/180ffc5a84b80a5fc0f954244dfcca34.png?cv=2" },
      { "item_id": 2902, "type": "tattered_celestial_skin_pattern_stat_item", "name": "Tattered Celestial Skin Pattern", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/222dda35ce2389c414b409e3c9a18f3c.png?cv=2" },
      { "item_id": 2340, "type": "temporal_rune_stat_item", "name": "Timesplit Rune", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/817a5d8a4a8977d5fd2d6bfa8cfa3ffa.png?cv=2" },
      { "item_id": 2903, "type": "total_eclipse_resource_stat_item", "name": "Core of the Eclipse", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/5867a5e073b34417aa0a85435f322782.png?cv=2" },
      { "item_id": 1247, "type": "tournament_token_mega_stat_item", "name": "MEGA Tournament Token", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/transparent_thumb/7d7fede08c84c3d2f6b9216d8ec188e4.png?cv=2" },
      { "item_id": 686, "type": "tournament_token_stat_item", "name": "Tournament Token", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/3f9a85833d0bd665ecfa7a611b4001c3.gif?cv=2" },
      { "item_id": 854, "type": "war_scrap_stat_item", "name": "War Scrap", "thumbnail": "https://www.mousehuntgame.com/images/items/stats/931a03134475b7df6350a2b059b5c8e7.gif?cv=2" },
    ], 'special', 'currency', 'currency', 'Currency');
  };


  addStyles(`.hunterProfileItemsView-categoryContent[data-category="chest"] .hunterProfileItemsView-categoryContent-item.uncollected,
  .hunterProfileItemsView-categoryContent[data-category="airships"] .hunterProfileItemsView-categoryContent-item.uncollected,
  .hunterProfileItemsView-categoryContent[data-category="currency"] .hunterProfileItemsView-categoryContent-item.uncollected,
  .hunterProfileItemsView-categoryContent[data-category="equipment"] .hunterProfileItemsView-categoryContent-item.uncollected,
  .hunterProfileItemsView-categoryContent[data-category="plankrun"] .hunterProfileItemsView-categoryContent-item.uncollected {
    filter: grayscale(100%);
  }

  .hunterProfileItemsView-categoryContent[data-category="chest"] .hunterProfileItemsView-categoryContent-item-padding .itemImage {
    background-size: contain;
  }`);

  const main = () => {
    console.log('main');
    if ('hunterprofile' === getCurrentPage() && 'items' === getCurrentTab()) {
      const params = hg.utils.PageUtil.getQueryParams();
      if (params && params.snuid && user.sn_user_id === params.snuid) {
        addTreasureChests()
        setTimeout(addAirships, 500);
        setTimeout(addCurrency, 1000);
        setTimeout(addEquipment, 1500);
        setTimeout(addPlankrunPages, 2000);
      }
    }
  };

  onNavigation(main, {
    page: 'hunterprofile',
    tab: 'items'
  });
}());
