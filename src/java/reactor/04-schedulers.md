---
title: 线程调度 Schedulers
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第四章：线程调度 Schedulers

## 4.1 为什么需要线程调度？

响应式编程的核心是**非阻塞**，但这不意味着不需要线程。

```
┌─────────────────────────────────────────────────────────────────┐
│                     响应式编程的线程模型                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   传统同步：                    响应式：                         │
│                                                                  │
│   线程 A:                      线程 A:                           │
│   request() ──等待──► DB       request() ──立即返回──►          │
│   ◄──结果──                      (不等待)                        │
│   process()                    (等回调)                         │
│                                                                  │
│   线程 B:                      线程 A:  ← 继续处理其他请求       │
│   request() ──等待──► API      回调 ──► 处理结果                │
│   ◄──结果──                                                         │
│                                                                  │
│   线程 C:                      线程 B: (回调执行)                │
│   request() ──等待──► ...      处理耗时操作                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键点**：
1. 发出请求的线程**不等结果**，立即返回
2. 结果通过**回调**在另一个线程执行
3. 同一线程可以处理**多个请求**

---

## 4.2 Schedulers 类型详解

Reactor 提供了多种调度器：

| 调度器 | 创建方式 | 线程池特点 | 适用场景 |
|--------|----------|------------|----------|
| `immediate` | `Schedulers.immediate()` | 当前线程 | 不切换线程 |
| `single` | `Schedulers.single()` | 单线程池 | 顺序执行 |
| `parallel` | `Schedulers.parallel()` | CPU 核数 | CPU 密集型 |
| `boundedElastic` | `Schedulers.boundedElastic()` | 弹性线程池（默认 10*CPU） | **I/O 阻塞操作** |
| `elastic` | `Schedulers.elastic()` | 弹性线程池（已废弃） | 不推荐 |

### 4.2.1 immediate - 当前线程

```java
// 不切换线程，在当前线程执行
Flux.just(1, 2, 3)
    .subscribeOn(Schedulers.immediate())
    .subscribe(i -> System.out.println("线程: " + Thread.currentThread().getName()));

// 输出: 线程: main
```

### 4.2.2 single - 单线程

```java
// 所有操作在同一线程执行
Flux.just(1, 2, 3)
    .subscribeOn(Schedulers.single())
    .subscribe(i -> System.out.println("线程: " + Thread.currentThread().getName()));

// 输出: 线程: single-1
// 所有元素都在 single-1 线程
```

### 4.2.3 parallel - 并行（CPU 核数）

```java
// 使用 CPU 核数的线程池
Flux.just(1, 2, 3, 4)
    .parallel(4)  // 并行度
    .runOn(Schedulers.parallel())  // 在并行调度器执行
    .map(i -> {
        System.out.println("处理: " + i + ", 线程: " + Thread.currentThread().getName());
        return i * 10;
    })
    .sequential()  // 重新合并为顺序流
    .subscribe();

// 输出（不保证顺序）:
// 处理: 3, 线程: parallel-2
// 处理: 1, 线程: parallel-1
// 处理: 4, 线程: parallel-3
// 处理: 2, 线程: parallel-4
```

### 4.2.4 boundedElastic - 弹性线程池（最重要！）

```java
// 适合阻塞 I/O 操作（数据库、文件、网络请求）
Flux.just(1, 2, 3)
    .flatMap(i -> Mono.fromCallable(() -> {
        // 模拟阻塞的数据库/网络调用
        Thread.sleep(100);
        return i * 10;
    }))
    .subscribeOn(Schedulers.boundedElastic())  // 关键！
    .subscribe(i -> System.out.println("结果: " + i));

