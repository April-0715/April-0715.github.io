# 深入理解 C++ 智能指针

> 发布日期：2026-06-04 | 标签：C++

## 一、为什么需要智能指针

[什么是RAII](article.html?slug=what-is-RAII) 中讲过：**裸指针需要手动 `delete`，任何提前返回或异常抛出都可能导致内存泄漏**。来看一个真实场景：

```cpp
void bad_example(int id) {
    User* user = new User(id);
    Order* order = new Order(user);   // 如果这里抛异常…
    Cache* cache = new Cache(order);  // 或者这里…
    // 处理逻辑
    delete cache;
    delete order;
    delete user;   // 上面三处 new 至少泄漏一个
}
```

三个 `new` 之间任何一个环节抛异常，之前的资源全泄漏。即使用 `try-catch` 包裹，代码也会迅速失控。

**智能指针是 RAII 管理堆内存的标准实现**：构造时接管裸指针，析构时自动释放，把"手动 delete"变成了编译器保证的行为。

```cpp
void good_example(int id) {
    auto user  = std::make_unique<User>(id);
    auto order = std::make_unique<Order>(*user);
    auto cache = std::make_unique<Cache>(*order);
    // 即使抛异常，栈展开自动调用三个 unique_ptr 的析构
}
```

C++11 起，标准库提供了三种智能指针，各有明确职责：

| 类型 | 所有权模型 | 拷贝 | 典型用途 |
|------|-----------|------|----------|
| `unique_ptr` | 独占 | 禁止 | 默认首选 |
| `shared_ptr` | 共享（引用计数） | 允许 | 多处共享同一对象 |
| `weak_ptr` | 弱引用（不计数） | 允许 | 打破循环引用 / 观察者 |

## 二、unique_ptr — 独占所有权

### 1. 基本用法

`unique_ptr` 独占所管理的对象，**不可拷贝、只可移动**，离开作用域自动 `delete`。

```cpp
#include <memory>
#include <iostream>

struct Task {
    int id;
    explicit Task(int id) : id(id) { std::cout << "Task " << id << " created\n"; }
    ~Task() { std::cout << "Task " << id << " destroyed\n"; }
    void run() const { std::cout << "Task " << id << " running\n"; }
};

void basic_usage() {
    auto t = std::make_unique<Task>(1);  // 构造 Task
    t->run();
}  // t 离开作用域 → 自动调用 ~Task()，输出 "Task 1 destroyed"
```

> `unique_ptr` 的大小几乎与裸指针一致（无控制块），性能零开销。

### 2. make_unique vs new：异常安全

为什么推荐 `make_unique` 而非直接 `new`？

```cpp
// 危险写法：new 和 unique_ptr 构造之间存在裸指针窗口期
process(std::unique_ptr<Task>(new Task(1)),
        std::unique_ptr<Task>(new Task(2)));
// C++ 不保证函数参数的求值顺序。如果编译器先执行两次 new，
// 然后在构造第一个 unique_ptr 前抛异常 → 泄漏
```

```cpp
// 安全写法：make_unique 一步完成，没有裸指针暴露
process(std::make_unique<Task>(1),
        std::make_unique<Task>(2));
```

> `make_unique` 把 `new` 和 `unique_ptr` 构造合并在一次调用中，**裸指针从不暴露在用户代码里**，彻底消除泄漏窗口。

### 3. 所有权转移

`unique_ptr` 删除了拷贝构造和拷贝赋值，但**允许移动**——这正是它与 [移动语义](article.html?slug=move-semantics) 深度配合的地方：

```cpp
void ownership_transfer() {
    auto p1 = std::make_unique<int>(42);

    // auto p2 = p1;            //  编译错误：拷贝构造 =delete
    auto p2 = std::move(p1);   //  移动构造，p2 接管资源

    std::cout << (p1 == nullptr) << '\n';  // 1（true）
    std::cout << *p2 << '\n';              // 42
}
```

典型场景——工厂函数返回对象：

```cpp
std::unique_ptr<Task> create_task(int id) {
    auto t = std::make_unique<Task>(id);
    // t 是左值，但 return 自动触发移动（RVO 可能省略）
    return t;
}

void caller() {
    auto t = create_task(5);  // 所有权从函数内部移交到调用方
    t->run();
}
```

### 4. 常用操作一览

```cpp
auto p = std::make_unique<int>(10);

p.get();        // 返回裸指针 int*，不释放所有权
p.reset();      // 释放当前对象，p 变为 nullptr
p.reset(new int(20));  // 释放旧对象，接管新对象
p.release();    // 放弃所有权，返回裸指针（调用者负责 delete）

// 判断是否有对象
if (p) { /* p 非空 */ }

// 数组形式（C++14 起）
auto arr = std::make_unique<int[]>(5);  // new int[5]
arr[0] = 1;  // 支持 operator[]
```

### 5. 自定义删除器

默认用 `delete` 释放资源。对于文件句柄、socket、自定义内存池等非 `new` 分配的资源，可以传入自定义删除器：

```cpp
// 场景：C 风格的 FILE* 需要 fclose 而非 delete
auto close_file = [](FILE* f) { if (f) fclose(f); };
std::unique_ptr<FILE, decltype(close_file)> file(fopen("data.txt", "r"), close_file);
// file 离开作用域 → 自动调用 fclose
```

## 三、shared_ptr — 共享所有权

### 1. 引用计数原理

