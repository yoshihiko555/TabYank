document.addEventListener('DOMContentLoaded', async () => {
  const tabListEl = document.getElementById('tabList');
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copy');
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');

  let tabs = [];

  // タブ一覧を取得して表示
  tabs = await chrome.tabs.query({ currentWindow: true });

  tabs.forEach((tab, index) => {
    const item = document.createElement('div');
    item.className = 'tab-item' + (tab.active ? ' active' : '');
    item.innerHTML = `
      <input type="checkbox" ${tab.active ? 'checked' : ''}>
      <span class="tab-title">${escapeHtml(tab.title || tab.url)}</span>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = item.querySelector('input');
        checkbox.checked = !checkbox.checked;
      }
      updateStatus();
    });
    tabListEl.appendChild(item);
  });

  // 全選択
  selectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.tab-item input').forEach(cb => cb.checked = true);
    updateStatus();
  });

  // 全解除
  selectNoneBtn.addEventListener('click', () => {
    document.querySelectorAll('.tab-item input').forEach(cb => cb.checked = false);
    updateStatus();
  });

  // コピー
  copyBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.tab-item input');
    const selectedUrls = [];

    checkboxes.forEach((cb, index) => {
      if (cb.checked) {
        selectedUrls.push(tabs[index].url);
      }
    });

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
    const count = document.querySelectorAll('.tab-item input:checked').length;
    statusEl.textContent = `${count}件選択中`;
    statusEl.className = 'status';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateStatus();
});
