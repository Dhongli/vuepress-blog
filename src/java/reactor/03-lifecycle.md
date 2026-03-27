---
title: 订阅流程与生命周期
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第三章：订阅流程与生命周期

## 3.1 订阅到底做了什么？

当你调用 `subscribe()` 时，Reactor 内部会发生什么？

```java
Flux.just("A", "B", "C")
    .subscribe(
        element -> System.out.println("收到: " + element),
        error -> System.out.println("错误: " + error),
        () -> System.out.println("完成")
    );
```

### 3.1.1 订阅流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      subscribe() 完整流程                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. subscribe() 被调用                                         │
│          │                                                      │
│          ▼                                                      │
│   2. 创建 Subscription（订阅关系）                               │
│          │                                                      │
│          ▼                                                      │
│   3. request(n) - 请求数据（默认无限）                          │
│          │                                                      │
│          ▼                                                      │
│   4. onNext() - 逐个收到元素                                     │
│          │                                                      │
│          ├── 元素 A → 处理 → 继续请求                           │
│          ├── 元素 B → 处理 → 继续请求                           │
│          └── 元素 C → 处理 → 完成 or 继续                       │
│          │                                                      │
│          ▼                                                      │
│   5. onComplete() / onError() - 流结束                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1.2 代码层面理解

```java
// 完整订阅接口
public interface Subscriber<T> {
    
    // 订阅时调用
    void onSubscribe(Subscription s);
    
    // 收到每个元素时调用
    void onNext(T t);
    
    // 发生错误时调用
    void onError(Throwable t);
    
    // 流完成时调用
    void onComplete();
}
```

```java
// 实际使用示例
Flux.just("A", "B", "C")
    .subscribe(new Subscriber<String>() {
        
        private Subscription subscription;
        
        @Override
        public void onSubscribe(Subscription s) {
            System.out.println("订阅成功!");
            this.subscription = s;
            s.request(1);  // 请求第一个元素
        }
        
        @Override
        public void onNext(String s) {
            System.out.println("收到: " + s);
            subscription.request(1);  // 处理完后请求下一个
        }
        
        @Override
        public void onError(Throwable t) {
            System.out.println("错误: " + t.getMessage());
        }
        
        @Override
        public void onComplete() {
            System.out.println("完成!");
        }
    });

// 输出:
// 订阅成功!
// 收到: A
// 收到: B
// 收到: C
// 完成!
```

---

## 3.2 生命周期钩子

Reactor 提供了多个 `doOn*` 方法，可以在流的各个阶段插入自定义逻辑。

### 3.2.1 完整生命周期

```java
Flux.just("A", "B", "C")
    .doOnSubscribe(sub -> System.out.println("1. 订阅开始"))
    .doOnRequest(n -> System.out.println("2. 请求元素: " + n))
    .doOnNext(s -> System.out.println("3. 收到元素: " + s))
    .doOnComplete(() -> System.out.println("4. 完成"))
    .doOnError(e -> System.out.println("4. 错误: " + e.getMessage()))
    .doFinally(signal -> System.out.println("5. 最终清理: " + signal))
    .subscribe();

/*
输出:
1. 订阅开始
2. 请求元素: 9223372036854775807 (Long.MAX_VALUE)
3. 收到元素: A
3. 收到元素: B
3. 收到元素: C
4. 完成
5. 最终清理: onComplete
*/
```

### 3.2.2 生命周期顺序图

```
元素 "A" 的完整生命周期:
        
        ┌─────────────────┐
        │ doOnSubscribe  │ ← 订阅时触发一次
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  doOnRequest    │ ← 每次 request 时触发
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │   doOnNext      │ ← 收到每个元素时触发
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  doOnComplete   │ ← 正常完成时触发
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │   doFinally     │ ← 无论成功/错误/取消都触发
        └─────────────────┘
```

### 3.2.3 常用生命周期钩子

| 钩子方法 | 触发时机 | 典型用途 |
|----------|----------|----------|
| `doOnSubscribe()` | 订阅时 | 初始化、资源准备 |
| `doOnRequest()` | 请求元���时 | 限流、监控 |
| `doOnNext()` | 每个元素 | 日志、统计、收集 |
| `doOnComplete()` | 正常完成 | 成功处理、资源释放 |
| `doOnError()` | 错误时 | 错误日志、监控 |
| `doOnCancel()` | 取消订阅 | 清理资源 |
| `doFinally()` | 最终清理 | 无论如何都清理 |

---

## 3.3 操作符详解

### 3.3.1 map - 一对一转换

```java
// 基础语法
Flux.just(1, 2, 3)
    .map(i -> i * 10)  // 每个元素 *10
    .subscribe(System.out::println);

// 输出: 10, 20, 30
```

