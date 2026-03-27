---
title: Spring 集成与项目实战
index: false
icon: code
category:
  - Java
  - Reactor
---

# 第八章：Spring 集成与项目实战

## 8.1 Spring WebFlux 基础

Spring WebFlux 是 Spring 的响应式 Web 框架，完全支持 Reactor。

### 8.1.1 WebFlux vs MVC

```java
// ============================================
// 传统 Spring MVC（阻塞）
// ============================================
@RestController
public class SyncController {
    
    @GetMapping("/user/{id}")
    public User getUser(@PathVariable Long id) {
        // 线程阻塞等待数据库
        return userService.findById(id);  // 阻塞！
    }
    
    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();  // 阻塞！
    }
}
```

```java
// ============================================
// Spring WebFlux（响应式）
// ============================================
@RestController
public class ReactiveController {
    
    @GetMapping("/user/{id}")
    public Mono<User> getUser(@PathVariable Long id) {
        // 立即返回 Mono，不阻塞
        return userService.findById(id);  // 非阻塞
    }
    
    @GetMapping("/users")
    public Flux<User> getUsers() {
        // 立即返回 Flux，不阻塞
        return userService.findAll();  // 非阻塞
    }
}
```

### 8.1.2 SSE 流式响应

Server-Sent Events (SSE) 实现实时推送：

```java
@RestController
public class ChatController {
    
    @GetMapping(value = "/chat", produces = "text/event-stream;charset=UTF-8")
    public Flux<String> chat(@RequestParam String query) {
        // 直接返回 Flux，前端通过 EventSource 接收
        return agent.stream(query);
    }
}
```

**前端接收**：

```javascript
const source = new EventSource('/chat?query=你好');

source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'text') {
        appendToChat(data.content);
    } else if (data.type === 'thinking') {
        showThinkingIndicator(data.content);
    } else if (data.type === 'error') {
        showError(data.content);
    }
};

source.onerror = () => {
    console.log('连接断开');
    source.close();
};
```

---

## 8.2 Dodo-Agent 项目实战

### 8.2.1 AgentController 完整解析

```java
// AgentController.java 核心方法

@GetMapping(value = "/chat/stream", produces = "text/event-stream;charset=UTF-8")
@Operation(summary = "智能问答", description = "接收用户查询并返回流式响应")
public Flux<String> webSearchStream(
    @RequestParam String query,
    @RequestParam String conversationId) {
    
    log.info("收到请求: query={}, conversationId={}", query, conversationId);
    
    // 参数验证
    if (query == null || query.trim().isEmpty()) {
        return Flux.error(new IllegalArgumentException("查询参数不能为空"));
    }
    
    try {
        // 1. 初始化 Agent
        WebSearchReactAgent agent = initWebSearchAgent();
        
        // 2. 创建持久化记忆
        ChatMemory memory = agent.createPersistentChatMemory(conversationId, 30);
        agent.setChatMemory(memory);
        
        // 3. 执行并返回 Flux（流式响应）
        return agent.stream(conversationId, query);
        
    } catch (Exception e) {
        log.error("处理请求时发生错误: ", e);
        return Flux.error(e);  // 错误通过 Flux 返回
    }
}
```

### 8.2.2 WebSearchReactAgent 核心流程

```java
// WebSearchReactAgent.java:115-213 核心流程

public Flux<String> stream(String conversationId, String question) {
    
    // 1. 检查是否有运行中的任务
    Flux<String> checkResult = checkRunningTask(conversationId);
    if (checkResult != null) {
        return checkResult;
    }
    
    // 2. 初始化
    initTimers();
    clearUsedTools();
    
    // 3. 创建 Sinks.Many（核心！）
    Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();
    
    // 4. 注册任务
    registerTask(conversationId, sink);
    
    // 5. 构建消息列表
    List<Message> messages = Collections.synchronizedList(new ArrayList<>());
    messages.add(new SystemMessage(prompt));  // 系统提示
    loadChatHistory(conversationId, messages);  // 历史消息
    messages.add(new UserMessage(question));  // 当前问题
    
    // 6. 保存用户问题到数据库
    if (sessionService != null) {
        AiSession session = sessionService.saveQuestion(...);
        currentSessionId = session.getId();
    }
    
    // 7. 调用 LLM（ReAct 循环）
    scheduleRound(messages, sink, ...);
    
    // 8. 返回 Flux
    return sink.asFlux()
        .doOnNext(chunk -> {
            recordFirstResponse();
            // 收集最终答案
            processResponse(chunk);
        })
        .doOnCancel(() -> {
            // 用户取消
            taskManager.stopTask(conversationId);
        })
        .doFinally(signal -> {
            // 无论成功/失败/取消，都保存结果
            saveSessionResult(...);
            taskManager.removeTask(conversationId);
        });
}
```

### 8.2.3 工具调用流程

