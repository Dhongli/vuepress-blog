---
title: Sinks.Many 手动控制数据流
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第五章：Sinks.Many - 手动控制数据流

## 5.1 什么是 Sinks？

前面我们学习的 Flux/Mono 是**声明式**的：定义数据流和处理逻辑，由 Reactor 决定何时发出元素。

但在**真实项目**中，我们经常需要：
- **手动推送**数据（比如 LLM 逐字返回时）
- **动态控制**流的开始和结束
- **推送方**和**订阅方**是分离的

这就需要 **Sinks**！

### Sinks vs Flux

```java
// Flux: 声明式 - 我定义数据流，Reactor 帮我发
Flux.just("A", "B", "C")
    .subscribe();

// Sinks: 命令式 - 我手动控制何时发数据
Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();

// 订阅者
sink.asFlux().subscribe();

// 推送者（可以在任何时候、任何线程）
sink.tryEmitNext("A");
sink.tryEmitNext("B");
sink.tryEmitNext("C");
sink.tryEmitComplete();
```

---

## 5.2 Sinks 类型

Reactor 提供 4 种 Sinks 类型：

| 类型 | 消费者数量 | 行为 |
|------|------------|------|
| `unicast` | 1 个 | 单消费者，缓冲背压 |
| `multicast` | 多个 | 多消费者，实时推送 |
| `replay` | 多个 | 多消费者，重放所有历史 |
| `publish` | 多个 | 多消费者，只接收新数据 |

### 5.2.1 Unicast - 单消费者（最常用）

```java
// 创建 unicast sink
Sinks.Many<String> sink = Sinks.many()
    .unicast()
    .onBackpressureBuffer();  // 背压缓冲

// 只有一个订阅者
sink.asFlux().subscribe(s -> System.out.println("收到: " + s));

// 推送数据
sink.tryEmitNext("第一块");
sink.tryEmitNext("第二块");
sink.tryEmitNext("第三块");
sink.tryEmitComplete();

/*
输出:
收到: 第一块
收到: 第二块
收到: 第三块
*/
```

**项目中典型用法**：SSE 流式响应（每个会话一个消费者）

### 5.2.2 Multicast - 多消费者

```java
// 创建 multicast sink
Sinks.Many<String> sink = Sinks.many()
    .multicast()
    .onBackpressureBuffer();

// 多个订阅者都会收到相同数据
sink.asFlux().subscribe(s -> System.out.println("订阅者1: " + s));
sink.asFlux().subscribe(s -> System.out.println("订阅者2: " + s));

// 推送一次，所有订阅者都收到
sink.tryEmitNext("广播消息");

/*
输出:
订阅者1: 广播消息
订阅者2: 广播消息
*/
```

### 5.2.3 Replay - 重放历史

```java
// 创建 replay sink
Sinks.Many<String> sink = Sinks.many()
    .replay()
    .all();  // 重放所有历史数据

// 先推送数据
sink.tryEmitNext("A");
sink.tryEmitNext("B");
sink.tryEmitNext("C");

// 再订阅，也会收到所有历史数据
sink.asFlux().subscribe(s -> System.out.println("新订阅者: " + s));

/*
输出:
新订阅者: A
新订阅者: B
新订阅者: C
*/
```

---

## 5.3 Sinks 的核心方法

```java
Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();

// 1. 推送元素（返回结果用于判断是否成功）
Sinks.EmitResult result = sink.tryEmitNext("data");

// 2. 发送错误
sink.tryEmitError(new RuntimeException("错误"));

// 3. 完成流
sink.tryEmitComplete();

// 4. 尝试检查结果
if (result == Sinks.EmitResult.OK) {
    // 发送成功
} else if (result == Sinks.EmitResult.FAIL_OVERFLOW) {
    // 背压溢出
} else if (result == Sinks.EmitResult.FAIL_TERMINATED) {
    // 流已终止
}
```

---

## 5.4 实战：模拟 LLM 流式响应

这是 Dodo-Agent 项目的核心模式！

### 5.4.1 简单模拟

```java
public class LlmStreamingExample {
    
    public static void main(String[] args) throws InterruptedException {
        // 1. 创建 Sinks.Many（Unicast）
        Sinks.Many<String> sink = Sinks.many()
            .unicast()
            .onBackpressureBuffer();
        
        // 2. 订阅并打印
        sink.asFlux()
            .subscribe(chunk -> System.out.println("前端收到: " + chunk));
        
        // 3. 模拟 LLM 逐字返回（后台线程）
        new Thread(() -> {
            String response = "Hello, 我是 AI 助手，很高兴为您服务！";
            try {
                for (int i = 0; i < response.length(); i++) {
                    String chunk = response.substring(i, i + 1);
                    sink.tryEmitNext(chunk);  // 推送一个字
                    Thread.sleep(50);  // 模拟延迟
                }
                sink.tryEmitComplete();  // 完成
            } catch (Exception e) {
                sink.tryEmitError(e);  // 错误
            }
        }).start();
        
        // 等待完成
        Thread.sleep(3000);
    }
}
```

**运行结果**：
```
前端收到: H
前端收到: e
前端收到: l
前端收到: l
前端收到: o
...
```

### 5.4.2 结合项目代码理解

