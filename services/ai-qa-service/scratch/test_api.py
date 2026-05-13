import requests
import json
import sys

# Configure stdout to handle UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def test_health():
    url = "http://localhost:8086/health"
    response = requests.get(url)
    print(f"GET {url} -> {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_chat():
    url = "http://localhost:8086/chat"
    headers = {
        "Content-Type": "application/json",
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
        "X-Role": "ADMIN"
    }
    data = {
        "question": "Xin chào, bạn là ai?",
        "model_id": "groq"
    }
    
    print(f"POST {url} with data: {data}")
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        print(f"Response Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_health()
    print("-" * 20)
    test_chat()
