---
title: Flux 与 Mono 基础
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第二章：Flux 与 Mono 基础

## 2.1 什么是 Flux 和 Mono？

Reactor 中有两个核心类型：

| 类型 | 元素数量 | 读作 | 典型场景 |
|------|----------|------|----------|
| `Flux<T>` | 0 到 N 个 | "Flux" | 列表、流式数据、SSE |
| `Mono<T>` | 0 或 1 个 | "Mono" | HTTP 响应、数据库单条记录 |

```java
// Flux：多个元素
Flux<String> flux = Flux.just("A", "B", "C");
// 发出: A → B → C → complete

// Mono：单个元素（或空）
Mono<String> mono = Mono.just("Hello");
// 发出: Hello → complete
```

---

## 2.2 创建 Flux 的多种方式

### 2.2.1 从固定值创建

```java
// 1. Flux.just() - 最简单
Flux<String> f1 = Flux.just("A", "B", "C");

// 2. Flux.fromArray()
String[] arr = {"A", "B", "C"};
Flux<String> f2 = Flux.fromArray(arr);

// 3. Flux.fromIterable()
List<String> list = Arrays.asList("A", "B", "C");
Flux<String> f3 = Flux.fromIterable(list);

// 4. Flux.fromStream()
Stream<String> stream = Stream.of("A", "B", "C");
Flux<String> f4 = Flux.fromStream(stream);
```

### 2.2.2 从 0 个元素创建

```java
// 空 Flux - 不发出任何元素，直接完成
Flux<String> empty = Flux.empty();

// 错误 Flux - 发出错误信号
Flux<String> error = Flux.error(new RuntimeException("出错了"));
```

### 2.2.3 动态生成

```java
// Flux.generate - 同步逐个生成
Flux<String> generated = Flux.generate(
    () -> 0,  // 初始状态
    (state, sink) -> {
        if (state >= 3) {
            sink.complete();  // 完成
        } else {
            sink.next("Value-" + state);  // 发出元素
        }
        return state + 1;  // 更新状态
    }
);
// 输出: Value-0, Value-1, Value-2, complete

// Flux.create - 异步/手动推送（后面详解）

// Flux.interval - 定时生成
Flux<Long> timer = Flux.interval(Duration.ofSeconds(1));
// 每秒发出: 0, 1, 2, 3, ...
```

### 2.2.4 从其他类型转换

```java
// Mono → Flux
Mono<String> mono = Mono.just("Hello");
Flux<String> fromMono = mono.flux();

// Flux → Mono（取第一个）
Flux<String> flux = Flux.just("A", "B", "C");
Mono<String> first = flux.next();

// Flux → Mono（收集为列表）
Mono<List<String>> list = flux.collectList();
```

---

## 2.3 创建 Mono 的多种方式

### 2.3.1 从值创建

```java
// 1. Mono.just() - 最常用
Mono<String> m1 = Mono.just("Hello");

// 2. Mono.fromCallable() - 延迟执行
Mono<String> m2 = Mono.fromCallable(() -> {
    // 实际调用时才执行
    return computeExpensiveValue();
});

// 3. Mono.fromSupplier() - 同上，简洁写法
Mono<String> m3 = Mono.fromSupplier(() -> "World");

// 4. Mono.fromRunnable() - 执行副作用
Mono<Void> m4 = Mono.fromRunnable(() -> {
    System.out.println("执行一些操作");
});

// 5. Mono.delay() - 延迟后发出
Mono<Long> m5 = Mono.delay(Duration.ofSeconds(2));
// 2 秒后发出: 0 → complete
```

### 2.3.2 创建空或错误的 Mono

```java
// 空 Mono - 不发出元素，直接完成
Mono<String> empty = Mono.empty();

// 错误 Mono - 发出错误
Mono<String> error = Mono.error(new RuntimeException("错误"));
```

---

## 2.4 订阅：让流开始流动

创建 Flux/Mono 后，数据不会自动流动，需要**订阅**才会执行。

### 2.4.1 最简单的订阅

```java
Flux.just("A", "B", "C")
    .subscribe();  // 订阅后数据开始流动
```

### 2.4.2 带回调的订阅

```java
Flux.just("A", "B", "C")
    .subscribe(
        element -> System.out.println("收到: " + element),  // onNext
        error -> System.out.println("错误: " + error),       // onError
        () -> System.out.println("完成")                      // onComplete
    );

// 输出:
// 收到: A
// 收到: B
// 收到: C
// 完成
```

### 2.4.3 订阅流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      订阅流程                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   创建 Flux/Mono                                            │
│         │                                                   │
│         ▼                                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              subscribe() 订阅                        │  │
│   └──────────────────────┬──────────────────────────────┘  │
│                          │                                   │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │ onNext() │    │ onError()│    │ onComplete│           │
│   │ 每个元素  │    │ 发生错误  │    │   完成    │           │
│   └──────────┘    └──────────┘    └──────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.4.4 不同订阅方式对比

