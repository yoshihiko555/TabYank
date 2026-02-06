document.addEventListener('DOMContentLoaded', async () => {
  const tabListEl = document.getElementById('tabList');
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copy');
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');

  let tabs = [];
  const selectedIndexes = new Set();
  let lastClickedIndex = null;

  // タブ一覧を取得して表示
  tabs = await chrome.tabs.query({ currentWindow: true });

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

  // 全選択
  selectAllBtn.addEventListener('click', () => {
    tabs.forEach((_, index) => selectedIndexes.add(index));
    renderSelection();
    updateStatus();
  });

  // 全解除
  selectNoneBtn.addEventListener('click', () => {
    selectedIndexes.clear();
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
      setSelection(index, selected);
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
