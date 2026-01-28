// Project CBA - 1v1 幻想篮球对决
// Game Logic and Character System

// ========== GAME MODE CONSTANTS ==========
const GAME_MODE = {
    SINGLE_PLAYER: 'single',
    MULTIPLAYER: 'multiplayer'
};

// ========== ROOM MANAGEMENT ==========
class RoomManager {
    constructor() {
        this.currentRoom = null;
        this.isHost = false;
        this.roomCode = null;
        this.players = [];
        this.selectedCharacterIndex = 0;
        this.connectionStatus = 'disconnected'; // disconnected, connecting, connected
        this.onStatusChange = null;
        this.onOpponentCharChange = null;
        
        // Simulated rooms (in real implementation, this would be server-side)
        // Using localStorage to allow multi-tab testing
        this.loadRoomsFromStorage();
        
        // Poll for room updates
        this.pollInterval = null;
    }

    loadRoomsFromStorage() {
        try {
            const stored = localStorage.getItem('cba_rooms');
            this.simulatedRooms = stored ? new Map(JSON.parse(stored)) : new Map();
        } catch {
            this.simulatedRooms = new Map();
        }
    }

    saveRoomsToStorage() {
        try {
            localStorage.setItem('cba_rooms', JSON.stringify([...this.simulatedRooms]));
        } catch {}
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom() {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.connectionStatus = 'connected';
        this.currentRoom = {
            code: this.roomCode,
            host: { 
                id: 'player1', 
                ready: true, 
                characterIndex: 0,
                name: '你 (房主)',
                joinedAt: Date.now()
            },
            guest: null,
            status: 'waiting',
            createdAt: Date.now()
        };
        this.simulatedRooms.set(this.roomCode, this.currentRoom);
        this.saveRoomsToStorage();
        console.log('Room created:', this.roomCode);
        console.log('Saved to storage:', localStorage.getItem('cba_rooms'));
        
        // Start polling for guest
        this.startPolling();
        
        return this.roomCode;
    }

    joinRoom(code) {
        this.loadRoomsFromStorage();
        console.log('Available rooms:', [...this.simulatedRooms.keys()]);
        console.log('Trying to join:', code.toUpperCase());
        const room = this.simulatedRooms.get(code.toUpperCase());
        
        if (!room) {
            console.log('Room not found in storage');
            return { success: false, error: 'ROOM_NOT_FOUND' };
        }
        
        if (room.guest) {
            return { success: false, error: 'ROOM_FULL' };
        }

        // Join the room
        const guestCharIndex = Math.floor(Math.random() * CHARACTERS.length);
        room.guest = { 
            id: 'player2', 
            ready: false, 
            characterIndex: guestCharIndex,
            name: '对手玩家',
            joinedAt: Date.now()
        };
        room.status = 'ready';
        
        this.simulatedRooms.set(code.toUpperCase(), room);
        this.saveRoomsToStorage();
        
        this.currentRoom = room;
        this.isHost = false;
        this.roomCode = code.toUpperCase();
        this.connectionStatus = 'connected';
        this.selectedCharacterIndex = guestCharIndex;
        
        // Start polling for game start
        this.startPolling();
        
        return { success: true, room: room };
    }

    updateMyCharacter(index) {
        if (!this.currentRoom) return;
        
        this.selectedCharacterIndex = index;
        
        if (this.isHost) {
            this.currentRoom.host.characterIndex = index;
        } else {
            this.currentRoom.guest.characterIndex = index;
        }
        
        this.simulatedRooms.set(this.roomCode, this.currentRoom);
        this.saveRoomsToStorage();
    }

    setReady(ready) {
        if (!this.currentRoom) return;
        
        if (this.isHost) {
            this.currentRoom.host.ready = ready;
        } else {
            this.currentRoom.guest.ready = ready;
        }
        
        this.simulatedRooms.set(this.roomCode, this.currentRoom);
        this.saveRoomsToStorage();
    }

    startGame() {
        if (!this.currentRoom) return;
        this.currentRoom.status = 'playing';
        this.currentRoom.startedAt = Date.now();
        this.simulatedRooms.set(this.roomCode, this.currentRoom);
        this.saveRoomsToStorage();
    }

    leaveRoom() {
        this.stopPolling();
        
        if (this.currentRoom) {
            if (this.isHost) {
                this.simulatedRooms.delete(this.roomCode);
            } else if (this.currentRoom.guest) {
                this.currentRoom.guest = null;
                this.currentRoom.status = 'waiting';
                this.simulatedRooms.set(this.roomCode, this.currentRoom);
            }
            this.saveRoomsToStorage();
        }
        
        this.currentRoom = null;
        this.isHost = false;
        this.roomCode = null;
        this.connectionStatus = 'disconnected';
    }

    canStartGame() {
        return this.currentRoom && 
               this.currentRoom.host && 
               this.currentRoom.guest &&
               this.currentRoom.host.ready;
    }

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.pollRoomUpdates(), 1000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    pollRoomUpdates() {
        if (!this.roomCode) return;
        
        this.loadRoomsFromStorage();
        const room = this.simulatedRooms.get(this.roomCode);
        
        if (!room) {
            // Room was deleted (host left)
            if (!this.isHost && this.onStatusChange) {
                this.onStatusChange('room_closed');
            }
            return;
        }

        const oldGuest = this.currentRoom?.guest;
        const newGuest = room.guest;
        
        // Check if guest joined
        if (!oldGuest && newGuest && this.isHost) {
            this.currentRoom = room;
            if (this.onStatusChange) {
                this.onStatusChange('guest_joined', newGuest);
            }
        }
        
        // Check if opponent changed character
        if (newGuest && oldGuest) {
            if (newGuest.characterIndex !== oldGuest.characterIndex) {
                this.currentRoom = room;
                if (this.onOpponentCharChange) {
                    this.onOpponentCharChange(newGuest.characterIndex);
                }
            }
        }
        
        // Check if game started
        if (room.status === 'playing' && this.currentRoom?.status !== 'playing') {
            this.currentRoom = room;
            if (this.onStatusChange) {
                this.onStatusChange('game_started');
            }
        }
        
        this.currentRoom = room;
    }

    // Simulate opponent joining (for demo/testing)
    simulateOpponentJoin(callback) {
        const delay = 2000 + Math.random() * 3000;
        setTimeout(() => {
            if (this.currentRoom && !this.currentRoom.guest) {
                const randomCharIndex = Math.floor(Math.random() * CHARACTERS.length);
                this.currentRoom.guest = { 
                    id: 'player2', 
                    ready: true, 
                    characterIndex: randomCharIndex,
                    name: '对手玩家',
                    joinedAt: Date.now()
                };
                this.currentRoom.status = 'ready';
                this.simulatedRooms.set(this.roomCode, this.currentRoom);
                this.saveRoomsToStorage();
                callback(this.currentRoom.guest);
            }
        }, delay);
    }

    getOpponentCharacter() {
        if (!this.currentRoom) return null;
        
        if (this.isHost && this.currentRoom.guest) {
            return CHARACTERS[this.currentRoom.guest.characterIndex];
        } else if (!this.isHost && this.currentRoom.host) {
            return CHARACTERS[this.currentRoom.host.characterIndex];
        }
        return null;
    }
}

// ========== CHARACTER DATA ==========
// 角色数据已移至 characters.js
// 使用 characterDB (CharacterDatabase 实例) 来管理角色
// CHARACTERS 数组从 characters.js 导出，保持向后兼容

// ========== GAME STATE ==========
class GameState {
    constructor() {
        this.gameMode = null; // 'single' or 'multiplayer'
        this.isMatchActive = false;
        this.playerScore = 0;
        this.opponentScore = 0;
        this.round = 1;
        this.possession = 'player'; // 'player' or 'opponent'
        this.consecutiveScores = 0;
        this.winStreak = 0;
        this.playerCharacter = null;
        this.opponentCharacter = null;
        this.playerOffenseSkillTriggered = false;
        this.playerDefenseSkillTriggered = false;
        this.opponentOffenseSkillTriggered = false;
        this.opponentDefenseSkillTriggered = false;
        this.nextGuaranteeHit = false;
        
        // Multiplayer specific
        this.isHost = false;
        this.roomCode = null;
    }

    reset() {
        this.playerScore = 0;
        this.opponentScore = 0;
        this.round = 1;
        this.possession = Math.random() > 0.5 ? 'player' : 'opponent';
        this.consecutiveScores = 0;
        this.playerOffenseSkillTriggered = false;
        this.playerDefenseSkillTriggered = false;
        this.opponentOffenseSkillTriggered = false;
        this.opponentDefenseSkillTriggered = false;
        this.nextGuaranteeHit = false;
    }

    setMode(mode) {
        this.gameMode = mode;
    }
}

// ========== GAME CONTROLLER ==========
class GameController {
    constructor() {
        this.state = new GameState();
        this.roomManager = new RoomManager();
        this.selectedCharacterIndex = 0;
        this.currentScreen = 'mode'; // 'mode', 'lobby', 'createRoom', 'joinRoom', 'waitingRoom', 'game'
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindModeSelectionEvents();
        this.bindLobbyEvents();
        this.bindRoomEvents();
        this.bindGameEvents();
        this.renderCharacterGrid();
        this.renderRoomCharacterGrids();
        this.selectCharacter(0);
        this.drawRadarChart();
    }

