import google.generativeai as genai
import os

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

model_name = 'gemini-flash-latest'
print(f"Testing model: {model_name}")
try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hello")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error with {model_name}: {e}")
