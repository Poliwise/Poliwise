import httpx
import json
import asyncio

API_URL = "http://localhost:8086/chat"
HEADERS = {
    "X-User-Id": "00000000-0000-0000-0000-000000000000",
    "X-Role": "ADMIN",
    "Content-Type": "application/json"
}

async def test_chat(question: str):
    payload = {
        "question": question,
        "stream": False
    }
    
    print(f"\n[Testing] Question: {question}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(API_URL, json=payload, headers=HEADERS)
            if response.status_code == 200:
                data = response.json()
                print(f"[Success] Status: {data.get('status')}")
                print(f"[Success] Layer: {data.get('processing_layer')}")
                print(f"[Success] Model: {data.get('model_used')}")
                print(f"[Success] Answer: {data.get('answer')}")
            else:
                print(f"[Error] Code: {response.status_code}")
                print(f"[Error] Detail: {response.text}")
        except Exception as e:
            print(f"[Exception] {str(e)}")

if __name__ == "__main__":
    import sys
    q = "What is the policy for working from home?"
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
    asyncio.run(test_chat(q))
