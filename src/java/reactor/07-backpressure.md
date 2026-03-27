---
title: 背压处理
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第七章：背压处理 - 让快慢匹配

## 7.1 什么是背压？

**背压**（Backpressure）是指**消费者处理速度跟不上生产者生产速度**时的处理机制。

```
生产者（LLM 逐字返回）: ████ ████ ████ ████ ████ → 每秒 20 个字
消费者（前端渲染）:    ████ ████            → 每秒只能渲染 5 个字

问题：积压越来越多，内存爆炸 💥
```

### 7.1.1 真实场景

```java
// 场景：LLM 快速返回，前端渲染慢
LLMClient client = new LLMClient();

// LLM 快速返回（每秒 50 个 token）
Flux<String> tokenStream = client.streamChat("写一篇长文");

// 前端渲染慢（每秒 5 个 token）
tokenStream.subscribe(token -> {
    renderToScreen(token);  // 渲染耗时操作
    Thread.sleep(200);       // 每个 token 200ms
});

/*
问题：
- LLM 1 秒推送 50 个 token
- 前端 1 秒只能处理 5 个
- 45 个积压在内存中
- 10 秒后，450 个 token 积压 → 内存暴涨
*/
```

---

## 7.2 背压策略

Reactor 提供了 4 种背压策略：

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| `onBackpressureBuffer()` | 缓冲到内存 | 允许延迟，内存足够 |
| `onBackpressureDrop()` | 丢弃新数据 | 数据可以丢失 |
| `onBackpressureLatest()` | 只保留最新 | 只关心最新状态 |
| `onBackpressureError()` | 抛出异常 | 不允许积压 |

### 7.2.1 onBackpressureBuffer - 缓冲

```java
// 默认缓冲 256 个元素
Flux.interval(Duration.ofMillis(10))
    .onBackpressureBuffer()
    .subscribe(i -> {
        Thread.sleep(100);  // 处理慢
    });

// 指定缓冲区大小
Flux.interval(Duration.ofMillis(10))
    .onBackpressureBuffer(1000)  // 最多缓冲 1000 个
    .subscribe(i -> {
        Thread.sleep(100);
    });

// 溢出时的策略
.onBackpressureBuffer(1000, overflowStrategy -> OverflowStrategy.ERROR)
```

### 7.2.2 onBackpressureDrop - 丢弃

```java
// 消费者处理不过来时，丢弃新数据
Flux.interval(Duration.ofMillis(10))
    .onBackpressureDrop(dropped -> 
        System.out.println("丢弃: " + dropped))
    .subscribe(i -> {
        Thread.sleep(100);  // 处理慢
    });

/*
输出:
0
1
...
99
丢弃: 100  ← 开始丢弃
丢弃: 101
...
*/
```

**使用场景**：实时行情数据，只关心最新价格

```java
// 股票行情，只关心最新价格
stockClient.priceStream("AAPL")
    .onBackpressureLatest()
    .subscribe(price -> updateUI(price));
```

### 7.2.3 onBackpressureLatest - 只保留最新

```java
// 只保留最新元素，丢弃旧的
Flux.interval(Duration.ofMillis(10))
    .onBackpressureLatest()
    .subscribe(i -> {
        Thread.sleep(100);
    });

/*
假设处理第 100 个时，第 105、106、107 个到来
最终只收到: 100, 107（最新的）
中间的被丢弃
*/
```

### 7.2.4 onBackpressureError - 抛异常

```java
// 缓冲区满时抛出异常
Flux.interval(Duration.ofMillis(10))
    .onBackpressureError()
    .subscribe(i -> {
        Thread.sleep(100);
    });

/*
当缓冲区满时（默认 256），会抛出：
 reactor.core.Exceptions$OverflowException: Buffer is full
*/
```

---

## 7.3 Sinks 中的背压

### 7.3.1 Unicast Sink 的背压

```java
// Unicast 默认使用背压缓冲
Sinks.Many<String> sink = Sinks.many()
    .unicast()
    .onBackpressureBuffer();  // 默认 256

// 推送时检查结果
Sinks.EmitResult result = sink.tryEmitNext("data");

switch (result) {
    case OK:
        break;
    case FAIL_OVERFLOW:
        // 缓冲区满了！
        // 策略：减慢推送速度或增加缓冲区
        break;
    case FAIL_NON_SERIALIZED:
        // 多线程不安全
        break;
    case FAIL_TERMINATED:
        // 流已终止
        break;
}
```

### 7.3.2 设置缓冲区大小

```java
// 小缓冲区，溢出时快速失败
Sinks.Many<String> sink1 = Sinks.many()
    .unicast()
    .onBackpressureBuffer(10);

// 大缓冲区，允许更多积压
Sinks.Many<String> sink2 = Sinks.many()
    .unicast()
    .onBackpressureBuffer(10000);
```

