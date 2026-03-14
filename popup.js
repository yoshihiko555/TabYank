document.addEventListener('DOMContentLoaded', async () => {
  const tabListEl = document.getElementById('tabList');
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copy');
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');
  const groupFilterEl = document.getElementById('groupFilter');

  let tabs = [];
  const selectedIndexes = new Set();
  let lastClickedIndex = null;
  let activeGroupFilter = null; // null = すべて表示

  const GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#1a73e8',
    red: '#d93025',
    yellow: '#f9ab00',
    green: '#188038',
    pink: '#d01884',
    purple: '#a142f4',
    cyan: '#007b83',
    orange: '#e8710a',
  };

  // タブ一覧を取得
  tabs = await chrome.tabs.query({ currentWindow: true });

  // グループ情報を取得
  const groupMap = new Map();
  const groupIds = [];
  const groupCountMap = new Map();
  let ungroupedCount = 0;
  tabs.forEach(tab => {
    if (tab.groupId === -1) {
      ungroupedCount += 1;
      return;
    }
    if (!groupCountMap.has(tab.groupId)) {
      groupIds.push(tab.groupId);
      groupCountMap.set(tab.groupId, 0);
    }
    groupCountMap.set(tab.groupId, groupCountMap.get(tab.groupId) + 1);
  });
  const tabGroupsApi = globalThis.chrome?.tabGroups;

  try {
    if (groupIds.length > 0 && typeof tabGroupsApi?.query === 'function') {
      const groups = await tabGroupsApi.query({ windowId: -2 });
      for (const group of groups) {
        groupMap.set(group.id, { title: group.title || '無題', color: group.color });
      }
    }
  } catch (_) {
    // tabGroups API が利用できない場合はフィルタなしで続行
  }
  renderGroupFilter();

  // グループフィルタを描画
  function renderGroupFilter() {
    if (groupIds.length === 0 && ungroupedCount === 0) {
      groupFilterEl.innerHTML = '';
      return;
    }

    groupFilterEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = activeGroupFilter === null ? 'active-filter' : '';
    allBtn.appendChild(document.createTextNode('すべて'));
    allBtn.appendChild(createCountBadge(tabs.length));
    allBtn.addEventListener('click', () => {
      activeGroupFilter = null;
      selectAllVisible();
      renderGroupFilter();
      renderTabVisibility();
      renderSelection();
      updateStatus();
    });
    groupFilterEl.appendChild(allBtn);

    for (const groupId of groupIds) {
      const info = groupMap.get(groupId);
      const btn = document.createElement('button');
      btn.type = 'button';
      const dot = document.createElement('span');
      dot.className = 'group-dot';
      dot.style.backgroundColor = GROUP_COLORS[info?.color] || '#9e9e9e';
      btn.appendChild(dot);
      const groupTitle = (info?.title || '').trim() || `グループ ${groupId}`;
      btn.appendChild(document.createTextNode(groupTitle));
      btn.appendChild(createCountBadge(groupCountMap.get(groupId) || 0));
      btn.className = activeGroupFilter === groupId ? 'active-filter' : '';
      btn.addEventListener('click', () => {
        activeGroupFilter = groupId;
        selectAllVisible();
        renderGroupFilter();
        renderTabVisibility();
        renderSelection();
        updateStatus();
      });
      groupFilterEl.appendChild(btn);
    }

    if (ungroupedCount > 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'グループなし';
      btn.appendChild(createCountBadge(ungroupedCount));
      btn.className = activeGroupFilter === -1 ? 'active-filter' : '';
      btn.addEventListener('click', () => {
        activeGroupFilter = -1;
        selectAllVisible();
        renderGroupFilter();
        renderTabVisibility();
        renderSelection();
        updateStatus();
      });
      groupFilterEl.appendChild(btn);
    }
  }

  function createCountBadge(count) {
    const badge = document.createElement('span');
    badge.className = 'group-count';
    badge.textContent = String(count);
    return badge;
  }

  // フィルタ切替時に表示対象タブを全選択
  function selectAllVisible() {
    selectedIndexes.clear();
    tabs.forEach((_, index) => {
      if (isVisibleIndex(index)) selectedIndexes.add(index);
    });
  }

  // フィルタに合致するインデックスかどうか
  function isVisibleIndex(index) {
    if (activeGroupFilter === null) return true;
    if (activeGroupFilter === -1) return tabs[index].groupId === -1;
    return tabs[index].groupId === activeGroupFilter;
  }

  // タブの表示/非表示を更新
  function renderTabVisibility() {
    document.querySelectorAll('.tab-item').forEach(item => {
      const index = Number(item.dataset.index);
      item.style.display = isVisibleIndex(index) ? '' : 'none';
    });
  }

  // タブ一覧を描画
  tabs.forEach((tab, index) => {
    const item = document.createElement('div');
    item.className = 'tab-item' + (tab.active ? ' active' : '');
    item.dataset.index = String(index);
    item.innerHTML = `
      <span class="tab-title">${escapeHtml(tab.title || tab.url)}</span>
    `;

    if (tab.active) {
      selectedIndexes.add(index);
    }

    item.addEventListener('click', event => {
      const isSelected = selectedIndexes.has(index);
      const shouldSelect = !isSelected;

      if (event.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
        setRangeSelection(lastClickedIndex, index, shouldSelect);
      } else {
        setSelection(index, shouldSelect);
      }

      lastClickedIndex = index;
      renderSelection();
      updateStatus();
    });

    tabListEl.appendChild(item);
  });

  // 全選択（フィルタ中は表示タブのみ）
  selectAllBtn.addEventListener('click', () => {
    tabs.forEach((_, index) => {
      if (isVisibleIndex(index)) selectedIndexes.add(index);
    });
    renderSelection();
    updateStatus();
  });

  // 全解除（フィルタ中は表示タブのみ）
  selectNoneBtn.addEventListener('click', () => {
    if (activeGroupFilter === null) {
      selectedIndexes.clear();
    } else {
      tabs.forEach((_, index) => {
        if (isVisibleIndex(index)) selectedIndexes.delete(index);
      });
    }
    renderSelection();
    updateStatus();
  });

  // コピー
  copyBtn.addEventListener('click', async () => {
    const selectedUrls = Array.from(selectedIndexes)
      .sort((a, b) => a - b)
      .map(index => tabs[index].url)
      .filter(Boolean);

    if (selectedUrls.length === 0) {
      statusEl.textContent = 'タブを選択してください';
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedUrls.join('\n'));
      statusEl.textContent = `${selectedUrls.length}件のURLをコピーしました`;
      statusEl.className = 'status success';
      setTimeout(() => window.close(), 800);
    } catch (error) {
      statusEl.textContent = 'コピーに失敗しました';
    }
  });

  function updateStatus() {
    statusEl.textContent = `${selectedIndexes.size}件選択中`;
    statusEl.className = 'status';
  }

  function setSelection(index, selected) {
    if (selected) {
      selectedIndexes.add(index);
      return;
    }
    selectedIndexes.delete(index);
  }

  function setRangeSelection(from, to, selected) {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let index = start; index <= end; index += 1) {
      if (isVisibleIndex(index)) {
        setSelection(index, selected);
      }
    }
  }

  function renderSelection() {
    document.querySelectorAll('.tab-item').forEach(item => {
      const index = Number(item.dataset.index);
      item.classList.toggle('selected', selectedIndexes.has(index));
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderSelection();
  updateStatus();
});
