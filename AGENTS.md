# AGENTS.md - VuePress Blog Project

## Project Overview

This is a **VuePress 2 blog** using `vuepress-theme-hope`. The project is written in **TypeScript** for configuration and **Markdown** for content. Content is primarily in **Chinese**.

---

## Build / Dev / Test Commands

```bash
# Install nvm and use Node.js 22 (required for compatibility)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22

# Install dependencies
npm install

# Start development server (with hot reload)
npm run docs:dev

# Build for production
npm run docs:build

# Clean cache and start fresh dev server
npm run docs:clean-dev

# Update VuePress packages
npm run docs:update-package
```

**Node.js 22 is required** - the project uses `vuepress-theme-hope` which has compatibility issues with Node.js 24. GitHub Actions also uses Node.js 22. An `.nvmrc` file is included for automatic version switching.

---

## Project Structure

```
vuepress-blog/
├── src/                           # Main content directory
│   ├── .vuepress/                 # VuePress configuration
│   │   ├── config.ts              # Site configuration
│   │   ├── theme.ts               # Theme configuration
│   │   ├── navbar.ts              # Navigation bar
│   │   ├── sidebar.ts             # Sidebar navigation
│   │   ├── styles/
│   │   │   ├── config.scss        # Theme customizations
│   │   │   ├── palette.scss       # Color palette
│   │   │   └── index.scss         # Custom styles
│   │   └── public/                # Static assets
│   │       ├── assets/images/     # Images
│   │       └── icon/              # Icons
│   ├── README.md                  # Home page (layout: Blog)
│   ├── intro.md                   # Introduction page
│   ├── java/                      # Java category
│   │   ├── spring/
│   │   ├── springboot/
│   │   └── reactor/               # Project reactor series
│   ├── linux/
│   ├── front-end/
│   ├── algorithm/
│   ├── interview/
│   ├── project/
│   ├── demo/                      # Demo/usage guide
│   └── posts/                     # Blog posts
│       ├── apple/
│       ├── banana/
│       ├── cherry.md
│       ├── strawberry.md
│       ├── tomato.md
│       └── dragonfruit.md
└── package.json
```

---

## Code Style Guidelines

### TypeScript (Configuration Files)

**File: `src/.vuepress/*.ts`**

```typescript
// Use ES module imports
import { defineUserConfig } from "vuepress";
import { hopeTheme } from "vuepress-theme-hope";

// Use named exports
export default defineUserConfig({ ... });
export default hopeTheme({ ... });
```

**TypeScript Compiler Options** (from `tsconfig.json`):
- Target: `ES2022`
- Module: `NodeNext`
- Module Resolution: `NodeNext`

```typescript
// Example: config.ts
import { defineUserConfig } from "vuepress";
import { searchPlugin } from '@vuepress/plugin-search';
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",
  lang: "zh-CN",
  title: "博客演示",
  description: "vuepress-theme-hope 的博客演示",
  theme,
});
```

### SCSS (Styles)

**File: `src/.vuepress/styles/*.scss`**

```scss
// Use variables for theme colors
$theme-color: #096dd9;

// Use standard SCSS syntax
```

### Markdown (Content)

**Frontmatter** is required at the top of every Markdown file:

```markdown
---
title: Page Title
icon: pen-to-square
date: 2024-01-01
category:
  - Category1
tag:
  - tag1
  - tag2
---

# Content starts here

<!-- more -->  <!-- Use this to control preview content -->
```

**Common Frontmatter Fields**:
- `title` - Page title
- `icon` - Icon (e.g., `pen-to-square`, `book`, `lock`)
- `date` - Publication date (YYYY-MM-DD)
- `category` - Array of categories
- `tag` - Array of tags
- `order` - Sort order
- `sticky` - Pin order (higher = more sticky)
- `star` - Mark as starred (true/false)
- `cover` - Cover image path
- `index` - Show in sidebar index (true/false)
- `collapsible` - Sidebar collapsible (true/false)
- `expanded` - Sidebar expanded by default (true/false)

