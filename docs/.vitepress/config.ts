import {defineConfig} from 'vitepress';

const repo = 'https://github.com/aDarkMaker/JMFM';
const base = '/JMFM/';

export default defineConfig({
  title: 'JMFM',
  description: '禁漫天堂漫画下载器 - React Native + TypeScript',
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    socialLinks: [{icon: 'github', link: repo}],
    search: {provider: 'local'},
    nav: [
      {text: '产品介绍', link: '/intro/product'},
      {text: '架构', link: '/architecture/overview'},
      {text: '开发', link: '/development/setup'},
    ],
    sidebar: [
      {
        text: '产品介绍',
        collapsed: false,
        items: [
          {text: '产品介绍', link: '/intro/product'},
          {text: '功能特性', link: '/intro/features'},
          {text: '快速开始', link: '/intro/quickstart'},
        ],
      },
      {
        text: '架构逻辑',
        collapsed: false,
        items: [
          {text: '架构总览', link: '/architecture/overview'},
          {text: '网络与 API 通道', link: '/architecture/network'},
          {text: '图片解密与重组', link: '/architecture/transcode'},
          {text: '下载编排', link: '/architecture/download'},
          {text: 'PDF 生成', link: '/architecture/pdf'},
        ],
      },
      {
        text: '开发方式',
        collapsed: false,
        items: [
          {text: '环境准备', link: '/development/setup'},
          {text: '验证与测试', link: '/development/verify'},
          {text: '开发日志', link: '/development/changelog'},
        ],
      },
    ],
  },
});