    cacheElements() {
        // Screens
        this.modeScreen = document.getElementById('modeScreen');
        this.lobbyScreen = document.getElementById('lobbyScreen');
        this.createRoomScreen = document.getElementById('createRoomScreen');
        this.joinRoomScreen = document.getElementById('joinRoomScreen');
        this.waitingRoomScreen = document.getElementById('waitingRoomScreen');
        this.gameContainer = document.getElementById('gameContainer');

        // Mode Selection
        this.singlePlayerMode = document.getElementById('singlePlayerMode');
        this.multiPlayerMode = document.getElementById('multiPlayerMode');

        // Lobby
        this.lobbyBackBtn = document.getElementById('lobbyBackBtn');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');

        // Create Room
        this.createRoomBackBtn = document.getElementById('createRoomBackBtn');
        this.roomCodeEl = document.getElementById('roomCode');
        this.copyRoomCodeBtn = document.getElementById('copyRoomCode');
        this.roomCharacterGrid = document.getElementById('roomCharacterGrid');
        this.startMultiplayerBtn = document.getElementById('startMultiplayerBtn');
        
        // Create Room - Player Cards
        this.hostAvatar = document.getElementById('hostAvatar');
        this.hostCharName = document.getElementById('hostCharName');
        this.guestCard = document.getElementById('guestCard');
        this.guestAvatar = document.getElementById('guestAvatar');
        this.guestName = document.getElementById('guestName');
        this.guestCharName = document.getElementById('guestCharName');
        this.guestStatus = document.getElementById('guestStatus');

        // Join Room
        this.joinRoomBackBtn = document.getElementById('joinRoomBackBtn');
        this.roomCodeInput = document.getElementById('roomCodeInput');
        this.confirmJoinBtn = document.getElementById('confirmJoinBtn');
        this.joinError = document.getElementById('joinError');
        
        // Waiting Room - Player Cards
        this.waitHostAvatar = document.getElementById('waitHostAvatar');
        this.waitHostName = document.getElementById('waitHostName');
        this.waitHostCharName = document.getElementById('waitHostCharName');
        this.waitGuestAvatar = document.getElementById('waitGuestAvatar');
        this.waitGuestCharName = document.getElementById('waitGuestCharName');

        // Waiting Room
        this.waitingRoomBackBtn = document.getElementById('waitingRoomBackBtn');
        this.joinedRoomCode = document.getElementById('joinedRoomCode');
        this.hostName = document.getElementById('hostName');
        this.joinCharacterGrid = document.getElementById('joinCharacterGrid');

        // Left Panel
        this.leftPanel = document.getElementById('leftPanel');
        this.playerAvatar = document.getElementById('playerAvatar');
        this.playerEmoji = document.getElementById('playerEmoji');
        this.playerName = document.getElementById('playerName');
        this.playerTitle = document.getElementById('playerTitle');
        this.playerRarity = document.getElementById('playerRarity');
        this.radarCanvas = document.getElementById('radarChart');
        this.offenseSkillName = document.getElementById('offenseSkillName');
        this.offenseSkillDesc = document.getElementById('offenseSkillDesc');
        this.defenseSkillName = document.getElementById('defenseSkillName');
        this.defenseSkillDesc = document.getElementById('defenseSkillDesc');
        this.characterGrid = document.getElementById('characterGrid');
        this.findMatchBtn = document.getElementById('findMatchBtn');
        this.backToMenuBtn = document.getElementById('backToMenuBtn');
        this.winStreakEl = document.getElementById('winStreak');

        // Right Panel
        this.rightPanel = document.getElementById('rightPanel');
        this.arenaOverlay = document.getElementById('arenaOverlay');
        this.playerScoreEl = document.getElementById('playerScore');
        this.opponentScoreEl = document.getElementById('opponentScore');
        this.possessionIndicator = document.getElementById('possessionIndicator');
        this.roundNumber = document.getElementById('roundNumber');
        this.gameLog = document.getElementById('gameLog');
        this.actionBar = document.getElementById('actionBar');
        this.opponentTurnEl = document.getElementById('opponentTurn');
        this.skillEffect = document.getElementById('skillEffect');
        this.skillEffectText = document.getElementById('skillEffectText');

        // Court
        this.playerToken = document.getElementById('playerToken');
        this.opponentToken = document.getElementById('opponentToken');
        this.playerTokenEmoji = document.getElementById('playerTokenEmoji');
        this.opponentTokenEmoji = document.getElementById('opponentTokenEmoji');
        this.ball = document.getElementById('ball');

        // Modal
        this.resultModal = document.getElementById('resultModal');
        this.resultTitle = document.getElementById('resultTitle');
        this.resultScore = document.getElementById('resultScore');
        this.resultMvp = document.getElementById('resultMvp');
        this.playAgainBtn = document.getElementById('playAgainBtn');
    }

    // ========== SCREEN NAVIGATION ==========
    showScreen(screenName) {
        // Hide all screens
        this.modeScreen.classList.add('hidden');
        this.lobbyScreen.classList.add('hidden');
        this.createRoomScreen.classList.add('hidden');
        this.joinRoomScreen.classList.add('hidden');
        this.waitingRoomScreen.classList.add('hidden');
        this.gameContainer.classList.add('hidden');

        // Show target screen
        switch(screenName) {
            case 'mode':
                this.modeScreen.classList.remove('hidden');
                break;
            case 'lobby':
                this.lobbyScreen.classList.remove('hidden');
                break;
            case 'createRoom':
                this.createRoomScreen.classList.remove('hidden');
                break;
            case 'joinRoom':
                this.joinRoomScreen.classList.remove('hidden');
                break;
            case 'waitingRoom':
                this.waitingRoomScreen.classList.remove('hidden');
                break;
            case 'game':
                this.gameContainer.classList.remove('hidden');
                break;
        }
        this.currentScreen = screenName;
    }

    // ========== MODE SELECTION EVENTS ==========
    bindModeSelectionEvents() {
        this.singlePlayerMode.addEventListener('click', () => {
            this.state.setMode(GAME_MODE.SINGLE_PLAYER);
            this.showScreen('game');
        });

        this.multiPlayerMode.addEventListener('click', () => {
            this.state.setMode(GAME_MODE.MULTIPLAYER);
            this.showScreen('lobby');
        });
    }

    // ========== LOBBY EVENTS ==========
    bindLobbyEvents() {
        this.lobbyBackBtn.addEventListener('click', () => {
            this.showScreen('mode');
        });

        this.createRoomBtn.addEventListener('click', async () => {
            // Use WebSocket multiplayer client
            await this.connectToServer();
            
            // Set up callbacks
            multiplayerClient.onRoomCreated = (roomCode, room) => {
                this.roomCodeEl.textContent = roomCode;
                this.showScreen('createRoom');
                this.updateCreateRoomUI();
                this.renderRoomCharacterGrids();
            };
            
            multiplayerClient.onPlayerJoined = (guest) => {
                this.onOpponentJoined(guest);
            };
            
            multiplayerClient.onCharacterUpdated = (charIndex, isHost) => {
                if (!isHost && this.currentScreen === 'createRoom') {
                    const char = CHARACTERS[charIndex];
                    this.updateRoomAvatar(this.guestAvatar, char);
                    this.guestCharName.textContent = char.name;
                }
            };
            
            multiplayerClient.onRoomClosed = (reason) => {
                alert('房间已关闭');
                this.showScreen('lobby');
            };
            
            // Create room on server
            multiplayerClient.createRoom('房主', this.selectedCharacterIndex);
        });

        this.joinRoomBtn.addEventListener('click', () => {
            this.roomCodeInput.value = '';
            this.joinError.classList.add('hidden');
            this.showScreen('joinRoom');
        });
    }

