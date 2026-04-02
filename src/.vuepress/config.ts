import { defineUserConfig } from "vuepress";
import { searchPlugin } from '@vuepress/plugin-search'

import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "Henry 的摸鱼小栈",
  description: "Henry 的摸鱼小栈",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
