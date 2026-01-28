/**
 * CBA Multiplayer WebSocket Server
 * 
 * 运行方式:
 * 1. cd server
 * 2. npm install
 * 3. npm start
 * 
 * 服务器将在 ws://localhost:8080 运行
 */

const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;

// Create HTTP server for Railway compatibility
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CBA Multiplayer Server Running');
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// 存储所有房间
const rooms = new Map();
// 存储所有连接的玩家
const players = new Map();

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏀 CBA Multiplayer Server running on port ${PORT}`);
});

// 生成房间号
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 广播给房间内所有玩家
function broadcastToRoom(roomCode, message, excludePlayerId = null) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    if (room.host && room.host.id !== excludePlayerId) {
        const hostWs = players.get(room.host.id);
        if (hostWs && hostWs.readyState === WebSocket.OPEN) {
            hostWs.send(messageStr);
        }
    }
    
    if (room.guest && room.guest.id !== excludePlayerId) {
        const guestWs = players.get(room.guest.id);
        if (guestWs && guestWs.readyState === WebSocket.OPEN) {
            guestWs.send(messageStr);
        }
    }
}

// 处理WebSocket连接
wss.on('connection', (ws) => {
    const playerId = uuidv4();
    players.set(playerId, ws);
    
    console.log(`Player connected: ${playerId}`);
    
    // 发送连接确认
    ws.send(JSON.stringify({
        type: 'connected',
        playerId: playerId
    }));
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, playerId, message);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        handleDisconnect(playerId);
        players.delete(playerId);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${playerId}:`, error);
    });
});

// 处理消息
function handleMessage(ws, playerId, message) {
    console.log(`Message from ${playerId}:`, message.type);
    
    switch (message.type) {
        case 'create_room':
            handleCreateRoom(ws, playerId, message);
            break;
            
        case 'join_room':
            handleJoinRoom(ws, playerId, message);
            break;
            
        case 'leave_room':
            handleLeaveRoom(playerId);
            break;
            
        case 'update_character':
            handleUpdateCharacter(playerId, message);
            break;
            
        case 'set_ready':
            handleSetReady(playerId, message);
            break;
            
        case 'start_game':
            handleStartGame(playerId);
            break;
            
        case 'game_action':
            handleGameAction(playerId, message);
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
}

// 创建房间
function handleCreateRoom(ws, playerId, message) {
    let roomCode = generateRoomCode();
    // 确保房间号唯一
    while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
    }
    
    const room = {
        code: roomCode,
        host: {
            id: playerId,
            name: message.playerName || '房主',
            characterIndex: message.characterIndex || 0,
            ready: true
        },
        guest: null,
        status: 'waiting',
        createdAt: Date.now()
    };
    
    rooms.set(roomCode, room);
    
    // 记录玩家所在房间
    ws.roomCode = roomCode;
    ws.isHost = true;
    
    console.log(`Room created: ${roomCode}, total rooms: ${rooms.size}`);
    console.log(`Active rooms: ${[...rooms.keys()].join(', ')}`);
    
    ws.send(JSON.stringify({
        type: 'room_created',
        roomCode: roomCode,
        room: room
    }));
}

// 加入房间
function handleJoinRoom(ws, playerId, message) {
    const roomCode = message.roomCode?.toUpperCase();
    console.log(`Join request for room: ${roomCode}`);
    console.log(`Available rooms: ${[...rooms.keys()].join(', ') || 'none'}`);
    
    const room = rooms.get(roomCode);
    
    if (!room) {
        console.log(`Room ${roomCode} not found`);
        ws.send(JSON.stringify({
            type: 'join_error',
            error: 'ROOM_NOT_FOUND'
        }));
        return;
    }
    
    if (room.guest) {
        ws.send(JSON.stringify({
            type: 'join_error',
            error: 'ROOM_FULL'
        }));
        return;
    }
    
    if (room.status === 'playing') {
        ws.send(JSON.stringify({
            type: 'join_error',
            error: 'GAME_IN_PROGRESS'
        }));
        return;
    }
    
    // 加入房间
    room.guest = {
        id: playerId,
        name: message.playerName || '玩家2',
        characterIndex: message.characterIndex || 0,
        ready: false
    };
    room.status = 'ready';
    
    ws.roomCode = roomCode;
    ws.isHost = false;
    
    console.log(`Player ${playerId} joined room ${roomCode}`);
    
    // 通知加入者
    ws.send(JSON.stringify({
        type: 'room_joined',
        roomCode: roomCode,
        room: room
    }));
    
    // 通知房主
    broadcastToRoom(roomCode, {
        type: 'player_joined',
        guest: room.guest
    }, playerId);
}

