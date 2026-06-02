# 深入理解 C++ 智能指针

> 发布日期：2025-06-02 | 标签：C++

## 前言

智能指针是现代 C++ 中最重要的 RAII 实践之一。它们自动管理动态分配的内存生命周期，从根本上避免了内存泄漏和悬空指针。

## 三种核心智能指针

### unique_ptr — 独占所有权

```cpp
#include <memory>

void uniqueExample() {
    auto widget = std::make_unique<Widget>(42);
    widget->draw();

    // 所有权转移
    auto other = std::move(widget);
    // widget 现在为 nullptr，other 持有资源
}
```

- 独占所指对象，不可拷贝
- 离开作用域自动释放
- 零开销（与裸指针相同）

### shared_ptr — 共享所有权

```cpp
void sharedExample() {
    auto sp1 = std::make_shared<int>(100);
    {
        auto sp2 = sp1;          // 引用计数 = 2
        *sp2 = 200;
    }                             // sp2 销毁，引用计数 = 1
    // 资源仍然存活
}                                 // 引用计数归零，释放资源
```

- 使用引用计数追踪共享者数量
- 最后一份 `shared_ptr` 销毁时释放资源
- 有轻微性能开销（控制块分配 + 原子操作）

### weak_ptr — 弱引用

```cpp
void weakExample() {
    auto sp = std::make_shared<Cache>(/* ... */);
    std::weak_ptr<Cache> wp = sp;

    if (auto locked = wp.lock()) {
        // 对象仍然存活，安全使用
        locked->query("key");
    } else {
        // 对象已被销毁
    }
}
```

- 不增加引用计数，不阻止资源释放
- 用于打破 `shared_ptr` 的循环引用
- 使用前必须 `lock()` 检查有效性

## 最佳实践

| 推荐 | 避免 |
|------|------|
| `make_unique` / `make_shared` | `new` 裸操作 |
| `unique_ptr` 作为默认选择 | 过早使用 `shared_ptr` |
| `weak_ptr` 打破循环 | 忽略循环引用 |
| 函数参数用裸指针/引用 | 无意义的所有权传递 |

## 总结

- 默认选 `unique_ptr`，需要共享时才用 `shared_ptr`
- `weak_ptr` 是打破循环引用的利器
- 优先使用 `make_unique` 和 `make_shared`（异常安全 + 一次分配）
- 智能指针让 C++ 的内存管理几乎达到了 GC 语言的便利性
