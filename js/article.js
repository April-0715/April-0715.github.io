/* ============================================
   文章详情页 — Markdown 解析 & 文章加载
   ============================================ */

/* ======== 轻量 Markdown → HTML 渲染 ======== */
function parseMarkdown(md) {
    const escapeHTML = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1. 提取围栏代码块 → 占位符
    const codeBlocks = [];
    let html = md.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
        return `%%CODEBLOCK_${idx}%%`;
    });

    // 2. 提取行内代码 → 占位符（在 HTML 转义之前，避免 < > & 被双重转义）
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
        const idx = inlineCodes.length;
        inlineCodes.push(code);
        return `%%INLINECODE_${idx}%%`;
    });

    // 3. 转义 HTML（不影响占位符）
    html = escapeHTML(html);

    // 4. 块级元素处理
    // 表格（先规范化：补全缺失的末尾 |）
    html = html.replace(/^\|.+/gm, (row) => row.endsWith('|') ? row : row + '|');
    html = html.replace(/^\|(.+)\|[ \t]*\n\|[-| :]+\|[ \t]*\n((?:\|.+\|[ \t]*\n?)*)/gm, (_, header, rows) => {
        const thead = '<thead><tr>' + header.split('|').map(c => `<th>${c.trim()}</th>`).join('') + '</tr></thead>';
        const tbody = '<tbody>' + rows.trim().split('\n').map(row =>
            '<tr>' + row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
        ).join('') + '</tbody>';
        return `<table>${thead}${tbody}</table>`;
    });

    // 标题
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 引用块
    html = html.replace(/^&gt; (.*)$/gm, '<blockquote><p>$1</p></blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // 分隔线
    html = html.replace(/^---$/gm, '<hr>');

    // 列表（多行感知：缩进续行合并到 <li> 内，用 <br> 保持单行避免段落包裹分裂）
    function mergeListContinuations(text, itemRegex, liAttrs) {
        const lines = text.split('\n');
        const out = [];
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(itemRegex);
            if (m) {
                let content = m[1];
                i++;
                // 收集缩进续行
                const contParts = [];
                while (i < lines.length) {
                    const nl = lines[i];
                    // 续行：1-4 空格缩进，且不是新列表项、不是标题
                    if (/^ {1,4}(?!\d+\. |[-*] \[[ xX]\] |[-*] |#{1,6} )/.test(nl)) {
                        contParts.push(nl.replace(/^ {1,4}/, ''));
                        i++;
                    } else if (nl.trim() === '') {
                        // 空行：看下一行是否仍是缩进续行（同 item 内段落分隔）
                        const peek = lines[i + 1];
                        if (peek && /^ {1,4}(?!\d+\. |[-*] \[[ xX]\] |[-*] |#{1,6} )/.test(peek)) {
                            contParts.push('');  // 段落分隔标记
                            i++;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (contParts.length > 0) {
                    content += '<br>' + contParts.map(p => p === '' ? '' : p).join('<br>');
                }
                out.push(`<li${liAttrs}>${content}</li>`);
                i--; // for 循环会 ++
            } else {
                out.push(lines[i]);
            }
        }
        return out.join('\n');
    }

    // 任务列表 — 必须在无序/有序之前
    html = mergeListContinuations(html, /^[-*] \[ \] (.+)/, ' class="task-item"><input type="checkbox" disabled');
    html = mergeListContinuations(html, /^[-*] \[[xX]\] (.+)/, ' class="task-item"><input type="checkbox" checked disabled');

    // 有序列表
    html = mergeListContinuations(html, /^\d+\. (.+)/, ' data-ol');

    // 无序列表（必须放在有序列表之后，避免 data-ol 项被重复匹配）
    html = mergeListContinuations(html, /^[-*] (?!\[[ xX]\])(.+)/, '');

    // 统一包裹连续 <li>（均为单行，含 data-ol → <ol>，否则 → <ul>）
    html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, (match) => {
        if (match.includes('data-ol')) {
            return '<ol>' + match.replace(/ data-ol/g, '') + '</ol>';
        }
        return '<ul>' + match + '</ul>';
    });

    // 5. 行内样式
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // 恢复行内代码（放在 bold/italic 之后，避免 ** 等误匹配 <code> 内文本）
    html = html.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => {
        return `<code>${escapeHTML(inlineCodes[+idx])}</code>`;
    });

    // 链接 & 图片
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // 6. 段落包裹
    const lines = html.split('\n');
    const result = [];
    let buf = [];

    function flush() {
        const text = buf.join('\n').trim();
        if (text) {
            if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr|img|li|p|thead|tbody|tr|th|td)|^%%CODEBLOCK/.test(text)) {
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
        } else if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr|img|li|p|thead|tbody|tr|th|td|\/)|^%%CODEBLOCK/.test(line.trim())) {
            flush();
            result.push(line.trim());
        } else {
            buf.push(line);
        }
    }
    flush();

    html = result.join('\n');

    // 7. 恢复代码块（HTML 转义 + 语言标签）
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