---

## 7.4 request - 手动控制请求量

除了被动处理背压，还可以**主动控制**请求量。

### 7.4.1 按需请求

```java
Flux.just(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    .subscribe(new Subscriber<Integer>() {
        private Subscription subscription;
        private int count = 0;
        
        @Override
        public void onSubscribe(Subscription s) {
            this.subscription = s;
            subscription.request(2);  // 初始请求 2 个
        }
        
        @Override
        public void onNext(Integer i) {
            count++;
            System.out.println("处理: " + i);
            
            // 处理完 2 个后，再请求 2 个
            if (count % 2 == 0) {
                subscription.request(2);
            }
        }
        
        @Override
        public void onError(Throwable t) {
            System.out.println("错误: " + t.getMessage());
        }
        
        @Override
        public void onComplete() {
            System.out.println("完成");
        }
    });

/*
输出:
处理: 1
处理: 2
处理: 3
处理: 4
处理: 5
...
*/
```

### 7.4.2 项目中的实际使用

```java
// 在 Agent 中，按需处理 LLM 返回的数据
chatClient.prompt()
    .messages(messages)
    .stream()
    .chatResponse()
    .subscribe(new Subscriber<ChatResponse>() {
        private Subscription subscription;
        
        @Override
        public void onSubscribe(Subscription s) {
            this.subscription = s;
            subscription.request(1);  // 请求 1 个 chunk
        }
        
        @Override
        public void onNext(ChatResponse chunk) {
            processChunk(chunk);
            subscription.request(1);  // 处理完再请求下一个
        }
        
        // ...
    });
```

---

## 7.5 使用场景与选择

### 7.5.1 场景1：LLM 流式输出

```java
// LLM 返回速度 vs 前端渲染速度
// 策略：缓冲 + 丢弃旧数据

// 前端渲染速度较慢，使用较大缓冲区
chatClient.stream(prompt)
    .onBackpressureBuffer(1000)  // 允许积压 1000 个字符
    .publishOn(Schedulers.boundedElastic())  // 在弹性线程处理
    .subscribe(chunk -> {
        renderToScreen(chunk);  // 渲染
    });
```

### 7.5.2 场景2：实时数据

```java
// 股票价格：只关心最新
stockService.priceStream("AAPL")
    .onBackpressureLatest()  // 只保留最新价格
    .subscribe(price -> updateUI(price));
```

### 7.5.3 场景3：日志收集

```java
// 日志收集：可以丢弃
logger.logStream()
    .onBackpressureDrop(dropped -> 
        metrics.increment("droppedLogs"))
    .subscribe(log -> writeToFile(log));
```

### 7.5.4 场景4：严格顺序

```java
// 严格顺序：不允许丢弃或溢出
orderProcessor.orderStream()
    .onBackpressureError()  // 必须处理每一个
    .concatMap(order -> processOrder(order))  // 顺序处理
    .subscribe();
```

---

## 7.6 背压监控与调优

### 7.6.1 监控指标

```java
// 添加监控
MetricsFlux.MeterIdMeterIdMeter registry = new MicrometerMeterRegistry();

Flux.interval(Duration.ofMillis(10))
    .name("llm.stream")
    .tag("type", "tokens")
    .register(registry)
    .onBackpressureBuffer(1000)
    .subscribe();
```

### 7.6.2 调优策略

```java
// 1. 增大缓冲区（如果内存足够）
.onBackpressureBuffer(5000)

// 2. 使用丢弃策略（如果数据允许丢失）
.onBackpressureLatest()

// 3. 增加消费者（并行处理）
.parallel()
.runOn(Schedulers.parallel())

// 4. 背压时减慢生产者速度
.onBackpressureBuffer(100, overflow -> {
    // 通知生产者减慢
    producer.reduceRate();
})
```

---

## 7.7 本章小结

1. **背压**：消费者速度 < 生产者速度时的处理机制
2. **Buffer**：缓冲到内存（默认 256）
3. **Drop**：丢弃新数据
4. **Latest**：只保留最新
5. **Error**：抛出异常
6. **request()**：主动控制请求量
7. **选择策略**：根据业务场景选择合适的背压策略

---

## 7.8 练习题

1. 设计一个场景：LLM 每秒返回 50 个 token，前端每秒只能处理 10 个，应该选择哪种背压策略？
2. 使用 onBackpressureLatest 实现一个只显示最新股价的组件
3. 分析项目中 Sinks.Many 的背压处理方式

---

**下一章**：我们将学习响应式编程在 Spring 中的实际应用，包括 WebFlux 和 Spring AI。