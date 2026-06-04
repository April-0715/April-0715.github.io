/* ============================================
   文章元数据 — 添加新文章只需在此数组新增一条

   分类：学习笔记 | 技术杂谈 | 其他
   ============================================ */

const ARTICLES = [
    {
        slug: 'smart-pointers',
        title: '深入理解 C++ 智能指针',
        date: '2026-06-04',
        tag: 'C++',
        category: '学习笔记',
        summary: 'unique_ptr、shared_ptr、weak_ptr 的深入解析——原理、使用场景、常见误区与选型指南。',
        file: 'articles/smart-pointers.md'
    },
    {
        slug: 'what-is-RAII',
        title: '什么是RAII',
        date: '2026-06-04',
        tag: 'C++',
        category: '学习笔记',
        summary: 'C++ RAII 资源管理范式的核心定义、设计原理与几个标准库应用。',
        file: 'articles/what-is-RAII.md'
    },
    {
        slug: 'move-semantics',
        title: 'C++11 移动语义',
        date: '2026-06-04',
        tag: 'C++',
        category: '学习笔记',
        summary: '左值/右值、右值引用、std::move、移动构造与移动赋值的梳理。',
        file: 'articles/move-semantics.md'
    }
];
