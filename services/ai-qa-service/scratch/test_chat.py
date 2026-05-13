
import httpx
import asyncio
import json

async def test_chat():
    url = "http://localhost:8086/chat"
    headers = {
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
        "X-Role": "ADMIN",
        "X-Department-Id": "00000000-0000-0000-0000-000000000001"
    }
    payload = {
        "question": "Hello, who are you?",
        "model_id": "default"
    }
    
    print(f"Testing {url}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

async def test_chat_stream():
    url = "http://localhost:8086/chat/stream"
    headers = {
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
        "X-Role": "ADMIN",
        "X-Department-Id": "00000000-0000-0000-0000-000000000001"
    }
    payload = {
        "question": "Tell me a short joke.",
        "model_id": "default"
    }
    
    print(f"\nTesting {url}...")
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, headers=headers, json=payload, timeout=30.0) as response:
                print(f"Status: {response.status_code}")
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            print("\n[DONE]")
                            break
                        try:
                            parsed = json.loads(data)
                            if "content" in parsed:
                                print(parsed["content"], end="", flush=True)
                            elif "conversationId" in parsed:
                                print(f"\nConv ID: {parsed['conversationId']}")
                        except:
                            print(f"\nRaw data: {data}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Note: This assumes the server is running on port 8086
    # You might need to start it first: python -m src.main
    asyncio.run(test_chat())
    asyncio.run(test_chat_stream())