// 离开房间
function handleLeaveRoom(playerId) {
    const ws = players.get(playerId);
    if (!ws || !ws.roomCode) return;
    
    const roomCode = ws.roomCode;
    const room = rooms.get(roomCode);
    
    if (!room) return;
    
    if (ws.isHost) {
        // 房主离开，关闭房间
        broadcastToRoom(roomCode, {
            type: 'room_closed',
            reason: 'HOST_LEFT'
        }, playerId);
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} closed (host left)`);
    } else {
        // 客人离开
        room.guest = null;
        room.status = 'waiting';
        
        broadcastToRoom(roomCode, {
            type: 'player_left',
            playerId: playerId
        }, playerId);
        console.log(`Player ${playerId} left room ${roomCode}`);
    }
    
    ws.roomCode = null;
    ws.isHost = false;
}

// 更新角色选择
function handleUpdateCharacter(playerId, message) {
    const ws = players.get(playerId);
    if (!ws || !ws.roomCode) return;
    
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    
    if (ws.isHost && room.host) {
        room.host.characterIndex = message.characterIndex;
    } else if (!ws.isHost && room.guest) {
        room.guest.characterIndex = message.characterIndex;
    }
    
    // 通知对方
    broadcastToRoom(ws.roomCode, {
        type: 'character_updated',
        playerId: playerId,
        characterIndex: message.characterIndex,
        isHost: ws.isHost
    }, playerId);
}

// 设置准备状态
function handleSetReady(playerId, message) {
    const ws = players.get(playerId);
    if (!ws || !ws.roomCode) return;
    
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    
    if (ws.isHost && room.host) {
        room.host.ready = message.ready;
    } else if (!ws.isHost && room.guest) {
        room.guest.ready = message.ready;
    }
    
    broadcastToRoom(ws.roomCode, {
        type: 'ready_updated',
        playerId: playerId,
        ready: message.ready,
        isHost: ws.isHost
    }, playerId);
}

// 开始游戏
function handleStartGame(playerId) {
    const ws = players.get(playerId);
    if (!ws || !ws.roomCode || !ws.isHost) return;
    
    const room = rooms.get(ws.roomCode);
    if (!room || !room.guest) return;
    
    room.status = 'playing';
    room.startedAt = Date.now();
    
    // 通知双方游戏开始
    broadcastToRoom(ws.roomCode, {
        type: 'game_started',
        room: room
    });
    
    console.log(`Game started in room ${ws.roomCode}`);
}

// 处理游戏动作 (用于同步游戏状态)
function handleGameAction(playerId, message) {
    const ws = players.get(playerId);
    if (!ws || !ws.roomCode) return;
    
    // 转发游戏动作给对方
    broadcastToRoom(ws.roomCode, {
        type: 'game_action',
        playerId: playerId,
        action: message.action,
        data: message.data
    }, playerId);
}

// 处理断开连接
function handleDisconnect(playerId) {
    handleLeaveRoom(playerId);
}

// 定期清理过期房间 (超过1小时的房间)
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [code, room] of rooms) {
        if (now - room.createdAt > oneHour) {
            broadcastToRoom(code, {
                type: 'room_closed',
                reason: 'TIMEOUT'
            });
            rooms.delete(code);
            console.log(`Room ${code} expired and removed`);
        }
    }
}, 60000); // 每分钟检查一次

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    
    for (const [code, room] of rooms) {
        broadcastToRoom(code, {
            type: 'server_shutdown'
        });
    }
    
    wss.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