```java
// WebSearchReactAgent.java:455-506 工具执行

private void executeToolCalls(Sinks.Many<String> sink, 
                               List<ToolCall> toolCalls, 
                               List<Message> messages, 
                               ...) {
    
    AtomicInteger completedCount = new AtomicInteger(0);
    int total = toolCalls.size();
    
    // 遍历每个工具调用
    for (ToolCall tc : toolCalls) {
        // 在 boundedElastic 线程执行（避免阻塞）
        Schedulers.boundedElastic().schedule(() -> {
            
            // 1. 发送思考消息
            String thinking = "🔍 正在搜索: " + query;
            sink.tryEmitNext(createThinkingResponse(thinking));
            
            // 2. 执行工具
            try {
                Object result = callback.call(argsJson);
                
                // 3. 添加工具响应到消息列表
                ToolResponse tr = new ToolResponse(tc.id(), tc.name(), result.toString());
                messages.add(ToolResponseMessage.builder()
                    .responses(List.of(tr))
                    .build());
                
                // 4. 记录使用的工具
                recordUsedTool(tc.name());
                
            } catch (Exception e) {
                // 工具执行失败，添加错误响应
                addErrorToolResponse(messages, tc, e.getMessage());
            } finally {
                // 5. 完成后继续下一轮
                if (completedCount.incrementAndGet() >= total) {
                    scheduleRound(...);  // 继续调用 LLM
                }
            }
        });
    }
}
```

---

## 8.3 Sinks.Many + Flux 实现 SSE

### 8.3.1 完整模式

```java
// 完整的 SSE 流式响应模式
public Flux<String> streamResponse(String question) {
    
    // 1. 创建 Sinks.Many（Unicast 单消费者）
    Sinks.Many<String> sink = Sinks.many()
        .unicast()
        .onBackpressureBuffer(1000);
    
    // 2. 在后台执行耗时操作
    CompletableFuture.runAsync(() -> {
        try {
            // 模拟 LLM 逐字返回
            String response = llmClient.chat(question);
            
            for (int i = 0; i < response.length(); i++) {
                String chunk = response.substring(i, i + 1);
                
                // 发送文本块
                sink.tryEmitNext(createTextResponse(chunk));
                
                Thread.sleep(30);  // 模拟延迟
            }
            
            // 完成
            sink.tryEmitComplete();
            
        } catch (Exception e) {
            // 错误
            sink.tryEmitError(e);
        }
    });
    
    // 3. 返回 Flux
    return sink.asFlux()
        .doOnNext(chunk -> {
            // 可以在这里记录日志
        })
        .doFinally(signal -> {
            // 清理资源
        });
}
```

### 8.3.2 多种消息类型

```java
// 创建不同类型的响应
private String createTextResponse(String content) {
    return JSON.toJSONString(
        Map.of("type", "text", "content", content)
    );
}

private String createThinkingResponse(String content) {
    return JSON.toJSONString(
        Map.of("type", "thinking", "content", content)
    );
}

private String createReferenceResponse(String content) {
    List<Map> refs = JSON.parseArray(content, Map.class);
    return JSON.toJSONString(
        Map.of("type", "reference", "content", content, "count", refs.size())
    );
}

private String createRecommendResponse(String content) {
    return JSON.toJSONString(
        Map.of("type", "recommend", "content", content)
    );
}

private String createErrorResponse(String content) {
    return JSON.toJSONString(
        Map.of("type", "error", "content", content)
    );
}
```

---

## 8.4 任务管理：中断与取消

### 8.4.1 AgentTaskManager

```java
// AgentTaskManager.java 核心逻辑

public class AgentTaskManager {
    
    private final Map<String, TaskInfo> taskMap = new ConcurrentHashMap<>();
    
    // 注册任务
    public TaskInfo registerTask(String conversationId, 
                                  Sinks.Many<String> sink, 
                                  String agentType) {
        
        // 防止重复注册
        if (taskMap.containsKey(conversationId)) {
            log.warn("会话已有任务在执行: {}", conversationId);
            return null;
        }
        
        TaskInfo info = new TaskInfo(sink, agentType);
        taskMap.put(conversationId, info);
        
        log.info("注册任务: conversationId={}, agentType={}", conversationId, agentType);
        return info;
    }
    
    // 停止任务
    public boolean stopTask(String conversationId) {
        TaskInfo info = taskMap.get(conversationId);
        if (info == null) {
            log.warn("没有正在执行的任务: {}", conversationId);
            return false;
        }
        
        try {
            // 1. 中断 LLM 调用
            Disposable disposable = info.getDisposable();
            if (disposable != null && !disposable.isDisposed()) {
                disposable.dispose();  // 关键：取消订阅
                log.info("已中断 LLM 调用: {}", conversationId);
            }
            
            // 2. 发送停止消息
            String stopMsg = createStopMessage();
            info.getSink().tryEmitNext(stopMsg);
            info.getSink().tryEmitComplete();
            
            // 3. 清理
            taskMap.remove(conversationId);
            
            log.info("任务已停止: {}", conversationId);
            return true;
            
        } catch (Exception e) {
            log.error("停止任务失败: {}", conversationId, e);
            return false;
        }
    }
}
```

### 8.4.2 Controller 接口

