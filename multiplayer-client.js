/**
 * CBA Multiplayer WebSocket Client
 * 
 * 用于连接真正的多人游戏服务器
 */

class MultiplayerClient {
    constructor(serverUrl = 'ws://localhost:8080') {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // 事件回调
        this.onConnected = null;
        this.onDisconnected = null;
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onJoinError = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onCharacterUpdated = null;
        this.onReadyUpdated = null;
        this.onGameStarted = null;
        this.onGameAction = null;
        this.onRoomClosed = null;
        this.onError = null;
    }
    
    // 连接服务器
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
                
                this.ws.onopen = () => {
                    console.log('Connected to multiplayer server');
                    this.reconnectAttempts = 0;
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message, resolve);
                    } catch (e) {
                        console.error('Failed to parse message:', e);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from server');
                    this.isConnected = false;
                    if (this.onDisconnected) {
                        this.onDisconnected();
                    }
                    this.attemptReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // 断开连接
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.playerId = null;
        this.roomCode = null;
    }
    
    // 尝试重连
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(() => {});
        }, delay);
    }
    
    // 发送消息
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    }
    
    // 处理服务器消息
    handleMessage(message, connectResolve = null) {
        console.log('Received:', message.type);
        
        switch (message.type) {
            case 'connected':
                this.playerId = message.playerId;
                this.isConnected = true;
                if (this.onConnected) this.onConnected(message.playerId);
                if (connectResolve) connectResolve(message.playerId);
                break;
                
            case 'room_created':
                this.roomCode = message.roomCode;
                this.isHost = true;
                if (this.onRoomCreated) this.onRoomCreated(message.roomCode, message.room);
                break;
                
            case 'room_joined':
                this.roomCode = message.roomCode;
                this.isHost = false;
                if (this.onRoomJoined) this.onRoomJoined(message.roomCode, message.room);
                break;
                
            case 'join_error':
                if (this.onJoinError) this.onJoinError(message.error);
                break;
                
            case 'player_joined':
                if (this.onPlayerJoined) this.onPlayerJoined(message.guest);
                break;
                
            case 'player_left':
                if (this.onPlayerLeft) this.onPlayerLeft(message.playerId);
                break;
                
            case 'character_updated':
                if (this.onCharacterUpdated) {
                    this.onCharacterUpdated(message.characterIndex, message.isHost);
                }
                break;
                
            case 'ready_updated':
                if (this.onReadyUpdated) {
                    this.onReadyUpdated(message.ready, message.isHost);
                }
                break;
                
            case 'game_started':
                if (this.onGameStarted) this.onGameStarted(message.room);
                break;
                
            case 'game_action':
                if (this.onGameAction) {
                    this.onGameAction(message.action, message.data);
                }
                break;
                
            case 'room_closed':
                this.roomCode = null;
                this.isHost = false;
                if (this.onRoomClosed) this.onRoomClosed(message.reason);
                break;
                
            case 'server_shutdown':
                console.log('Server is shutting down');
                this.disconnect();
                break;
        }
    }
    
    // ========== 房间操作 ==========
    
    createRoom(playerName, characterIndex = 0) {
        this.send({
            type: 'create_room',
            playerName: playerName,
            characterIndex: characterIndex
        });
    }
    
    joinRoom(roomCode, playerName, characterIndex = 0) {
        this.send({
            type: 'join_room',
            roomCode: roomCode,
            playerName: playerName,
            characterIndex: characterIndex
        });
    }
    
    leaveRoom() {
        this.send({ type: 'leave_room' });
        this.roomCode = null;
        this.isHost = false;
    }
    
    updateCharacter(characterIndex) {
        this.send({
            type: 'update_character',
            characterIndex: characterIndex
        });
    }
    
    setReady(ready) {
        this.send({
            type: 'set_ready',
            ready: ready
        });
    }
    
    startGame() {
        if (this.isHost) {
            this.send({ type: 'start_game' });
        }
    }
    
    // 发送游戏动作
    sendGameAction(action, data) {
        this.send({
            type: 'game_action',
            action: action,
            data: data
        });
    }
}

// 全局实例
const multiplayerClient = new MultiplayerClient();
