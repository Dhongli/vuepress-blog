import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      text: "Java",
      icon: "laptop-code",
      prefix: "java/",
      link: "java/",
      collapsible: true,
      expanded: false,
      children: [
        {
          text: "Spring",
          icon: "laptop-code",
          prefix: "spring/",
          link: "spring/",
        },
        {
          text: "SpringBoot",
          icon: "laptop-code",
          prefix: "springboot/",
          link: "springboot/",
        },
        {
          text: "Reactor",
          icon: "laptop-code",
          prefix: "reactor/",
          link: "reactor/",
          children: [
            { text: "第一章 初识响应式编程", icon: "pen-to-square", link: "01-intro" },
            { text: "第二章 Flux 与 Mono 基础", icon: "pen-to-square", link: "02-flux-mono" },
            { text: "第三章 订阅流程与生命周期", icon: "pen-to-square", link: "03-lifecycle" },
            { text: "第四章 线程调度 Schedulers", icon: "pen-to-square", link: "04-schedulers" },
            { text: "第五章 Sinks.Many - 手动控制数据流", icon: "pen-to-square", link: "05-sinks" },
            { text: "第六章 第六章：错误处理与资源清理", icon: "pen-to-square", link: "06-error-handling" },
            { text: "第七章 背压处理 - 让快慢匹配", icon: "pen-to-square", link: "07-backpressure" },
            { text: "第八章 Spring 集成与项目实战", icon: "pen-to-square", link: "08-spring-integration" }
          ]
        },
      ],
    },
    {
      text: "面试",
      icon: "laptop-code",
      prefix: "interview/",
      link: "interview/",
      collapsible: true,
      expanded: true,
      children: "structure",
    },
    {
      text: "算法",
      icon: "laptop-code",
      prefix: "algorithm/",
      link: "algorithm/",
      children: "structure",
    },
    {
      text: "前端",
      icon: "laptop-code",
      prefix: "front-end/",
      link: "front-end/",
      children: "structure",
    },
    {
      text: "项目",
      icon: "laptop-code",
      prefix: "project/",
      link: "project/",
      children: "structure",
    },
    {
      text: "Linux",
      icon: "laptop-code",
      prefix: "linux/",
      link: "linux/",
      children: "structure",
    },
    {
      text: "如何使用",
      icon: "laptop-code",
      prefix: "demo/",
      link: "demo/",
      children: "structure",
    },
    {
      text: "文章",
      icon: "book",
      prefix: "posts/",
      children: "structure",
    },
    "intro",
    {
      text: "幻灯片",
      icon: "person-chalkboard",
      link: "https://ecosystem.vuejs.press/zh/plugins/markdown/revealjs/demo.html",
    },
  ],
});
