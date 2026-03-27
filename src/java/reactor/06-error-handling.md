---
title: 错误处理与资源清理
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第六章：错误处理与资源清理

## 6.1 错误处理的重要性

在响应式编程中，错误处理比传统编程更重要：

```
传统同步：
try {
    result = callApi();  // 抛出异常
} catch (Exception e) {
    handleError(e);      // 捕获处理
}

响应式：
callApi()
    .subscribe(          // 异步回调，try-catch 不起作用！
        result -> process(result),
        error -> handleError(error)  // 必须在 subscribe 中处理
    );
```

**关键点**：响应式流中的异常不会自动抛出，必须通过操作符处理。

---

## 6.2 错误处理操作符

### 6.2.1 onErrorReturn - 错误返回默认值

```java
Flux.just(1, 2, 3)
    .map(i -> {
        if (i == 2) throw new RuntimeException("错误");
        return i * 10;
    })
    .onErrorReturn(0)  // 发生错误时发出 0 并完成
    .subscribe(
        System.out::println,
        e -> System.out.println("错误被捕获: " + e.getMessage())
    );

// 输出:
// 10
// 0   ← 错误后返回默认值
```

**使用场景**：API 调用失败时返回默认值

### 6.2.2 onErrorResume - 错误切换到另一个流

```java
Flux.just(1, 2, 3)
    .map(i -> {
        if (i == 2) throw new RuntimeException("错误");
        return i * 10;
    })
    .onErrorResume(e -> {
        System.out.println("错误: " + e.getMessage());
        return Flux.just(100, 200);  // 切换到新流
    })
    .subscribe(System.out::println);

// 输出:
// 10
// 100  ← 错误后继续
// 200
```

**使用场景**：主 API 失败时尝试备用 API

```java
// 示例：主 API 失败，尝试备用
webClient.get().uri(primaryApiUrl)
    .retrieve()
    .bodyToMono(String.class)
    .onErrorResume(e -> 
        webClient.get().uri(backupApiUrl)
            .retrieve()
            .bodyToMono(String.class)
    )
    .subscribe(result -> System.out.println("最终结果: " + result));
```

### 6.2.3 onErrorContinue - 忽略错误继续

```java
Flux.just(1, 2, 3)
    .map(i -> {
        if (i == 2) throw new RuntimeException("忽略这个");
        return i * 10;
    })
    .onErrorContinue((e, obj) -> {
        System.out.println("跳过错误: " + obj + ", 原因: " + e.getMessage());
    })
    .subscribe(System.out::println);

// 输出:
// 10
// 跳过错误: 2, 原因: 忽略这个
// 30
```

**使用场景**：处理批量数据，某条失败不影响其他

### 6.2.4 retry - 重试

```java
// 基础重试：失败后重新订阅最多 3 次
Flux.just(1, 2, 3)
    .flatMap(i -> Mono.fromCallable(() -> {
        if (i == 2) throw new RuntimeException("临时错误");
        return i * 10;
    }))
    .retry(3)  // 最多重试 3 次
    .subscribe(
        System.out::println,
        e -> System.out.println("最终失败: " + e.getMessage())
    );

/*
输出:
10
(retry 1) ← 重试
(retry 2) ← 重试
(retry 3) ← 重试
最终失败: 临时错误  ← 3 次后放弃
*/
```

**使用场景**：网络不稳定时自动重试

```java
// 更智能的重试：带延迟
webClient.get().uri(url)
    .retrieve()
    .bodyToMono(String.class)
    .retryWhen(Retry.backoff(3, Duration.ofSeconds(1))  // 指数退避
        .filter(e -> e instanceof WebClientResponseException))
    .subscribe();
```

---

## 6.3 doFinally 资源清理

`doFinally` 是最重要的清理方法，无论成功、错误还是取消，都会执行。

### 6.3.1 基本用法

```java
Flux.just("A", "B", "C")
    .doFinally(signal -> {
        // 无论哪种结束方式，都会执行这里
        System.out.println("最终清理: " + signal);
    })
    .subscribe();

/*
正常完成输出:
A
B
C
最终清理: onComplete
*/
```

### 6.3.2 SignalType 类型

```java
.doFinally(signal -> {
    switch (signal) {
        case OnComplete:
            System.out.println("正常完成");
            break;
        case OnError:
            System.out.println("错误终止");
            break;
        case Cancel:
            System.out.println("被取消");
            break;
    }
})
```

---

## 6.4 取消订阅 Disposable

### 6.4.1 什么是 Disposable？

`Disposable` 是一个可以**取消**的订阅对象。

