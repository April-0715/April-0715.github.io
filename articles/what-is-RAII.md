# 什么是RAII 

> 发布日期：2026-06-04 | 标签：C++
> 
## 一、核心定义
**RAII(资源获取即初始化)：资源在对象构造时申请获取，对象析构时自动释放归还**，是C++独有的经典资源管理编程范式，依靠**栈对象生命周期**自动管控资源，从语法层面避免内存泄漏、句柄泄露、文件/锁忘记释放。


### 适用资源类型
堆内存、文件句柄、套接字、互斥锁、数据库连接等**所有需要手动释放的资源**。

## 二、设计原理
C++ 对象特性：
1. **局部栈对象出作用域自动调用析构函数**（函数返回、`}`、异常抛出都会触发）；
2. 把**资源申请放到构造函数**，**资源释放放到析构函数**；
只要对象生命周期结束，资源必然自动回收，不用手动写释放代码。

## 三、正反示例对比
### 1. 传统裸指针
```cpp
void bad_func() {
    int* p = new int[100]; // 申请堆内存
    // 中间代码如果提前return /抛出异常，直接跳过delete
    delete[] p; // 容易漏写，造成内存泄漏
}
```

### 2. RAII实现内存管理
```cpp
// RAII封装
template<typename T>
class MyRAIIPtr {
private:
    T* data;
public:
    // 构造：获取资源
    explicit MyRAIIPtr(T* p):data(p){}
    // 析构：释放资源
    ~MyRAIIPtr(){ delete data; }

    // 重载解引用、箭头，像原生指针使用
    T& operator*() const{ return *data; }
    T* operator->() const{ return data; }

    // 禁用拷贝（防止双重释放），现代C++用移动语义
    MyRAIIPtr(const MyRAIIPtr&)=delete;
    MyRAIIPtr& operator=(const MyRAIIPtr&)=delete;
};

// 使用
void good_func(){
    MyRAIIPtr<int> p(new int(10)); // 构造拿资源
    // 函数结束/异常跳出，栈对象销毁，析构自动delete
}
```

## 四、C++标准库大量基于RAII
### 1. 智能指针
- `std::unique_ptr`：独占所有权，RAII管理堆内存，离开作用域自动释放
- `std::shared_ptr`：共享所有权，引用计数归零自动释放
```cpp
void test(){
    std::unique_ptr<int> ptr = std::make_unique<int>(5);
    // 出作用域自动释放堆内存，无需delete
}
```

### 2. 锁管理
`std::lock_guard / std::unique_lock`：构造加锁，析构解锁，避免死锁/忘解锁
```cpp
std::mutex mtx;
void thread_func(){
    std::lock_guard<std::mutex> lg(mtx); // 构造上锁
    // 临界区代码，函数退出/异常，lg销毁自动解锁
}
```

### 3. 文件流
`std::fstream`：构造打开文件，析构自动close()，不用手动`fclose`
```cpp
void file_demo(){
    std::ofstream out("test.txt");
    out << "hello";
    // 离开作用域自动关闭文件
}
```

### 4. STL容器
`vector/string`：构造分配堆内存，析构自动释放内部缓冲区。

