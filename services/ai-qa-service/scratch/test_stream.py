import requests
import json
import sys

# Configure stdout to handle UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def test_chat_stream():
    url = "http://localhost:8086/chat/stream"
    headers = {
        "Content-Type": "application/json",
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
        "X-Role": "ADMIN"
    }
    data = {
        "question": "Hãy giải thích ngắn gọn về Poliwise.",
        "model_id": "groq"
    }
    
    print(f"POST {url} with data: {data}")
    try:
        response = requests.post(url, headers=headers, json=data, stream=True, timeout=30)
        print(f"Response Status: {response.status_code}")
        
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    data_str = line_text[6:]
                    if data_str == "[DONE]":
                        print("\n[DONE]")
                        break
                    try:
                        chunk = json.loads(data_str)
                        if "content" in chunk:
                            print(chunk["content"], end="", flush=True)
                        elif "conversationId" in chunk:
                            print(f"\nConversation ID: {chunk['conversationId']}\n")
                    except json.JSONDecodeError:
                        print(f"\nRaw chunk: {data_str}")
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    test_chat_stream()
