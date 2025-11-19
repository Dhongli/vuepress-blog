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
        }
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
