# 验证与测试

## 单测

Jest 覆盖核心模块：

| 模块 | 覆盖点 |
|---|---|
| `transcode` | getNum 条带计算、computeStrips 逆序重排 |
| `crypto` | MD5、AES-256-ECB 密钥派生与解密 |
| `parser` | Base64 解码、HTML 解析 |
| `model` | 图片 URL 构造、ImageItem 创建 |
| `net` | 域名轮换、URL 构造 |
| `download-service` | 端到端编排（mock 网络与运行时） |
| `pdf` | 统一宽度、等比缩放、标题清理 |
| `constants` / `settings` | 配置与设置持久化 |

运行：

```bash
bun run test
```

## Node 端真实验证

`scripts/verify-download.ts` 在 Node 环境跑通完整链路（不走模拟器）：

```bash
bun scripts/verify-download.ts 1327951
```

它会：

1. 刷新动态域名。
2. `ApiClient` 拉取专辑与章节。
3. 并发下载全部图片。
4. ImageMagick 条带重组。
5. 生成统一宽度 PDF 到 `temp/<albumId>/`。

已用专辑 1327951 验证：50 页全部等宽 960pt、无白色占位、无小图。

## 校验 PDF

检查生成 PDF 的页面结构：

```bash
python3 -c "
import re
data = open('temp/1327951/<标题>.pdf','rb').read()
boxes = re.findall(rb'/MediaBox\s*\[([^\]]+)\]', data)
ws = [int(x.split()[2]) for x in boxes]
print('pages:', len(boxes), 'distinct widths:', len(set(ws)))
"
```

期望：`pages: 50`，`distinct widths: 1`。
