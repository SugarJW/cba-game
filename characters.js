// Project CBA - Character Database
// 可扩展的角色数据库，支持 AI 生成角色

// ========== 角色数据结构定义 ==========
/*
Character Schema:
{
    id: string,              // 唯一标识符
    name: string,            // 角色名称
    title: string,           // 英文称号
    emoji: string,           // 默认表情符号（无图片时显示）
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY',
    
    // AI 生成相关字段
    isGenerated: boolean,    // 是否为 AI 生成
    prompt: string,          // 生成时使用的 prompt
    imageUrl: string,        // AI 生成的图片 URL
    generatedAt: timestamp,  // 生成时间
    
    // 8维属性 (0-100)
    stats: {
        inside: number,      // 内线
        midRange: number,    // 中投
        threePoint: number,  // 三分
        handle: number,      // 运球
        interiorDef: number, // 内防
        perimeterDef: number,// 外防
        steal: number,       // 抢断
        block: number        // 盖帽
    },
    
    // 技能
    offenseSkill: {
        name: string,
        desc: string,
        trigger: string,     // 触发时机
        effect: function     // 效果函数
    },
    defenseSkill: {
        name: string,
        desc: string,
        trigger: string,
        effect: function
    }
}
*/

// ========== 技能效果工厂 ==========
// 预定义的技能效果，可组合使用
const SkillEffects = {
    // 进攻技能效果
    guaranteeScore: () => ({ guaranteeScore: true }),
    unblockable: () => ({ unblockable: true }),
    insideBonus: (value) => ({ insideBonus: value }),
    shootBonus: (value) => ({ shootBonus: value }),
    ignoreContest: () => ({ ignoreContest: true }),
    forceThree: () => ({ forceThree: true }),
    foulChance: (value) => ({ foulChance: value }),
    nextGuarantee: () => ({ nextGuarantee: true }),
    
    // 防守技能效果
    stealBonus: (value) => ({ stealBonus: value }),
    blockBonus: (value) => ({ blockBonus: value }),
    contestBonus: (value) => ({ contestBonus: value }),
    doubleStealCheck: () => ({ doubleStealCheck: true }),
    instantSteal: (value) => ({ instantSteal: value }),
    halfShootingChance: () => ({ halfShootingChance: true }),
    threePointDefBonus: (value) => ({ threePointDefBonus: value }),
    intimidate: (value) => ({ intimidate: value }),
    convert: (value) => ({ convert: value }),
    endStreak: () => ({ endStreak: true }),
    nullifyStat: (stat) => ({ nullifyStat: stat }),
    
    // 组合多个效果
    combine: (...effects) => {
        return effects.reduce((acc, effect) => ({ ...acc, ...effect }), {});
    }
};