```java
// WebSearchReactAgent.java:115-213 简化版

public Flux<String> stream(String conversationId, String question) {
    
    // 1. 创建 Sink
    Sinks.Many<String> sink = Sinks.many()
        .unicast()
        .onBackpressureBuffer();
    
    // 2. 注册任务
    registerTask(conversationId, sink);
    
    // 3. 调用 LLM
    chatClient.prompt()
        .messages(messages)
        .stream()
        .chatResponse()
        .doOnNext(chunk -> {
            // LLM 返回的每个 chunk
            String text = chunk.getResult().getOutput().getText();
            if (text != null) {
                // 推送到 Sink
                sink.tryEmitNext(createTextResponse(text));
            }
        })
        .doOnComplete(() -> {
            // 完成后发送参考链接
            sink.tryEmitNext(createReferenceResponse(referenceJson));
            // 发送完成信号
            sink.tryEmitComplete();
        })
        .doOnError(err -> {
            // 错误处理
            sink.tryEmitError(err);
        })
        .subscribe();
    
    // 4. 返回 Flux
    return sink.asFlux();
}
```

---

## 5.5 Sinks 完整生命周期

```java
Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();

sink.asFlux()
    .doOnSubscribe(s -> System.out.println("1. 订阅"))
    .doOnRequest(n -> System.out.println("2. 请求: " + n))
    .doOnNext(s -> System.out.println("3. 收到: " + s))
    .doOnComplete(() -> System.out.println("4. 完成"))
    .doOnError(e -> System.out.println("4. 错误"))
    .doFinally(s -> System.out.println("5. 最终: " + s))
    .subscribe();

// 推送数据
System.out.println("推送 A");
sink.tryEmitNext("A");
System.out.println("推送 B");
sink.tryEmitNext("B");
System.out.println("完成");
sink.tryEmitComplete();
```

**输出**：
```
1. 订阅
2. 请求: 9223372036854775807
推送 A
3. 收到: A
推送 B
3. 收到: B
完成
4. 完成
5. 最终: onComplete
```

---

## 5.6 项目中的 Sinks 使用场景

### 5.6.1 场景1：WebSearchReactAgent

```java
// AgentTaskManager 中保存每个会话的 Sink
private final Map<String, TaskInfo> taskMap = new ConcurrentHashMap<>();

public TaskInfo registerTask(String conversationId, Sinks.Many<String> sink, String agentType) {
    // 每个会话对应一个 Sink
    taskMap.put(conversationId, new TaskInfo(sink, agentType));
    return taskInfo;
}
```

### 5.6.2 场景2：停止任务

```java
// AgentTaskManager.java:108-140
public boolean stopTask(String conversationId) {
    TaskInfo taskInfo = taskMap.get(conversationId);
    
    // 1. 中断底层调用（LLM 调用）
    Disposable disposable = taskInfo.getDisposable();
    if (disposable != null) {
        disposable.dispose();
    }
    
    // 2. 发送停止消息
    Sinks.Many<String> sink = taskInfo.getSink();
    sink.tryEmitNext(createStopMessage());
    sink.tryEmitComplete();
    
    // 3. 清理
    taskMap.remove(conversationId);
    
    return true;
}
```

### 5.6.3 场景3：多种消息类型

```java
// 推送不同类型的消息
sink.tryEmitNext(createThinkingResponse("正在思考..."));
sink.tryEmitNext(createTextResponse("这是回答"));
sink.tryEmitNext(createReferenceResponse("[{\"title\":\"来源\"}]"));
sink.tryEmitNext(createRecommendResponse("[\"推荐问题\"]"));
```

---

## 5.7 背压处理

当消费者处理速度慢于生产者推送速度时，需要背压处理。

### 5.7.1 onBackpressureBuffer

```java
// 默认缓冲 256 个元素
Sinks.Many<String> sink = Sinks.many()
    .unicast()
    .onBackpressureBuffer();  // 超过 256 会抛出 OverflowException

// 指定缓冲区大小
Sinks.Many<String> sink2 = Sinks.many()
    .unicast()
    .onBackpressureBuffer(1000);  // 缓冲 1000 个
```

### 5.7.2 背压溢出处理

```java
// 推送时检查结果
Sinks.EmitResult result = sink.tryEmitNext("data");

switch (result) {
    case OK:
        // 成功
        break;
    case FAIL_OVERFLOW:
        // 缓冲区溢出！减少推送速度或增加缓冲区
        break;
    case FAIL_NON_SERIALIZED:
        // 多线程不安全
        break;
    case FAIL_TERMINATED:
        // 流已终止
        break;
}
```

---

## 5.8 本章小结

1. **Sinks.Many** 允许手动推送数据到 Flux
2. **Unicast** 最常用（单消费者，如 SSE）
3. **核心方法**：`tryEmitNext()`, `tryEmitComplete()`, `tryEmitError()`
4. **项目中**：Sinks.Many + Flux 实现 LLM 流式响应
5. **背压处理**：使用 `onBackpressureBuffer()` 缓冲

---

## 5.9 练习题

1. 使用 Sinks.Many 实现一个简单的聊天消息推送功能
2. 如果有多个消费者分别以不同速度处理数据，会发生什么？
3. 如何实现"新订阅者只能收到新数据，不收历史数据"？

---

**下一章**：我们将学习错误处理和资源清理，这是生产环境必需的知识。