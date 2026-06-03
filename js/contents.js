/* ============================================
   文章列表页 — 按分类分组渲染
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

    const categoryOrder = ['学习笔记', '技术杂谈', '其他'];
    const grouped = {};

    for (const cat of categoryOrder) {
        grouped[cat] = ARTICLES
            .filter(a => a.category === cat)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function renderCard(a) {
        return `
            <article class="article-card">
                <a href="article.html?slug=${a.slug}">
                    <div class="article-card-body">
                        <span class="card-tag">${a.tag}</span>
                        <h3>${a.title}</h3>
                        <p class="card-summary">${a.summary}</p>
                        <div class="card-meta">
                            <span>${a.date}</span>
                            <span class="read-more">阅读全文</span>
                        </div>
                    </div>
                </a>
            </article>`;
    }

    let html = '';
    for (const cat of categoryOrder) {
        const articles = grouped[cat];
        if (articles.length === 0) continue;

        html += `<div class="category-section">`;
        html += `<h2 class="category-title">${cat}</h2>`;
        html += `<div class="category-count">${articles.length} 篇</div>`;
        html += `<div class="article-card-grid">`;
        html += articles.map(renderCard).join('');
        html += `</div></div>`;
    }

    container.innerHTML = html;
})();