`shared_ptr` 允许多个对象**共享同一个堆资源**。内部维护一个**控制块**，记录当前有多少个 `shared_ptr` 指向该资源。计数归零时自动释放。

```cpp
void ref_count_demo() {
    auto sp1 = std::make_shared<int>(100);  // 引用计数 = 1
    std::cout << sp1.use_count() << '\n';    // 1

    {
        auto sp2 = sp1;                      // 拷贝构造，计数 = 2
        auto sp3 = sp1;                      // 计数 = 3
        std::cout << sp3.use_count() << '\n'; // 3
        *sp2 = 200;
    }  // sp2、sp3 销毁，计数降回 1

    std::cout << *sp1 << '\n';  // 200，资源仍然存活
}  // sp1 销毁，计数归零 → delete 资源
```

### 2. 控制块与内存布局

`shared_ptr` 的大小是裸指针的 **2 倍**（一个指向对象，一个指向控制块）：

```
shared_ptr<T>
┌──────────────┐       ┌──────────────┐
│ 对象指针      │ ────→ │  T 对象       │
├──────────────┤       └──────────────┘
│ 控制块指针    │ ────→ ┌──────────────┐
└──────────────┘       │ 引用计数 (3)  │
                       │ 弱引用计 (1)  │
                       │ 删除器        │
                       │ 分配器        │
                       └──────────────┘
```

> 拷贝 `shared_ptr` 只增加引用计数，**不拷贝 T 对象本身**。

### 3. make_shared 的双重优势

```cpp
// 分开写：两次堆分配（一次 new T，一次 new 控制块）
std::shared_ptr<Task> sp1(new Task(1));

// make_shared：一次堆分配（T 对象 + 控制块连续存储）
auto sp2 = std::make_shared<Task>(1);
```

`make_shared` 的优势：
1. **一次堆分配**（对象 + 控制块紧邻），减少内存碎片，缓存更友好；
2. **异常安全**——和 `make_unique` 同理，裸指针不暴露；
3. 性能提升在频繁创建场景下非常可观。

### 4. shared_ptr 的代价

`shared_ptr` 不是免费的：

- **空间**：2 倍裸指针大小（对象指针 + 控制块指针）；
- **时间**：拷贝/析构涉及**原子操作**（引用计数增减），比 `unique_ptr` 慢；
- **风险**：循环引用导致永不释放（见下节）。

> **原则**：能用 `unique_ptr` 就不要用 `shared_ptr`。

## 四、weak_ptr — 打破循环引用

### 1. 循环引用

`shared_ptr` 最大的陷阱——**循环引用**。两个对象互相持有对方的 `shared_ptr`，引用计数永远不会归零：

```cpp
struct Node {
    std::shared_ptr<Node> parent;
    std::shared_ptr<Node> child;
    ~Node() { std::cout << "Node destroyed\n"; }
};

void cycle_leak() {
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->child = b;   // b 的引用计数 = 2（b + a->child）
    b->parent = a;  // a 的引用计数 = 2（a + b->parent）
}  // a、b 离开作用域，计数各降为 1 → 都未归零 → 内存泄漏！
   // "Node destroyed" 永远不会打印
```

引用关系图：
```
a ──child───→ b     a.use_count() = 2（栈上 a + b->parent 指向它）
│             │
│   parent    │     b.use_count() = 2（栈上 b + a->child 指向它）
└─────────────┘
```

### 2. weak_ptr 解环

把其中一侧改成 `weak_ptr`，**弱引用不增加引用计数**，环就断了：

```cpp
struct SafeNode {
    std::weak_ptr<SafeNode>   parent;   // ← 弱引用，不计数
    std::shared_ptr<SafeNode> child;
    ~SafeNode() { std::cout << "SafeNode destroyed\n"; }
};

void no_leak() {
    auto a = std::make_shared<SafeNode>();
    auto b = std::make_shared<SafeNode>();
    a->child = b;   // b 的计数 = 2
    b->parent = a;  // a 的计数 = 1（weak_ptr 不增加计数）
}  // a 和 b 都正常析构，"SafeNode destroyed" 打印两次
```

### 3. lock() 与 expired()

`weak_ptr` 不能直接解引用，必须先 `lock()` 升级为 `shared_ptr`：

```cpp
void observe(std::weak_ptr<Task> wp) {
    if (auto sp = wp.lock()) {           // 升级为 shared_ptr
        sp->run();                        // 安全使用
    } else {
        std::cout << "对象已销毁\n";       // 资源已经没了
    }
}

void demo() {
    auto task = std::make_shared<Task>(10);
    auto wp = std::weak_ptr<Task>(task);

    observe(wp);  // 输出 "Task 10 running"
    task.reset(); // 手动释放
    observe(wp);  // 输出 "对象已销毁"
}
```

> `lock()` 和 `expired()` 的区别：
> - `lock()`：返回 `shared_ptr`（可安全使用），或空指针；
> - `expired()`：只返回 `bool`，**多线程下存在 TOCTOU 竞态**，查完可能立即失效。永远优先用 `lock()`。
> >TOCTOU 竞态（全称：Time-of-Check To Time-of-Use，检查后使用时差竞态）：
> 先检查资源状态 → 间隔一小段时间 → 再使用资源；在【检查～使用】的空隙（竞态窗口），别的线程 / 进程修改了资源，导致之前的校验失效、逻辑出错 / 安全漏洞


