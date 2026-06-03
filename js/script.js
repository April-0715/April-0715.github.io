/* ============================================
   April-0715's Blog — 交互脚本
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ===== 同步文章总数 =====
    (function syncArticleCount() {
        const el = document.getElementById('articleCount');
        if (!el || typeof ARTICLES === 'undefined') return;
        el.setAttribute('data-count', ARTICLES.length);
    })();

    // ===== 首页文章预览渲染 =====
    (function renderHomeArticles() {
        const grid = document.getElementById('worksGrid');
        if (!grid || typeof ARTICLES === 'undefined') return;

        const latest = [...ARTICLES]
            .filter(a => a.category !== '其他')
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6);

        grid.innerHTML = latest.map(a => `
            <article class="work-item reveal">
                <a href="article.html?slug=${a.slug}">
                    <div class="work-item-img">
                        <img src="${a.image}" alt="${a.title}" loading="lazy">
                        <div class="work-item-overlay">
                            <span class="work-item-tag">${a.tag}</span>
                        </div>
                    </div>
                    <div class="work-item-body">
                        <h4>${a.title}</h4>
                        <span class="work-date">${a.date}</span>
                    </div>
                </a>
            </article>
        `).join('');
    })();

    // ===== DOM 引用 =====
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const backToTop = document.getElementById('backToTop');
    const revealElements = document.querySelectorAll('.reveal');
    const statNums = document.querySelectorAll('.stat-num[data-count]');
    const allNavLinks = document.querySelectorAll('.nav-link');

    // ===== 移动端菜单切换 =====
    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-label', isOpen ? '收起菜单' : '展开菜单');
        navToggle.classList.toggle('active', isOpen);
    });

    // 点击导航链接后关闭移动菜单
    allNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-label', '展开菜单');
        });
    });

    // 点击页面其他区域关闭菜单
    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target) && navLinks.classList.contains('open')) {
            navLinks.classList.remove('open');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-label', '展开菜单');
        }
    });

    // ===== 滚动事件处理 =====
    let ticking = false;

    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }

    function handleScroll() {
        const scrollY = window.scrollY;
        const hero = document.getElementById('home');
        const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;

        // 导航栏阴影：滚过英雄区后才显示
        if (scrollY > heroBottom - 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // 回到顶部按钮
        if (scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }

        // 滚动渐显元素
        revealElements.forEach(el => {
            if (!el.classList.contains('visible')) {
                const rect = el.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                if (rect.top < windowHeight * 0.88) {
                    el.classList.add('visible');
                }
            }
        });

        // 高亮当前区域的导航链接
        updateActiveNavLink(scrollY);
    }

    // ===== 高亮当前导航链接 =====
    function updateActiveNavLink(scrollY) {
        const sections = document.querySelectorAll('section[id]');
        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.offsetHeight;
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });

        allNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }

    // ===== 回到顶部 =====
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ===== 数字滚动动画 =====
    function animateStats() {
        statNums.forEach(el => {
            // 避免重复计数
            if (el.dataset.animated) return;
            el.dataset.animated = 'true';

            const target = parseInt(el.dataset.count, 10);
            const duration = 2000;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // easeOutCubic 缓动
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(eased * target);
                el.textContent = current.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            requestAnimationFrame(update);
        });
    }

    // ===== Intersection Observer — 数字统计触发 =====
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateStats();
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6 });

    // 观察统计区域
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
        statsObserver.observe(aboutSection);
    }

    // ===== 初始加载时检查可见元素 =====
    // 页面刚加载时，视口内的 reveal 元素需要立即显示
    setTimeout(() => {
        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.88) {
                el.classList.add('visible');
            }
        });
    }, 100);

    // ===== 监听滚动 (passive 提升性能) =====
    window.addEventListener('scroll', onScroll, { passive: true });

    // ===== 键盘 ESC 关闭菜单 =====
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('open')) {
            navLinks.classList.remove('open');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-label', '展开菜单');
            navToggle.focus();
        }
    });

    // ===== 初始触发一次，设置正确状态 =====
    handleScroll();

});
