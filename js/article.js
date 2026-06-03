/* ============================================
   文章详情页 — Markdown 解析 & 文章加载
   ============================================ */

/* ======== 轻量 Markdown → HTML 渲染 ======== */
function parseMarkdown(md) {
    const escapeHTML = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1. 提取代码块 → 占位符
    const codeBlocks = [];
    let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
        return `%%CODEBLOCK_${idx}%%`;
    });

    // 2. 转义行内 HTML
    html = escapeHTML(html);

    // 3. 块级元素处理（占位符不会被正则匹配）
    // 表格
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_, header, rows) => {
        const thead = '<thead><tr>' + header.split('|').map(c => `<th>${c.trim()}</th>`).join('') + '</tr></thead>';
        const tbody = '<tbody>' + rows.trim().split('\n').map(row =>
            '<tr>' + row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
        ).join('') + '</tbody>';
        return `<table>${thead}${tbody}</table>`;
    });

    // 标题
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 引用块
    html = html.replace(/^&gt; (.*)$/gm, '<blockquote><p>$1</p></blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // 分隔线
    html = html.replace(/^---$/gm, '<hr>');

    // 无序列表
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // 有序列表
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // 4. 行内样式
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 链接 & 图片
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // 5. 段落包裹
    const lines = html.split('\n');
    const result = [];
    let buf = [];

    function flush() {
        const text = buf.join('\n').trim();
        if (text) {
            if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr|img|li|thead|tbody|tr|th|td|%%CODEBLOCK)/.test(text)) {
                result.push(text);
            } else {
                result.push(`<p>${text}</p>`);
            }
        }
        buf = [];
    }

    for (const line of lines) {
        if (line.trim() === '') {
            flush();
        } else if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr|img|li|thead|tbody|tr|th|td|ul|ol|\/|%%CODEBLOCK)/.test(line.trim())) {
            flush();
            result.push(line.trim());
        } else {
            buf.push(line);
        }
    }
    flush();

    html = result.join('\n');

    // 6. 最后恢复代码块（HTML 转义 + 不受正则影响）
    html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
        const { lang, code } = codeBlocks[+idx];
        const escaped = escapeHTML(code);
        const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
        return `<pre>${langLabel}<code>${escaped}</code></pre>`;
    });

    return html;
}

/* ======== 加载并渲染文章 ======== */
(function() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const main = document.getElementById('articleMain');

    if (!slug) {
        main.innerHTML = `
            <div class="not-found">
                <h2>未指定文章</h2>
                <p>请从<a href="contents.html">文章列表</a>选择一篇阅读。</p>
            </div>`;
        return;
    }

    const meta = typeof ARTICLES !== 'undefined' ? ARTICLES.find(a => a.slug === slug) : null;

    if (!meta) {
        main.innerHTML = `
            <div class="not-found">
                <h2>文章未找到</h2>
                <p>找不到 slug 为 "${slug}" 的文章。<br><a href="contents.html">返回文章列表</a></p>
            </div>`;
        return;
    }

    document.title = `${meta.title} — April-0715's Blog`;
    document.querySelector('meta[name="description"]').content = meta.summary;

    fetch(meta.file)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(md => {
            const body = parseMarkdown(md);
            main.innerHTML = `
                <section class="article-header">
                    <span class="tag">${meta.tag}</span>
                    <h1>${meta.title}</h1>
                    <div class="meta">${meta.date}</div>
                </section>
                <article class="article-content">
                    <a class="back-link" href="contents.html">返回文章列表</a>
                    ${body}
                </article>`;
        })
        .catch(err => {
            main.innerHTML = `
                <div class="not-found">
                    <h2>加载失败</h2>
                    <p>文章文件加载出错：${err.message}<br><a href="contents.html">返回文章列表</a></p>
                </div>`;
        });
})();