// ========== 技能模板 ==========
// 可复用的技能模板，AI 生成时可以从这些模板中选择或组合
const SkillTemplates = {
    offense: {
        breakthrough: {
            name: '无双突破',
            desc: '无视防守，100%完成突破得分',
            trigger: 'drive',
            effect: () => SkillEffects.combine(
                SkillEffects.guaranteeScore(),
                SkillEffects.unblockable()
            )
        },
        powerDunk: {
            name: '力量灌篮',
            desc: '内线得分能力大幅提升',
            trigger: 'drive',
            effect: () => SkillEffects.insideBonus(50)
        },
        perfectShot: {
            name: '精准投射',
            desc: '投篮命中率大幅提升，无视干扰',
            trigger: 'shoot',
            effect: () => SkillEffects.combine(
                SkillEffects.shootBonus(40),
                SkillEffects.ignoreContest()
            )
        },
        longRange: {
            name: '超远三分',
            desc: '强制三分出手，且无法被封盖',
            trigger: 'shoot',
            effect: () => SkillEffects.combine(
                SkillEffects.forceThree(),
                SkillEffects.unblockable()
            )
        },
        ankleBreaker: {
            name: '脚踝终结者',
            desc: '运球必定过人，下次进攻必中',
            trigger: 'dribble',
            effect: () => SkillEffects.combine(
                SkillEffects.guaranteeScore(),
                SkillEffects.nextGuarantee()
            )
        },
        drawFoul: {
            name: '造犯规',
            desc: '失败时有概率造成犯规重新进攻',
            trigger: 'drive',
            effect: () => SkillEffects.foulChance(50)
        }
    },
    defense: {
        lockdown: {
            name: '死亡缠绕',
            desc: '锁死对手，投篮命中率减半',
            trigger: 'perimeter',
            effect: () => SkillEffects.halfShootingChance()
        },
        shotBlocker: {
            name: '护框巨兽',
            desc: '盖帽能力大幅提升',
            trigger: 'block',
            effect: () => SkillEffects.blockBonus(50)
        },
        pickpocket: {
            name: '神偷手',
            desc: '抢断能力大幅提升',
            trigger: 'steal',
            effect: () => SkillEffects.stealBonus(50)
        },
        doubleTeam: {
            name: '双重封锁',
            desc: '抢断判定次数翻倍',
            trigger: 'steal',
            effect: () => SkillEffects.doubleStealCheck()
        },
        intimidator: {
            name: '威慑者',
            desc: '大幅降低对手所有进攻属性',
            trigger: 'presence',
            effect: () => SkillEffects.intimidate(30)
        },
        noFlyZone: {
            name: '禁飞区',
            desc: '对方三分时防守能力极大增强',
            trigger: 'threePoint',
            effect: () => SkillEffects.threePointDefBonus(60)
        }
    }
};

// ========== 角色数据库类 ==========
class CharacterDatabase {
    constructor() {
        this.characters = new Map();
        this.presetCharacters = [];
        this.generatedCharacters = [];
        this.initPresets();
    }

