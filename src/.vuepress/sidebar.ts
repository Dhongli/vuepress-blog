import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      text: "Java",
      icon: "laptop-code",
      prefix: "java/",
      link: "java/",
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
