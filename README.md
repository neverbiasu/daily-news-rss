## 目录结构

### 数据存储 (data/)

```
data/
├── latest-raw.json
└── theconversation/
    └── 2025-10-04-08-latest-raw.json
```

-   `latest-raw.json`: 合并的最新拉取的所有文章数据
-   `theconversation/`: 按源分组的数据目录
-   `2025-10-04-08-latest-raw.json`: 带时间戳的文件 (YYYY-MM-DD-HH 格式)

### PDF 存储 (pdfs/)

```
pdfs/
└── theconversation.com/
    └── 2025-10-04/
        ├── us-economy-is-already-on-the-edge.pdf
        ├── why-major-league-baseball-keeps-coming-back.pdf
        └── ...
```

-   按源域名分组存储 PDF 文件
-   按日期创建子目录 (YYYY-MM-DD 格式)
-   自动跳过已存在的同名文件