    // 初始化预设角色
    initPresets() {
        const presets = [
            {
                id: 'wukong',
                name: '孙悟空',
                title: 'The Monkey King',
                emoji: '🐒',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/sunwukong.png',
                stats: {
                    inside: 80, midRange: 65, threePoint: 60, handle: 98,
                    interiorDef: 55, perimeterDef: 80, steal: 92, block: 70
                },
                offenseSkill: {
                    name: '筋斗云',
                    desc: '无视对手碰撞体积，100%完成突破得分',
                    trigger: 'dribble',
                    effect: (game) => {
                        game.addLog('⚡ 筋斗云发动！瞬移过人！', 'skill');
                        return SkillEffects.guaranteeScore();
                    }
                },
                defenseSkill: {
                    name: '火眼金睛',
                    desc: '抢断成功率临时提升50%',
                    trigger: 'steal',
                    effect: (game) => {
                        game.addLog('👁️ 火眼金睛！看穿一切！', 'skill');
                        return SkillEffects.stealBonus(50);
                    }
                }
            },
            {
                id: 'godzilla',
                name: '哥斯拉',
                title: 'King of Monsters',
                emoji: '🦖',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/godzilla.png',
                stats: {
                    inside: 99, midRange: 20, threePoint: 0, handle: 35,
                    interiorDef: 99, perimeterDef: 25, steal: 25, block: 97
                },
                offenseSkill: {
                    name: '怪兽碾压',
                    desc: '绝对力量强制得分，无法被盖帽',
                    trigger: 'drive',
                    effect: (game) => {
                        game.addLog('💥 怪兽碾压！无人能挡！', 'skill');
                        return SkillEffects.combine(
                            SkillEffects.guaranteeScore(),
                            SkillEffects.unblockable()
                        );
                    }
                },
                defenseSkill: {
                    name: '原子吐息',
                    desc: '大概率直接封盖',
                    trigger: 'block',
                    effect: (game) => {
                        game.addLog('☢️ 原子吐息！毁灭封盖！', 'skill');
                        return SkillEffects.blockBonus(80);
                    }
                }
            },
            {
                id: 'joker',
                name: '小丑',
                title: 'The Joker',
                emoji: '🃏',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/joker.png',
                stats: {
                    inside: 45, midRange: 80, threePoint: 85, handle: 92,
                    interiorDef: 40, perimeterDef: 70, steal: 98, block: 30
                },
                offenseSkill: {
                    name: '疯狂大戏',
                    desc: '随机将对手一项防守属性降为0',
                    trigger: 'any',
                    effect: (game) => {
                        const defStats = ['interiorDef', 'perimeterDef', 'steal', 'block'];
                        const randomStat = defStats[Math.floor(Math.random() * defStats.length)];
                        game.addLog(`🎭 疯狂大戏！对手${randomStat}崩溃！`, 'skill');
                        return SkillEffects.nullifyStat(randomStat);
                    }
                },
                defenseSkill: {
                    name: '疯人院陷阱',
                    desc: '抢断判定次数翻倍',
                    trigger: 'steal',
                    effect: (game) => {
                        game.addLog('🎪 疯人院陷阱！双重抢断！', 'skill');
                        return SkillEffects.doubleStealCheck();
                    }
                }
            },
            {
                id: 'ironman',
                name: '钢铁侠',
                title: 'Iron Man',
                emoji: '🦾',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/ironman.png',
                stats: {
                    inside: 75, midRange: 85, threePoint: 85, handle: 75,
                    interiorDef: 75, perimeterDef: 80, steal: 65, block: 70
                },
                offenseSkill: {
                    name: '贾维斯自瞄',
                    desc: '无视距离干扰，中远投命中率+40%',
                    trigger: 'shoot',
                    effect: (game) => {
                        game.addLog('🎯 贾维斯自瞄锁定！', 'skill');
                        return SkillEffects.shootBonus(40);
                    }
                },
                defenseSkill: {
                    name: '纳米装甲',
                    desc: '封盖与干扰判定+50%',
                    trigger: 'block',
                    effect: (game) => {
                        game.addLog('🛡️ 纳米装甲展开！', 'skill');
                        return SkillEffects.combine(
                            SkillEffects.blockBonus(50),
                            SkillEffects.contestBonus(50)
                        );
                    }
                }
            },
            {
                id: 'trex',
                name: '霸王龙',
                title: 'T-Rex',
                emoji: '🦕',
                rarity: 'EPIC',
                isGenerated: false,
                cardImage: 'assets/cards/trex.png',
                stats: {
                    inside: 95, midRange: 10, threePoint: 0, handle: 45,
                    interiorDef: 95, perimeterDef: 30, steal: 35, block: 90
                },
                offenseSkill: {
                    name: '史前冲撞',
                    desc: '得分失败有50%概率造成犯规重新进攻',
                    trigger: 'drive',
                    effect: (game) => {
                        game.addLog('🦴 史前冲撞！', 'skill');
                        return SkillEffects.foulChance(50);
                    }
                },
                defenseSkill: {
                    name: '暴龙咆哮',
                    desc: '大幅降低对手全进攻属性',
                    trigger: 'intimidate',
                    effect: (game) => {
                        game.addLog('🔊 暴龙咆哮！震慑全场！', 'skill');
                        return SkillEffects.intimidate(30);
                    }
                }
            },
            {
                id: 'panda',
                name: '功夫熊猫',
                title: 'Kung Fu Panda',
                emoji: '🐼',
                rarity: 'EPIC',
                isGenerated: false,
                cardImage: 'assets/cards/kungfupanda.png',
                stats: {
                    inside: 85, midRange: 60, threePoint: 40, handle: 75,
                    interiorDef: 85, perimeterDef: 70, steal: 65, block: 60
                },
                offenseSkill: {
                    name: '功夫灌篮',
                    desc: '内线得分属性临时+50点',
                    trigger: 'drive',
                    effect: (game) => {
                        game.addLog('🥋 功夫灌篮！Skadoosh!', 'skill');
                        return SkillEffects.insideBonus(50);
                    }
                },
                defenseSkill: {
                    name: '太极推手',
                    desc: '将对手30%进攻属性转化为防守加成',
                    trigger: 'counter',
                    effect: (game) => {
                        game.addLog('☯️ 太极推手！以柔克刚！', 'skill');
                        return SkillEffects.convert(30);
                    }
                }
            },
            {
                id: 'mario',
                name: '马里奥',
                title: 'Super Mario',
                emoji: '🍄',
                rarity: 'EPIC',
                isGenerated: false,
                cardImage: 'assets/cards/mario.png',
                stats: {
                    inside: 75, midRange: 75, threePoint: 70, handle: 75,
                    interiorDef: 70, perimeterDef: 70, steal: 65, block: 70
                },
                offenseSkill: {
                    name: '火球投射',
                    desc: '投篮计为3分且轨迹不可被封盖',
                    trigger: 'shoot',
                    effect: (game) => {
                        game.addLog('🔥 火球投射！It\'s-a me!', 'skill');
                        return SkillEffects.combine(
                            SkillEffects.forceThree(),
                            SkillEffects.unblockable()
                        );
                    }
                },
                defenseSkill: {
                    name: '超级弹跳',
                    desc: '盖帽属性临时增加40点',
                    trigger: 'block',
                    effect: (game) => {
                        game.addLog('⭐ 超级弹跳！', 'skill');
                        return SkillEffects.blockBonus(40);
                    }
                }
            },
            {
                id: 'brucelee',
                name: '李小龙',
                title: 'Bruce Lee',
                emoji: '🥷',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/brucelee.png',
                stats: {
                    inside: 65, midRange: 55, threePoint: 40, handle: 95,
                    interiorDef: 55, perimeterDef: 98, steal: 95, block: 37
                },
                offenseSkill: {
                    name: '截拳爆发',
                    desc: '运球突破后下一回合必定命中',
                    trigger: 'dribble',
                    effect: (game) => {
                        game.addLog('⚡ 截拳爆发！Be water!', 'skill');
                        return SkillEffects.nextGuarantee();
                    }
                },
                defenseSkill: {
                    name: '寸劲截断',
                    desc: '高几率直接断球',
                    trigger: 'steal',
                    effect: (game) => {
                        game.addLog('👊 寸劲截断！', 'skill');
                        return SkillEffects.instantSteal(70);
                    }
                }
            },
            {
                id: 'kobe',
                name: '科比',
                title: 'Black Mamba',
                emoji: '🐍',
                rarity: 'LEGENDARY',
                isGenerated: false,
                cardImage: 'assets/cards/kobe.png',
                stats: {
                    inside: 88, midRange: 98, threePoint: 85, handle: 88,
                    interiorDef: 70, perimeterDef: 85, steal: 75, block: 51
                },
                offenseSkill: {
                    name: '黑曼巴后仰',
                    desc: '完全无视对手的干扰判定',
                    trigger: 'shoot',
                    effect: (game) => {
                        game.addLog('🐍 黑曼巴后仰！Mamba Mentality!', 'skill');
                        return SkillEffects.combine(
                            SkillEffects.ignoreContest(),
                            SkillEffects.shootBonus(30)
                        );
                    }
                },
                defenseSkill: {
                    name: '死亡缠绕',
                    desc: '锁定对手，三分和中投命中率减半',
                    trigger: 'lockdown',
                    effect: (game) => {
                        game.addLog('🔒 死亡缠绕！无处可逃！', 'skill');
                        return SkillEffects.halfShootingChance();
                    }
                }
            },
            {
                id: 'obama',
                name: '奥巴马',
                title: 'The 44th',
                emoji: '🇺🇸',
                rarity: 'EPIC',
                isGenerated: false,
                cardImage: 'assets/cards/obama.png',
                stats: {
                    inside: 40, midRange: 88, threePoint: 80, handle: 85,
                    interiorDef: 45, perimeterDef: 85, steal: 77, block: 40
                },
                offenseSkill: {
                    name: '关键演说',
                    desc: '比赛后半段所有投篮命中率+30%',
                    trigger: 'clutch',
                    effect: (game) => {
                        game.addLog('🎤 关键演说！Yes We Can!', 'skill');
                        return SkillEffects.shootBonus(30);
                    }
                },
                defenseSkill: {
                    name: '禁飞区指令',
                    desc: '对手三分时外线防守极大增强',
                    trigger: 'threePoint',
                    effect: (game) => {
                        game.addLog('✈️ 禁飞区指令！', 'skill');
                        return SkillEffects.threePointDefBonus(60);
                    }
                }
            }
        ];

        presets.forEach(char => {
            this.characters.set(char.id, char);
            this.presetCharacters.push(char.id);
        });
    }

