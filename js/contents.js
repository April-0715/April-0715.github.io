/* ============================================
   文章列表页 — 渲染文章卡片
   ============================================ */

(function() {
    const container = document.getElementById('articlesContainer');
    if (!container) return;

    if (typeof ARTICLES === 'undefined' || ARTICLES.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon"></div>
                <p>还没有文章，敬请期待。</p>
            </div>`;
        return;
    }

    const sorted = [...ARTICLES].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(a => `
        <article class="article-card">
            <a href="article.html?slug=${a.slug}">
                <div class="article-card-img">
                    <img src="${a.image}" alt="${a.title}" loading="lazy">
                    <span class="card-tag">${a.tag}</span>
                </div>
                <div class="article-card-body">
                    <h3>${a.title}</h3>
                    <p class="card-summary">${a.summary}</p>
                    <div class="card-meta">
                        <span>${a.date}</span>
                        <span class="read-more">阅读全文</span>
                    </div>
                </div>
            </a>
        </article>
    `).join('');
})();