// 输出: 结果: 10, 结果: 20, 结果: 30
// 所有操作在 boundedElastic 线程池执行，不阻塞主线程
```

---

## 4.3 subscribeOn vs publishOn

这是两个最容易混淆的概念。

### 4.3.1 subscribeOn - 影响源

`subscribeOn` 影响**数据源**的执行线程，**只生效一次**。

```java
// 无论有多少个 subscribeOn，只有第一个生效
Flux.just(1, 2, 3)                    // 数据源
    .subscribeOn(Schedulers.single()) // ① 这个生效
    .subscribeOn(Schedulers.boundedElastic()) // ② 无效
    .subscribeOn(Schedulers.parallel())      // ③ 无效
    .subscribe(i -> System.out.println("线程: " + Thread.currentThread().getName()));

// 输出: 线程: single-1
```

**场景**：数据源是阻塞的（如数据库查询）

```java
// ❌ 错误：subscribeOn 位置错误
Flux.create(sink -> {
        // 阻塞的数据库查询
        List<User> users = jdbcTemplate.query(...);  // 会阻塞
        users.forEach(sink::next);
    })
    .map(User::getName)  // 这个不受影响
    .subscribeOn(Schedulers.boundedElastic())  // 放错位置！
    .subscribe();

// ✅ 正确：subscribeOn 影响 Flux.create
Flux.create(sink -> {
        // 阻塞的数据库查询，现在在 boundedElastic 线程执行
        List<User> users = jdbcTemplate.query(...);
        users.forEach(sink::next);
    })
    .subscribeOn(Schedulers.boundedElastic())  // 正确位置
    .subscribe();
```

### 4.3.2 publishOn - 影响下游

`publishOn` 影响**当前操作符之后**的所有操作，**可以多次调用**。

```java
// publishOn 可以多次使用，切换不同阶段到不同线程
Flux.just(1, 2, 3)
    .map(i -> {                 // 线程: main
        System.out.println("① map: " + Thread.currentThread().getName());
        return i * 10;
    })
    .publishOn(Schedulers.single())  // 切换线程
    .map(i -> {                 // 线程: single-1
        System.out.println("② map: " + Thread.currentThread().getName());
        return i + 1;
    })
    .publishOn(Schedulers.boundedElastic())  // 再切换
    .map(i -> {                 // 线程: boundedElastic-1
        System.out.println("③ map: " + Thread.currentThread().getName());
        return i * 2;
    })
    .subscribe();

/*
输出:
① map: main
② map: single-1
③ map: boundedElastic-1
*/
```

### 4.3.3 对比总结

| 特性 | subscribeOn | publishOn |
|------|-------------|-----------|
| 作用位置 | 影响数据源（上游） | 影响当前操作之后（下游） |
| 生效次数 | 首次有效 | 可多次调用 |
| 典型场景 | 阻塞的数据源 | 分阶段处理 |
| 代码位置 | 任意（会向上传播） | 影响之后的操作 |

### 4.3.4 组合使用

```java
// 完整示例：数据获取 → 处理 → 返回
Flux.just(1, 2, 3)
    .subscribeOn(Schedulers.boundedElastic())  // ① 数据获取在弹性线程
    .publishOn(Schedulers.parallel())           // ② CPU 处理在并行线程
    .map(i -> computeExpensive(i))              // 计算密集型
    .publishOn(Schedulers.boundedElastic())     // ③ ���果写入在弹性线程
    .doOnNext(result -> writeToDb(result))
    .subscribe();
```

---

## 4.4 项目中的实际使用

### 4.4.1 WebSearchReactAgent 中的线程调度

```java
// WebSearchReactAgent.java:247-260

// 创建流并订阅
Disposable disposable = chatClient.prompt()
    .messages(messages)
    .stream()
    .chatResponse()
    .publishOn(Schedulers.boundedElastic())  // 关键！
    .doOnNext(chunk -> processChunk(chunk, sink, state))
    .subscribe();
```

**为什么用 boundedElastic？**
- LLM API 调用是网络 I/O 操作
- 需要等待响应，线程会阻塞
- 使用弹性线程池，避免阻塞主线程

### 4.4.2 工具执行的线程调度

```java
// WebSearchReactAgent.java:460