```java
// 方式1：Lambda 订阅（最常用）
flux.subscribe(
    element -> process(element),  // onNext
    error -> handleError(error),   // onError
    () -> cleanup()                 // onComplete
);

// 方式2：只关心元素
flux.subscribe(element -> System.out.println(element));

// 方式3：使用 Consumer 接口
flux.subscribe(new Consumer<String>() {
    @Override
    public void accept(String s) {
        System.out.println(s);
    }
});

// 方式4：获取 Disposable 控制订阅
Disposable disposable = flux.subscribe();
disposable.dispose();  // 取消订阅
```

---

## 2.5 错误处理基础

### 2.5.1 onErrorReturn - 错误时返回默认值

```java
Flux.just(1, 2, 3)
    .map(i -> {
        if (i == 2) throw new RuntimeException("错误");
        return i * 10;
    })
    .onErrorReturn(0)  // 发生错误时发出 0 并完成
    .subscribe(
        System.out::println,
        System.out::println  // 错误会被 onErrorReturn 吞掉
    );

// 输出: 10, 0
```

### 2.5.2 onErrorResume - 错误时切换到另一个流

```java
Flux.just(1, 2, 3)
    .map(i -> {
        if (i == 2) throw new RuntimeException("错误");
        return i * 10;
    })
    .onErrorResume(e -> Flux.just(100, 200, 300))  // 错误后切换到新流
    .subscribe(System.out::println);

// 输出: 10, 100, 200, 300
```

---

## 2.6 第一个完整示例

```java
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public class FirstReactorExample {
    
    public static void main(String[] args) {
        // 示例1: Flux 基本使用
        System.out.println("=== 示例1: Flux ===");
        Flux.just("Apple", "Banana", "Orange")
            .subscribe(
                fruit -> System.out.println("水果: " + fruit),
                error -> System.out.println("错误: " + error),
                () -> System.out.println("完成!")
            );
        
        // 示例2: Mono 基本使用
        System.out.println("\n=== 示例2: Mono ===");
        Mono.just("Hello Reactor")
            .subscribe(
                msg -> System.out.println("消息: " + msg),
                error -> System.out.println("错误: " + error),
                () -> System.out.println("完成!")
            );
        
        // 示例3: 错误处理
        System.out.println("\n=== 示例3: 错误处理 ===");
        Flux.error(new RuntimeException("出错了"))
            .onErrorReturn("默认值")
            .subscribe(
                System.out::println,
                System.out::println  // 不执行，因为被捕获了
            );
        
        // 示例4: 转换操作
        System.out.println("\n=== 示例4: map 转换 ===");
        Flux.just(1, 2, 3)
            .map(i -> i * 10)
            .map(i -> "数字: " + i)
            .subscribe(System.out::println);
    }
}
```

**运行结果**：

```
=== 示例1: Flux ===
水果: Apple
水果: Banana
水果: Orange
完成!

=== 示例2: Mono ===
消息: Hello Reactor
完成!

=== 示例3: 错误处理 ===
默认值

=== 示例4: map 转换 ===
数字: 10
数字: 20
数字: 30
```

---

## 2.7 常用操作符速查

| 操作符 | 作用 | 示例 |
|--------|------|------|
| `map` | 一对一转换 | `Flux.just(1,2,3).map(i->i*10)` |
| `flatMap` | 一对多/异步转换 | `Flux.just(1,2).flatMap(i->Mono.just(i*10))` |
| `filter` | 过滤 | `Flux.just(1,2,3).filter(i->i>1)` |
| `take` | 取前 N 个 | `Flux.just(1,2,3,4,5).take(3)` |
| `distinct` | 去重 | `Flux.just(1,2,1,3).distinct()` |
| `merge` | 合并 | `Flux.merge(Flux.just(1,2), Flux.just(3,4))` |
| `zip` | 按索引组合 | `Flux.zip(Flux.just("A","B"), Flux.just(1,2))` |
| `onErrorReturn` | 错误默认值 | `flux.onErrorReturn("default")` |
| `onErrorResume` | 错误切换流 | `flux.onErrorResume(e->Flux.empty())` |

---

## 2.8 本章小结

1. **Flux** = 0-N 元素流，**Mono** = 0-1 单值
2. 创建方式：`just()`, `fromIterable()`, `empty()`, `error()`, `generate()`, `interval()`
3. 订阅才执行：`subscribe(onNext, onError, onComplete)`
4. 错误处理：`onErrorReturn()`, `onErrorResume()`
5. 常用操作符：`map`, `flatMap`, `filter`, `take`, `merge`, `zip`

---

## 2.9 练习题

1. 创建一个发出数字 1-10 的 Flux，过滤出偶数并乘以 2
2. 创建一个 Mono，延迟 3 秒后发出 "Done"
3. 模拟一个错误流，体验 `onErrorReturn` 和 `onErrorResume` 的区别

---

**下一章**：我们将学习 Flux 的订阅流程和生命周期，这是理解响应式编程的关键。