    // ========== 数据库操作方法 ==========
    
    // 获取所有角色
    getAll() {
        return Array.from(this.characters.values());
    }

    // 获取预设角色
    getPresets() {
        return this.presetCharacters.map(id => this.characters.get(id));
    }

    // 获取生成的角色
    getGenerated() {
        return this.generatedCharacters.map(id => this.characters.get(id));
    }

    // 根据 ID 获取角色
    getById(id) {
        return this.characters.get(id);
    }

    // 根据索引获取角色
    getByIndex(index) {
        const all = this.getAll();
        return all[index] || null;
    }

    // 获取角色数量
    count() {
        return this.characters.size;
    }

    // 添加新角色 (AI 生成时使用)
    addCharacter(characterData) {
        const id = characterData.id || this.generateId();
        const newChar = {
            ...characterData,
            id,
            isGenerated: true,
            generatedAt: Date.now()
        };
        
        this.characters.set(id, newChar);
        this.generatedCharacters.push(id);
        
        return newChar;
    }

    // 删除角色 (只能删除生成的角色)
    removeCharacter(id) {
        const char = this.characters.get(id);
        if (char && char.isGenerated) {
            this.characters.delete(id);
            this.generatedCharacters = this.generatedCharacters.filter(cid => cid !== id);
            return true;
        }
        return false;
    }

