# C++11 移动语义

> 发布日期：2026-06-04 | 标签：C++

## 一、左值与右值
### 1. 左值 lvalue
可以取地址、拥有持久内存空间、具名的变量/对象，程序生命周期内真实存在。
- 普通变量、函数局部对象、引用变量均为左值；
```cpp
int num = 10;
MyRAIIPtr<int> p(new int(5));
// num、p都是左值，&num、&p合法
```
>MyRAIIPtr 是 [什么是RAII](article.html?slug=what-is-RAII) 中的示例类，简化实现了类似 unique_ptr 的独占所有权智能指针——对裸指针做 RAII 封装，禁止拷贝，仅允许移动转移资源所有权。

**左值传入构造，优先匹配拷贝构造函数。**

### 2. 右值 rvalue
匿名临时数据，没有独立内存地址、表达式运算产物、字面常量，生命周期短暂，语句结束立刻销毁，**无法取地址**。
- 常量字面量：`100`、`3.14`；
- 运算表达式：`a+b`；
- 函数返回临时对象。
```cpp
int x = 1+2; 
MyRAIIPtr<int> func(){ return MyRAIIPtr<int>(new int(1)); }
auto res = func(); // func()返回临时右值
```
**右值传入构造，优先匹配移动构造函数。**

## 二、右值引用 &&：移动语义的载体（C++11）
### 1. 两种引用对比
1. **左值引用 T&**：只能绑定左值，不能绑定普通右值；`const T&`特例可绑定右值，但无法修改资源。
2. **右值引用 T&&**：专门绑定右值，是实现移动的语法基础，作为移动构造/移动赋值的形参类型。
```cpp
int&& r = 66;    // 合法，字面量右值绑定右值引用
int a=10;
int&& rr = a;    // 非法，a是左值不能绑定&&
```

### 2. std::move：左值手动转为右值
`std::move(左值变量)`：**仅做类型转换，不拷贝内存、不销毁数据**，把实名左值强制转换成可被右值引用接收的将亡值，人为触发移动。
> 关键：move后的原对象资源被转移，变为空对象。
> 被`std::move`后的对象处于**有效但未定义状态**，只能赋值或销毁，禁止解引用访问资源；
```cpp
MyRAIIPtr<int> p1(new int(10));
auto p2 = std::move(p1); // p1左值→右值，触发移动构造
```

## 三、为什么诞生移动语义（结合RAII智能指针痛点）
1. **RAII独占资源禁止拷贝**
独占型资源（`unique_ptr`、文件句柄、锁）不能浅拷贝，默认拷贝构造会造成同一块资源被多个对象持有，析构时重复释放内存崩溃，因此用`=delete`删除拷贝构造与拷贝赋值。
```cpp
MyRAIIPtr(const MyRAIIPtr&)=delete;
MyRAIIPtr& operator=(const MyRAIIPtr&)=delete;
```
禁用拷贝后：`auto p2=p1;`直接编译报错。

2. **业务需要资源所有权转移**
虽然不能复制资源，但经常需要把资源从A对象移交至B对象（函数返回对象、对象赋值转移），**拷贝行不通，移动来解决**。
- 拷贝：开辟新内存、复制数据，开销大，独占资源不允许；
- 移动：仅转移内部资源指针，源对象置空，无堆内存复制，开销极小。

## 四、移动构造函数 & 移动赋值函数实现逻辑
### 1. 移动构造（对象初始化阶段）
格式：`类名(类名&& 源对象) noexcept`
执行步骤：
1. 新对象接管源对象内部资源指针；
2. 源对象内部指针置空`nullptr`；
3. 源对象析构时`delete nullptr`，安全无释放动作，避免二次释放。
```cpp
MyRAIIPtr(MyRAIIPtr&& src) noexcept{
    data = src.data;
    src.data = nullptr;
}
```

### 2. 移动赋值（对象已存在，后续赋值）
格式：`类名& operator=(类名&& src) noexcept`
执行步骤：
1. 防止自赋值`if(this==&src) return *this;`；
2. 释放当前对象原有资源；
3. 接管源对象资源，源对象置空。
```cpp
MyRAIIPtr& operator=(MyRAIIPtr&& src) noexcept{
    if(this == &src) return *this;
    delete data;
    data = src.data;
    src.data = nullptr;
    return *this;
}
```

## 五、拷贝/移动三种写法
```cpp
MyRAIIPtr<int> p1(new int(10));
// 1. 拷贝初始化：左值传入，拷贝构造已删除 → 编译报错
MyRAIIPtr<int> p2 = p1;
// 2. 移动初始化：move转右值，调用移动构造，资源转移
MyRAIIPtr<int> p3 = std::move(p1);
// 3. 函数返回临时右值，自动触发移动
MyRAIIPtr<int> test(){
    MyRAIIPtr<int> tmp(new int(99));
    return tmp;
}
auto p4 = test();
```

## 六、移动语义核心优势
1. **性能优化**：大块内存、容器（string/vector）、自定义RAII资源，避免不必要的深拷贝，只转移指针，降低开销；
2. **适配独占式RAII设计**：`unique_ptr`、`std::lock_guard`等独占资源，禁用拷贝，依靠移动实现资源所有权转交；
3. **异常安全**：移动操作`noexcept`标记，容器扩容移动元素时不会触发异常回滚。