```java
// AgentController.java 停止接口

@GetMapping("/stop")
@Operation(summary = "停止Agent执行")
public Map<String, Object> stopAgent(@RequestParam String conversationId) {
    log.info("收到停止请求: conversationId={}", conversationId);
    
    boolean success = taskManager.stopTask(conversationId);
    
    Map<String, Object> result = new HashMap<>();
    if (success) {
        result.put("success", true);
        result.put("message", "已停止执行");
    } else {
        result.put("success", false);
        result.put("message", "没有找到正在执行的任务");
    }
    return result;
}
```

---

## 8.5 错误处理的最佳实践

### 8.5.1 Controller 层错误处理

```java
@GetMapping(value = "/chat/stream", produces = "text/event-stream;charset=UTF-8")
public Flux<String> chatStream(String query, String conversationId) {
    
    // 1. 参数验证
    if (query == null || query.trim().isEmpty()) {
        return Flux.error(new IllegalArgumentException("查询参数不能为空"));
    }
    
    try {
        // 2. 业务逻辑
        return agent.stream(conversationId, query);
        
    } catch (Exception e) {
        // 3. 异常转换
        log.error("处理请求异常", e);
        return Flux.error(new RuntimeException("服务处理异常: " + e.getMessage()));
    }
}
```

### 8.5.2 Agent 层错误处理

```java
// 完整的错误处理链
chatClient.prompt()
    .messages(messages)
    .stream()
    .chatResponse()
    // 处理每个 chunk
    .doOnNext(chunk -> processChunk(chunk, sink, state))
    // 完成时
    .doOnComplete(() -> {
        sink.tryEmitNext(referenceJson);
        sink.tryEmitComplete();
    })
    // 错误时
    .doOnError(err -> {
        if (!hasSentFinalResult.get()) {
            hasSentFinalResult.set(true);
            // 发送错误消息
            sink.tryEmitError(err);
        }
    })
    // 无论如何都清理
    .doFinally(signal -> {
        saveSessionResult(...);
        taskManager.removeTask(conversationId);
    })
    .subscribe();
```

---

## 8.6 性能优化技巧

### 8.6.1 减少内存占用

```java
// ❌ 问题：收集所有数据到内存
flux.collectList().block();

// ✅ 解决：流式处理，不积累
flux
    .filter(...)
    .map(...)
    .subscribe();
```

### 8.6.2 并行处理

```java
// CPU 密集型任务使用 parallel
Flux.just(1, 2, 3, 4)
    .parallel()
    .runOn(Schedulers.parallel())
    .map(i -> computeHeavy(i))
    .sequential()
    .subscribe();
```

### 8.6.3 合理使用缓存

```java
// 重复查询使用缓存
public Mono<User> getUser(Long id) {
    return CacheService.get("user:" + id)
        .switchIfEmpty(  // 缓存未命中
            userRepository.findById(id)
                .flatMap(user -> 
                    CacheService.set("user:" + id, user)
                        .then(Mono.just(user))
                )
        );
}
```

---

## 8.7 本章小结

1. **Spring WebFlux** 是响应式 Web 框架
2. **Sinks.Many + Flux** 是 SSE 流式响应的核心模式
3. **AgentTaskManager** 管理任务的中断和取消
4. **多种消息类型**（text/thinking/reference/recommend）
5. **错误处理链**：doOnError + doFinally
6. **性能优化**：流式处理、并行化、合理缓存

---

## 8.8 练习题

1. 分析 AgentController 中 `/chat/stream` 接口的完整请求流程
2. 模拟实现一个带停止功能的流式问答
3. 如果 LLM 返回出错，前端如何接收错误消息？

---

## 附录：Reactor 快速入门总结

### 核心类型

| 类型 | 元素数 | 场景 |
|------|--------|------|
| `Flux<T>` | 0-N | 列表、流式数据 |
| `Mono<T>` | 0-1 | 单值、HTTP 响应 |

### 关键概念

1. **订阅才执行**：创建 Flux/Mono 后，需要 subscribe() 才开始流动
2. **非阻塞**：线程不被阻塞，通过回调处理结果
3. **操作符**：map/flatMap/filter 是最常用的转换操作符
4. **Sinks.Many**：手动推送数据，实现 SSE
5. **Schedulers**：boundedElastic 适合 I/O 操作
6. **错误处理**：onErrorReturn/onErrorResume 必须有兜底

### 项目模式

```java
// SSE 流式响应标准模式
public Flux<String> stream(String question) {
    Sinks.Many<String> sink = Sinks.many().unicast().onBackpressureBuffer();
    
    // 后台执行
    executeAsync(question, result -> {
        for (String chunk : result) {
            sink.tryEmitNext(chunk);
        }
        sink.tryEmitComplete();
    });
    
    return sink.asFlux()
        .doFinally(cleanup);
}
```

---

**学习路径建议**：

1. 第一遍：通读所有章节，理解概念
2. 第二遍：结合项目代码，理解实际应用
3. 第三遍：动手实践，写一个简单的流式响应示例

祝学习愉快！ 🚀