---

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|------|------------|---------|
| Content directories | kebab-case | `src/java/reactor/` |
| Markdown files | kebab-case | `linux磁盘与文件系统管理.md` |
| Config files | kebab-case | `navbar.ts`, `sidebar.ts` |
| Categories | PascalCase or Chinese | `Java`, `Spring`, `面试` |

### TypeScript Identifiers

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `const baseUrl = "/"` |
| Functions | camelCase | `defineUserConfig()` |
| Imports | PascalCase | `import { hopeTheme }` |
| Constants | SCREAMING_SNAKE_CASE | `const MAX_RETRIES = 3` |

---

## VuePress Theme Hope Features

### Markdown Extensions Used

- **Code tabs**: `::: code-tabs`
- **Containers**: `::: info`, `::: tip`, `::: warning`, `::: caution`, `::: details`
- **Tabs**: `::: tabs#fruit`
- **Footnotes**: `[^1]`
- **Task lists**: `- [x] done`
- **Sup/Sub**: `19^th^`, `H~2~O`
- **Mark**: `==highlighted==`
- **Align**: `::: center`, `::: right`
- **Components**: `<component VPCard>`
- **PlantUML**: `@startuml`
- **Include**: `<!-- @include: ./file.md{1-10} -->`

### Encryption

```typescript
encrypt: {
  config: {
    "/demo/encrypt.html": {
      hint: "Password: 12345",
      password: "12345",
    },
  },
},
```

---

## Error Handling

- **No linter configured**: There is no ESLint, Prettier, or Stylelint setup
- **TypeScript strictness**: The tsconfig.json uses default settings (not strict)
- **Build errors**: Check `src/.vuepress/config.ts` syntax first
- **Theme errors**: Verify `theme.ts` follows vuepress-theme-hope API

---

## Common Tasks

### Adding a New Blog Post

1. Create a Markdown file in appropriate category under `src/`
2. Add required frontmatter (`title`, `date`, `category`, `tag`)
3. Add `<!-- more -->` to control preview length
4. Test with `npm run docs:dev`

### Adding a New Category Page

1. Create directory under `src/`
2. Create `README.md` with frontmatter:
```markdown
---
title: Category Name
index: false
icon: book
category:
  - Parent Category
---
<Catalog />
```
3. Add to `navbar.ts` and `sidebar.ts`

### Modifying Theme Configuration

Edit `src/.vuepress/theme.ts` following the [vuepress-theme-hope documentation](https://theme-hope.vuejs.press/zh/).

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| vuepress | 2.0.0-rc.26 | Core framework |
| vuepress-theme-hope | 2.0.0-rc.98 | Theme |
| @vuepress/bundler-webpack | 2.0.0-rc.26 | Bundler |
| sass-embedded | 1.93.2 | SCSS compilation |
| @vuepress/plugin-search | 2.0.0-rc.118 | Search plugin |

---

## Version Compatibility Notes

**IMPORTANT**: `vuepress-theme-hope@2.0.0-rc.104` and `sass-embedded@1.98.0` have a compatibility bug that causes theme CSS to not compile correctly (navbar/sidebar styles missing). 

**DO NOT upgrade** to:
- `vuepress-theme-hope` beyond `2.0.0-rc.98`
- `sass-embedded` beyond `1.93.2`
- `vuepress` beyond `2.0.0-rc.26`
- `@vuepress/bundler-webpack` beyond `2.0.0-rc.26`

If you encounter CSS styling issues (missing navbar, unstyled sidebar), run:
```bash
npm install sass-embedded@1.93.2 -D
```

---

## Notes

- This is a **content-focused blog** — no JavaScript/TypeScript code in content files
- All content is **Chinese** (Simplified)
- Images go in `src/.vuepress/public/assets/images/`
- Static assets go in `src/.vuepress/public/`
- Links use absolute paths from `src/`
