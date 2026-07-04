"""Test WebSocket game flow with multiple players"""
import pytest
import asyncio
import websockets
import json
import requests
import os

BASE_URL = os.getenv('TEST_BASE_URL', '').rstrip('/')
pytestmark = pytest.mark.skipif(
    not BASE_URL,
    reason='Set TEST_BASE_URL to run live WebSocket integration tests',
)

WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')


class TestWebSocketGame:
    """Test WebSocket game flows"""

    def test_websocket_connection_and_lobby(self):
        """Test WebSocket connection and lobby state"""
        async def test():
            # Create a room first
            response = requests.post(f"{BASE_URL}/api/rooms")
            created = response.json()
            room_id = created["room_id"]
            host_token = created["host_token"]
            print(f"✓ Created room: {room_id}")

            # Connect as player 1 (host)
            ws_url = f"{WS_URL}/api/ws/{room_id}?player_name=Player1&player_id=p1&host_token={host_token}"
            async with websockets.connect(ws_url) as ws1:
                # Receive initial state
                msg = await ws1.recv()
                state = json.loads(msg)
                
                assert state['type'] == 'state'
                assert state['phase'] == 'waiting'
                assert len(state['players']) == 1
                assert state['players'][0]['name'] == 'Player1'
                assert state['players'][0]['is_host'] is True
                print("✓ Player 1 connected and received waiting state")

                # Connect as player 2
                ws_url2 = f"{WS_URL}/api/ws/{room_id}?player_name=Player2&player_id=p2"
                async with websockets.connect(ws_url2) as ws2:
                    # Both players should receive updated state
                    msg1 = await ws1.recv()
                    state1 = json.loads(msg1)
                    
                    msg2 = await ws2.recv()
                    state2 = json.loads(msg2)
                    
                    assert len(state1['players']) == 2
                    assert len(state2['players']) == 2
                    print("✓ Player 2 connected, both received updated state")

                    # Connect player 3
                    ws_url3 = f"{WS_URL}/api/ws/{room_id}?player_name=Player3&player_id=p3"
                    async with websockets.connect(ws_url3) as ws3:
                        # All players receive state
                        await ws1.recv()
                        await ws2.recv()
                        msg3 = await ws3.recv()
                        state3 = json.loads(msg3)
                        
                        assert len(state3['players']) == 3
                        assert state3['phase'] == 'waiting'
                        print("✓ Player 3 connected, 3 players in lobby")

                        # Host starts the game
                        await ws1.send(json.dumps({"action": "start_game"}))
                        
                        # All players should receive game start state
                        msg1 = await ws1.recv()
                        state1 = json.loads(msg1)
                        
                        assert state1['phase'] == 'bidding'
                        assert state1['current_round'] == 1
                        assert state1['trump_suit'] in ['hearts', 'spades', 'diamonds', 'clubs']
                        assert len(state1['your_hand']) > 0
                        print(f"✓ Game started! Phase: {state1['phase']}, Round: {state1['current_round']}, Trump: {state1['trump_suit']}")
                        print(f"✓ Player 1 has {len(state1['your_hand'])} cards")

        asyncio.run(test())

    def test_bidding_phase(self):
        """Test bidding phase with dealer restriction"""
        async def test():
            # Create room and connect 3 players
            response = requests.post(f"{BASE_URL}/api/rooms")
            created = response.json()
            room_id = created["room_id"]
            host_token = created["host_token"]

            ws_url1 = f"{WS_URL}/api/ws/{room_id}?player_name=P1&player_id=p1&host_token={host_token}"
            ws_url2 = f"{WS_URL}/api/ws/{room_id}?player_name=P2&player_id=p2"
            ws_url3 = f"{WS_URL}/api/ws/{room_id}?player_name=P3&player_id=p3"

            async with websockets.connect(ws_url1) as ws1, \
                       websockets.connect(ws_url2) as ws2, \
                       websockets.connect(ws_url3) as ws3:
                
                # Clear initial states
                await ws1.recv()
                await ws1.recv()
                await ws2.recv()
                await ws1.recv()
                await ws2.recv()
                await ws3.recv()

                # Start game
                await ws1.send(json.dumps({"action": "start_game"}))
                
                # Get game state
                msg1 = await ws1.recv()
                msg2 = await ws2.recv()
                msg3 = await ws3.recv()
                
                state1 = json.loads(msg1)
                state2 = json.loads(msg2)
                state3 = json.loads(msg3)

                print(f"✓ Game started, phase: {state1['phase']}")
                
                # Determine bidding order
                current_player = state1['current_player_index']
                print(f"✓ Current player to bid: {current_player}")

                # First player bids
                if current_player == 0:
                    await ws1.send(json.dumps({"action": "place_bid", "bid": 2}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()
                elif current_player == 1:
                    await ws2.send(json.dumps({"action": "place_bid", "bid": 2}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()
                else:
                    await ws3.send(json.dumps({"action": "place_bid", "bid": 2}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()

                state = json.loads(msg)
                print(f"✓ First bid placed, current player now: {state['current_player_index']}")

                # Second player bids
                current_player = state['current_player_index']
                if current_player == 0:
                    await ws1.send(json.dumps({"action": "place_bid", "bid": 1}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()
                elif current_player == 1:
                    await ws2.send(json.dumps({"action": "place_bid", "bid": 1}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()
                else:
                    await ws3.send(json.dumps({"action": "place_bid", "bid": 1}))
                    await ws1.recv()
                    await ws2.recv()
                    msg = await ws3.recv()

                state = json.loads(msg)
                print(f"✓ Second bid placed")

                # Check dealer restriction
                cards_this_round = state['cards_this_round']
                restricted_bids = state.get('restricted_bids', [])
                expected_restricted = cards_this_round - 3  # 2 + 1 = 3
                
                if 0 <= expected_restricted <= cards_this_round:
                    assert expected_restricted in restricted_bids
                    print(f"✓ Dealer restriction working: can't bid {expected_restricted}")

                # Third player (dealer) bids - avoid restricted bid
                current_player = state['current_player_index']
                dealer_bid = 0 if 0 not in restricted_bids else 3
                
                if current_player == 0:
                    await ws1.send(json.dumps({"action": "place_bid", "bid": dealer_bid}))
                    msg = await ws1.recv()
                elif current_player == 1:
                    await ws2.send(json.dumps({"action": "place_bid", "bid": dealer_bid}))
                    msg = await ws2.recv()
                else:
                    await ws3.send(json.dumps({"action": "place_bid", "bid": dealer_bid}))
                    msg = await ws3.recv()

                state = json.loads(msg)
                assert state['phase'] == 'playing'
                print(f"✓ All bids placed, phase changed to: {state['phase']}")

        asyncio.run(test())

    def test_invalid_bid_error(self):
        """Test that invalid bids return error messages"""
        async def test():
            response = requests.post(f"{BASE_URL}/api/rooms")
            created = response.json()
            room_id = created["room_id"]
            host_token = created["host_token"]

            ws_url = f"{WS_URL}/api/ws/{room_id}?player_name=P1&player_id=p1&host_token={host_token}"
            async with websockets.connect(ws_url) as ws:
                await ws.recv()  # Initial state
                
                # Try to bid when not in bidding phase
                await ws.send(json.dumps({"action": "place_bid", "bid": 5}))
                msg = await ws.recv()
                response = json.loads(msg)
                
                assert response['type'] == 'error'
                assert 'bidding' in response['message'].lower()
                print(f"✓ Error message for invalid bid: {response['message']}")

        asyncio.run(test())

    def test_room_full_error(self):
        """Test that 8th player cannot join (max 7)"""
        async def test():
            response = requests.post(f"{BASE_URL}/api/rooms")
            created = response.json()
            room_id = created["room_id"]
            host_token = created["host_token"]

            # Connect 7 players
            connections = []
            for i in range(7):
                host_query = f"&host_token={host_token}" if i == 0 else ""
                ws_url = f"{WS_URL}/api/ws/{room_id}?player_name=P{i+1}&player_id=p{i+1}{host_query}"
                ws = await websockets.connect(ws_url)
                connections.append(ws)
                await ws.recv()  # Receive state
                # Clear broadcast messages
                for conn in connections[:-1]:
                    try:
                        await asyncio.wait_for(conn.recv(), timeout=0.1)
                    except:
                        pass

            print(f"✓ Connected 7 players successfully")

            # Try to connect 8th player
            ws_url8 = f"{WS_URL}/api/ws/{room_id}?player_name=P8&player_id=p8"
            ws8 = await websockets.connect(ws_url8)
            msg = await ws8.recv()
            response = json.loads(msg)
            
            assert response['type'] == 'error'
            assert 'full' in response['message'].lower() or '7' in response['message']
            print(f"✓ 8th player rejected: {response['message']}")

            # Close all connections
            for conn in connections:
                await conn.close()
            await ws8.close()

        asyncio.run(test())
