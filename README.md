# 浮岛建造师 · Floating Isles

在漂浮的天空群岛间搭桥、扩张、募兵，抵御风暴与神鸟袭击的低多边形 3D 生存建造游戏。
纯 Web 技术（Three.js + Vite），浏览器即开即玩。

## 玩法

- 🌉 搭桥连接被云海隔绝的浮岛，每座新岛解锁资源与建筑槽位
- 🌀 周期性风暴：未完工的建筑会被吹散，边缘岛会倾斜沉没（20s 倒计时救援）
- 👥 三兵种：采集工自动采集 / 士兵反击灾鸟 / 维修师加速建造+修岛
- 🐦 八大中国神鸟：凤凰/金乌/重明/丹雀降祥瑞，毕方/灭蒙劫掠，九头鬼车 Boss 压阵
- 📖 新手 7 步引导 + 岛屿碑文碎片化叙事 + 积分结算码

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173 热更新
npm run build    # 产出 dist/
npm run preview  # 预览构建产物
```

## 部署

```bash
tar -czf dist.tar.gz -C dist .
DEPLOY_PASS=<root密码> python scripts/deploy.py   # 需 pip install paramiko
```

部署行为：上传 dist 到 `/var/www/isles`，新增独立 nginx 站点（8088-8099 首空闲端口），
并可通过主站 `location /isles/` 子路径访问。不动现有业务。

## 分支工作流

- `main`：线上对应版本
- 新功能：从 main 切 `feat/xxx` 分支 → 提 PR → 评审合入