    // ========== ROOM EVENTS ==========
    bindRoomEvents() {
        // Create Room
        this.createRoomBackBtn.addEventListener('click', () => {
            if (multiplayerClient.isConnected) {
                multiplayerClient.leaveRoom();
            }
            this.roomManager.leaveRoom();
            this.showScreen('lobby');
        });

        this.copyRoomCodeBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomManager.roomCode).then(() => {
                this.copyRoomCodeBtn.textContent = '✓ 已复制';
                this.copyRoomCodeBtn.classList.add('copied');
                setTimeout(() => {
                    this.copyRoomCodeBtn.textContent = '📋 复制';
                    this.copyRoomCodeBtn.classList.remove('copied');
                }, 2000);
            });
        });

        this.startMultiplayerBtn.addEventListener('click', () => {
            if (multiplayerClient.isConnected && multiplayerClient.isHost) {
                multiplayerClient.startGame();
                // Game will start via onGameStarted callback
            }
        });
        
        // Set up game started callback for host
        multiplayerClient.onGameStarted = (room) => {
            this.onlineRoom = room;
            this.startMultiplayerGame();
        };

        // Join Room
        this.joinRoomBackBtn.addEventListener('click', () => {
            if (multiplayerClient.isConnected) {
                multiplayerClient.leaveRoom();
            }
            this.showScreen('lobby');
        });

        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        this.confirmJoinBtn.addEventListener('click', () => {
            this.attemptJoinRoom();
        });

        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.attemptJoinRoom();
            }
        });

        // Waiting Room
        this.waitingRoomBackBtn.addEventListener('click', () => {
            this.roomManager.leaveRoom();
            this.showScreen('lobby');
        });

        // Room character selection
        this.roomCharacterGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.room-char-item');
            if (item) {
                this.selectRoomCharacter(parseInt(item.dataset.index), 'create');
            }
        });

        this.joinCharacterGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.room-char-item');
            if (item) {
                this.selectRoomCharacter(parseInt(item.dataset.index), 'join');
            }
        });
    }

    renderRoomCharacterGrids() {
        const selectedIndex = this.roomManager.selectedCharacterIndex || 0;
        const html = CHARACTERS.map((char, index) => `
            <div class="room-char-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}" data-char="${char.id}">
                ${char.cardImage 
                    ? `<div class="room-char-avatar" data-char="${char.id}" style="background-image: url('${char.cardImage}')"></div>`
                    : `<span class="char-emoji">${char.emoji}</span>`
                }
                <span class="char-name">${char.name}</span>
            </div>
        `).join('');

        if (this.roomCharacterGrid) this.roomCharacterGrid.innerHTML = html;
        if (this.joinCharacterGrid) this.joinCharacterGrid.innerHTML = html;
    }

    selectRoomCharacter(index, gridType) {
        const grid = gridType === 'create' ? this.roomCharacterGrid : this.joinCharacterGrid;
        grid.querySelectorAll('.room-char-item').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        
        // Update server
        if (multiplayerClient.isConnected) {
            multiplayerClient.updateCharacter(index);
        }
        this.roomManager.updateMyCharacter(index);
        
        // Update UI with selected character
        const char = CHARACTERS[index];
        if (gridType === 'create') {
            this.updateRoomAvatar(this.hostAvatar, char);
            this.hostCharName.textContent = char.name;
        } else {
            this.updateRoomAvatar(this.waitGuestAvatar, char);
            this.waitGuestCharName.textContent = char.name;
        }
    }
    
    // Connect to multiplayer server
    async connectToServer() {
        if (multiplayerClient.isConnected) return;
        
        try {
            await multiplayerClient.connect();
            console.log('Connected to multiplayer server');
        } catch (error) {
            console.error('Failed to connect to server:', error);
            alert('无法连接到服务器，请检查网络连接');
            throw error;
        }
    }
    
    updateRoomAvatar(avatarEl, char) {
        if (!avatarEl) return;
        
        if (char.cardImage) {
            avatarEl.style.backgroundImage = `url('${char.cardImage}')`;
            avatarEl.classList.add('has-image');
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.classList.remove('has-image');
            avatarEl.textContent = char.emoji;
        }
        avatarEl.classList.remove('waiting');
    }

    async attemptJoinRoom() {
        const code = this.roomCodeInput.value.trim();
        if (code.length < 4) {
            this.joinError.querySelector('span').textContent = '❌ 请输入完整房间号';
            this.joinError.classList.remove('hidden');
            return;
        }

        // Connect to server
        await this.connectToServer();
        
        // Set up callbacks
        multiplayerClient.onRoomJoined = (roomCode, room) => {
            this.joinedRoomCode.textContent = roomCode;
            
            // Show host's character
            const hostChar = CHARACTERS[room.host.characterIndex] || CHARACTERS[0];
            this.updateRoomAvatar(this.waitHostAvatar, hostChar);
            this.waitHostName.textContent = room.host.name || '房主';
            this.waitHostCharName.textContent = hostChar.name;
            
            // Show my character
            const myChar = CHARACTERS[this.selectedCharacterIndex] || CHARACTERS[0];
            this.updateRoomAvatar(this.waitGuestAvatar, myChar);
            this.waitGuestCharName.textContent = myChar.name;
            
            this.showScreen('waitingRoom');
            this.renderRoomCharacterGrids();
        };
        
        multiplayerClient.onJoinError = (error) => {
            if (error === 'ROOM_NOT_FOUND') {
                this.joinError.querySelector('span').textContent = '❌ 房间不存在';
            } else if (error === 'ROOM_FULL') {
                this.joinError.querySelector('span').textContent = '❌ 房间已满';
            } else if (error === 'GAME_IN_PROGRESS') {
                this.joinError.querySelector('span').textContent = '❌ 游戏已开始';
            } else {
                this.joinError.querySelector('span').textContent = '❌ 加入失败';
            }
            this.joinError.classList.remove('hidden');
        };
        
        multiplayerClient.onCharacterUpdated = (charIndex, isHost) => {
            if (isHost && this.currentScreen === 'waitingRoom') {
                const char = CHARACTERS[charIndex];
                this.updateRoomAvatar(this.waitHostAvatar, char);
                this.waitHostCharName.textContent = char.name;
            }
        };
        
        multiplayerClient.onGameStarted = (room) => {
            this.onlineRoom = room;
            this.startMultiplayerGame();
        };
        
        multiplayerClient.onRoomClosed = (reason) => {
            alert('房主已离开，房间已关闭');
            this.showScreen('lobby');
        };

        // Join room on server
        multiplayerClient.joinRoom(code, '玩家', this.selectedCharacterIndex);
    }

    onOpponentJoined(guest) {
        if (this.currentScreen !== 'createRoom') return;
        
        // Update guest card UI
        const char = CHARACTERS[guest.characterIndex] || CHARACTERS[0];
        
        this.updateRoomAvatar(this.guestAvatar, char);
        this.guestName.textContent = guest.name || '对手玩家';
        this.guestCharName.textContent = char.name;
        this.guestStatus.textContent = '已加入';
        this.guestStatus.classList.remove('waiting');
        this.guestStatus.classList.add('ready');
        this.guestCard.classList.add('joined');

        // Enable start button
        this.startMultiplayerBtn.classList.remove('disabled');
        this.startMultiplayerBtn.querySelector('.btn-hint').textContent = '点击开始';
    }

    updateCreateRoomUI() {
        // Reset guest to waiting state
        this.guestAvatar.style.backgroundImage = '';
        this.guestAvatar.classList.remove('has-image');
        this.guestAvatar.classList.add('waiting');
        this.guestAvatar.textContent = '⏳';
        this.guestName.textContent = '等待加入...';
        this.guestCharName.textContent = '-';
        this.guestStatus.textContent = '等待中';
        this.guestStatus.classList.add('waiting');
        this.guestStatus.classList.remove('ready');
        this.guestCard.classList.remove('joined');
        
        // Initialize host avatar with first selected character
        const selectedIndex = this.roomManager.selectedCharacterIndex || 0;
        const char = CHARACTERS[selectedIndex];
        this.updateRoomAvatar(this.hostAvatar, char);
        this.hostCharName.textContent = char.name;
        
        this.startMultiplayerBtn.classList.add('disabled');
        this.startMultiplayerBtn.querySelector('.btn-hint').textContent = '等待对手加入';
    }

    startMultiplayerGame() {
        // Use online room if available, otherwise fall back to local
        const room = this.onlineRoom || this.roomManager.currentRoom;
        const isHost = multiplayerClient.isConnected ? multiplayerClient.isHost : this.roomManager.isHost;
        
        // Set characters based on room selection
        let playerCharIndex, opponentCharIndex;
        
        if (isHost) {
            playerCharIndex = room?.host?.characterIndex || this.selectedCharacterIndex || 0;
            opponentCharIndex = room?.guest?.characterIndex || 0;
        } else {
            playerCharIndex = room?.guest?.characterIndex || this.selectedCharacterIndex || 0;
            opponentCharIndex = room?.host?.characterIndex || 0;
        }

        this.selectedCharacterIndex = playerCharIndex;
        this.selectCharacter(playerCharIndex);
        this.state.opponentCharacter = CHARACTERS[opponentCharIndex];
        this.state.gameMode = GAME_MODE.MULTIPLAYER;
        this.state.isHost = isHost;
        this.state.roomCode = multiplayerClient.roomCode || this.roomManager.roomCode;

        this.showScreen('game');
        this.startMatch();
    }

    renderCharacterGrid() {
        this.characterGrid.innerHTML = CHARACTERS.map((char, index) => `
            <div class="char-select-item" data-index="${index}" data-char="${char.id}">
                ${char.cardImage 
                    ? `<div class="char-select-avatar" data-char="${char.id}" style="background-image: url('${char.cardImage}')"></div>`
                    : `<span class="char-select-emoji">${char.emoji}</span>`
                }
                <span class="char-select-name">${char.name}</span>
            </div>
        `).join('');
    }

    selectCharacter(index) {
        this.selectedCharacterIndex = index;
        const char = CHARACTERS[index];
        this.state.playerCharacter = char;

        // Update UI - show card image if available
        const avatarContainer = document.getElementById('playerAvatar');
        if (char.cardImage && avatarContainer) {
            avatarContainer.setAttribute('data-char', char.id);
            avatarContainer.innerHTML = `<img src="${char.cardImage}" class="player-card-image" alt="${char.name}">`;
        } else if (avatarContainer) {
            avatarContainer.removeAttribute('data-char');
            avatarContainer.innerHTML = `<div class="avatar-placeholder"><span class="avatar-emoji">${char.emoji}</span></div>`;
        }
        
        this.playerName.textContent = char.name;
        this.playerTitle.textContent = char.title;
        this.playerRarity.textContent = char.rarity;
        this.offenseSkillName.textContent = char.offenseSkill.name;
        this.offenseSkillDesc.textContent = char.offenseSkill.desc;
        this.defenseSkillName.textContent = char.defenseSkill.name;
        this.defenseSkillDesc.textContent = char.defenseSkill.desc;
        // Update token avatar
        const playerTokenAvatar = document.getElementById('playerTokenAvatar');
        if (char.cardImage && playerTokenAvatar) {
            playerTokenAvatar.style.backgroundImage = `url('${char.cardImage}')`;
            playerTokenAvatar.classList.add('has-image');
            this.playerTokenEmoji.style.display = 'none';
        } else if (playerTokenAvatar) {
            playerTokenAvatar.style.backgroundImage = '';
            playerTokenAvatar.classList.remove('has-image');
            this.playerTokenEmoji.style.display = '';
            this.playerTokenEmoji.textContent = char.emoji;
        }

        // Update selection highlight
        document.querySelectorAll('.char-select-item').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });

        this.drawRadarChart();
    }

    bindGameEvents() {
        // Character selection
        this.characterGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.char-select-item');
            if (item && !this.state.isMatchActive) {
                this.selectCharacter(parseInt(item.dataset.index));
            }
        });

        // Find Match button (Start Game for single player)
        this.findMatchBtn.addEventListener('click', () => {
            if (!this.state.isMatchActive) {
                this.startMatch();
            }
        });

        // Back to Menu button
        this.backToMenuBtn.addEventListener('click', () => {
            if (!this.state.isMatchActive) {
                this.roomManager.leaveRoom();
                this.showScreen('mode');
            }
        });

        // Action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (this.state.isMatchActive && this.state.possession === 'player') {
                    this.executePlayerAction(action);
                }
            });
        });

        // Play Again button - always go back to pre-match screen
        this.playAgainBtn.addEventListener('click', () => {
            this.hideResultModal();
            // Reset to pre-match state (can choose character again)
            this.state.isMatchActive = false;
            this.hideMatchInfoPanel();
        });
    }

    drawRadarChart() {
        const ctx = this.radarCanvas.getContext('2d');
        const char = CHARACTERS[this.selectedCharacterIndex];
        const stats = char.stats;
        const centerX = 140;
        const centerY = 140;
        const radius = 100;

        // Clear canvas
        ctx.clearRect(0, 0, 280, 280);

        // Labels
        const labels = ['内线', '中投', '三分', '运球', '内防', '外防', '抢断', '盖帽'];
        const values = [
            stats.inside, stats.midRange, stats.threePoint, stats.handle,
            stats.interiorDef, stats.perimeterDef, stats.steal, stats.block
        ];

        // Draw background circles
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let j = 0; j <= 8; j++) {
                const angle = (Math.PI * 2 * j / 8) - Math.PI / 2;
                const x = centerX + Math.cos(angle) * (radius * i / 5);
                const y = centerY + Math.sin(angle) * (radius * i / 5);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Draw axes
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) - Math.PI / 2;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.stroke();
        }

        // Draw data polygon
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2;

        for (let i = 0; i <= 8; i++) {
            const index = i % 8;
            const angle = (Math.PI * 2 * index / 8) - Math.PI / 2;
            const value = values[index] / 100;
            const x = centerX + Math.cos(angle) * radius * value;
            const y = centerY + Math.sin(angle) * radius * value;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.fill();
        ctx.stroke();

        // Draw labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "Noto Sans SC"';
        ctx.textAlign = 'center';

        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (radius + 25);
            const y = centerY + Math.sin(angle) * (radius + 25);
            ctx.fillText(`${labels[i]} ${values[i]}`, x, y + 4);
        }
    }

    startMatch() {
        // For single player mode, select random opponent
        if (this.state.gameMode === GAME_MODE.SINGLE_PLAYER || !this.state.opponentCharacter) {
            let opponentIndex;
            do {
                opponentIndex = Math.floor(Math.random() * CHARACTERS.length);
            } while (opponentIndex === this.selectedCharacterIndex);

            this.state.opponentCharacter = CHARACTERS[opponentIndex];
        }

        // Update opponent token avatar
        const opponentTokenAvatar = document.getElementById('opponentTokenAvatar');
        if (this.state.opponentCharacter.cardImage && opponentTokenAvatar) {
            opponentTokenAvatar.style.backgroundImage = `url('${this.state.opponentCharacter.cardImage}')`;
            opponentTokenAvatar.classList.add('has-image');
            this.opponentTokenEmoji.style.display = 'none';
        } else if (opponentTokenAvatar) {
            opponentTokenAvatar.style.backgroundImage = '';
            opponentTokenAvatar.classList.remove('has-image');
            this.opponentTokenEmoji.style.display = '';
            this.opponentTokenEmoji.textContent = this.state.opponentCharacter.emoji;
        }

        // Reset game state
        this.state.reset();
        this.state.isMatchActive = true;

        // Update UI
        this.leftPanel.classList.add('locked');
        this.arenaOverlay.classList.add('hidden');
        this.updateScoreboard();
        this.clearLog();
        
        // Show match info panel with stats comparison
        this.showMatchInfoPanel();

        // Show game mode in log
        if (this.state.gameMode === GAME_MODE.MULTIPLAYER) {
            this.addLog(`[多人模式] 房间号: ${this.state.roomCode || 'N/A'}`);
        } else {
            this.addLog('[单机模式] VS AI 对手');
        }

        this.addLog(`🏀 比赛开始！`);
        this.addLog(`${this.state.playerCharacter.name} VS ${this.state.opponentCharacter.name}`);
        this.addLog(`${this.state.possession === 'player' ? '你' : '对手'}获得发球权`);

        // Reset positions
        this.resetPositions();

        // Start turn
        if (this.state.possession === 'player') {
            this.showActionBar();
        } else {
            this.executeOpponentTurn();
        }

        this.updatePityGlow();
    }

    showActionBar() {
        this.actionBar.classList.add('active');
        this.opponentTurnEl.classList.remove('active');
    }

    hideActionBar() {
        this.actionBar.classList.remove('active');
    }

    showOpponentTurn(action = null) {
        this.opponentTurnEl.classList.add('active');
        this.hideActionBar();
        
        // Show what action opponent chose
        const choiceEl = document.getElementById('opponentChoice');
        if (choiceEl) {
            if (action) {
                const actionNames = {
                    drive: '🔴 冲击篮下',
                    shoot: '🔵 寻找空位',
                    dribble: '🟣 运球晃人'
                };
                choiceEl.textContent = actionNames[action] || action;
                choiceEl.className = 'action-choice ' + action;
            } else {
                choiceEl.textContent = '思考中...';
                choiceEl.className = 'action-choice';
            }
        }
    }

    // Match info panel with stats comparison
    showMatchInfoPanel() {
        const panel = document.getElementById('matchInfoPanel');
        if (!panel) return;
        
        const player = this.state.playerCharacter;
        const opponent = this.state.opponentCharacter;
        
        // Update names
        document.getElementById('infoPlayerName').textContent = player.name;
        document.getElementById('infoOpponentName').textContent = opponent.name;
        
        // Update skills
        document.getElementById('infoPlayerOffense').textContent = player.offenseSkill.name;
        document.getElementById('infoPlayerDefense').textContent = player.defenseSkill.name;
        document.getElementById('infoOpponentOffense').textContent = opponent.offenseSkill.name;
        document.getElementById('infoOpponentDefense').textContent = opponent.defenseSkill.name;
        
        // Draw overlapping radar chart
        this.drawMatchRadarChart(player, opponent);
        
        panel.classList.add('show');
    }

    drawMatchRadarChart(player, opponent) {
        const canvas = document.getElementById('matchRadarCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = 70;
        const centerY = 70;
        const radius = 55;
        
        // Clear canvas
        ctx.clearRect(0, 0, 140, 140);
        
        // 6 dimensions for comparison
        const labels = ['内线', '中投', '三分', '运球', '内防', '外防'];
        const playerValues = [
            player.stats.inside,
            player.stats.midRange,
            player.stats.threePoint,
            player.stats.handle,
            player.stats.interiorDef,
            player.stats.perimeterDef
        ];
        const opponentValues = [
            opponent.stats.inside,
            opponent.stats.midRange,
            opponent.stats.threePoint,
            opponent.stats.handle,
            opponent.stats.interiorDef,
            opponent.stats.perimeterDef
        ];
        
        // Draw background circles
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let j = 0; j <= 6; j++) {
                const angle = (Math.PI * 2 * j / 6) - Math.PI / 2;
                const x = centerX + Math.cos(angle) * (radius * i / 5);
                const y = centerY + Math.sin(angle) * (radius * i / 5);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Draw axes and labels
        ctx.font = '8px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i / 6) - Math.PI / 2;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            ctx.stroke();
            
            // Labels
            const labelRadius = radius + 10;
            const lx = centerX + Math.cos(angle) * labelRadius;
            const ly = centerY + Math.sin(angle) * labelRadius;
            ctx.fillText(labels[i], lx, ly);
        }
        
        // Draw player polygon (blue)
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i / 6) - Math.PI / 2;
            const value = playerValues[i] / 100;
            const x = centerX + Math.cos(angle) * radius * value;
            const y = centerY + Math.sin(angle) * radius * value;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw opponent polygon (red)
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 71, 87, 0.25)';
        ctx.strokeStyle = 'rgba(255, 71, 87, 0.8)';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i / 6) - Math.PI / 2;
            const value = opponentValues[i] / 100;
            const x = centerX + Math.cos(angle) * radius * value;
            const y = centerY + Math.sin(angle) * radius * value;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    hideMatchInfoPanel() {
        const panel = document.getElementById('matchInfoPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    }

    updateScoreboard() {
        this.playerScoreEl.textContent = this.state.playerScore;
        this.opponentScoreEl.textContent = this.state.opponentScore;
        this.roundNumber.textContent = `ROUND ${this.state.round}`;
        this.winStreakEl.textContent = this.state.winStreak;
    }

    addLog(message, type = '') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        this.gameLog.appendChild(entry);
        this.gameLog.scrollTop = this.gameLog.scrollHeight;
    }

    clearLog() {
        this.gameLog.innerHTML = '';
    }

    showSkillEffect(text, colorType = 'gold') {
        // Use the full-screen highlight for skills with color variation
        // colorType can be: gold, red, blue, purple, green, fire
        this.showHighlight('skill skill-' + colorType, text, '技能发动!');
    }

    // Check if skill should trigger (30% base, pity at 9 points)
    shouldTriggerSkill(isOffense, isPlayer) {
        const score = isPlayer ? this.state.playerScore : this.state.opponentScore;
        const triggered = isPlayer 
            ? (isOffense ? this.state.playerOffenseSkillTriggered : this.state.playerDefenseSkillTriggered)
            : (isOffense ? this.state.opponentOffenseSkillTriggered : this.state.opponentDefenseSkillTriggered);

        // Pity system: if at 9 points and haven't triggered skill yet
        if (score >= 9 && !triggered) {
            return true;
        }

        // Normal 30% chance
        return Math.random() < 0.3;
    }

    markSkillTriggered(isOffense, isPlayer) {
        if (isPlayer) {
            if (isOffense) this.state.playerOffenseSkillTriggered = true;
            else this.state.playerDefenseSkillTriggered = true;
        } else {
            if (isOffense) this.state.opponentOffenseSkillTriggered = true;
            else this.state.opponentDefenseSkillTriggered = true;
        }
    }

    updatePityGlow() {
        const buttons = document.querySelectorAll('.action-btn');
        const nearPity = this.state.playerScore >= 9 && !this.state.playerOffenseSkillTriggered;
        
        buttons.forEach(btn => {
            btn.classList.toggle('pity-glow', nearPity);
        });
    }

    // Calculate success chance based on stats
    calculateSuccess(attackStat, defenseStat, bonus = 0) {
        // Base formula: 50% + (attack - defense) / 2
        // Max 95%, Min 5%
        let chance = 50 + (attackStat - defenseStat) / 2 + bonus;
        return Math.max(5, Math.min(95, chance));
    }

    async executePlayerAction(action) {
        this.hideActionBar();
        
        try {
            const player = this.state.playerCharacter;
            const opponent = this.state.opponentCharacter;

            let success = false;
            let points = 0;
            let skillEffect = null;

            // Check for offense skill trigger
            if (this.shouldTriggerSkill(true, true)) {
                this.markSkillTriggered(true, true);
                try {
                    skillEffect = player.offenseSkill.effect(this);
                } catch (e) {
                    console.error('Player skill effect error:', e);
                    skillEffect = {};
                }
                this.showSkillEffect(player.offenseSkill.name, 'blue');
                await this.delay(1000);
            }

        // Check for next guarantee hit (from Bruce Lee skill)
            if (this.state.nextGuaranteeHit) {
                skillEffect = { ...skillEffect, guaranteeScore: true };
                this.state.nextGuaranteeHit = false;
            }

            switch (action) {
                case 'drive':
                    this.addLog(`🏀 ${player.name} 持球突破！杀向篮下！`);
                    await this.animateDrive(true);

                    let insideStat = player.stats.inside;
                    let defStat = opponent.stats.interiorDef;

                    if (skillEffect?.insideBonus) insideStat += skillEffect.insideBonus;
                    if (skillEffect?.guaranteeScore) {
                        success = true;
                        points = 2;
                        this.addLog(`💥 ${player.name} 势不可挡！强行得分！`, 'score');
                        this.showCourtEvent('dunk', 'UNSTOPPABLE!');
                    } else {
                        // Show stat showdown
                        const result = await this.showStatShowdown({
                            title: '🏀 突破对决',
                            playerName: player.name,
                            playerStat: insideStat,
                            playerLabel: '内线进攻',
                            playerImage: player.cardImage,
                            opponentName: opponent.name,
                            opponentStat: defStat,
                            opponentLabel: '内线防守',
                            opponentImage: opponent.cardImage,
                            isPlayerAttacking: true
                        });
                        success = result.success;

                        if (success) {
                            points = 2;
                            const driveComments = [
                                `💥 暴力灌篮！${player.name} 隔扣得手！`,
                                `🔥 ${player.name} 力压防守，强行打进！`,
                                `⚡ 势不可挡！${player.name} 攻入禁区得分！`
                            ];
                            this.addLog(driveComments[Math.floor(Math.random() * driveComments.length)], 'score');
                            this.showCourtEvent('dunk', 'SLAM DUNK!');
                        } else if (skillEffect?.foulChance && Math.random() * 100 < skillEffect.foulChance) {
                            this.addLog('⚠️ 造成犯规！重新进攻！', 'skill');
                            await this.delay(1000);
                            this.resetPositions();
                            this.showActionBar();
                            return;
                        } else {
                            this.addLog(`❌ ${player.name} 上篮不中！球滑出篮筐！`, 'miss');
                        }
                    }
                    break;

                case 'shoot':
                    const isThree = player.stats.threePoint > player.stats.midRange || skillEffect?.forceThree;
                    points = isThree ? 3 : 2;
                    const shootStat = isThree ? player.stats.threePoint : player.stats.midRange;

                    if (isThree) {
                        this.addLog(`🎯 ${player.name} 拉开空间，瞄准三分线外！`);
                    } else {
                        this.addLog(`🏀 ${player.name} 急停跳投，中距离出手！`);
                    }
                    await this.animateShoot(true, isThree);

                    let shootBonus = skillEffect?.shootBonus || 0;
                    let defPenalty = 0;
                    if (skillEffect?.ignoreContest) defPenalty = opponent.stats.perimeterDef;
                    const finalShootStat = shootStat + shootBonus;
                    const finalDefStat = Math.max(0, opponent.stats.perimeterDef - defPenalty);

                    if (skillEffect?.guaranteeScore) {
                        success = true;
                        this.addLog(`🎯 ${player.name} 神准出手！必进！`, 'score');
                    } else {
                        // Show stat showdown
                        const result = await this.showStatShowdown({
                            title: isThree ? '🎯 三分对决' : '🏀 中投对决',
                            playerName: player.name,
                            playerStat: finalShootStat,
                            playerLabel: isThree ? '三分球' : '中投',
                            playerImage: player.cardImage,
                            opponentName: opponent.name,
                            opponentStat: finalDefStat,
                            opponentLabel: '外线防守',
                            opponentImage: opponent.cardImage,
                            isPlayerAttacking: true
                        });
                        success = result.success;
                    }

                    if (success) {
                        if (isThree) {
                            const threeComments = [
                                `💦 手起刀落！三分球空心入网！`,
                                `🔥 BANG! ${player.name} 三分命中！`,
                                `🎯 ${player.name} 精准制导！`
                            ];
                            this.addLog(threeComments[Math.floor(Math.random() * threeComments.length)], 'score');
                            this.showCourtEvent('three', 'THREEEE!');
                        } else {
                            this.addLog(`✅ 中投稳健！${player.name} 得分！`, 'score');
                        }
                    } else {
                        this.addLog(`❌ 投篮偏出！${player.name} 手感不佳！`, 'miss');
                    }
                    break;

                case 'dribble':
                    this.addLog(`🏀 ${player.name} 单打！连续变向运球！`);
                    await this.animateDribble(true);

                    let handleStat = player.stats.handle;
                    let stealStat = opponent.stats.steal;

                    if (skillEffect?.guaranteeScore) {
                        success = true;
                        this.addLog(`⚡ ${player.name} 无人能挡！`, 'score');
                    } else {
                        // Show stat showdown
                        const result = await this.showStatShowdown({
                            title: '🎭 运球对决',
                            playerName: player.name,
                            playerStat: handleStat,
                            playerLabel: '运球',
                            playerImage: player.cardImage,
                            opponentName: opponent.name,
                            opponentStat: stealStat,
                            opponentLabel: '抢断',
                            opponentImage: opponent.cardImage,
                            isPlayerAttacking: true
                        });
                        success = result.success;
                    }

                    if (success) {
                        points = 2;
                        const dribbleComments = [
                            `🔥 脚踝终结者！${player.name} 晃飞对手！`,
                            `⚡ Crossover！${player.name} 过人如麻！`,
                            `💥 ${player.name} 运球戏耍防守！`
                        ];
                        this.addLog(dribbleComments[Math.floor(Math.random() * dribbleComments.length)], 'score');
                        this.showCourtEvent('dunk', 'ANKLE BREAKER!');
                        
                        if (skillEffect?.nextGuarantee) {
                            this.state.nextGuaranteeHit = true;
                            this.addLog('⚡ 进入无双状态！下次进攻必定命中！', 'skill');
                        }
                    } else {
                        this.addLog(`🔥 ${opponent.name} 眼疾手快！抢断成功！`, 'miss');
                        this.showCourtEvent('steal', 'STOLEN!');
                    }
                    break;
            }

            await this.delay(500);
            this.processResult(success, points, true);
        } catch (error) {
            console.error('Player action error:', error);
            // Recover by giving ball to opponent
            this.state.possession = 'opponent';
            this.resetPositions();
            this.executeOpponentTurn();
        }
    }

    async executeOpponentTurn() {
        try {
            // Show thinking state first
            this.showOpponentTurn(null);
            await this.delay(800);

            const opponent = this.state.opponentCharacter;
            const player = this.state.playerCharacter;

            // AI chooses action based on stats
            const actions = ['drive', 'shoot', 'dribble'];
            const weights = [
                opponent.stats.inside,
                (opponent.stats.midRange + opponent.stats.threePoint) / 2,
                opponent.stats.handle
            ];
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let rand = Math.random() * totalWeight;
            let action = 'drive';
            
            for (let i = 0; i < actions.length; i++) {
                rand -= weights[i];
                if (rand <= 0) {
                    action = actions[i];
                    break;
                }
            }

            // Show chosen action
            this.showOpponentTurn(action);
            await this.delay(700);

            let success = false;
            let points = 0;
            let skillEffect = null;

            // Check for opponent offense skill
            if (this.shouldTriggerSkill(true, false)) {
                this.markSkillTriggered(true, false);
                try {
                    skillEffect = opponent.offenseSkill.effect(this);
                } catch (e) {
                    console.error('Skill effect error:', e);
                    skillEffect = {};
                }
                this.showSkillEffect(opponent.offenseSkill.name, 'fire');
                await this.delay(1000);
            }

        // Check for player defense skill
            let defenseEffect = null;
            if (this.shouldTriggerSkill(false, true)) {
                this.markSkillTriggered(false, true);
                try {
                    defenseEffect = player.defenseSkill.effect(this);
                } catch (e) {
                    console.error('Defense skill error:', e);
                    defenseEffect = {};
                }
                this.showSkillEffect(player.defenseSkill.name, 'green');
                await this.delay(1000);
            }

            switch (action) {
                case 'drive':
                    this.addLog(`🏀 ${opponent.name} 强行突破！冲击禁区！`);
                    await this.animateDrive(false);

                    let insideStat = opponent.stats.inside;
                    let defStat = player.stats.interiorDef;

                    if (defenseEffect?.convert) {
                        defStat += insideStat * defenseEffect.convert / 100;
                    }

                    if (skillEffect?.guaranteeScore) {
                        success = true;
                    } else {
                        const blockStat = player.stats.block + (defenseEffect?.blockBonus || 0);
                        const blockChance = this.calculateSuccess(blockStat, insideStat / 2);
                        
                        if (Math.random() * 100 < blockChance && !skillEffect?.unblockable) {
                            const blockComments = [
                                `🚫 ${player.name} 霸气封盖！把球扇飞！`,
                                `💪 ${player.name} 护框成功！大帽伺候！`,
                                `🔒 ${player.name} 挡在门前！不许进！`
                            ];
                            this.addLog(blockComments[Math.floor(Math.random() * blockComments.length)], 'score');
                            this.showCourtEvent('block', 'BLOOOOCK!');
                            success = false;
                        } else {
                            success = Math.random() * 100 < this.calculateSuccess(insideStat, defStat);
                        }
                    }

                    if (success) {
                        points = 2;
                        this.addLog(`💥 ${opponent.name} 杀进内线得分！难以阻挡！`, 'miss');
                    } else if (success === false && !this.state.playerDefenseSkillTriggered) {
                        this.addLog(`❌ ${opponent.name} 上篮不中！`, 'score');
                    }
                    break;

                case 'shoot':
                    const isThreeOpp = skillEffect?.forceThree || opponent.stats.threePoint > opponent.stats.midRange;
                    points = isThreeOpp ? 3 : 2;
                    const shootStat = isThreeOpp ? opponent.stats.threePoint : opponent.stats.midRange;

                    if (isThreeOpp) {
                        this.addLog(`🎯 ${opponent.name} 拉到三分线外出手！`);
                    } else {
                        this.addLog(`🏀 ${opponent.name} 中距离跳投！`);
                    }
                    await this.animateShoot(false, isThreeOpp);

                    let shootBonus = skillEffect?.shootBonus || 0;
                    let perimDef = player.stats.perimeterDef + (defenseEffect?.threePointDefBonus || 0);

                    if (defenseEffect?.halfShootingChance) {
                        shootBonus -= 50;
                    }

                    success = skillEffect?.guaranteeScore || 
                        Math.random() * 100 < this.calculateSuccess(shootStat + shootBonus, perimDef);

                    if (success) {
                        if (isThreeOpp) {
                            this.addLog(`💦 ${opponent.name} 三分球进了！`, 'miss');
                            this.showCourtEvent('three', 'THREEEE!');
                        } else {
                            this.addLog(`✅ ${opponent.name} 跳投命中！`, 'miss');
                        }
                    } else {
                        this.addLog(`🧱 ${opponent.name} 打铁！你防守成功！`, 'score');
                    }
                    break;

                case 'dribble':
                    this.addLog(`🏀 ${opponent.name} 试图单打过人！`);
                    await this.animateDribble(false);

                    let handleStat = opponent.stats.handle;
                    let stealStat = player.stats.steal + (defenseEffect?.stealBonus || 0);

                    if (defenseEffect?.doubleStealCheck) {
                        const stealChance = this.calculateSuccess(stealStat, handleStat);
                        if (Math.random() * 100 < stealChance || Math.random() * 100 < stealChance) {
                            success = false;
                        } else {
                            success = true;
                        }
                    } else if (defenseEffect?.instantSteal) {
                        if (Math.random() * 100 < defenseEffect.instantSteal) {
                            success = false;
                            this.addLog(`⚡ ${player.name} 闪电断球！`, 'score');
                            this.showCourtEvent('steal', 'PICKPOCKET!');
                        }
                    } else if (skillEffect?.guaranteeScore) {
                        success = true;
                    } else {
                        success = Math.random() * 100 < this.calculateSuccess(handleStat, stealStat);
                    }

                    if (success) {
                        points = 2;
                        this.addLog(`🔥 ${opponent.name} 过人成功！轻松得分！`, 'miss');
                    } else if (!defenseEffect?.instantSteal || Math.random() > 0.5) {
                        const stealComments = [
                            `🔥 ${player.name} 抢断成功！漂亮的防守！`,
                            `💨 ${player.name} 读懂了运球！直接断球！`,
                            `🛡️ ${player.name} 防守到位！成功抢断！`
                        ];
                        this.addLog(stealComments[Math.floor(Math.random() * stealComments.length)], 'score');
                        this.showCourtEvent('steal', 'STOLEN!');
                    }
                    break;
            }

            await this.delay(500);
            this.processResult(success, points, false);
        } catch (error) {
            console.error('Opponent turn error:', error);
            // Recover by giving ball to player
            this.state.possession = 'player';
            this.resetPositions();
            this.showActionBar();
        }
    }

    processResult(success, points, isPlayer) {
        if (success) {
            // Show score popup
            if (isPlayer) {
                this.state.playerScore += points;
                this.state.consecutiveScores++;
                this.showScorePopup(true, points);
            } else {
                this.state.opponentScore += points;
                this.state.consecutiveScores++;
                this.showScorePopup(true, points);
            }

            // Check for win
            if (this.state.playerScore >= 11) {
                this.endMatch(true);
                return;
            }
            if (this.state.opponentScore >= 11) {
                this.endMatch(false);
                return;
            }

            // Make-it-take-it rule (max 2 consecutive)
            if (this.state.consecutiveScores >= 2) {
                this.addLog('连续得分限制！强制换发球权');
                this.state.possession = isPlayer ? 'opponent' : 'player';
                this.state.consecutiveScores = 0;
            }
            // Otherwise scorer keeps ball
        } else {
            // Turnover - switch possession
            this.state.possession = isPlayer ? 'opponent' : 'player';
            this.state.consecutiveScores = 0;
        }

        this.state.round++;
        this.updateScoreboard();
        this.resetPositions();
        this.updatePityGlow();

        // Next turn
        setTimeout(() => {
            if (this.state.possession === 'player') {
                this.showActionBar();
            } else {
                this.executeOpponentTurn();
            }
        }, 1000);
    }

    endMatch(playerWon) {
        this.state.isMatchActive = false;
        this.hideActionBar();
        this.opponentTurnEl.classList.remove('active');

        if (playerWon) {
            this.state.winStreak++;
            this.resultModal.classList.add('victory');
            this.resultModal.classList.remove('defeat');
            this.resultTitle.textContent = 'VICTORY!';
        } else {
            this.state.winStreak = 0;
            this.resultModal.classList.add('defeat');
            this.resultModal.classList.remove('victory');
            this.resultTitle.textContent = 'DEFEAT';
        }

        this.resultScore.textContent = `${this.state.playerScore} - ${this.state.opponentScore}`;
        this.resultMvp.textContent = `MVP: ${playerWon ? this.state.playerCharacter.name : this.state.opponentCharacter.name}`;
        
        this.updateScoreboard();
        this.showResultModal();
    }

    showResultModal() {
        this.resultModal.classList.add('show');
    }

    hideResultModal() {
        this.resultModal.classList.remove('show');
        this.leftPanel.classList.remove('locked');
        this.arenaOverlay.classList.remove('hidden');
        this.hideMatchInfoPanel();
        this.hideActionBar();
        this.opponentTurnEl.classList.remove('active');
    }

    // ========== ANIMATION SYSTEM ==========
    
    // Court positions - realistic basketball court layout
    getCourtPositions() {
        return {
            // Starting positions - face off at top of key
            playerStart: { x: 150, y: 130 },
            opponentStart: { x: 250, y: 130 },
            
            // Basket position
            basket: { x: 200, y: 310 },
            
            // Paint/inside positions (close to basket) - for drives/dunks
            insideLeft: { x: 160, y: 280 },
            insideRight: { x: 240, y: 280 },
            insideCenter: { x: 200, y: 285 },
            
            // Mid-range positions (between paint and 3pt line, inside the arc)
            midLeft: { x: 100, y: 200 },
            midRight: { x: 300, y: 200 },
            midElbowLeft: { x: 140, y: 230 },
            midElbowRight: { x: 260, y: 230 },
            midFreeThrow: { x: 200, y: 210 },
            
            // Three point positions (OUTSIDE the arc - pushed back)
            threeCornerLeft: { x: 45, y: 240 },
            threeCornerRight: { x: 355, y: 240 },
            threeTop: { x: 200, y: 80 },
            threeWingLeft: { x: 70, y: 150 },
            threeWingRight: { x: 330, y: 150 },
            
            // Defense positions
            defenseClose: { x: 200, y: 160 },
            defenseLeft: { x: 170, y: 150 },
            defenseRight: { x: 230, y: 150 }
        };
    }

    // Animate element to position using SVG transforms
    async animateElement(element, fromX, fromY, toX, toY, duration, easing = 'ease-out') {
        if (!element) return Promise.resolve();
        
        const startTime = performance.now();
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;

        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function
                let easedProgress;
                switch(easing) {
                    case 'ease-out':
                        easedProgress = 1 - Math.pow(1 - progress, 3);
                        break;
                    case 'ease-in-out':
                        easedProgress = progress < 0.5 
                            ? 4 * progress * progress * progress 
                            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                        break;
                    case 'bounce':
                        if (progress < 0.5) {
                            easedProgress = 4 * progress * progress * progress;
                        } else {
                            easedProgress = 1 - Math.pow(-2 * progress + 2, 3) / 2;
                        }
                        break;
                    default:
                        easedProgress = progress;
                }

                const currentX = fromX + deltaX * easedProgress;
                const currentY = fromY + deltaY * easedProgress;

                // Update all child elements with cx/cy attributes
                element.querySelectorAll('circle').forEach(circle => {
                    const baseX = parseFloat(circle.getAttribute('data-base-x') || circle.getAttribute('cx'));
                    const baseY = parseFloat(circle.getAttribute('data-base-y') || circle.getAttribute('cy'));
                    if (!circle.getAttribute('data-base-x')) {
                        circle.setAttribute('data-base-x', baseX);
                        circle.setAttribute('data-base-y', baseY);
                    }
                });
                
                element.setAttribute('transform', `translate(${currentX - parseFloat(element.dataset.x || 0)}, ${currentY - parseFloat(element.dataset.y || 0)})`);
                element.dataset.currentX = currentX;
                element.dataset.currentY = currentY;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    // Update ball position to follow a token
    updateBallPosition(x, y, offsetX = 0, offsetY = -15) {
        const ballGroup = document.getElementById('ballGroup');
        
        if (ballGroup) {
            // Ball base position is 150, 115
            const baseX = 150;
            const baseY = 115;
            ballGroup.setAttribute('transform', `translate(${x - baseX + offsetX}, ${y - baseY + offsetY})`);
        }
    }

    // Animate ball flying to basket
    async animateBallToBasket(startX, startY, success) {
        const ballGroup = document.getElementById('ballGroup');
        if (!ballGroup) return;
        
        const positions = this.getCourtPositions();
        const basket = positions.basket;
        
        const duration = 600;
        const startTime = performance.now();
        const arcHeight = -80; // Ball arcs up before coming down
        const self = this; // Preserve reference

        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Parabolic arc
                const x = startX + (basket.x - startX) * progress;
                const linearY = startY + (basket.y - startY) * progress;
                const arcOffset = arcHeight * Math.sin(progress * Math.PI);
                const y = linearY + arcOffset;

                ballGroup.setAttribute('transform', `translate(${x - 120}, ${y - 105})`);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    // Score popup (simple +2/+3 display)
    showScorePopup(isScore, points = 2) {
        // Use court event for scoring display
        if (isScore) {
            this.showCourtEvent('score', `+${points}`);
        }
    }

    // Court event popup (stays on court, for game events)
    showCourtEvent(type, text) {
        const eventEl = document.getElementById('courtEvent');
        const textEl = document.getElementById('courtEventText');
        
        if (!eventEl || !textEl) return;
        
        // Remove all type classes
        eventEl.classList.remove('show', 'score', 'dunk', 'three', 'block', 'steal');
        
        // Set content
        textEl.textContent = text;
        
        // Add type class
        eventEl.classList.add(type);
        
        // Trigger reflow
        void eventEl.offsetWidth;
        
        // Show
        eventEl.classList.add('show');
        
        // Auto hide
        setTimeout(() => {
            eventEl.classList.remove('show');
        }, 1800);
    }

    // Stat Showdown - dramatic stat comparison
    async showStatShowdown(config) {
        const {
            title,
            playerName,
            playerStat,
            playerLabel,
            playerImage,
            opponentName,
            opponentStat,
            opponentLabel,
            opponentImage,
            isPlayerAttacking = true
        } = config;

        const overlay = document.getElementById('statShowdown');
        if (!overlay) return { success: false, roll: 0 };

        // Set content
        document.getElementById('showdownTitle').textContent = title;
        document.getElementById('showdownPlayerName').textContent = playerName;
        document.getElementById('showdownPlayerLabel').textContent = playerLabel;
        document.getElementById('showdownPlayerValue').textContent = '0';
        document.getElementById('showdownOpponentName').textContent = opponentName;
        document.getElementById('showdownOpponentLabel').textContent = opponentLabel;
        document.getElementById('showdownOpponentValue').textContent = '0';

        // Set avatars
        const playerAvatar = document.getElementById('showdownPlayerAvatar');
        const opponentAvatar = document.getElementById('showdownOpponentAvatar');
        if (playerImage) playerAvatar.style.backgroundImage = `url('${playerImage}')`;
        if (opponentImage) opponentAvatar.style.backgroundImage = `url('${opponentImage}')`;

        // Reset bars
        document.getElementById('showdownPlayerBar').style.width = '0%';
        document.getElementById('showdownOpponentBar').style.width = '0%';

        // Hide result
        const resultEl = document.getElementById('showdownResult');
        resultEl.classList.remove('show');

        // Show overlay
        overlay.classList.add('show');

        // Animate numbers counting up
        await this.delay(800);
        await this.animateNumber('showdownPlayerValue', 0, playerStat, 600);
        await this.animateNumber('showdownOpponentValue', 0, opponentStat, 600);

        // Animate bars
        document.getElementById('showdownPlayerBar').style.width = `${playerStat}%`;
        document.getElementById('showdownOpponentBar').style.width = `${opponentStat}%`;

        await this.delay(500);

        // Calculate result with dramatic dice roll
        const successChance = this.calculateSuccess(playerStat, opponentStat);
        const roll = Math.random() * 100;
        const success = roll < successChance;

        // Show dice rolling
        const diceEl = document.getElementById('showdownDice');
        for (let i = 0; i < 8; i++) {
            diceEl.textContent = ['🎲', '🎯', '⚡', '🔥', '💫', '✨'][Math.floor(Math.random() * 6)];
            await this.delay(100);
        }
        diceEl.textContent = success ? '✅' : '❌';

        await this.delay(300);

        // Show result
        const resultText = document.getElementById('showdownResultText');
        if (isPlayerAttacking) {
            resultText.textContent = success ? '成功!' : '失败!';
        } else {
            resultText.textContent = success ? '得分!' : '防守成功!';
        }
        resultText.className = 'result-text ' + (success ? 'success' : 'fail');
        resultEl.classList.add('show');

        await this.delay(1200);

        // Hide overlay
        overlay.classList.remove('show');

        return { success, roll };
    }

    // Animate number counting
    async animateNumber(elementId, from, to, duration) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const startTime = performance.now();
        const diff = to - from;

        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(from + diff * eased);
                el.textContent = current;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    // Full screen highlight effect (for SKILLS ONLY)
    showHighlight(type, text, subText = '') {
        const overlay = document.getElementById('highlightOverlay');
        const textEl = document.getElementById('highlightText');
        const subEl = document.getElementById('highlightSub');
        
        if (!overlay) return;
        
        // Remove all type classes
        overlay.classList.remove('show', 'dunk', 'three', 'block', 'steal', 'skill', 
            'skill-gold', 'skill-red', 'skill-blue', 'skill-purple', 'skill-green', 'skill-fire');
        
        // Set content
        textEl.textContent = text;
        subEl.textContent = subText;
        
        // Add type classes (can be space-separated)
        type.split(' ').forEach(cls => {
            if (cls) overlay.classList.add(cls);
        });
        
        // Trigger reflow
        void overlay.offsetWidth;
        
        // Show
        overlay.classList.add('show');
        
        // Auto hide
        setTimeout(() => {
            overlay.classList.remove('show');
        }, 1500);
    }

    // Drive animation - attacker drives to basket, defender tries to guard
    async animateDrive(isPlayer) {
        const attacker = isPlayer ? this.playerToken : this.opponentToken;
        const defender = isPlayer ? this.opponentToken : this.playerToken;
        const positions = this.getCourtPositions();
        
        const attackStart = isPlayer ? positions.playerStart : positions.opponentStart;
        const defenseStart = isPlayer ? positions.opponentStart : positions.playerStart;
        
        // Get current positions
        const attackX = parseFloat(attacker.dataset.currentX) || attackStart.x;
        const attackY = parseFloat(attacker.dataset.currentY) || attackStart.y;
        const defenseX = parseFloat(defender.dataset.currentX) || defenseStart.x;
        const defenseY = parseFloat(defender.dataset.currentY) || defenseStart.y;

        // Defender moves to guard position
        const guardPos = { x: 200, y: 150 };
        this.animateElement(defender, defenseX, defenseY, guardPos.x, guardPos.y, 300, 'ease-out');
        await this.delay(100);

        // Phase 1: Attacker makes a jab step
        const jabPos = { x: attackX + (isPlayer ? 25 : -25), y: attackY + 15 };
        await this.animateElement(attacker, attackX, attackY, jabPos.x, jabPos.y, 200, 'ease-out');
        this.updateBallPosition(jabPos.x, jabPos.y);
        
        // Defender reacts
        const reactPos = { x: guardPos.x + (isPlayer ? 15 : -15), y: guardPos.y + 20 };
        this.animateElement(defender, guardPos.x, guardPos.y, reactPos.x, reactPos.y, 200, 'ease-out');

        // Phase 2: Blow by! Drive to basket
        const drivePos = isPlayer ? positions.insideLeft : positions.insideRight;
        await this.animateElement(attacker, jabPos.x, jabPos.y, drivePos.x, drivePos.y, 400, 'ease-in-out');
        this.updateBallPosition(drivePos.x, drivePos.y);

        // Defender chases
        const chasePos = { x: 200, y: 230 };
        this.animateElement(defender, reactPos.x, reactPos.y, chasePos.x, chasePos.y, 350, 'ease-out');

        await this.delay(150);
    }

    // Shoot animation - shooter finds space, defender contests
    async animateShoot(isPlayer, isThreePointer = false) {
        const attacker = isPlayer ? this.playerToken : this.opponentToken;
        const defender = isPlayer ? this.opponentToken : this.playerToken;
        const positions = this.getCourtPositions();
        
        const attackStart = isPlayer ? positions.playerStart : positions.opponentStart;
        const defenseStart = isPlayer ? positions.opponentStart : positions.playerStart;
        
        const attackX = parseFloat(attacker.dataset.currentX) || attackStart.x;
        const attackY = parseFloat(attacker.dataset.currentY) || attackStart.y;
        const defenseX = parseFloat(defender.dataset.currentX) || defenseStart.x;
        const defenseY = parseFloat(defender.dataset.currentY) || defenseStart.y;

        // Determine shot location based on shot type
        let shootPos;
        if (isThreePointer) {
            // Three pointer - outside the arc
            shootPos = isPlayer ? positions.threeWingLeft : positions.threeWingRight;
        } else {
            // Mid-range - between paint and 3pt line
            shootPos = isPlayer ? positions.midElbowLeft : positions.midElbowRight;
        }

        // Phase 1: Attacker moves to shooting spot
        await this.animateElement(attacker, attackX, attackY, shootPos.x, shootPos.y, 350, 'ease-out');
        this.updateBallPosition(shootPos.x, shootPos.y);

        // Defender closes out
        const closeoutPos = { x: shootPos.x + (isPlayer ? 30 : -30), y: shootPos.y + 20 };
        this.animateElement(defender, defenseX, defenseY, closeoutPos.x, closeoutPos.y, 400, 'ease-out');

        // Phase 2: Set feet and elevate (small hop back)
        const elevatePos = { x: shootPos.x + (isPlayer ? -10 : 10), y: shootPos.y - 8 };
        await this.animateElement(attacker, shootPos.x, shootPos.y, elevatePos.x, elevatePos.y, 200, 'ease-out');
        this.updateBallPosition(elevatePos.x, elevatePos.y, 0, -30); // Ball raised up

        await this.delay(100);

        // Phase 3: Ball flies to basket in an arc
        await this.animateBallToBasket(elevatePos.x, elevatePos.y - 30, false);
    }

    // Dribble/Iso animation - crossovers to beat defender
    async animateDribble(isPlayer) {
        const attacker = isPlayer ? this.playerToken : this.opponentToken;
        const defender = isPlayer ? this.opponentToken : this.playerToken;
        const positions = this.getCourtPositions();
        
        const attackStart = isPlayer ? positions.playerStart : positions.opponentStart;
        const defenseStart = isPlayer ? positions.opponentStart : positions.playerStart;
        
        const attackX = parseFloat(attacker.dataset.currentX) || attackStart.x;
        const attackY = parseFloat(attacker.dataset.currentY) || attackStart.y;
        const defenseX = parseFloat(defender.dataset.currentX) || defenseStart.x;
        const defenseY = parseFloat(defender.dataset.currentY) || defenseStart.y;

        // Defender gets in stance close to attacker
        const guardPos = { x: attackX + (isPlayer ? 35 : -35), y: attackY + 20 };
        await Promise.all([
            this.animateElement(defender, defenseX, defenseY, guardPos.x, guardPos.y, 250, 'ease-out'),
            this.delay(100)
        ]);

        // Crossover sequence - rapid side to side
        const cross1 = { x: attackX + (isPlayer ? 40 : -40), y: attackY + 10 };
        await this.animateElement(attacker, attackX, attackY, cross1.x, cross1.y, 120, 'ease-out');
        this.updateBallPosition(cross1.x, cross1.y);
        
        // Defender bites
        const defReact1 = { x: guardPos.x + (isPlayer ? 20 : -20), y: guardPos.y };
        this.animateElement(defender, guardPos.x, guardPos.y, defReact1.x, defReact1.y, 150, 'ease-out');

        // Cross back!
        const cross2 = { x: attackX - (isPlayer ? 30 : -30), y: attackY + 25 };
        await this.animateElement(attacker, cross1.x, cross1.y, cross2.x, cross2.y, 130, 'ease-in-out');
        this.updateBallPosition(cross2.x, cross2.y);

        // Behind the back
        const cross3 = { x: attackX + (isPlayer ? 20 : -20), y: attackY + 40 };
        await this.animateElement(attacker, cross2.x, cross2.y, cross3.x, cross3.y, 140, 'ease-in-out');
        this.updateBallPosition(cross3.x, cross3.y);

        // Defender stumbles trying to recover
        const defStumble = { x: defReact1.x - (isPlayer ? 40 : -40), y: defReact1.y + 15 };
        this.animateElement(defender, defReact1.x, defReact1.y, defStumble.x, defStumble.y, 200, 'ease-out');

        await this.delay(100);
    }

    resetPositions() {
        // Positions for 1v1 face-off: attacker at top, defender in front guarding
        const attackerPos = { x: 200, y: 115 };  // Top of the key with ball
        const defenderPos = { x: 200, y: 165 };  // In front, between attacker and basket
        
        // Token base SVG positions
        const playerBaseX = 150, playerBaseY = 130;
        const opponentBaseX = 250, opponentBaseY = 130;
        
        if (this.state.possession === 'player') {
            // Player attacks, opponent defends (stands in front)
            const playerOffset = { x: attackerPos.x - playerBaseX, y: attackerPos.y - playerBaseY };
            const opponentOffset = { x: defenderPos.x - opponentBaseX, y: defenderPos.y - opponentBaseY };
            
            this.playerToken.setAttribute('transform', `translate(${playerOffset.x}, ${playerOffset.y})`);
            this.playerToken.dataset.currentX = attackerPos.x;
            this.playerToken.dataset.currentY = attackerPos.y;
            this.playerToken.dataset.x = playerBaseX;
            this.playerToken.dataset.y = playerBaseY;
            
            this.opponentToken.setAttribute('transform', `translate(${opponentOffset.x}, ${opponentOffset.y})`);
            this.opponentToken.dataset.currentX = defenderPos.x;
            this.opponentToken.dataset.currentY = defenderPos.y;
            this.opponentToken.dataset.x = opponentBaseX;
            this.opponentToken.dataset.y = opponentBaseY;
            
            this.updateBallPosition(attackerPos.x, attackerPos.y);
        } else {
            // Opponent attacks, player defends (stands in front)
            const playerOffset = { x: defenderPos.x - playerBaseX, y: defenderPos.y - playerBaseY };
            const opponentOffset = { x: attackerPos.x - opponentBaseX, y: attackerPos.y - opponentBaseY };
            
            this.playerToken.setAttribute('transform', `translate(${playerOffset.x}, ${playerOffset.y})`);
            this.playerToken.dataset.currentX = defenderPos.x;
            this.playerToken.dataset.currentY = defenderPos.y;
            this.playerToken.dataset.x = playerBaseX;
            this.playerToken.dataset.y = playerBaseY;
            
            this.opponentToken.setAttribute('transform', `translate(${opponentOffset.x}, ${opponentOffset.y})`);
            this.opponentToken.dataset.currentX = attackerPos.x;
            this.opponentToken.dataset.currentY = attackerPos.y;
            this.opponentToken.dataset.x = opponentBaseX;
            this.opponentToken.dataset.y = opponentBaseY;
            
            this.updateBallPosition(attackerPos.x, attackerPos.y);
        }
        
        this.updateBallPossessionIndicator();
    }

    updateBallPossessionIndicator() {
        if (this.state.possession === 'player') {
            this.possessionIndicator.classList.add('player');
            this.possessionIndicator.classList.remove('opponent');
        } else {
            this.possessionIndicator.classList.remove('player');
            this.possessionIndicator.classList.add('opponent');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
