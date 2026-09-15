import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.post("http://localhost:8000/api/chat/send", json={
            "session_id": "test-session-123",
            "message": "How does Elena Verna define Product-Led Growth?",
            "provider": "ollama",
            "model": "llama3.2"
        }, timeout=30.0)
        print("STATUS:", res.status_code)
        print("RESPONSE:", res.json())

if __name__ == "__main__":
    asyncio.run(main())