    // 生成唯一 ID
    generateId() {
        return 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ========== AI 生成相关方法 ==========

    // 从 AI 响应创建角色
    createFromAIResponse(aiResponse) {
        /*
        预期的 AI 响应格式:
        {
            name: "角色名",
            title: "英文称号",
            description: "角色描述",
            imageUrl: "生成的图片URL",
            stats: { inside, midRange, threePoint, handle, interiorDef, perimeterDef, steal, block },
            offenseSkill: { name, desc, type },
            defenseSkill: { name, desc, type },
            rarity: "EPIC"
        }
        */
        
        const { name, title, description, imageUrl, stats, offenseSkill, defenseSkill, rarity } = aiResponse;
        
        // 根据技能类型选择效果模板
        const offenseEffect = this.mapSkillTypeToEffect(offenseSkill.type, 'offense');
        const defenseEffect = this.mapSkillTypeToEffect(defenseSkill.type, 'defense');
        
        return this.addCharacter({
            name,
            title: title || name,
            emoji: '🌟', // AI 生成角色默认 emoji
            rarity: rarity || 'EPIC',
            imageUrl,
            prompt: description,
            stats: this.normalizeStats(stats),
            offenseSkill: {
                name: offenseSkill.name,
                desc: offenseSkill.desc,
                trigger: offenseEffect.trigger,
                effect: (game) => {
                    game.addLog(`⚡ ${offenseSkill.name}！`, 'skill');
                    return offenseEffect.effect();
                }
            },
            defenseSkill: {
                name: defenseSkill.name,
                desc: defenseSkill.desc,
                trigger: defenseEffect.trigger,
                effect: (game) => {
                    game.addLog(`🛡️ ${defenseSkill.name}！`, 'skill');
                    return defenseEffect.effect();
                }
            }
        });
    }

    // 将技能类型映射到效果
    mapSkillTypeToEffect(type, category) {
        const templates = SkillTemplates[category];
        return templates[type] || templates[Object.keys(templates)[0]];
    }

    // 标准化属性值 (确保在 0-100 范围内)
    normalizeStats(stats) {
        const normalized = {};
        const keys = ['inside', 'midRange', 'threePoint', 'handle', 'interiorDef', 'perimeterDef', 'steal', 'block'];
        
        keys.forEach(key => {
            let value = stats[key] || 50;
            normalized[key] = Math.max(0, Math.min(100, Math.round(value)));
        });
        
        return normalized;
    }

    // 计算属性总和
    calculateTotalStats(stats) {
        return Object.values(stats).reduce((sum, val) => sum + val, 0);
    }

    // 平衡属性 (确保总和约为 540)
    balanceStats(stats) {
        const TARGET_TOTAL = 540;
        const total = this.calculateTotalStats(stats);
        const ratio = TARGET_TOTAL / total;
        
        const balanced = {};
        Object.keys(stats).forEach(key => {
            balanced[key] = Math.max(0, Math.min(100, Math.round(stats[key] * ratio)));
        });
        
        return balanced;
    }

    // ========== 持久化方法 ==========

    // 保存到 localStorage
    saveToLocalStorage() {
        const data = {
            generatedCharacters: this.generatedCharacters.map(id => this.characters.get(id)),
            savedAt: Date.now()
        };
        localStorage.setItem('cba_characters', JSON.stringify(data));
    }

    // 从 localStorage 加载
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('cba_characters'));
            if (data && data.generatedCharacters) {
                data.generatedCharacters.forEach(char => {
                    // 重新绑定技能效果函数
                    this.restoreSkillFunctions(char);
                    this.characters.set(char.id, char);
                    this.generatedCharacters.push(char.id);
                });
            }
        } catch (e) {
            console.error('Failed to load characters from localStorage:', e);
        }
    }

    // 恢复技能函数 (从存储加载后需要重新绑定)
    restoreSkillFunctions(char) {
        // 根据存储的技能类型重新绑定效果函数
        // 这是简化版本，实际需要根据技能数据重建
        if (!char.offenseSkill.effect || typeof char.offenseSkill.effect !== 'function') {
            char.offenseSkill.effect = (game) => {
                game.addLog(`⚡ ${char.offenseSkill.name}！`, 'skill');
                return SkillEffects.shootBonus(30);
            };
        }
        if (!char.defenseSkill.effect || typeof char.defenseSkill.effect !== 'function') {
            char.defenseSkill.effect = (game) => {
                game.addLog(`🛡️ ${char.defenseSkill.name}！`, 'skill');
                return SkillEffects.blockBonus(30);
            };
        }
    }

    // 导出为 JSON
    exportToJSON() {
        return JSON.stringify(this.getGenerated(), null, 2);
    }

    // 从 JSON 导入
    importFromJSON(jsonString) {
        try {
            const characters = JSON.parse(jsonString);
            characters.forEach(char => {
                this.restoreSkillFunctions(char);
                this.addCharacter(char);
            });
            return true;
        } catch (e) {
            console.error('Failed to import characters:', e);
            return false;
        }
    }
}

// ========== 单例导出 ==========
const characterDB = new CharacterDatabase();

// 为了向后兼容，导出一个 CHARACTERS 数组
const CHARACTERS = characterDB.getAll();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CharacterDatabase, characterDB, CHARACTERS, SkillEffects, SkillTemplates };
}