// 在弹性线程池执行工具
Schedulers.boundedElastic().schedule(() -> {
    if (hasSentFinalResult.get()) {
        return;
    }
    
    String toolName = tc.name();
    try {
        Object result = callback.call(argsJson);  // 阻塞的网络调用
        
        // 处理结果...
        messages.add(ToolResponseMessage.builder()
            .responses(List.of(tr))
            .build());
        
    } catch (Exception ex) {
        // 处理错误
    }
});
```

---

## 4.5 常见错误与最佳实践

### 4.5.1 常见错误

```java
// ❌ 错误1：在 subscribeOn 之前的操作会阻塞
Flux.just(1, 2, 3)
    .subscribeOn(Schedulers.boundedElastic())  // 太晚了
    .map(i -> blockingCall(i))  // 这里会阻塞主线程！
    .subscribe();

// ❌ 错误2：在 map 中执行阻塞操作
Flux.just(1, 2, 3)
    .map(i -> {
        Thread.sleep(1000);  // 阻塞主线程！
        return i * 10;
    })
    .subscribe();

// ✅ 正确：使用 flatMap + subscribeOn
Flux.just(1, 2, 3)
    .flatMap(i -> Mono.fromCallable(() -> {
        Thread.sleep(1000);  // 在 boundedElastic 线程执行
        return i * 10;
    }))
    .subscribeOn(Schedulers.boundedElastic())
    .subscribe();
```

### 4.5.2 最佳实践

```java
// ✅ 最佳实践1：阻塞操作一定用 boundedElastic
Mono.fromCallable(() -> blockingCall())
    .subscribeOn(Schedulers.boundedElastic())
    .subscribe();

// ✅ 最佳实践2：CPU 密集型用 parallel
Flux.just(1, 2, 3, 4)
    .parallel()
    .runOn(Schedulers.parallel())
    .map(i -> cpuHeavyComputation(i))
    .sequential()
    .subscribe();

// ✅ 最佳实践3：多个阻塞操作可以并行
Mono.zip(
    Mono.fromCallable(() -> callServiceA()).subscribeOn(Schedulers.boundedElastic()),
    Mono.fromCallable(() -> callServiceB()).subscribeOn(Schedulers.boundedElastic()),
    Mono.fromCallable(() -> callServiceC()).subscribeOn(Schedulers.boundedElastic())
).subscribe();
```

---

## 4.6 自定义调度器

```java
// 创建固定大小的线程池
ExecutorService executor = Executors.newFixedThreadPool(10);
Scheduler customScheduler = Schedulers.fromExecutorService(executor);

// 使用
Flux.just(1, 2, 3)
    .publishOn(customScheduler)
    .subscribe();

// 使用后销毁
customScheduler.dispose();
```

---

## 4.7 本章小结

1. **为什么需要调度器**：非阻塞 ≠ 不用线程，而是线程复用
2. **boundedElastic**：最适合 I/O 阻塞操作（数据库、网络、LLM 调用）
3. **parallel**：适合 CPU 密集型计算
4. **subscribeOn**：影响数据源，只生效一次
5. **publishOn**：影响下游操作，可多次调用
6. **最佳实践**：阻塞操作 → boundedElastic，CPU 计算 → parallel

---

## 4.8 练习题

1. 分析以下代码的线程执行路径：
```java
Flux.just(1, 2, 3)
    .map(i -> { System.out.println("① " + Thread.currentThread().getName()); return i; })
    .subscribeOn(Schedulers.single())
    .publishOn(Schedulers.boundedElastic())
    .map(i -> { System.out.println("② " + Thread.currentThread().getName()); return i; })
    .subscribe();
```

2. 如果 LLM 调用需要 10 秒，boundedElastic 线程池默认最多有多少个并发？为什么？

---

**下一章**：我们将学习 Sinks.Many，这是项目中实现 SSE 流式响应的核心。