"""Pytest configuration and shared fixtures"""
import pytest
import requests


@pytest.fixture
def api_client():
    """Shared requests session for API calls"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
