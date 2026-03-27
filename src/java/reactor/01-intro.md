---
title: 初识响应式编程
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第一章：初识响应式编程

## 1.1 什么是响应式编程？

**响应式编程**（Reactive Programming）是一种面向数据流和变化传播的编程范式。

### 传统命令式 vs 响应式

```java
// ============================================
// 传统命令式编程（同步阻塞）
// ============================================

// 场景：调用 LLM API 获取回答
public class SyncExample {
    
    public String chat(String question) {
        // 💡 线程在这里阻塞等待！
        // 假设 LLM 响应需要 5 秒，这 5 秒线程什么都干不了
        String result = llmClient.call(question);
        
        // 只有 LLM 返回后，才能继续执行
        return result;
    }
}

// 使用：每个请求占用一个线程
// 请求1 → 线程1 (阻塞 5 秒)
// 请求2 → 线程2 (阻塞 5 秒)
// 请求3 → 线程3 (阻塞 5 秒)
// ...
// 1000个请求 = 1000个阻塞线程 💀
```

```java
// ============================================
// 响应式编程（非阻塞）
// ============================================

public class ReactiveExample {
    
    public Flux<String> chat(String question) {
        // 💡 立即返回，不阻塞！
        // 创建一个数据流，LLM 响应时会推送数据
        
        // 底层机制：
        // 1. 请求发出后，线程立即返回
        // 2. LLM 响应时，框架回调通知
        // 3. 同一个线程可以处理多个请求
        
        return Flux.create(sink -> {
            llmClient.callAsync(question, result -> {
                // 异步收到结果，推送到流
                sink.next(result);
                sink.complete();
            });
        });
    }
}

// 使用：线程复用，效率高
// 请求1 → 线程1 (发出请求，立即返回)
// 请求2 → 线程1 (发出请求，立即返回) ← 同一线程处理多个请求！
// 请求3 → 线程1 (发出请求，立即返回)
// ...
// 1000个请求 = 少量线程 ✅
```

### 对比总结

| 特性 | 传统同步 | 响应式 |
|------|----------|--------|
| 线程模型 | 一请求一线程 | 线程复用 |
| 阻塞等待 | 阻塞 | 非阻塞 |
| 资源消耗 | 高 | 低 |
| 并发能力 | 有限 | 强 |
| 适用场景 | CPU 密集型 | I/O 密集型 |

---

## 1.2 为什么需要响应式编程？

### 1.2.1 现代应用的挑战

```
┌─────────────────────────────────────────────────────────────────┐
│                     高并发互联网应用                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │ 用户 A  │  │ 用户 B  │  │ 用户 C  │  │ 用户 D  │   ...    │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│        │           │           │           │                  │
│        └───────────┴───────────┴───────────┘                  │
│                         │                                      │
│                         ▼                                      │
│              ┌─────────────────────┐                          │
│              │    并发请求数可能    │                          │
│              │    上万甚至更多      │                          │
│              └─────────────────────┘                          │
│                         │                                      │
│                         ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐ │
│   │ 这些请求大部分时间在等待：                                 │ │
│   │  • 数据库查询                                            │ │
│   │  • 外部 API 调用                                         │ │
│   │  • 文件读写                                               │ │
│   │  • LLM 生成回答                                          │ │
│   └─────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2.2 I/O 操作的等待时间

| 操作 | 等待时间 |
|------|----------|
| 内存访问 | 纳秒级 |
| SSD 读取 | 微秒级 |
| 网络请求（本地） | 毫秒级 |
| 网络请求（远程） | 10-100 毫秒 |
| 数据库查询 | 1-100 毫秒 |
| **LLM API 调用** | **1-30 秒** 💀 |

**关键洞察**：在等待 I/O 的过程中，线程完全空闲！

### 1.2.3 响应式编程的价值

```
传统方式：10000 并发 = 10000 线程 = 大量内存 + 频繁上下文切换
┌───┬───┬───┬───┬───┐
│T1 │T2 │T3 │T4 │T5 │  ... 9995 more threads
└───┴───┴───┴───┴───┘

