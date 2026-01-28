# CBA 多人游戏服务器

## 本地运行

```bash
cd server
npm install
npm start
```

服务器将在 `ws://localhost:8080` 运行。

## 部署到互联网

### 方案1: Railway (推荐，免费)

1. 注册 [Railway](https://railway.app)
2. 连接 GitHub 仓库
3. 自动部署，获得公网地址如 `wss://your-app.railway.app`

### 方案2: Render (免费)

1. 注册 [Render](https://render.com)
2. 创建 Web Service
3. 连接仓库，设置 `cd server && npm install && npm start`
4. 获得地址如 `wss://your-app.onrender.com`

### 方案3: Fly.io

```bash
# 安装 flyctl
brew install flyctl

# 登录
flyctl auth login

# 部署
cd server
flyctl launch
flyctl deploy
```

### 方案4: 自己的服务器 (VPS)

```bash
# 1. SSH 到服务器
ssh user@your-server.com

# 2. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 克隆代码
git clone your-repo
cd your-repo/server

# 4. 安装依赖
npm install

# 5. 使用 PM2 保持运行
npm install -g pm2
pm2 start server.js --name cba-server
pm2 save
pm2 startup

# 6. 配置 Nginx (可选，用于 HTTPS)
sudo apt install nginx
```

Nginx 配置示例 (`/etc/nginx/sites-available/cba`):
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 客户端配置

部署后，在游戏中修改服务器地址：

```javascript
// multiplayer-client.js
const multiplayerClient = new MultiplayerClient('wss://your-server-address.com');
```

## 测试

本地测试：
1. 启动服务器: `npm start`
2. 在浏览器打开两个游戏页面
3. 一个创建房间，另一个加入

远程测试：
1. 部署服务器到公网
2. 两个人在不同设备打开游戏
3. 使用相同房间号对战
