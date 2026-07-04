"""Test REST API endpoints for room creation and checking"""
import pytest
import requests
import os

BASE_URL = os.getenv('TEST_BASE_URL', '').rstrip('/')
pytestmark = pytest.mark.skipif(
    not BASE_URL,
    reason='Set TEST_BASE_URL to run live HTTP integration tests',
)


class TestRoomAPI:
    """Test room creation and existence checking endpoints"""

    def test_root_endpoint(self):
        """Test API root endpoint returns correct message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Judgement" in data["message"]
        print("✓ Root endpoint working")

    def test_create_room_success(self):
        """Test room creation returns valid room_id"""
        response = requests.post(f"{BASE_URL}/api/rooms")
        assert response.status_code == 200
        data = response.json()
        assert "room_id" in data
        assert len(data["room_id"]) == 4
        assert data["room_id"].isupper()
        assert isinstance(data["host_token"], str)
        assert len(data["host_token"]) >= 32
        print(f"✓ Room created: {data['room_id']}")

    def test_create_multiple_rooms_unique_ids(self):
        """Test that multiple room creations return unique IDs"""
        room_ids = set()
        for _ in range(5):
            response = requests.post(f"{BASE_URL}/api/rooms")
            assert response.status_code == 200
            data = response.json()
            room_ids.add(data["room_id"])
        assert len(room_ids) == 5
        print(f"✓ Created 5 unique rooms: {room_ids}")

    def test_check_room_exists_valid_room(self):
        """Test checking existence of a valid room"""
        # Create a room first
        create_response = requests.post(f"{BASE_URL}/api/rooms")
        room_id = create_response.json()["room_id"]
        
        # Check if it exists
        check_response = requests.get(f"{BASE_URL}/api/rooms/{room_id}/exists")
        assert check_response.status_code == 200
        data = check_response.json()
        assert "exists" in data
        assert "joinable" in data
        assert data["exists"] is True
        assert data["joinable"] is True
        print(f"✓ Room {room_id} exists and is joinable")

    def test_check_room_nonexistent(self):
        """Test checking existence of a non-existent room"""
        response = requests.get(f"{BASE_URL}/api/rooms/ZZZZ/exists")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False
        assert data["joinable"] is False
        print("✓ Non-existent room correctly reported")

    def test_check_room_case_insensitive(self):
        """Test that room code checking is case-insensitive"""
        # Create a room
        create_response = requests.post(f"{BASE_URL}/api/rooms")
        room_id = create_response.json()["room_id"]
        
        # Check with lowercase
        check_response = requests.get(f"{BASE_URL}/api/rooms/{room_id.lower()}/exists")
        assert check_response.status_code == 200
        data = check_response.json()
        assert data["exists"] is True
        print(f"✓ Room code is case-insensitive")