响应式：10000 并发 = 少量线程（复用）
┌─────────────────────┐
│   少量工作线程      │
│  (复用处理请求)    │
└─────────────────────┘
```

---

## 1.3 响应式编程解决的问题

### 问题 1：线程资源浪费

```java
// 同步写法：线程在等待时空闲
public List<Order> getOrders() {
    // 线程阻塞等待数据库
    return jdbcTemplate.query("SELECT * FROM orders", ...);
}
```

```java
// 响应式写法：线程不阻塞
public Flux<Order> getOrders() {
    // 创建查询流，数据库返回时推送数据
    return reactiveTemplate.query("SELECT * FROM orders", ...);
}
```

### 问题 2：级联等待

```java
// 同步：串行等待，每一步都阻塞
public OrderDetail getOrderDetail(Long orderId) {
    // 1. 等待查询订单信息 (100ms)
    Order order = orderDao.findById(orderId);
    
    // 2. 等待查询用户信息 (100ms)
    User user = userDao.findById(order.getUserId());
    
    // 3. 等待查询商品信息 (100ms)
    List<Item> items = itemDao.findByOrderId(orderId);
    
    // 总耗时：300ms（串行）
    return new OrderDetail(order, user, items);
}
```

```java
// 响应式：并行等待
public Mono<OrderDetail> getOrderDetail(Long orderId) {
    // 并行执行，互不等待
    Mono<Order> orderMono = orderDao.findById(orderId);
    Mono<User> userMono = userMono.flatMap(u -> userDao.findById(u.getId()));
    Mono<List<Item>> itemsMono = itemDao.findByOrderId(orderId);
    
    // 组合结果
    return Mono.zip(orderMono, userMono, itemsMono)
        .map(tuple -> new OrderDetail(
            tuple.getT1(),  // order
            tuple.getT2(),  // user
            tuple.getT3()   // items
        ));
    // 总耗时：100ms（并行取最大值）
}
```

### 问题 3：流式数据处理

```java
// 同步：一次性加载全部数据到内存
public List<String> readLargeFile(String path) {
    // 文件可能有 1GB，全部加载到内存 💀
    return Files.readAllLines(Paths.get(path));
}
```

```java
// 响应式：流式处理，数据分块推送
public Flux<String> readLargeFile(String path) {
    return Flux.create(sink -> {
        try (BufferedReader reader = new BufferedReader(
                new FileReader(path))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // 每读一行，推送一行
                // 内存占用极低 ✅
                sink.next(line);
            }
            sink.complete();
        } catch (IOException e) {
            sink.error(e);
        }
    });
}
```

---

## 1.4 Spring 生态中的响应式编程

### 1.4.1 Spring WebFlux

```java
// 传统 Spring MVC（阻塞）
@RestController
public class SyncController {
    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();  // 阻塞
    }
}

// Spring WebFlux（响应式）
@RestController
public class ReactiveController {
    @GetMapping("/users")
    public Flux<User> getUsers() {
        return userService.findAll();  // 非阻塞
    }
}
```

### 1.4.2 Spring Data 响应式

```java
// 传统 JPA（阻塞）
public interface UserRepository extends JpaRepository<User, Long> {
    List<User> findByName(String name);  // 阻塞
}

// Spring Data R2DBC（响应式）
public interface UserRepository extends ReactiveCrudRepository<User, Long> {
    Flux<User> findByName(String name);  // 非阻塞
}
```

### 1.4.3 Spring AI 中的响应式

```java
// Spring AI 使用 Flux 实现流式输出（SSE）
@RestController
public class ChatController {
    
    @GetMapping(value = "/chat", produces = "text/event-stream")
    public Flux<String> chat(@RequestParam String query) {
        // LLM 逐字返回，通过 Flux 流式推送到前端
        return chatModel.stream(prompt);
    }
}
```

---

## 1.5 Reactor 简介

**Reactor** 是 Spring 5 引入的响应式编程库，也是 Spring WebFlux 的底层实现。

```
┌─────────────────────────────────────────────────────────────┐
│                      Reactor 在 Spring 生态中的位置          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   Spring Application                │  │
│   ├─────────────────────────────────────────────────────┤  │
│   │  Spring WebFlux    │  Spring Data    │  Spring AI  │  │
│   │       │            │     R2DBC       │      │      │  │
│   │       │            │       │         │      │      │  │
│   │       ▼            │       ▼         │      ▼      │  │
│   │  ┌─────────┐       │  ┌─────────┐    │  ┌─────────┐ │  │
│   │  │Reactor  │◄──────┼──│Reactor  │◄───┼──│ Reactor │ │  │
│   │  │         │       │  │         │    │  │         │ │  │
│   │  └─────────┘       │  └─────────┘    │  └─────────┘ │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│                  ┌──────────────┐                          │
│                  │ Netty / Servlet 容器                    │
│                  └──────────────┘                          │
│                                                              │
└────────────────────────────────���────────────────────────────┘
```

### 核心类型

| 类型 | 含义 | 元素数量 |
|------|------|----------|
| `Flux<T>` | 异步序列 | 0 到 N |
| `Mono<T>` | 异步单值 | 0 或 1 |

---

## 1.6 本章小结

1. **响应式编程** = 非阻塞 + 异步 + 数据流
2. **核心优势**：线程复用、高并发、低资源消耗
3. **适用场景**：I/O 密集型（数据库、API、LLM 调用）
4. **不适用**：CPU 密集型计算
5. **Reactor** 是 Spring 生态的响应式基础库
6. **Flux** = 0-N 元素流，**Mono** = 0-1 单值

---

## 1.7 思考题

1. 为什么说"LLM API 调用"特别适合响应式编程？
2. 如果你的应用是 CPU 密集型的计算，响应式编程还有优势吗？
3. 响应式编程能否完全替代传统的同步代码？

---

**下一章**：我们将深入学习 Flux 和 Mono 的创建方式与基本操作。