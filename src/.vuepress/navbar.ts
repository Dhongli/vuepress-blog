import { navbar } from "vuepress-theme-hope";

export default navbar([
  "/",
  {
    text: "Java",
    icon: "pen-to-square",
    prefix: "/java/",
    children: [
      {
        text: "Spring",
        icon: "pen-to-square",
        prefix: "spring/",
        link: "spring/",
      },
      {
        text: "SpringBoot",
        icon: "pen-to-square",
        prefix: "springboot/",
        link: "springboot/",
      },
      {
        text: "Reactor",
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
  "/interview/",
  "/algorithm/",
  "/front-end/",
  "/project/",
  "/linux/",
  "/demo/",
  
  {
    text: "博文",
    icon: "pen-to-square",
    prefix: "/posts/",
    children: [
      {
        text: "苹果",
        icon: "pen-to-square",
        prefix: "apple/",
        children: [
          { text: "苹果1", icon: "pen-to-square", link: "1" },
          { text: "苹果2", icon: "pen-to-square", link: "2" },
          "3",
          "4",
        ],
      },
      {
        text: "香蕉",
        icon: "pen-to-square",
        prefix: "banana/",
        children: [
          {
            text: "香蕉 1",
            icon: "pen-to-square",
            link: "1",
          },
          {
            text: "香蕉 2",
            icon: "pen-to-square",
            link: "2",
          },
          "3",
          "4",
        ],
      },
      { text: "樱桃", icon: "pen-to-square", link: "cherry" },
      { text: "火龙果", icon: "pen-to-square", link: "dragonfruit" },
      "tomato",
      "strawberry",
    ],
  },
  {
    text: "V2 文档",
    icon: "book",
    link: "https://theme-hope.vuejs.press/zh/",
  },
]);
