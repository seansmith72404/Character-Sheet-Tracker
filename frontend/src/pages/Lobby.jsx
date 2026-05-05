import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useParams } from 'react-router-dom';

import tavernMap from '../assets/maps/tavern.png';
import caveMap from '../assets/maps/cave.png';
import forestMap from '../assets/maps/forest.png';

const BUILT_IN_MAPS = {
    '/maps/tavern.png': tavernMap,
    '/maps/cave.png': caveMap,
    '/maps/forest.png': forestMap
};

const socket = io('http://localhost:3000', { autoConnect: false });

function Lobby() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const mapRef = useRef(null);

    const [joinInput, setJoinInput] = useState('');
    const [activityLog, setActivityLog] = useState([]);
    const [users, setUsers] = useState([]);
    const [chatInput, setChatInput] = useState('');

    // Character Selection State
    const [myCharacters, setMyCharacters] = useState([]);
    const myCharactersRef = useRef(myCharacters);
    useEffect(() => { myCharactersRef.current = myCharacters; }, [myCharacters]);

    const [selectedCharacter, setSelectedCharacter] = useState('');
    const selectedCharacterRef = useRef(selectedCharacter);
    useEffect(() => { selectedCharacterRef.current = selectedCharacter; }, [selectedCharacter]);

    const [hasJoined, setHasJoined] = useState(false);
    const hasJoinedRef = useRef(hasJoined);
    useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);

    // VTT State
    const [myUsername, setMyUsername] = useState('');
    const [roomHost, setRoomHost] = useState('');
    const [worldMapUrl, setWorldMapUrl] = useState('');
    const [battleMapUrl, setBattleMapUrl] = useState('');
    const [isCombat, setIsCombat] = useState(false);
    const [tokens, setTokens] = useState({});
    const [draggingToken, setDraggingToken] = useState(null);
    const [turnOrder, setTurnOrder] = useState([]);
    const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
    const [proposedMoves, setProposedMoves] = useState({});
    const [isPartySplit, setIsPartySplit] = useState(false);

    // Combat Setup Modal State
    const [combatModalEnemyGroups, setCombatModalEnemyGroups] = useState([
        { name: 'Goblin', count: 3, dex: 2 }
    ]);
    const [combatModalMapUrl, setCombatModalMapUrl] = useState('/maps/tavern.png');
    const [customMapUrl, setCustomMapUrl] = useState('');

    // DM Local Input State
    const [newWorldInput, setNewWorldInput] = useState('');
    const [newBattleInput, setNewBattleInput] = useState('');

    // Dice State
    const [diceInput, setDiceInput] = useState('1d20');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setMyUsername(payload.username);
        } catch (e) {
            console.error("Token decoding failed", e);
        }

        setActivityLog([]);
        setUsers([]);

        // Fetch Characters
        const fetchCharacters = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/characters', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setMyCharacters(data.characters);
                    if (data.characters.length > 0 && !selectedCharacterRef.current) {
                        setSelectedCharacter(data.characters[0].id);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch characters:", err);
            }
        };
        fetchCharacters();

        socket.auth = { token };
        socket.connect();

        // Do NOT auto join here anymore. User must select character first.
        // If they already joined (hasJoined), it will render VTT.

        socket.on('lobby_created', (code) => {
            setHasJoined(true);
            navigate(`/lobby/${code}`, { replace: true });
        });

        socket.on('lobby_disbanded', (msg) => {
            alert(msg);
            setHasJoined(false);
            navigate('/lobby');
        });

        socket.on('kicked_from_lobby', (msg) => {
            alert(msg);
            setHasJoined(false);
            navigate('/lobby');
        });

        socket.on('room_state', (state) => {
            setHasJoined(true);
            setRoomHost(state.host);
            setWorldMapUrl(state.worldMapUrl);
            setBattleMapUrl(state.battleMapUrl);
            setIsCombat(state.isCombat);
            setTokens(state.tokens || {});
        });

        socket.on('map_updated', (mapType, url) => {
            if (mapType === 'world') setWorldMapUrl(url);
            if (mapType === 'battle') setBattleMapUrl(url);
        });

        socket.on('combat_toggled', (state) => {
            setIsCombat(state);
            if (!state) {
                setTurnOrder([]);
                setIsPartySplit(false);
            }
            setActivityLog(prev => [...prev, {
                type: 'system',
                text: state ? '⚔️ The DM has initiated combat! Turn order calculated.' : '🛡️ Combat has ended. Returning to world map.'
            }]);
        });

        socket.on('party_split_toggled', (state) => setIsPartySplit(state));

        socket.on('turn_order_update', ({ order, currentIndex }) => {
            setTurnOrder(order);
            setCurrentTurnIndex(currentIndex);
        });

        socket.on('board_update', (updatedTokens) => setTokens(updatedTokens));
        socket.on('proposed_move_update', (moves) => setProposedMoves(moves));
        socket.on('room_update', (message) => setActivityLog(prev => [...prev, { type: 'system', text: message }]));
        socket.on('room_users_update', (userList) => setUsers(userList));
        socket.on('receive_message', (data) => setActivityLog(prev => [...prev, { type: 'chat', user: data.username, text: data.text }]));

        socket.on('connect', () => {
            if (hasJoinedRef.current && roomId) {
                const char = myCharactersRef.current.find(c => c.id === parseInt(selectedCharacterRef.current));
                socket.emit('join_lobby', roomId.toUpperCase(), char);
            }
        });

        return () => {
            socket.off('lobby_created');
            socket.off('room_state');
            socket.off('map_updated');
            socket.off('combat_toggled');
            socket.off('party_split_toggled');
            socket.off('turn_order_update');
            socket.off('board_update');
            socket.off('proposed_move_update');
            socket.off('room_update');
            socket.off('room_users_update');
            socket.off('receive_message');
            socket.off('connect');
            socket.off('lobby_disbanded');
            socket.off('kicked_from_lobby');
        };
    }, [navigate, roomId]);

    // Disconnect ONLY when the component completely unmounts (e.g. leaving the Lobby entirely)
    useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, []);

    const handleCreateLobby = () => {
        const char = myCharacters.find(c => c.id === parseInt(selectedCharacter));
        socket.emit('create_lobby', char || null);
    };

    const handleJoinLobby = (code) => {
        if (!code) return;
        navigate(`/lobby/${code.toUpperCase()}`);
    };

    const handleEnterLobby = () => {
        if (!roomId) return;
        const char = myCharacters.find(c => c.id === parseInt(selectedCharacter));
        socket.emit('join_lobby', roomId.toUpperCase(), char || null);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (chatInput.trim() && roomId) {
            socket.emit('send_message', roomId, chatInput.trim());
            setChatInput('');
        }
    };

    const handleRollDice = (e) => {
        e.preventDefault();
        if (roomId && diceInput.trim()) {
            socket.emit('roll_dice', roomId, diceInput.trim());
            setDiceInput('');
        }
    };

    const handleUpdateMap = (type) => {
        const url = type === 'world' ? newWorldInput : newBattleInput;
        if (url.trim() && roomId) {
            socket.emit('update_map_url', roomId, type, url.trim());
            type === 'world' ? setNewWorldInput('') : setNewBattleInput('');
        }
    };

    const spawnParty = () => {
        users.forEach((u, index) => {
            if (u.username === roomHost) return; // DM gets no token
            const id = `tok_${uuidv4()}`;
            const maxHp = u.character?.core_stats?.MaxHP || 10;
            socket.emit('spawn_token', roomId, {
                id,
                name: u.character ? u.character.character_name : u.username,
                owner: u.username,
                x: 10 + (index * 5),
                y: 10,
                color: 'bg-info text-white',
                hp: maxHp,
                maxHp: maxHp,
                dex: u.character?.core_stats?.DEX || 0,
                isParty: false
            });
        });
    };

    const setupCombat = (e) => {
        e.preventDefault();
        const mapUrl = combatModalMapUrl === 'CUSTOM' ? customMapUrl : combatModalMapUrl;
        socket.emit('setup_combat', roomId, {
            mapUrl: mapUrl,
            enemyGroups: combatModalEnemyGroups
        });
        document.getElementById('combat_setup_modal').close();
    };

    const endCombat = () => {
        socket.emit('end_combat', roomId);
    };

    const handleDragStart = (e, tokenId) => {
        const token = tokens[tokenId];
        // Only DM can move individual tokens in split party
        if (!isCombat && isPartySplit && myUsername !== roomHost) {
            e.preventDefault();
            return;
        }

        if (token.owner !== myUsername && myUsername !== roomHost && token.owner !== 'party') {
            e.preventDefault();
            return;
        }

        // Turn order enforcement
        if (isCombat && myUsername !== roomHost) {
            const activeTokenId = turnOrder[currentTurnIndex];
            if (activeTokenId !== tokenId) {
                e.preventDefault();
                return;
            }
        }

        e.dataTransfer.setData('text/plain', tokenId);
        setDraggingToken(tokenId);
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleDrop = (e) => {
        e.preventDefault();
        if (!draggingToken || !mapRef.current) return;

        const rect = mapRef.current.getBoundingClientRect();
        let x = ((e.clientX - rect.left) / rect.width) * 100;
        let y = ((e.clientY - rect.top) / rect.height) * 100;

        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        if (isCombat && myUsername !== roomHost) {
            socket.emit('propose_move', roomId, { id: draggingToken, x, y });
        } else {
            socket.emit('move_token', roomId, { id: draggingToken, x, y });
        }

        setDraggingToken(null);
    };

    const handleTokenClick = (tokenId) => {
        const token = tokens[tokenId];
        if (!token) return;

        if (token.owner === myUsername || isHost) {
            if (token.hp !== undefined) {
                const changeStr = prompt(`Adjust HP for ${token.name} (Current: ${token.hp}/${token.maxHp})\n\nEnter a positive or negative number (e.g. -5 for damage, 8 for healing):`);
                if (changeStr) {
                    const change = parseInt(changeStr);
                    if (!isNaN(change)) {
                        const newHp = Math.min(token.maxHp, Math.max(0, token.hp + change));
                        socket.emit('update_hp', roomId, tokenId, newHp);
                    }
                }
            }
        }
    };

    const handleDeleteToken = (tokenId) => {
        const token = tokens[tokenId];
        if (token.owner === myUsername || myUsername === roomHost) {
            socket.emit('delete_token', roomId, tokenId);
        }
    };

    const isHost = myUsername === roomHost;
    const currentDisplayMapRaw = isCombat ? battleMapUrl : worldMapUrl;
    const currentDisplayMap = BUILT_IN_MAPS[currentDisplayMapRaw] || currentDisplayMapRaw;

    return (
        <div className="min-h-screen flex flex-col h-screen overflow-hidden">

            {/* Top Navbar */}
            <div className={`navbar border-b shadow-sm z-10 px-4 flex justify-between shrink-0 transition-colors ${isCombat ? 'bg-red-900 border-red-700' : 'bg-base-100 border-base-200'}`}>
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-widest text-white">LAIRMASTER {isCombat ? '— COMBAT PHASE' : 'VTT'}</h1>
                    {roomId && <div className="badge badge-outline badge-lg font-mono text-white">Room: {roomId}</div>}
                </div>
                <div>{hasJoined && <button onClick={() => { socket.emit('leave_lobby', roomId); setHasJoined(false); navigate('/lobby'); }} className="btn btn-error btn-sm">Leave</button>}</div>
            </div>

            {!hasJoined ? (
                <div className="flex-grow flex justify-center items-start pt-20 bg-base-300">
                    <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-300">
                        <div className="card-body text-center">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">{roomId ? `Join Campaign: ${roomId}` : 'Lobby Hub'}</h2>
                                <button onClick={() => navigate('/dashboard')} className="btn btn-outline btn-sm">Back</button>
                            </div>

                            {/* Character Selection */}
                            <div className="form-control w-full mb-6 text-left">
                                <label className="label">
                                    <span className="label-text font-bold text-sm text-primary">Select Your Character (Required)</span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={selectedCharacter}
                                    onChange={(e) => setSelectedCharacter(e.target.value)}
                                >
                                    <option value="" disabled>Select Character</option>
                                    {myCharacters.map(char => (
                                        <option key={char.id} value={char.id}>
                                            {char.character_name} {char.game_system === 'DND5E' ? `(HP: ${char.core_stats?.MaxHP || 0})` : ''}
                                        </option>
                                    ))}
                                    <option value="DM_MODE">Join as Dungeon Master (No Character)</option>
                                </select>
                                {myCharacters.length === 0 && (
                                    <label className="label">
                                        <span className="label-text-alt text-error">You have no characters! Go to dashboard to create one, or join as DM.</span>
                                    </label>
                                )}
                            </div>

                            {!roomId ? (
                                <>
                                    <button onClick={handleCreateLobby} disabled={!selectedCharacter} className="btn btn-primary w-full mb-4">Create New Campaign</button>
                                    <div className="divider">OR</div>
                                    <div className="join w-full">
                                        <input type="text" placeholder="Enter 5-letter code" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} className="input input-bordered join-item w-full uppercase" maxLength="5" />
                                        <button onClick={() => handleJoinLobby(joinInput)} disabled={!selectedCharacter || !joinInput} className="btn btn-secondary join-item">Join</button>
                                    </div>
                                </>
                            ) : (
                                <button onClick={handleEnterLobby} disabled={!selectedCharacter} className="btn btn-success w-full btn-lg">ENTER LOBBY</button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex w-full overflow-hidden bg-base-300">

                    {/* Main Stage */}
                    <div className={`w-3/4 flex flex-col relative transition-all ${isCombat ? 'bg-red-950/20' : 'bg-neutral-900'}`}>

                        {/* The Map Renderer with Token Overlay */}
                        <div className="flex-grow overflow-hidden relative flex justify-center items-center p-4">

                            {/* The permanent board container */}
                            <div
                                ref={mapRef}
                                className={`relative inline-block shadow-2xl rounded-lg overflow-hidden border-4 ${isCombat ? 'border-red-600 bg-red-950/40' : 'border-base-100 bg-black'}`}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                            >
                                {currentDisplayMap ? (
                                    <img src={currentDisplayMap} className="max-w-full max-h-[70vh] pointer-events-none" alt="Map" />
                                ) : (
                                    <div className="w-[800px] h-[600px] max-w-full max-h-[70vh] flex items-center justify-center pointer-events-none">
                                        <h2 className="text-neutral-content opacity-50 text-2xl font-bold tracking-widest">NO MAP LOADED</h2>
                                    </div>
                                )}

                                {Object.values(tokens)
                                    .filter(t => {
                                        if (isCombat) return !t.isParty;
                                        return isPartySplit ? !t.isParty : t.isParty;
                                    })
                                    .map((token) => (
                                        <div
                                            key={token.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, token.id)}
                                            onClick={() => handleTokenClick(token.id)}
                                            onDoubleClick={() => handleDeleteToken(token.id)}
                                            className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold cursor-grab active:cursor-grabbing z-20 tooltip tooltip-top group hover:scale-110 transition-transform ${token.color}`}
                                            style={{ left: `${token.x}%`, top: `${token.y}%` }}
                                            data-tip={token.name}
                                        >
                                            {token.isParty ? '⭐' : token.name.substring(0, 3).toUpperCase()}
                                            {token.hp !== undefined && !token.isParty && token.owner !== roomHost && (
                                                <div className="absolute -bottom-6 w-max bg-base-300 text-white text-[10px] px-2 py-0.5 rounded shadow-xl text-center leading-tight">
                                                    <span className="font-bold text-primary">{token.name}</span><br />
                                                    {token.hp} / {token.maxHp} HP
                                                </div>
                                            )}

                                            {isHost && (
                                                <button
                                                    onClick={() => handleDeleteToken(token.id)}
                                                    className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-error text-white font-bold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl"
                                                    title="Remove Token"
                                                >
                                                    X
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                {/* Ghost tokens for proposed moves */}
                                {Object.entries(proposedMoves).map(([tokenId, pos]) => {
                                    const token = tokens[tokenId];
                                    if (!token) return null;
                                    return (
                                        <div key={`ghost_${tokenId}`} className="absolute z-30" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                                            <div className={`w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-dashed border-white opacity-60 flex items-center justify-center text-xs font-bold ${token.color}`}>
                                                {token.name.substring(0, 3).toUpperCase()}
                                            </div>
                                            {isHost && (
                                                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1 bg-base-100 p-1 rounded shadow-xl">
                                                    <button onClick={() => socket.emit('resolve_move', roomId, tokenId, true)} className="btn btn-xs btn-success text-white px-2">✓</button>
                                                    <button onClick={() => socket.emit('resolve_move', roomId, tokenId, false)} className="btn btn-xs btn-error text-white px-2">✗</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* DM Control Panel */}
                        {isHost && (
                            <div className="bg-base-200 p-4 border-t border-base-300 shrink-0 flex flex-col gap-4 shadow-inner overflow-y-auto">
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-4 items-center">
                                        <span className="badge badge-primary font-bold">DM TOOLS</span>
                                        {!isCombat && (
                                            <button
                                                onClick={() => socket.emit('toggle_party_split', roomId, !isPartySplit)}
                                                className={`btn btn-sm shadow-md ${isPartySplit ? 'btn-secondary' : 'btn-info'}`}
                                            >
                                                {isPartySplit ? 'Group Party' : 'Split Party'}
                                            </button>
                                        )}
                                        {isCombat && (
                                            <button onClick={() => socket.emit('next_turn', roomId)} className="btn btn-sm btn-warning shadow-md">Next Turn</button>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => socket.emit('save_campaign', roomId)}
                                            className="btn btn-outline btn-primary font-bold shadow-sm"
                                        >
                                            💾 Save State
                                        </button>

                                        {isCombat ? (
                                            <button onClick={endCombat} className="btn btn-error font-bold shadow-lg">End Combat</button>
                                        ) : (
                                            <button onClick={() => document.getElementById('combat_setup_modal').showModal()} className="btn btn-error font-bold shadow-lg">INITIATE COMBAT</button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="join w-1/2 shadow-sm">
                                        <input type="text" placeholder="Update World Map URL..." className="input input-sm input-bordered join-item w-full" value={newWorldInput} onChange={(e) => setNewWorldInput(e.target.value)} />
                                        <button onClick={() => handleUpdateMap('world')} className="btn btn-sm btn-secondary join-item">Set World</button>
                                    </div>
                                    <div className="join w-1/2 shadow-sm">
                                        <input type="text" placeholder="Update Battle Map URL..." className="input input-sm input-bordered join-item w-full" value={newBattleInput} onChange={(e) => setNewBattleInput(e.target.value)} />
                                        <button onClick={() => handleUpdateMap('battle')} className="btn btn-sm btn-accent join-item">Set Battle</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="w-1/4 bg-base-100 border-l border-base-300 flex flex-col shadow-xl z-10 shrink-0">

                        {/* Party Members */}
                        <div className="p-4 border-b border-base-300 shrink-0">
                            <h3 className="font-bold text-sm text-base-content/70 uppercase mb-3">Party Members</h3>
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {users.map(u => (
                                    <li key={u.id} className="flex flex-col bg-base-200 p-2 rounded border border-base-300 group relative">
                                        <div className="flex justify-between items-center w-full">
                                            <div className="text-sm font-semibold flex items-center gap-2">
                                                {u.username}
                                                {u.username === roomHost && <span className="badge badge-primary badge-xs">HOST</span>}
                                            </div>
                                            {isHost && u.username !== roomHost && (
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Kick ${u.username}?`)) {
                                                            socket.emit('kick_player', roomId, u.id);
                                                        }
                                                    }} 
                                                    className="btn btn-xs btn-outline btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Kick Player"
                                                >
                                                    Kick
                                                </button>
                                            )}
                                        </div>
                                        {u.character && Object.keys(u.character).length > 0 && (
                                            <div className="text-xs text-base-content/60 font-medium mt-1">
                                                {u.character.character_name}
                                                {u.character.core_stats?.MaxHP ? ` • HP: ${u.character.core_stats.MaxHP}` : ''}
                                            </div>
                                        )}

                                        {u.character && u.character.core_stats && (
                                            <div className="absolute right-full top-0 mr-2 w-48 bg-base-300 border border-base-content/20 p-3 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                <div className="font-bold border-b border-base-content/20 pb-1 mb-2 text-primary">{u.character.character_name}</div>
                                                <div className="grid grid-cols-2 gap-1 text-xs">
                                                    {Object.entries(u.character.core_stats).map(([stat, val]) => (
                                                        <div key={stat}><span className="opacity-70">{stat}:</span> <span className="font-bold">{val}</span></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Turn Order (Only in Combat) */}
                        {isCombat && turnOrder.length > 0 && (
                            <div className="p-4 border-b border-base-300 bg-red-950/20 shrink-0">
                                <h3 className="font-bold text-sm text-error uppercase mb-3 flex items-center justify-between">
                                    <span>Turn Order</span>
                                    {isHost && <button onClick={() => socket.emit('next_turn', roomId)} className="btn btn-xs btn-error">Next</button>}
                                </h3>
                                <ul className="space-y-1">
                                    {turnOrder.map((tokenId, idx) => {
                                        const token = tokens[tokenId];
                                        if (!token) return null;
                                        const isActive = idx === currentTurnIndex;
                                        return (
                                            <li key={tokenId} className={`text-sm font-bold p-2 rounded flex justify-between ${isActive ? 'bg-error text-error-content shadow-lg scale-105' : 'bg-base-200 opacity-70'}`}>
                                                <span>{idx + 1}. {token.name}</span>
                                                {isActive && <span>▶</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* Chat Log */}
                        <div className="flex-grow p-4 overflow-y-auto space-y-2 text-sm bg-base-100/50">
                            {activityLog.map((log, idx) => (
                                <div key={idx}>
                                    {log.type === 'system' ? (
                                        <span className="opacity-50 italic text-xs block">💬 {log.text}</span>
                                    ) : (
                                        <span>
                                            <strong className="text-primary">{log.user}: </strong>
                                            <span dangerouslySetInnerHTML={{ __html: log.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Dice Roller */}
                        <div className="p-3 border-t border-base-300 bg-base-200 shrink-0">
                            <form onSubmit={handleRollDice} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    placeholder="e.g. 2d6 + 1d4 + 2"
                                    className="input input-sm input-bordered flex-grow text-center font-mono font-bold"
                                    value={diceInput}
                                    onChange={(e) => setDiceInput(e.target.value)}
                                />
                                <button type="submit" className="btn btn-sm btn-accent shadow-sm">Roll</button>
                            </form>
                        </div>

                        {/* Chat Input */}
                        <div className="p-4 border-t border-base-300 bg-base-200 shrink-0">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input type="text" placeholder="Message party..." className="input input-sm input-bordered flex-grow" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                                <button type="submit" className="btn btn-sm btn-primary px-4">Send</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Combat Setup Modal */}
            <dialog id="combat_setup_modal" className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-error border-b border-error/20 pb-2 mb-4">Setup Combat Phase</h3>
                    <form onSubmit={setupCombat} className="space-y-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text font-bold">Select Battle Map</span></label>
                            <select className="select select-bordered" value={combatModalMapUrl} onChange={e => setCombatModalMapUrl(e.target.value)}>
                                <option value="/maps/tavern.png">Tavern (Built-in)</option>
                                <option value="/maps/cave.png">Cave (Built-in)</option>
                                <option value="/maps/forest.png">Forest (Built-in)</option>
                                <option value="CUSTOM">Custom URL</option>
                            </select>
                            {combatModalMapUrl === 'CUSTOM' && (
                                <input type="text" className="input input-sm input-bordered w-full mt-2" placeholder="Enter Custom Image URL" value={customMapUrl} onChange={e => setCustomMapUrl(e.target.value)} />
                            )}
                        </div>

                        <div className="divider">Enemies</div>

                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {combatModalEnemyGroups.map((group, index) => (
                                <div key={index} className="grid grid-cols-5 gap-2 items-end bg-base-200 p-2 rounded">
                                    <div className="form-control col-span-2">
                                        <label className="label py-1"><span className="label-text text-xs">Enemy Name</span></label>
                                        <input type="text" className="input input-sm input-bordered w-full" value={group.name}
                                            onChange={e => {
                                                const newGroups = [...combatModalEnemyGroups];
                                                newGroups[index].name = e.target.value;
                                                setCombatModalEnemyGroups(newGroups);
                                            }} required />
                                    </div>
                                     <div className="form-control">
                                        <label className="label py-1"><span className="label-text text-xs">Count</span></label>
                                        <input type="number" min="1" max="20" className="input input-sm input-bordered w-full" value={group.count}
                                            onChange={e => {
                                                const newGroups = [...combatModalEnemyGroups];
                                                newGroups[index].count = parseInt(e.target.value) || 1;
                                                setCombatModalEnemyGroups(newGroups);
                                            }} />
                                    </div>
                                    <div className="form-control">
                                        <label className="label py-1"><span className="label-text text-xs">DEX</span></label>
                                        <div className="flex gap-1">
                                            <input type="number" className="input input-sm input-bordered w-full" value={group.dex}
                                                onChange={e => {
                                                    const newGroups = [...combatModalEnemyGroups];
                                                    newGroups[index].dex = parseInt(e.target.value) || 0;
                                                    setCombatModalEnemyGroups(newGroups);
                                                }} />
                                            {combatModalEnemyGroups.length > 1 && (
                                                <button type="button" className="btn btn-sm btn-error btn-square"
                                                    onClick={() => {
                                                        const newGroups = combatModalEnemyGroups.filter((_, i) => i !== index);
                                                        setCombatModalEnemyGroups(newGroups);
                                                    }}>X</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="btn btn-sm btn-outline btn-block mt-2"
                            onClick={() => setCombatModalEnemyGroups([...combatModalEnemyGroups, { name: 'Orc', count: 1, dex: 1 }])}>
                            + Add Enemy Type
                        </button>

                        <div className="modal-action">
                            <button type="button" className="btn" onClick={() => document.getElementById('combat_setup_modal').close()}>Cancel</button>
                            <button type="submit" className="btn btn-error font-bold">ROLL INITIATIVE & START</button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

        </div>
    );
}

export default Lobby;