# yuanzehua.me

Zane Hua 的个人主页。纯静态站点，无框架依赖，部署于 Cloudflare Pages。

## 目录结构

```
yuanzehua.me/
├── index.html                  ← 主页（唯一入口，所有内容在此维护）
├── README.md                   ← 本文件
│
├── assets/
│   ├── cursor-demo.html        ← 光标风格参考 demo（不上线，仅本地留存）
│   ├── images/                 ← 图片资源（头像、文章配图等）
│   └── fonts/                  ← 如需本地字体文件
│
├── content/
│   ├── about.md                ← 个人简介草稿（同步维护，手动更新到 index.html）
│   ├── films.yml               ← 电影片单数据源
│   └── posts/                  ← 博客文章（每篇一个 .md 文件）
│       └── YYYY-MM-DD-slug.md  ← 命名规范示例
│
├── scripts/
│   ├── build.js                ← 构建脚本：把 content/ 注入 index.html
│   └── publish.sh              ← 一键发布脚本
│
└── .github/
    └── workflows/
        └── deploy.yml          ← GitHub Actions 自动构建配置
```

## 快速发布流程

```bash
# 写完文章或改完内容后
./scripts/publish.sh
```

等待约 1–2 分钟，Cloudflare Pages 自动部署完成。

## 内容维护对照表

| 要改的内容         | 对应文件                          | 方式         |
|--------------------|-----------------------------------|--------------|
| 个人简介 / 时间轴  | `index.html` → `#about`          | 直接编辑     |
| 项目 / 科研成果    | `index.html` → `#work`           | 直接编辑     |
| 兴趣卡片           | `index.html` → `#interests`      | 直接编辑     |
| 博客文章列表       | `content/posts/*.md` + build.js  | 写 md 后构建 |
| 电影片单           | `content/films.yml`              | 加一条后构建 |
| 联系方式 / 社交    | `index.html` → `#connect`        | 直接编辑     |

## 部署信息

- **托管**：Cloudflare Pages
- **域名**：yuanzehua.me（DNS 托管于 Cloudflare）
- **构建命令**：`node scripts/build.js`（或留空，纯静态直接部署）
- **输出目录**：`/`（根目录）
- **分支**：`main`

详细部署步骤见 `docs/deployment-guide.md`。