```java
// 订阅会返回一个 Disposable
Disposable disposable = Flux.interval(Duration.ofSeconds(1))
    .subscribe(i -> System.out.println("Tick: " + i));

// 5 秒后取消
Thread.sleep(5000);
disposable.dispose();  // 取消订阅

System.out.println("已取消");

/*
输出:
Tick: 0
Tick: 1
Tick: 2
Tick: 3
Tick: 4
已取消
*/
```

### 6.4.2 项目中的任务中断

```java
// AgentTaskManager 中管理 Disposable

public class AgentTaskManager {
    
    private final Map<String, TaskInfo> taskMap = new ConcurrentHashMap<>();
    
    public static class TaskInfo {
        private final Sinks.Many<String> sink;
        private Disposable disposable;  // 保存 Disposable
        
        public void setDisposable(Disposable disposable) {
            this.disposable = disposable;
        }
    }
    
    // 停止任务
    public boolean stopTask(String conversationId) {
        TaskInfo taskInfo = taskMap.get(conversationId);
        
        // 1. 取消 LLM 调用
        if (taskInfo.disposable != null) {
            taskInfo.disposable.dispose();
        }
        
        // 2. 发送停止消息
        taskInfo.sink.tryEmitNext("⏹ 用户已停止生成");
        taskInfo.sink.tryEmitComplete();
        
        // 3. 清理
        taskMap.remove(conversationId);
        
        return true;
    }
}
```

### 6.4.3 WebSearchReactAgent 中的使用

```java
// WebSearchReactAgent.java:247-265

// 保存 Disposable 到任务管理器
Disposable disposable = chatClient.prompt()
    .messages(messages)
    .stream()
    .chatResponse()
    .doOnNext(chunk -> processChunk(chunk, sink, state))
    .doOnComplete(...)
    .subscribe();

// 关键：保存 Disposable
if (conversationId != null && taskManager != null) {
    taskManager.setDisposable(conversationId, disposable);
}
```

---

## 6.5 doOnCancel 取消时处理

```java
Flux.interval(Duration.ofSeconds(1))
    .doOnCancel(() -> System.out.println("流被取消"))
    .doOnComplete(() -> System.out.println("流完成"))
    .take(5)  // 只取 5 个
    .subscribe();

Thread.sleep(3000);
System.out.println("主线程结束");

/*
输出:
0
1
2
流被取消     ← take(5) 相当于取消
流完成
主线程结束
*/
```

---

## 6.6 完���错误处理模式

项目中常用的完整模式：

```java
chatClient.prompt()
    .messages(messages)
    .stream()
    .chatResponse()
    // 1. 处理每个 chunk
    .doOnNext(chunk -> processChunk(chunk, sink, state))
    // 2. 完成时处理
    .doOnComplete(() -> {
        sink.tryEmitNext(createReferenceResponse(referenceJson));
        sink.tryEmitComplete();
    })
    // 3. 错误处理
    .doOnError(err -> {
        if (!hasSentFinalResult.get()) {
            hasSentFinalResult.set(true);
            sink.tryEmitError(err);  // 发送错误到前端
        }
    })
    // 4. 无论如何都清理资源（关键！）
    .doFinally(signal -> {
        log.info("流结束，信号: {}", signal);
        
        // 保存会话到数据库
        saveSessionResult(...);
        
        // 移除任务
        if (taskManager != null) {
            taskManager.removeTask(conversationId);
        }
    })
    .subscribe();
```

---

## 6.7 常见错误处理模式

### 6.7.1 模式1：静默失败，返回空

```java
// 错误时返回空 Flux，不影响主流程
service.call()
    .onErrorResume(e -> {
        log.warn("调用失败", e);
        return Flux.empty();
    })
    .subscribe();
```

### 6.7.2 模式2：降级处理

```java
// 主数据源失败，使用缓存
service.getData()
    .onErrorResume(e -> cache.get(key))
    .onErrorResume(e -> Mono.just(defaultData))
    .subscribe();
```

### 6.7.3 模式3：重试 + 降级

```java
service.getData()
    .retry(3)  // 重试 3 次
    .onErrorResume(e -> {
        log.error("重试后仍失败", e);
        return Mono.just(fallbackData);  // 降级
    })
    .subscribe();
```

---

## 6.8 本章小结

1. **错误处理是必须的**：响应式异常不会自动抛出
2. **onErrorReturn**：返回默认值
3. **onErrorResume**：切换到备用流
4. **retry**：重试机制
5. **doFinally**：无论成功/错误/取消都执行
6. **Disposable**：取消正在进行的订阅
7. **doOnCancel**：取消时的处理

---

## 6.9 练习题

1. 编写代码：调用 API，失败后重试 3 次，每次延迟递增
2. 使用 doFinally 确保流结束后释放数据库连接
3. 模拟用户点击"取消"按钮中断 LLM 调用的完整流程

---

**下一章**：我们将学习背压处理，这是应对高并发的重要机制。