# 丛林野人突击 · 2.5D 街机射击

纯前端 Canvas 单机小游戏，零依赖、零后端、零素材（100% 代码手绘 + WebAudio 合成音效）。

## 玩法
- 丛林枪手守住阵地，野人从丛林深处涌来
- 全方向移动、自动射击、击杀得强化（三选一 RPG buff）
- 每 3 次强化出现酋长 Boss（多阶段：散射长矛 / 召唤 / 跺地 AoE）
- 后期解锁盾牌野人、萨满、自爆野人、狂战士等机制怪

## 操作
- `WASD` / 方向键：全方向移动
- `空格`：暂停
- `M`：静音
- 触屏：拖动控制移动

## 本地运行
直接用浏览器打开 `index.html` 即可；或起一个静态服务器：
```
python -m http.server 8000
```
访问 http://localhost:8000/

## 部署（Ubuntu + Caddy，公网 IP）
```bash
sudo mkdir -p /var/www && sudo git clone <本仓库地址> /var/www/jungle
# 安装 Caddy 后，/etc/caddy/Caddyfile:
#   :80 {
#       root * /var/www/jungle
#       file_server
#       encode gzip
#   }
sudo ufw allow 80,443/tcp
sudo systemctl reload caddy
```
访问 http://你的公网IP/

## 目录
```
index.html      # 入口
style.css       # 街机风 UI
game.js         # 全部游戏逻辑与手绘渲染
assets/         # 仅占位 manifest（游戏不依赖图片）
```