### 3.3.2 flatMap - 一对多 / 异步转换

```java
// map vs flatMap 区别

// map: 一对一，同步转换
Flux.just(1, 2, 3)
    .map(i -> Flux.just(i * 10))  // 返回 Flux
    .subscribe(flux -> flux.subscribe(System.out::println));
// 输出: 10, 20, 30 (嵌套订阅)

// flatMap: 扁平化，自动合并
Flux.just(1, 2, 3)
    .flatMap(i -> Flux.just(i * 10))  // 扁平化
    .subscribe(System.out::println);
// 输出: 10, 20, 30 (直接合并)

// 实际项目中的异步场景
public Mono<User> getUserWithOrders(Long userId) {
    // 1. 获取用户
    Mono<User> userMono = userRepository.findById(userId);
    
    // 2. 获取用户订单（异步）
    return userMono.flatMap(user -> 
        orderRepository.findByUserId(user.getId())
            .collectList()
            .map(orders -> {
                user.setOrders(orders);
                return user;
            })
    );
}
```

### 3.3.3 filter - 过滤

```java
Flux.just(1, 2, 3, 4, 5)
    .filter(i -> i > 3)  // 保留 > 3 的
    .subscribe(System.out::println);

// 输出: 4, 5
```

### 3.3.4 take - 取前 N 个

```java
Flux.just(1, 2, 3, 4, 5)
    .take(3)  // 只取前 3 个
    .subscribe(System.out::println);

// 输出: 1, 2, 3

// take 变体
.take(3)          // 前 3 个
.takeLast(3)      // 后 3 个
.takeUntil(i -> i >= 3)  // 直到满足条件
.takeWhile(i -> i < 3)   // 满足条件时继续
```

### 3.3.5 distinct - 去重

```java
Flux.just(1, 2, 1, 3, 2, 4)
    .distinct()
    .subscribe(System.out::println);

// 输出: 1, 2, 3, 4
```

---

## 3.4 组合操作符

### 3.4.1 merge - 合并（交错）

```java
Flux.merge(
    Flux.just(1, 2),
    Flux.just(3, 4)
).subscribe(System.out::println);

// 输出: 1, 3, 2, 4 (可能交错，取决于执行时序)

// 变体
.mergeWith(otherFlux)  // 合并另一个
.mergeSequential(f1, f2, f3)  // 按顺序合并
```

### 3.4.2 zip - 按索引组合

```java
Flux.zip(
    Flux.just("A", "B", "C"),
    Flux.just(1, 2, 3),
    (letter, number) -> letter + number  // 组合函数
).subscribe(System.out::println);

// 输出: A1, B2, C3
```

### 3.4.3 concat - 按顺序拼接

```java
Flux.concat(
    Flux.just(1, 2),
    Flux.just(3, 4)
).subscribe(System.out::println);

// 输出: 1, 2, 3, 4 (顺序固定)

// 对比 merge vs concat
// merge:   [1,2] + [3,4] → 1,3,2,4 (可能交错)
// concat:  [1,2] + [3,4] → 1,2,3,4 (顺序固定)
```

---

## 3.5 实战：用户查询流程

```java
// 场景：查询用户及其最近订单
public Mono<UserOrderVO> getUserWithOrders(Long userId) {
    
    return userRepository.findById(userId)
        .flatMap(user -> 
            // 并行查询订单和收货地址
            Mono.zip(
                orderRepository.findRecentByUserId(userId, 5).collectList(),
                addressRepository.findDefaultByUserId(userId)
            ).map(tuple -> {
                UserOrderVO vo = new UserOrderVO();
                vo.setUser(user);
                vo.setOrders(tuple.getT1());
                vo.setAddress(tuple.getT2());
                return vo;
            })
        )
        .doOnSuccess(vo -> log.info("查询成功: {}", vo.getUser().getName()))
        .doOnError(e -> log.error("查询失败", e))
        .onErrorResume(e -> Mono.empty());  // 用户不存在返回空
}
```

---

## 3.6 本章小结

1. **订阅流程**：subscribe → request → onNext → onComplete/onError
2. **生命周期钩子**：doOnSubscribe/doOnNext/doOnComplete/doFinally
3. **转换操作符**：map（同步）、flatMap（异步）
4. **过滤操作符**：filter、take、distinct
5. **组合操作符**：merge（交错）、zip（按索引）、concat（顺序）

---

## 3.7 练习题

1. 使用 doOnNext 统计 Flux 中偶数的数量
2. 使用 flatMap 将 1-5 每个数字转换为包含其平方的 Flux
3. 比较 merge 和 concat 的输出顺序差异

---

**下一章**：我们将学习线程调度 Schedulers，这是实现非阻塞的关键。