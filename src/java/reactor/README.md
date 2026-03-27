---
title: Reactor 响应式编程教程
index: false
icon: code
category:
  - Java
  - Reactor
---

# Reactor 响应式编程教程 - 目录

本教程共 8 章，采用循序渐进的方式，从基础概念到项目实战。

---

## 学习路径

```
第一章 → 第二章 → 第三章 → 第四章 → 第五章 → 第六章 → 第七章 → 第八章
  │          │          │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼          ▼          ▼
 入门      基础       订阅流程    线程调度    Sinks     错误处理    项目实战
 (Why?)    (What?)    (How?)     (Where?)   (Control) (Safety)   (Real)
```

---

## 章节简介

### 📚 第一章：初识响应式编程
- 为什么需要响应式编程
- 传统同步 vs 响应式
- Reactor 简介
- 适合场景分析

**目标**：理解"为什么"，建立背景认知

---

### 📚 第二章：Flux 与 Mono 基础
- Flux 和 Mono 的区别
- 创建 Flux/Mono 的多种方式
- 订阅机制
- 常用操作符（map、flatMap、filter、merge、zip）

**目标**：掌握"是什么"，学会创建和订阅流

---

### 📚 第三章：订阅流程与生命周期
- subscribe 完整流程
- 生命周期钩子（doOnSubscribe、doOnNext、doOnComplete、doFinally）
- 操作符详解（map、flatMap、filter、take、distinct）
- 组合操作符（merge、zip、concat）

**目标**：理解流的执行过程，学会使用操作符

---

### 📚 第四章：线程调度 Schedulers
- 为什么需要线程调度
- Schedulers 类型（immediate、single、parallel、boundedElastic）
- subscribeOn vs publishOn 区别
- 项目中的实际使用

**目标**：掌握线程控制，理解非阻塞原理

---

### 📚 第五章：Sinks.Many - 手动控制数据流
- Sinks 是什么
- Sinks 类型（unicast、multicast、replay）
- 核心方法（tryEmitNext、tryEmitComplete、tryEmitError）
- **项目实战**：模拟 LLM 流式响应

**目标**：学会手动控制数据流，实现 SSE

---

### 📚 第六章：错误处理与资源清理
- 为什么错误处理更重要
- 错误处理操作符（onErrorReturn、onErrorResume、retry）
- doFinally 资源清理
- Disposable 取消订阅
- **项目实战**：任务中断流程

**目标**：掌握错误处理和资源管理

---

### 📚 第七章：背压处理
- 什么是背压
- 背压策略（buffer、drop、latest、error）
- Sinks 中的背压处理
- request 手动控制请求量

**目标**：理解快慢匹配机制

---

### 📚 第八章：Spring 集成与项目实战
- Spring WebFlux 基础
- **项目实战**：Dodo-Agent 完整流程分析
- SSE 流式响应实现
- 任务管理（中断与取消）
- 错误处理最佳实践

**目标**：将所有知识应用到实际项目

---

## 快速查阅

### 需要某个具体功能时

| 功能 | 章节 |
|------|------|
| 创建 Flux/Mono | 第二章 |
| 转换数据 | 第三章 |
| 控制线程 | 第四章 |
| 手动推送数据 | 第五章 |
| 处理错误 | 第六章 |
| 处理积压 | 第七章 |
| 实际项目应用 | 第八章 |

### 常见错误解决

| 问题 | 解决方案 |
|------|----------|
| 线程阻塞 | 使用 boundedElastic 调度器 |
| 内存爆炸 | 使用背压策略 |
| 错误未处理 | 使用 onErrorReturn/onErrorResume |
| 资源未释放 | 使用 doFinally |

---

## 推荐学习方式

### 方式一：系统学习（推荐）
按顺序学习 1-8 章，每章配合代码练习

### 方式二：快速入门
1. 第一章（理解概念）
2. 第二章（掌握基础）
3. 第五章（Sinks 核心）
4. 第八章（项目实战）

### 方式三：问题驱动
遇到具体问题时，查阅相关章节

---

## 相关资源

- [Reactor 官方文档](https://projectreactor.io/)
- [Spring WebFlux 文档](https://docs.spring.io/spring-framework/reference/web/webflux.html)
- [Dodo-Agent 项目代码](../)
- [LEARN.md 项目学习文档](../LEARN.md)

---

## 练习答案

详见各章节练习题解答（待补充）

---

*持续更新中...* 🚀